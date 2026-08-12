import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CaregiverService } from '../../../caregiver/caregiver.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ScheduleMode, DayOfWeek } from '@prisma/client';
import { CreateLibraryScheduleDto } from '../dto/create-library-schedule.dto';
import { CreateManualScheduleDto } from '../dto/create-manual-schedule.dto';
import { ScheduleQueryDto, ScheduleView } from '../dto/schedule-query.dto';
import { UpdateLibraryScheduleDto } from '../dto/update-library-schedule.dto';
import { UpdateManualScheduleDto } from '../dto/update-manual-schedule.dto';

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

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  private async checkScheduleOverlap(
    childId: string,
    date: Date,
    startTimeStr: string,
    endTimeStr?: string,
    excludeScheduleId?: string,
  ): Promise<void> {
    if (!startTimeStr || !endTimeStr) return;

    const startMinutes = this.timeToMinutes(startTimeStr);
    const endMinutes = this.timeToMinutes(endTimeStr);

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('Start time must be before end time');
    }

    const existingSchedules = await this.prisma.childSchedule.findMany({
      where: {
        childId,
        date,
        id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
      },
      select: { startTime: true, endTime: true, title: true },
    });

    for (const schedule of existingSchedules) {
      if (!schedule.startTime || !schedule.endTime) continue;

      const existingStart = this.timeToMinutes(schedule.startTime);
      const existingEnd = this.timeToMinutes(schedule.endTime);

      if (startMinutes < existingEnd && endMinutes > existingStart) {
        throw new BadRequestException(
          `Schedule time overlaps with an existing schedule: '${schedule.title}' (${schedule.startTime} - ${schedule.endTime})`
        );
      }
    }

    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: DayOfWeek.SUN,
      1: DayOfWeek.MON,
      2: DayOfWeek.TUE,
      3: DayOfWeek.WED,
      4: DayOfWeek.THU,
      5: DayOfWeek.FRI,
      6: DayOfWeek.SAT,
    };
    const dayOfWeek = dayOfWeekMap[date.getUTCDay()];

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        schoolSchedule: true,
        naps: true,
        recurringActivities: {
          where: { days: { has: dayOfWeek } },
        },
      },
    });

    if (child) {
      if (child.wakeUpTime && child.bedTime) {
        const wakeUp = this.timeToMinutes(child.wakeUpTime);
        const bed = this.timeToMinutes(child.bedTime);
        if (startMinutes < wakeUp || endMinutes > bed) {
          throw new BadRequestException(
            `Schedule must be within child's wake up (${child.wakeUpTime}) and bed (${child.bedTime}) times`
          );
        }
      }

      if (child.schoolSchedule && child.schoolSchedule.days.includes(dayOfWeek)) {
        const schStart = this.timeToMinutes(child.schoolSchedule.startTime);
        const schEnd = this.timeToMinutes(child.schoolSchedule.endTime);
        if (startMinutes < schEnd && endMinutes > schStart) {
          throw new BadRequestException(
            `Schedule time overlaps with school schedule (${child.schoolSchedule.startTime} - ${child.schoolSchedule.endTime})`
          );
        }
      }

      for (const nap of child.naps) {
        const napStart = this.timeToMinutes(nap.startTime);
        const napEnd = this.timeToMinutes(nap.endTime);
        if (startMinutes < napEnd && endMinutes > napStart) {
          throw new BadRequestException(
            `Schedule time overlaps with a nap time (${nap.startTime} - ${nap.endTime})`
          );
        }
      }

      for (const activity of child.recurringActivities) {
        const actStart = this.timeToMinutes(activity.startTime);
        const actEnd = this.timeToMinutes(activity.endTime);
        if (startMinutes < actEnd && endMinutes > actStart) {
          throw new BadRequestException(
            `Schedule time overlaps with recurring activity: '${activity.name}' (${activity.startTime} - ${activity.endTime})`
          );
        }
      }
    }
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
    await this.checkScheduleOverlap(dto.childId, scheduleDate, dto.startTime, dto.endTime);

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
    await this.checkScheduleOverlap(dto.childId, scheduleDate, dto.startTime, dto.endTime);

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
    const selectedDate = query.date ? this.resolveDate(query.date) : today;
    const view = query.view ?? ScheduleView.ALL;

    const whereBase = {
      childId: query.childId ? query.childId : { in: accessibleChildIds },
    };

    const todayWhere = {
      ...whereBase,
      date: today,
    };

    const dateWhere = {
      ...whereBase,
      date: selectedDate,
    };

    const upcomingWhere = {
      ...whereBase,
      date: { gt: today },
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

    const shouldFetchToday =
      view === ScheduleView.ALL || view === ScheduleView.TODAY;
    const shouldFetchDate =
      view === ScheduleView.ALL || view === ScheduleView.DATE;
    const shouldFetchUpcoming =
      view === ScheduleView.ALL || view === ScheduleView.UPCOMING;

    const [
      todaySchedules,
      dateSchedules,
      upcomingSchedules,
      todayCount,
      dateCount,
      upcomingCount,
    ] = await Promise.all([
      shouldFetchToday
        ? this.prisma.childSchedule.findMany({
            where: todayWhere,
            include: includeRelations,
            orderBy: { startTime: 'asc' },
            skip,
            take: limit,
          })
        : Promise.resolve([]),

      shouldFetchDate
        ? this.prisma.childSchedule.findMany({
            where: dateWhere,
            include: includeRelations,
            orderBy: { startTime: 'asc' },
            skip,
            take: limit,
          })
        : Promise.resolve([]),

      shouldFetchUpcoming
        ? this.prisma.childSchedule.findMany({
            where: upcomingWhere,
            include: includeRelations,
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            skip,
            take: limit,
          })
        : Promise.resolve([]),

      shouldFetchToday
        ? this.prisma.childSchedule.count({ where: todayWhere })
        : Promise.resolve(0),

      shouldFetchDate
        ? this.prisma.childSchedule.count({ where: dateWhere })
        : Promise.resolve(0),

      shouldFetchUpcoming
        ? this.prisma.childSchedule.count({ where: upcomingWhere })
        : Promise.resolve(0),
    ]);

    const formattedUpcomingSchedules = this.formatSchedules(upcomingSchedules);

    return {
      message: 'Schedules fetched successfully',
      data: {
        todaySchedules: this.formatSchedules(todaySchedules),
        dateSchedules: this.formatSchedules(dateSchedules),
        upcomingSchedules: formattedUpcomingSchedules,
        otherSchedules: formattedUpcomingSchedules,
      },
      meta: {
        view,
        selectedDate,
        todaySchedules: {
          total: todayCount,
          page,
          limit,
          totalPages: Math.ceil(todayCount / limit),
        },
        dateSchedules: {
          total: dateCount,
          page,
          limit,
          totalPages: Math.ceil(dateCount / limit),
        },
        upcomingSchedules: {
          total: upcomingCount,
          page,
          limit,
          totalPages: Math.ceil(upcomingCount / limit),
        },
        otherSchedules: {
          total: upcomingCount,
          page,
          limit,
          totalPages: Math.ceil(upcomingCount / limit),
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
          select: {
            id: true,
            title: true,
            recipeMealType: true,
            imageUrl: true,
          },
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

  async updateLibrarySchedule(
    userId: string,
    scheduleId: string,
    dto: UpdateLibraryScheduleDto,
  ) {
    const schedule = await this.prisma.childSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.caregiverService.assertChildPermission(
      userId,
      schedule.childId,
      'manageDailyPlans',
    );

    if (schedule.mode !== ScheduleMode.LIBRARY) {
      throw new BadRequestException('This schedule is not a library schedule');
    }

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

      const libraryItem =
        dto.libraryItemType === 'activity' ? activity : recipe;

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
        activityId:
          dto.libraryItemType === 'activity' ? dto.libraryItemId : null,
        recipeId: dto.libraryItemType === 'recipe' ? dto.libraryItemId : null,
        mode: ScheduleMode.LIBRARY,
      };
    }

    const scheduleDate = dto.date ? this.resolveDate(dto.date) : schedule.date;
    const finalStartTime = dto.startTime ?? schedule.startTime;
    const finalEndTime = dto.endTime !== undefined ? dto.endTime : schedule.endTime;

    await this.checkScheduleOverlap(
      schedule.childId,
      scheduleDate,
      finalStartTime,
      finalEndTime ?? undefined,
      scheduleId
    );

    const updated = await this.prisma.childSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(scheduleDate && { date: scheduleDate }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...libraryData,
      },
    });

    return {
      message: 'Library schedule updated successfully',
      data: updated,
    };
  }

  async updateManualSchedule(
    userId: string,
    scheduleId: string,
    dto: UpdateManualScheduleDto,
  ) {
    const schedule = await this.prisma.childSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.userId !== userId)
      throw new ForbiddenException('You do not have access to this schedule');

    if (schedule.mode !== ScheduleMode.CUSTOM) {
      throw new BadRequestException('This schedule is not a manual schedule');
    }

    const scheduleDate = dto.date ? this.resolveDate(dto.date) : schedule.date;
    const finalStartTime = dto.startTime ?? schedule.startTime;
    const finalEndTime = dto.endTime !== undefined ? dto.endTime : schedule.endTime;

    await this.checkScheduleOverlap(
      schedule.childId,
      scheduleDate,
      finalStartTime,
      finalEndTime ?? undefined,
      scheduleId
    );

    const updated = await this.prisma.childSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.category && { category: dto.category }),
        ...(scheduleDate && { date: scheduleDate }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    return {
      message: 'Manual schedule updated successfully',
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
