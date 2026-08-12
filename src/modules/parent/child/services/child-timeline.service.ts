import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ScheduleMode } from '@prisma/client';
import { ChildDailyTimelineQueryDto } from '../dto/child-daily-timeline-query.dto';

@Injectable()
export class ChildTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getChildDailyTimeline(
    parentUserId: string,
    childId: string,
    query: ChildDailyTimelineQueryDto,
  ) {
    // 1. Validate child ownership
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        schoolSchedule: true,
        naps: true,
      },
    });

    if (!child) throw new NotFoundException('Child not found');
    if (child.parentUserId !== parentUserId)
      throw new ForbiddenException('You do not have access to this child');

    // 2. Resolve target date
    const targetDate = query.date ? new Date(query.date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    // 3. Determine day of week for school schedule check
    // getUTCDay(): 0=Sun, 1=Mon, ..., 6=Sat
    const dayIndexMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayOfWeek = dayIndexMap[targetDate.getUTCDay()];

    // 4. Fetch child schedules for that date
    const childSchedules = await this.prisma.childSchedule.findMany({
      where: {
        childId,
        date: targetDate,
      },
      include: {
        activity: {
          select: { id: true, title: true, activityType: true, imageUrl: true },
        },
        recipe: {
          select: { id: true, title: true, recipeMealType: true, imageUrl: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // 5. Format schedule items
    const scheduleItems = childSchedules.map((s) => ({
      id: s.id,
      type: 'SCHEDULE' as const,
      category: s.category,
      mode: s.mode,
      title: s.title,
      description: s.description,
      startTime: s.startTime,
      endTime: s.endTime ?? null,
      libraryRef:
        s.mode === ScheduleMode.LIBRARY
          ? s.activityId
            ? {
                type: 'activity',
                id: s.activity?.id,
                title: s.activity?.title,
                activityType: s.activity?.activityType,
                imageUrl: s.activity?.imageUrl ?? null,
              }
            : {
                type: 'recipe',
                id: s.recipe?.id,
                title: s.recipe?.title,
                recipeMealType: s.recipe?.recipeMealType,
                imageUrl: s.recipe?.imageUrl ?? null,
              }
          : null,
    }));

    // 6. Build timeline: merge fixed items (wakeUp, school, naps, bedtime) with schedules
    const timeline: Array<Record<string, any>> = [];

    // Wake up anchor
    if (child.wakeUpTime) {
      timeline.push({
        id: `wake-up-${childId}`,
        type: 'WAKE_UP',
        title: 'Wake up',
        startTime: child.wakeUpTime,
        endTime: null,
        category: null,
        mode: null,
        libraryRef: null,
      });
    }

    // School time (if school schedule exists and today is a school day)
    if (
      child.schoolSchedule &&
      (child.schoolSchedule.days as string[]).includes(dayOfWeek)
    ) {
      timeline.push({
        id: `school-${child.schoolSchedule.id}`,
        type: 'SCHOOL',
        title: 'School time',
        startTime: child.schoolSchedule.startTime,
        endTime: child.schoolSchedule.endTime,
        category: null,
        mode: null,
        libraryRef: null,
      });
    }

    // Nap windows (recurring)
    for (const nap of child.naps) {
      timeline.push({
        id: `nap-${nap.id}`,
        type: 'NAP',
        title: 'Nap',
        startTime: nap.startTime,
        endTime: nap.endTime,
        category: 'NAP',
        mode: null,
        libraryRef: null,
      });
    }

    // Add all user-created schedules for this date
    for (const item of scheduleItems) {
      timeline.push(item);
    }

    // Bedtime anchor
    if (child.bedTime) {
      timeline.push({
        id: `bedtime-${childId}`,
        type: 'BEDTIME',
        title: 'Bedtime',
        startTime: child.bedTime,
        endTime: null,
        category: 'BEDTIME',
        mode: null,
        libraryRef: null,
      });
    }

    // 7. Sort timeline by startTime (HH:mm string comparison works for same-day sorting)
    timeline.sort((a, b) => {
      if (!a.startTime) return -1;
      if (!b.startTime) return 1;
      return a.startTime.localeCompare(b.startTime);
    });

    return {
      message: 'Daily timeline fetched successfully',
      data: {
        date: targetDate.toISOString().split('T')[0],
        child: {
          id: child.id,
          name: child.name,
          avatar: child.avatar ?? null,
          hasAllergy: (child.healthConditions && child.healthConditions.includes('FOOD_ALLERGIES' as any)) || (child.additionalNotes && /allerg/i.test(child.additionalNotes)) ? true : false,
          healthConditions: child.healthConditions || [],
        },
        timeline,
      },
    };
  }
}
