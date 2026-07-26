import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CaregiverService } from '../../../caregiver/caregiver.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ScheduleMode } from '@prisma/client';
import { CreateLibraryScheduleDto } from '../dto/create-library-schedule.dto';
import { CreateManualScheduleDto } from '../dto/create-manual-schedule.dto';
import { ScheduleQueryDto } from '../dto/schedule-query.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
  ) {}

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
    await this.caregiverService.assertChildPermission(
      userId,
      childId,
      'manageDailyPlans',
    );
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
    const accessibleChildIds =
      await this.caregiverService.getAccessibleChildIds(userId);

    if (query.childId && !accessibleChildIds.includes(query.childId)) {
      throw new ForbiddenException('You do not have access to this child');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const today = this.resolveDate();
    const filterDate = query.date ? this.resolveDate(query.date) : undefined;

    const whereBase = {
      childId: query.childId
        ? query.childId
        : { in: accessibleChildIds },
    };

    const todayWhere = {
      ...whereBase,
      date: filterDate ?? today,
    };

    const otherWhere = {
      ...whereBase,
      ...(filterDate ? { id: 'skip' } : { date: { not: today } }), // if specific date is requested, otherSchedules is empty
    };

    const includeRelations = {
      child: { select: { id: true, name: true, avatar: true } },
      activity: {
        select: { id: true, title: true, activityType: true, imageUrl: true },
      },
      recipe: {
        select: { id: true, title: true, recipeMealType: true, imageUrl: true },
      },
    };

    const [todaySchedules, otherSchedules, todayCount, otherCount] = await Promise.all([
      this.prisma.childSchedule.findMany({
        where: todayWhere,
        include: includeRelations,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),

      filterDate 
        ? Promise.resolve([] as any[]) 
        : this.prisma.childSchedule.findMany({
            where: otherWhere,
            include: includeRelations,
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            skip,
            take: limit,
          }),

      this.prisma.childSchedule.count({ where: todayWhere }),
      
      filterDate 
        ? Promise.resolve(0) 
        : this.prisma.childSchedule.count({ where: otherWhere }),
    ]);

    return {
      message: 'Schedules fetched successfully',
      data: {
        todaySchedules: this.formatSchedules(todaySchedules),
        otherSchedules: this.formatSchedules(otherSchedules),
      },
      meta: {
        todaySchedules: {
          total: todayCount,
          page,
          limit,
          totalPages: Math.ceil(todayCount / limit),
        },
        otherSchedules: {
          total: otherCount,
          page,
          limit,
          totalPages: Math.ceil(otherCount / limit),
        },
      },
    };
  }

  async getScheduleById(userId: string, scheduleId: string) {
    const schedule = await this.prisma.childSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        child: { select: { id: true, name: true, avatar: true } },
        activity: {
          select: { id: true, title: true, activityType: true, imageUrl: true },
        },
        recipe: {
          select: { id: true, title: true, recipeMealType: true, imageUrl: true },
        },
      },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');
    const accessibleChildIds =
      await this.caregiverService.getAccessibleChildIds(userId);
    if (!accessibleChildIds.includes(schedule.childId))
      throw new ForbiddenException('You do not have access to this schedule');

    return {
      message: 'Schedule fetched successfully',
      data: this.formatSchedules([schedule])[0],
    };
  }

  async updateSchedule(userId: string, scheduleId: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.childSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.caregiverService.assertChildPermission(
      userId,
      schedule.childId,
      'manageDailyPlans',
    );

    let libraryData: any = {};

    if (dto.libraryItemId && dto.libraryItemType) {
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

      const libraryItem = dto.libraryItemType === 'activity' ? activity : recipe;

      if (!libraryItem) {
        throw new NotFoundException(
          `${dto.libraryItemType === 'activity' ? 'Activity' : 'Recipe'} not found in library`,
        );
      }

      libraryData = {
        title: libraryItem.title,
        category:
          dto.libraryItemType === 'activity'
            ? this.mapActivityCategory((activity as any).activityType)
            : this.mapRecipeCategory((recipe as any).recipeMealType),
        activityId: dto.libraryItemType === 'activity' ? dto.libraryItemId : null,
        recipeId: dto.libraryItemType === 'recipe' ? dto.libraryItemId : null,
        mode: ScheduleMode.LIBRARY,
      };
    }

    const scheduleDate = dto.date ? this.resolveDate(dto.date) : undefined;

    const updated = await this.prisma.childSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.category && { category: dto.category }),
        ...(scheduleDate && { date: scheduleDate }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...libraryData,
      },
    });

    return {
      message: 'Schedule updated successfully',
      data: updated,
    };
  }

  async deleteSchedule(userId: string, scheduleId: string) {
    const schedule = await this.prisma.childSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.caregiverService.assertChildPermission(
      userId,
      schedule.childId,
      'manageDailyPlans',
    );

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
