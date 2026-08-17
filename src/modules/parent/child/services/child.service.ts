import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  CaregiverAccessStatus,
  ChildMood,
  HealthCondition,
  TaskCompletionRate,
  TaskEnjoymentLevel,
} from '@prisma/client';
import { ManageSystemService } from '../../../manageSystem/manage-system.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { StorageService } from '../../../../common/storage/storage.service';
import { AddChildDto } from '../dto/add-child.dto';
import { UpdateChildDto } from '../dto/update-child.dto';

@Injectable()
export class ChildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: ManageSystemService,
    private readonly storageService: StorageService,
  ) {}

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  private computeHasAllergy(child: {
    healthConditions?: HealthCondition[] | null;
    additionalNotes?: string | null;
  }): boolean {
    const hasFoodAllergiesEnum =
      Array.isArray(child.healthConditions) &&
      child.healthConditions.includes(HealthCondition.FOOD_ALLERGIES);
    const hasAllergyInNotes = Boolean(
      child.additionalNotes && /allerg/i.test(child.additionalNotes),
    );
    return hasFoodAllergiesEnum || hasAllergyInNotes;
  }

  async addChild(parentUserId: string, dto: AddChildDto) {
    if (dto.wakeUpTime && dto.bedTime) {
      if (this.timeToMinutes(dto.wakeUpTime) >= this.timeToMinutes(dto.bedTime)) {
        throw new BadRequestException('Wake up time must be before bed time');
      }
    }

    const healthConditions = dto.healthConditions
      ? [...dto.healthConditions]
      : [];
    if (
      dto.hasAllergy &&
      !healthConditions.includes(HealthCondition.FOOD_ALLERGIES)
    ) {
      healthConditions.push(HealthCondition.FOOD_ALLERGIES);
    }

    const child = await this.prisma.child.create({
      data: {
        parentUserId,
        name: dto.name,
        gender: dto.gender,
        weight: dto.weight,
        wakeUpTime: dto.wakeUpTime,
        bedTime: dto.bedTime,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        healthConditions:
          healthConditions.length > 0 ? healthConditions : undefined,
        favfood: dto.favfood,
        favActivites: dto.favActivites,
        currentChallenges: dto.currentChallenges,
        extraNote: dto.extraNote,
      },
    });

    return {
      message: 'Child added successfully',
      data: {
        ...child,
        hasAllergy: this.computeHasAllergy(child),
      },
    };
  }

  async getChildren(parentUserId: string) {
    const accessibleChildIds =
      await this.caregiverService.getAccessibleChildIds(parentUserId);

    const children = await this.prisma.child.findMany({
      where: { id: { in: accessibleChildIds } },
      include: {
        caregiverAccesses: {
          where: {
            status: {
              in: [
                CaregiverAccessStatus.PENDING,
                CaregiverAccessStatus.ACCEPTED,
              ],
            },
          },
          select: {
            id: true,
            role: true,
            relationship: true,
            status: true,
            invitedName: true,
            invitedEmail: true,
            invitedPhone: true,
            acceptedAt: true,
            createdAt: true,
            invitedUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                profilePictureUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Children fetched successfully',
      data: children.map((child) => {
        const assignedCaregivers = child.caregiverAccesses.map((access) => ({
          id: access.id,
          accessId: access.id,
          name:
            access.invitedUser?.fullName ??
            access.invitedName ??
            access.invitedEmail ??
            access.invitedPhone ??
            'Caregiver',
          image: access.invitedUser?.profilePictureUrl ?? null,
          role: access.role,
          relationship: access.relationship,
        }));

        return {
          id: child.id,
          name: child.name,
          image: child.avatar,
          avatar: child.avatar,
          birthDate: child.birthDate,
          age: this.formatChildAge(child.birthDate),
          gender: child.gender,
          weight: child.weight,
          hasAllergy: this.computeHasAllergy(child),
          hasAssignedCaregivers: assignedCaregivers.length > 0,
          assignedCount: assignedCaregivers.length,
          assignedCaregivers,
          assignedUsers: assignedCaregivers,
        };
      }),
    };
  }

  async getChildById(parentUserId: string, childId: string) {
    const accessibleChildIds =
      await this.caregiverService.getAccessibleChildIds(parentUserId);
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        schoolSchedule: true,
        recurringActivities: true,
        naps: true,
      },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (!accessibleChildIds.includes(child.id)) {
      throw new ForbiddenException('You do not have access to this child');
    }

    return {
      message: 'Child fetched successfully',
      data: {
        ...child,
        hasAllergy: this.computeHasAllergy(child),
      },
    };
  }

  async getChildProfile(parentUserId: string, childId: string) {
    const accessibleChildIds =
      await this.caregiverService.getAccessibleChildIds(parentUserId);

    if (!accessibleChildIds.includes(childId)) {
      throw new ForbiddenException('You do not have access to this child');
    }

    const caregiverAccessInclude = this.childCaregiverAccessInclude();

    const [
      child,
      memoryCount,
      memories,
      storyCount,
      stories,
      insightActivities,
    ] = await Promise.all([
      this.prisma.child.findUnique({
        where: { id: childId },
        include: {
          schoolSchedule: true,
          recurringActivities: true,
          naps: true,
          caregiverAccesses: caregiverAccessInclude,
        },
      }),
      this.prisma.dayActivityProof.count({
        where: {
          dayActivity: {
            dayPlan: { childId },
          },
        },
      }),
      this.prisma.dayActivityProof.findMany({
        where: {
          dayActivity: {
            dayPlan: { childId },
          },
        },
        select: {
          id: true,
          caption: true,
          createdAt: true,
          mediaAsset: {
            select: {
              id: true,
              url: true,
              type: true,
              mimeType: true,
            },
          },
          uploadedByUser: {
            select: {
              id: true,
              fullName: true,
              profilePictureUrl: true,
            },
          },
          dayActivity: {
            select: {
              id: true,
              title: true,
              category: true,
              dayPlan: {
                select: {
                  id: true,
                  date: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 18,
      }),
      this.prisma.bedtimeStory.count({
        where: {
          dayPlan: { childId },
        },
      }),
      this.prisma.bedtimeStory.findMany({
        where: {
          dayPlan: { childId },
        },
        select: {
          id: true,
          title: true,
          coverImageUrl: true,
          storyText: true,
          audioDurationSec: true,
          createdAt: true,
          updatedAt: true,
          dayPlan: {
            select: {
              id: true,
              date: true,
            },
          },
          audioTracks: {
            select: {
              id: true,
              speakerName: true,
              audioUrl: true,
              durationSec: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.dayActivity.findMany({
        where: {
          dayPlan: { childId },
          feedback: { isNot: null },
        },
        select: {
          id: true,
          title: true,
          category: true,
          feedback: {
            select: {
              enjoyment: true,
              childMood: true,
              completionRate: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ]);

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const assignedUsers = this.formatAssignedUsers(child.caregiverAccesses);
    const insights = this.buildChildInsights(insightActivities);

    return {
      message: 'Child profile fetched successfully',
      data: {
        child: {
          id: child.id,
          name: child.name,
          avatar: child.avatar,
          gender: child.gender,
          birthDate: child.birthDate,
          age: this.formatChildAge(child.birthDate),
          weight: child.weight,
          wakeUpTime: child.wakeUpTime,
          bedTime: child.bedTime,
          healthConditions: child.healthConditions,
          additionalNotes: child.additionalNotes,
          favfood: child.favfood,
          favActivites: child.favActivites,
          currentChallenges: child.currentChallenges,
          extraNote: child.extraNote,
          schoolSchedule: child.schoolSchedule,
          recurringActivities: child.recurringActivities,
          naps: child.naps,
          createdAt: child.createdAt,
          updatedAt: child.updatedAt,
        },
        caregivers: {
          hasAssignedCaregivers: assignedUsers.length > 0,
          assignedCount: assignedUsers.length,
          assignedUsers,
        },
        stats: {
          memories: memoryCount,
          stories: storyCount,
        },
        memories: memories.map((memory) => ({
          id: memory.id,
          imageUrl: memory.mediaAsset.url,
          caption: memory.caption,
          media: memory.mediaAsset,
          activity: memory.dayActivity,
          uploadedBy: memory.uploadedByUser,
          createdAt: memory.createdAt,
        })),
        stories: stories.map((story) => ({
          id: story.id,
          title: story.title,
          coverImageUrl: story.coverImageUrl,
          excerpt: this.storyExcerpt(story.storyText),
          dayPlanId: story.dayPlan.id,
          date: story.dayPlan.date,
          audioDurationSec: story.audioDurationSec,
          audioTracks: story.audioTracks,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
        })),
        insights,
      },
    };
  }

  async updateChild(
    parentUserId: string,
    childId: string,
    dto: UpdateChildDto,
  ) {
    await this.caregiverService.assertChildPermission(
      parentUserId,
      childId,
      'editChildProfile',
    );

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        naps: true,
        schoolSchedule: true,
      }
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const newWakeUpTime = dto.wakeUpTime !== undefined ? dto.wakeUpTime : child.wakeUpTime;
    const newBedTime = dto.bedTime !== undefined ? dto.bedTime : child.bedTime;

    if (newWakeUpTime && newBedTime) {
      if (this.timeToMinutes(newWakeUpTime) >= this.timeToMinutes(newBedTime)) {
        throw new BadRequestException('Wake up time must be before bed time');
      }
    }

    const finalSchoolSchedule = dto.schoolSchedule !== undefined ? dto.schoolSchedule : child.schoolSchedule;
    if (finalSchoolSchedule) {
      if (this.timeToMinutes(finalSchoolSchedule.startTime) >= this.timeToMinutes(finalSchoolSchedule.endTime)) {
        throw new BadRequestException('School schedule start time must be before end time');
      }
    }

    const finalNaps = dto.naps !== undefined ? dto.naps : child.naps;
    if (finalNaps && finalNaps.length > 0) {
      for (const nap of finalNaps) {
        if (this.timeToMinutes(nap.startTime) >= this.timeToMinutes(nap.endTime)) {
          throw new BadRequestException('Nap start time must be before end time');
        }
      }
      for (let i = 0; i < finalNaps.length; i++) {
        for (let j = i + 1; j < finalNaps.length; j++) {
          const nap1 = finalNaps[i];
          const nap2 = finalNaps[j];
          const start1 = this.timeToMinutes(nap1.startTime);
          const end1 = this.timeToMinutes(nap1.endTime);
          const start2 = this.timeToMinutes(nap2.startTime);
          const end2 = this.timeToMinutes(nap2.endTime);
          
          if (start1 < end2 && end1 > start2) {
            throw new BadRequestException('Naps time periods cannot overlap');
          }
        }
      }
    }

    await this.validateCrossEntityOverlaps(childId, finalSchoolSchedule, finalNaps);

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.birthDate !== undefined && {
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.wakeUpTime !== undefined && { wakeUpTime: dto.wakeUpTime }),
        ...(dto.bedTime !== undefined && { bedTime: dto.bedTime }),
        ...(dto.healthConditions !== undefined && {
          healthConditions: dto.healthConditions,
        }),
        ...(dto.additionalNotes !== undefined && {
          additionalNotes: dto.additionalNotes,
        }),
        ...(dto.favfood !== undefined && { favfood: dto.favfood }),
        ...(dto.favActivites !== undefined && {
          favActivites: dto.favActivites,
        }),
        ...(dto.currentChallenges !== undefined && {
          currentChallenges: dto.currentChallenges,
        }),
        ...(dto.extraNote !== undefined && { extraNote: dto.extraNote }),

        ...(dto.schoolSchedule && {
          schoolSchedule: {
            upsert: {
              create: dto.schoolSchedule,
              update: dto.schoolSchedule,
            },
          },
        }),


        ...(dto.naps && {
          naps: {
            deleteMany: {},
            create: dto.naps,
          },
        }),
      },
      include: {
        schoolSchedule: true,
        recurringActivities: true,
        naps: true,
      },
    });

    return {
      message: 'Child updated successfully',
      data: updated,
    };
  }
  async deleteChildMemory(
    parentUserId: string,
    childId: string,
    memoryId: string,
  ) {
    await this.caregiverService.assertChildPermission(
      parentUserId,
      childId,
      'memoriesStories',
    );

    const memory = await this.prisma.dayActivityProof.findFirst({
      where: {
        id: memoryId,
        dayActivity: {
          dayPlan: { childId },
        },
      },
      select: {
        id: true,
        dayActivityId: true,
        mediaAssetId: true,
        mediaAsset: {
          select: {
            id: true,
            url: true,
          },
        },
        dayActivity: {
          select: {
            proofMediaId: true,
          },
        },
      },
    });

    if (!memory) {
      throw new NotFoundException('Memory photo not found');
    }

    await this.prisma.$transaction(async (tx) => {
      if (memory.dayActivity.proofMediaId === memory.mediaAssetId) {
        await tx.dayActivity.update({
          where: { id: memory.dayActivityId },
          data: { proofMediaId: null },
        });
      }

      await tx.dayActivityProof.delete({ where: { id: memory.id } });

      const mediaUsageCount = await tx.dayActivityProof.count({
        where: { mediaAssetId: memory.mediaAssetId },
      });

      const primaryUsageCount = await tx.dayActivity.count({
        where: { proofMediaId: memory.mediaAssetId },
      });

      const highlightUsageCount = await tx.nannyPortfolioHighlight.count({
        where: { mediaAssetId: memory.mediaAssetId },
      });

      if (
        mediaUsageCount === 0 &&
        primaryUsageCount === 0 &&
        highlightUsageCount === 0
      ) {
        await tx.mediaAsset.delete({ where: { id: memory.mediaAssetId } });
      }
    });

    await this.storageService.deleteFile(memory.mediaAsset.url);

    return {
      message: 'Memory photo deleted successfully',
      data: {
        id: memory.id,
        mediaAssetId: memory.mediaAssetId,
        deleted: true,
      },
    };
  }

  async deleteChild(parentUserId: string, childId: string) {
    await this.caregiverService.assertChildPermission(
      parentUserId,
      childId,
      'addRemoveChildren',
    );

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    await this.prisma.child.delete({ where: { id: childId } });

    return { message: 'Child deleted successfully' };
  }

  private childCaregiverAccessInclude() {
    return {
      where: {
        status: {
          in: [CaregiverAccessStatus.PENDING, CaregiverAccessStatus.ACCEPTED],
        },
      },
      select: {
        id: true,
        role: true,
        relationship: true,
        status: true,
        invitedName: true,
        invitedEmail: true,
        invitedPhone: true,
        acceptedAt: true,
        createdAt: true,
        invitedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' as const },
    };
  }

  private formatAssignedUsers(accesses: any[]) {
    return accesses.map((access) => ({
      accessId: access.id,
      userId: access.invitedUser?.id ?? null,
      name:
        access.invitedUser?.fullName ??
        access.invitedName ??
        access.invitedEmail ??
        access.invitedPhone,
      image: access.invitedUser?.profilePictureUrl ?? null,
      email: access.invitedUser?.email ?? access.invitedEmail,
      phoneNumber: access.invitedUser?.phoneNumber ?? access.invitedPhone,
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      acceptedAt: access.acceptedAt,
      assignedAt: access.createdAt,
    }));
  }

  private formatChildAge(birthDate?: Date | null) {
    if (!birthDate) return null;

    const today = new Date();
    let years = today.getUTCFullYear() - birthDate.getUTCFullYear();
    let months = today.getUTCMonth() - birthDate.getUTCMonth();
    let days = today.getUTCDate() - birthDate.getUTCDate();

    if (days < 0) {
      const previousMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0),
      );
      days += previousMonth.getUTCDate();
      months -= 1;
    }

    if (months < 0) {
      months += 12;
      years -= 1;
    }

    return {
      years,
      months,
      days,
      label: [
        years > 0 ? `${years} year${years === 1 ? '' : 's'}` : null,
        months > 0 ? `${months} month${months === 1 ? '' : 's'}` : null,
        days > 0 ? `${days} day${days === 1 ? '' : 's'}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  private storyExcerpt(storyText: string) {
    return storyText.length > 160
      ? `${storyText.slice(0, 157).trim()}...`
      : storyText;
  }

  private buildChildInsights(activities: any[]) {
    const favoriteFoods = new Map<string, number>();
    const declinedFoods = new Map<string, number>();
    const favoriteActivities = new Map<string, number>();
    const lowEngagement = new Map<string, number>();

    for (const activity of activities) {
      const feedback = activity.feedback;
      if (!feedback) continue;

      const title = activity.title ?? 'Untitled';
      const isFood = this.isFoodCategory(activity.category);
      const liked =
        feedback.enjoyment === TaskEnjoymentLevel.LOVE_IT ||
        feedback.enjoyment === TaskEnjoymentLevel.ENJOY_IT;
      const declined =
        feedback.enjoyment === TaskEnjoymentLevel.RELUCTANT ||
        feedback.childMood === ChildMood.RESISTANT ||
        feedback.completionRate === TaskCompletionRate.UNTOUCHED;

      if (isFood && liked) this.incrementInsight(favoriteFoods, title);
      if (isFood && declined) this.incrementInsight(declinedFoods, title);
      if (!isFood && liked) this.incrementInsight(favoriteActivities, title);
      if (!isFood && declined) this.incrementInsight(lowEngagement, title);
    }

    const favoriteActivityNames = this.topInsightLabels(favoriteActivities);
    const lowEngagementNames = this.topInsightLabels(lowEngagement);

    return {
      favoriteFoods: this.topInsightLabels(favoriteFoods),
      frequentlyDeclined: this.topInsightLabels(declinedFoods),
      favoriteActivities: favoriteActivityNames,
      lowEngagement: lowEngagementNames,
      personalitySnapshot: this.personalitySnapshot(
        favoriteActivityNames,
        lowEngagementNames,
      ),
      source: 'derived_from_nanny_feedback',
    };
  }

  private isFoodCategory(category?: string | null) {
    const value = category?.toUpperCase() ?? '';
    return [
      'RECIPE',
      'MEAL',
      'BREAKFAST',
      'LUNCH',
      'DINNER',
      'SNACK',
      'FOOD',
    ].some((keyword) => value.includes(keyword));
  }

  private incrementInsight(map: Map<string, number>, label: string) {
    map.set(label, (map.get(label) ?? 0) + 1);
  }

  private topInsightLabels(map: Map<string, number>) {
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([label]) => label);
  }

  private personalitySnapshot(
    favoriteActivities: string[],
    lowEngagement: string[],
  ) {
    if (favoriteActivities.length === 0 && lowEngagement.length === 0) {
      return null;
    }

    const strengths =
      favoriteActivities.length > 0
        ? `responds positively to ${favoriteActivities.slice(0, 2).join(' and ')}`
        : 'is still building clear activity preferences';
    const support =
      lowEngagement.length > 0
        ? `may need extra support with ${lowEngagement.slice(0, 2).join(' and ')}`
        : 'shows steady engagement across recent activities';

    return `This child ${strengths}, and ${support}.`;
  }

  private async validateCrossEntityOverlaps(
    childId: string,
    newSchoolSchedule: any,
    newNaps: any[],
  ) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const futureSchedules = await this.prisma.childSchedule.findMany({
      where: { childId, date: { gte: today } },
      select: { date: true, startTime: true, endTime: true, title: true },
    });

    const recurringActivities = await this.prisma.recurringActivity.findMany({
      where: { childId },
    });

    const dayOfWeekMap: Record<number, string> = {
      0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT'
    };

    if (newSchoolSchedule) {
      const schStart = this.timeToMinutes(newSchoolSchedule.startTime);
      const schEnd = this.timeToMinutes(newSchoolSchedule.endTime);

      if (newNaps) {
        for (const nap of newNaps) {
          const napStart = this.timeToMinutes(nap.startTime);
          const napEnd = this.timeToMinutes(nap.endTime);
          if (schStart < napEnd && schEnd > napStart) {
            throw new BadRequestException(`School schedule overlaps with nap time (${nap.startTime} - ${nap.endTime})`);
          }
        }
      }

      for (const activity of recurringActivities) {
        const hasCommonDay = newSchoolSchedule.days.some((day: any) => activity.days.includes(day as any));
        if (!hasCommonDay) continue;

        const actStart = this.timeToMinutes(activity.startTime);
        const actEnd = this.timeToMinutes(activity.endTime);
        if (schStart < actEnd && schEnd > actStart) {
          throw new BadRequestException(`School schedule overlaps with recurring activity: '${activity.name}' (${activity.startTime} - ${activity.endTime})`);
        }
      }

      for (const sched of futureSchedules) {
        if (!sched.startTime || !sched.endTime) continue;
        const schedDay = dayOfWeekMap[sched.date.getUTCDay()];
        if (newSchoolSchedule.days.includes(schedDay as any)) {
          const sStart = this.timeToMinutes(sched.startTime);
          const sEnd = this.timeToMinutes(sched.endTime);
          if (schStart < sEnd && schEnd > sStart) {
            throw new BadRequestException(`School schedule overlaps with existing schedule on ${sched.date.toISOString().split('T')[0]}: '${sched.title}' (${sched.startTime} - ${sched.endTime})`);
          }
        }
      }
    }

    if (newNaps && newNaps.length > 0) {
      for (const nap of newNaps) {
        const napStart = this.timeToMinutes(nap.startTime);
        const napEnd = this.timeToMinutes(nap.endTime);

        for (const activity of recurringActivities) {
          const actStart = this.timeToMinutes(activity.startTime);
          const actEnd = this.timeToMinutes(activity.endTime);
          if (napStart < actEnd && napEnd > actStart) {
            throw new BadRequestException(`Nap time (${nap.startTime} - ${nap.endTime}) overlaps with recurring activity: '${activity.name}' (${activity.startTime} - ${activity.endTime})`);
          }
        }

        for (const sched of futureSchedules) {
          if (!sched.startTime || !sched.endTime) continue;
          const sStart = this.timeToMinutes(sched.startTime);
          const sEnd = this.timeToMinutes(sched.endTime);
          if (napStart < sEnd && napEnd > sStart) {
            throw new BadRequestException(`Nap time (${nap.startTime} - ${nap.endTime}) overlaps with existing schedule on ${sched.date.toISOString().split('T')[0]}: '${sched.title}' (${sched.startTime} - ${sched.endTime})`);
          }
        }
      }
    }
  }
}
