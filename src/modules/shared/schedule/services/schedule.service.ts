import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ScheduleMode } from '@prisma/client';
import { CreateLibraryScheduleDto } from '../dto/create-library-schedule.dto';
import { CreateManualScheduleDto } from '../dto/create-manual-schedule.dto';
import { ScheduleQueryDto } from '../dto/schedule-query.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveDate(dateStr?: string): Date {
    if (!dateStr) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return today;
    }
    const d = new Date(dateStr);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async assertChildOwnership(
    childId: string,
    userId: string,
  ): Promise<void> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { parentUserId: true },
    });
    if (!child) throw new NotFoundException('Child not found');
    if (child.parentUserId !== userId)
      throw new ForbiddenException('You do not have access to this child');
  }

  async createFromLibrary(userId: string, dto: CreateLibraryScheduleDto) {
    await this.assertChildOwnership(dto.childId, userId);

    const scheduleDate = this.resolveDate(dto.date);

    const [activity, recipe] = await this.prisma.$transaction([
      dto.libraryItemType === 'activity'
        ? this.prisma.activity.findUnique({
            where: { id: dto.libraryItemId, isActive: true },
            select: { id: true, title: true, activityType: true },
          })
        : this.prisma.activity.findUnique({
            where: { id: 'non-existent' },
            select: { id: true, title: true, activityType: true },
          }),

      dto.libraryItemType === 'recipe'
        ? this.prisma.recipe.findUnique({
            where: { id: dto.libraryItemId, isActive: true },
            select: { id: true, title: true, recipeMealType: true },
          })
        : this.prisma.recipe.findUnique({
            where: { id: 'non-existent' },
            select: { id: true, title: true, recipeMealType: true },
          }),
    ]);

    const libraryItem =
      dto.libraryItemType === 'activity' ? activity : recipe;

    if (!libraryItem) {
      throw new NotFoundException(
        `${dto.libraryItemType === 'activity' ? 'Activity' : 'Recipe'} not found in library`,
      );
    }

    const schedule = await this.prisma.childSchedule.create({
      data: {
        childId: dto.childId,
        userId,
        date: scheduleDate,
        mode: ScheduleMode.LIBRARY,
        title: libraryItem.title,
        category:
          dto.libraryItemType === 'activity'
            ? this.mapActivityCategory((activity as any).activityType)
            : this.mapRecipeCategory((recipe as any).recipeMealType),
        startTime: dto.startTime,
        endTime: dto.endTime,
        description: dto.description,
        activityId:
          dto.libraryItemType === 'activity' ? dto.libraryItemId : undefined,
        recipeId:
          dto.libraryItemType === 'recipe' ? dto.libraryItemId : undefined,
      },
    });

    return {
      message: 'Schedule created from library successfully',
      data: schedule,
    };
  }

  async createManual(userId: string, dto: CreateManualScheduleDto) {
    await this.assertChildOwnership(dto.childId, userId);

    const scheduleDate = this.resolveDate(dto.date);

    const schedule = await this.prisma.childSchedule.create({
      data: {
        childId: dto.childId,
        userId,
        date: scheduleDate,
        mode: ScheduleMode.CUSTOM,
        title: dto.title,
        category: dto.category,
        startTime: dto.startTime,
        endTime: dto.endTime,
        description: dto.description,
      },
    });

    return {
      message: 'Manual schedule created successfully',
      data: schedule,
    };
  }

  async getSchedules(userId: string, query: ScheduleQueryDto) {
    const targetDate = this.resolveDate(query.date);
    const today = this.resolveDate();

    const whereBase = {
      userId,
      ...(query.childId && { childId: query.childId }),
    };

    const [todaySchedules, otherSchedules] = await this.prisma.$transaction([
      this.prisma.childSchedule.findMany({
        where: {
          ...whereBase,
          date: today,
        },
        include: {
          child: { select: { id: true, name: true, avatar: true } },
          activity: {
            select: { id: true, title: true, activityType: true, imageUrl: true },
          },
          recipe: {
            select: { id: true, title: true, recipeMealType: true, imageUrl: true },
          },
        },
        orderBy: { startTime: 'asc' },
      }),

      this.prisma.childSchedule.findMany({
        where: {
          ...whereBase,
          date: { not: today },
        },
        include: {
          child: { select: { id: true, name: true, avatar: true } },
          activity: {
            select: { id: true, title: true, activityType: true, imageUrl: true },
          },
          recipe: {
            select: { id: true, title: true, recipeMealType: true, imageUrl: true },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    return {
      message: 'Schedules fetched successfully',
      data: {
        todaySchedules: this.formatSchedules(todaySchedules),
        otherSchedules: this.formatSchedules(otherSchedules),
      },
    };
  }

  async deleteSchedule(userId: string, scheduleId: string) {
    const schedule = await this.prisma.childSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.userId !== userId)
      throw new ForbiddenException('You do not have access to this schedule');

    await this.prisma.childSchedule.delete({ where: { id: scheduleId } });

    return { message: 'Schedule deleted successfully' };
  }

  private formatSchedules(schedules: any[]) {
    return schedules.map((s) => ({
      id: s.id,
      mode: s.mode,
      title: s.title,
      category: s.category,
      startTime: s.startTime,
      endTime: s.endTime,
      description: s.description,
      date: s.date,
      child: s.child,
      libraryRef:
        s.mode === ScheduleMode.LIBRARY
          ? s.activityId
            ? { type: 'activity', ...s.activity }
            : { type: 'recipe', ...s.recipe }
          : null,
    }));
  }

  private mapActivityCategory(activityType: string) {
    const map: Record<string, string> = {
      STORY_TIME: 'OTHER',
      CREATIVE_PLAY: 'ACTIVITY',
      LEARNING_DEVELOPMENT: 'HOME_STUDY',
      OUTDOOR_PLAY: 'ACTIVITY',
      MUSIC: 'ACTIVITY',
      ART: 'ACTIVITY',
      OTHER: 'OTHER',
    };
    return (map[activityType] ?? 'OTHER') as any;
  }

  private mapRecipeCategory(mealType: string) {
    const map: Record<string, string> = {
      BREAKFAST: 'RECIPE',
      LUNCH: 'RECIPE',
      DINNER: 'RECIPE',
      SNACK: 'RECIPE',
      FAMILY: 'RECIPE',
      OTHER: 'RECIPE',
    };
    return (map[mealType] ?? 'RECIPE') as any;
  }
}
