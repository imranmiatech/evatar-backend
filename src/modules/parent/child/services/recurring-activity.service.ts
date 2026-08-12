import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CaregiverService } from '../../../caregiver/caregiver.service';
import { CreateRecurringActivityDto } from '../dto/create-recurring-activity.dto';
import { UpdateRecurringActivityDto } from '../dto/update-recurring-activity.dto';

@Injectable()
export class RecurringActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
  ) {}

  async addRecurringActivity(parentUserId: string, childId: string, dto: CreateRecurringActivityDto) {
    await this.caregiverService.assertChildPermission(parentUserId, childId, 'editChildProfile');

    await this.checkOverlap(childId, dto.days, dto.startTime, dto.endTime);

    const activity = await this.prisma.recurringActivity.create({
      data: {
        childId,
        name: dto.name,
        days: dto.days,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    return { message: 'Recurring activity added successfully', data: activity };
  }

  async getRecurringActivities(parentUserId: string, childId: string) {
    await this.caregiverService.assertChildPermission(parentUserId, childId, 'editChildProfile');

    const activities = await this.prisma.recurringActivity.findMany({
      where: { childId },
    });

    return { message: 'Recurring activities fetched successfully', data: activities };
  }

  async updateRecurringActivity(
    parentUserId: string,
    childId: string,
    activityId: string,
    dto: UpdateRecurringActivityDto,
  ) {
    await this.caregiverService.assertChildPermission(parentUserId, childId, 'editChildProfile');

    const existing = await this.prisma.recurringActivity.findFirst({
      where: { id: activityId, childId },
    });

    if (!existing) {
      throw new NotFoundException('Recurring activity not found');
    }

    const newDays = dto.days ?? existing.days;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    await this.checkOverlap(childId, newDays, newStartTime, newEndTime, activityId);

    const activity = await this.prisma.recurringActivity.update({
      where: { id: activityId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.days && { days: dto.days }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
      },
    });

    return { message: 'Recurring activity updated successfully', data: activity };
  }

  async deleteRecurringActivity(parentUserId: string, childId: string, activityId: string) {
    await this.caregiverService.assertChildPermission(parentUserId, childId, 'editChildProfile');

    const existing = await this.prisma.recurringActivity.findFirst({
      where: { id: activityId, childId },
    });

    if (!existing) {
      throw new NotFoundException('Recurring activity not found');
    }

    await this.prisma.recurringActivity.delete({
      where: { id: activityId },
    });

    return { message: 'Recurring activity deleted successfully' };
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  private async checkOverlap(
    childId: string,
    days: string[],
    startTimeStr: string,
    endTimeStr: string,
    excludeActivityId?: string,
  ): Promise<void> {
    if (!startTimeStr || !endTimeStr || !days || days.length === 0) return;

    const startMinutes = this.timeToMinutes(startTimeStr);
    const endMinutes = this.timeToMinutes(endTimeStr);

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('Start time must be before end time');
    }

    const existingActivities = await this.prisma.recurringActivity.findMany({
      where: {
        childId,
        id: excludeActivityId ? { not: excludeActivityId } : undefined,
      },
      select: { startTime: true, endTime: true, days: true, name: true },
    });

    for (const activity of existingActivities) {
      if (!activity.startTime || !activity.endTime || !activity.days) continue;

      const hasCommonDay = days.some((day) => activity.days.includes(day as any));
      if (!hasCommonDay) continue;

      const existingStart = this.timeToMinutes(activity.startTime);
      const existingEnd = this.timeToMinutes(activity.endTime);

      if (startMinutes < existingEnd && endMinutes > existingStart) {
        throw new BadRequestException(
          `Schedule time overlaps with an existing activity: '${activity.name}' (${activity.startTime} - ${activity.endTime})`
        );
      }
    }

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        naps: true,
        schoolSchedule: true,
      },
    });

    if (child) {
      if (child.schoolSchedule) {
        const hasCommonDay = days.some((day) => child.schoolSchedule!.days.includes(day as any));
        if (hasCommonDay) {
          const schStart = this.timeToMinutes(child.schoolSchedule.startTime);
          const schEnd = this.timeToMinutes(child.schoolSchedule.endTime);
          if (startMinutes < schEnd && endMinutes > schStart) {
            throw new BadRequestException(
              `Recurring activity time overlaps with school schedule (${child.schoolSchedule.startTime} - ${child.schoolSchedule.endTime})`
            );
          }
        }
      }

      for (const nap of child.naps) {
        const napStart = this.timeToMinutes(nap.startTime);
        const napEnd = this.timeToMinutes(nap.endTime);
        if (startMinutes < napEnd && endMinutes > napStart) {
          throw new BadRequestException(
            `Recurring activity time overlaps with nap time (${nap.startTime} - ${nap.endTime})`
          );
        }
      }
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const futureSchedules = await this.prisma.childSchedule.findMany({
      where: { childId, date: { gte: today } },
      select: { date: true, startTime: true, endTime: true, title: true },
    });

    const dayOfWeekMap: Record<number, string> = {
      0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT'
    };

    for (const sched of futureSchedules) {
      if (!sched.startTime || !sched.endTime) continue;
      const schedDay = dayOfWeekMap[sched.date.getUTCDay()];
      if (days.includes(schedDay)) {
        const sStart = this.timeToMinutes(sched.startTime);
        const sEnd = this.timeToMinutes(sched.endTime);
        if (startMinutes < sEnd && endMinutes > sStart) {
          throw new BadRequestException(
            `Recurring activity time overlaps with existing schedule on ${sched.date.toISOString().split('T')[0]}: '${sched.title}' (${sched.startTime} - ${sched.endTime})`
          );
        }
      }
    }
  }
}
