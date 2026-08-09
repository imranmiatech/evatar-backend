import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityStatus,
  CaregiverAccessRole,
  CaregiverAccessStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CaregiverService } from '../caregiver/caregiver.service';
import { CreateNannyInvitationDto } from './dto/create-nanny-invitation.dto';
import { NannyProfileQueryDto } from './dto/nanny-profile-query.dto';

const POINTS_PER_COMPLETED_TASK = 2;
const MEAL_CATEGORY_KEYWORDS = [
  'RECIPE',
  'MEAL',
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK',
  'FOOD',
];
const ACTIVITY_CATEGORY_KEYWORDS = [
  'ACTIVITY',
  'PLAY',
  'STUDY',
  'LEARNING',
  'OUTDOOR',
  'CREATIVE',
];
const CARE_CATEGORY_KEYWORDS = ['CARE', 'NAP', 'BEDTIME', 'ROUTINE', 'HYGIENE'];

@Injectable()
export class NanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
  ) {}

  async createInvitation(
    user: CurrentUserPayload,
    dto: CreateNannyInvitationDto,
  ) {
    this.ensureParent(user);
    const parentUserId = this.currentUserId(user);

    const nanny = await this.prisma.user.findUnique({
      where: { email: dto.nannyEmail },
      select: {
        id: true,
        role: true,
        email: true,
        fullName: true,
      },
    });

    if (!nanny || nanny.role !== UserRole.NANNY) {
      throw new NotFoundException('Nanny user not found');
    }

    const child = dto.childId
      ? await this.prisma.child.findFirst({
          where: {
            id: dto.childId,
            parentUserId,
          },
        })
      : await this.prisma.child.create({
          data: {
            parentUserId,
            name: dto.childName?.trim() || 'Child',
          },
        });

    if (!child) {
      throw new NotFoundException('Child not found for this parent');
    }

    const invitation = await this.prisma.nannyChildLink.upsert({
      where: {
        nannyUserId_childId: {
          nannyUserId: nanny.id,
          childId: child.id,
        },
      },
      update: {
        canViewStory: dto.canViewStory ?? true,
        canUpdateProof: dto.canUpdateProof ?? true,
      },
      create: {
        nannyUserId: nanny.id,
        childId: child.id,
        canViewStory: dto.canViewStory ?? true,
        canUpdateProof: dto.canUpdateProof ?? true,
      },
      include: this.invitationInclude(),
    });

    return {
      success: true,
      message: 'Nanny invitation created successfully',
      data: this.formatInvitation(invitation),
    };
  }

  async getMyInvitations(user: CurrentUserPayload) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);

    const invitations = await this.prisma.nannyChildLink.findMany({
      where: { nannyUserId },
      include: this.invitationInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: invitations.map((link) => this.formatInvitation(link)),
    };
  }

  async acceptInvitation(user: CurrentUserPayload, linkId: string) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);

    const invitation = await this.prisma.nannyChildLink.findFirst({
      where: {
        id: linkId,
        nannyUserId,
      },
      include: this.invitationInclude(),
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return {
      success: true,
      message: 'Invitation accepted successfully',
      data: this.formatInvitation(invitation),
    };
  }

  async getNannyProfile(
    user: CurrentUserPayload,
    nannyUserId: string,
    query: NannyProfileQueryDto,
  ) {
    const requesterUserId = this.currentUserId(user);
    const childId = query.childId?.trim();
    const period = query.period ?? 'overview';
    const limit = query.limit ?? 10;

    if (!childId) {
      throw new BadRequestException('childId is required');
    }

    await this.caregiverService.assertChildPermission(
      requesterUserId,
      childId,
      'dailyActivitiesRecipes',
    );

    const range = this.resolveProfileRange(period);
    const rangeWhere = range
      ? {
          date: {
            gte: range.start,
            lt: range.end,
          },
        }
      : undefined;

    const nannyCompletedWhere = {
      status: ActivityStatus.COMPLETED,
      feedback: {
        is: {
          submittedByUserId: nannyUserId,
        },
      },
      dayPlan: {
        childId,
      },
    };

    const periodTaskWhere = {
      dayPlan: {
        childId,
        ...(rangeWhere ?? {}),
      },
    };

    const periodCompletedWhere = {
      ...periodTaskWhere,
      status: ActivityStatus.COMPLETED,
    };

    const [
      child,
      nanny,
      caregiverAccess,
      nannyChildLink,
      completedTasks,
      mealsServed,
      activitiesDone,
      careMomentsDone,
      completedWithProofs,
      skippedTasks,
      dutyActivities,
      periodTotalTasks,
      periodWithProofs,
      periodProofMissing,
      periodTasks,
      recentHighlights,
      rewardAccount,
    ] = await this.prisma.$transaction([
      this.prisma.child.findUnique({
        where: { id: childId },
        select: {
          id: true,
          name: true,
          avatar: true,
          parentUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profilePictureUrl: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: nannyUserId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          profilePictureUrl: true,
          role: true,
          nannyProfile: {
            include: {
              experiences: {
                orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
              },
              certifications: {
                orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
              },
            },
          },
        },
      }),
      this.prisma.caregiverAccess.findFirst({
        where: {
          childId,
          invitedUserId: nannyUserId,
          role: CaregiverAccessRole.NANNY,
          status: CaregiverAccessStatus.ACCEPTED,
        },
        select: {
          id: true,
          acceptedAt: true,
          createdAt: true,
          manageDailyPlans: true,
          manageGroceryLists: true,
          editChildProfile: true,
          accessChildInsights: true,
        },
      }),
      this.prisma.nannyChildLink.findUnique({
        where: {
          nannyUserId_childId: {
            nannyUserId,
            childId,
          },
        },
        select: {
          id: true,
          createdAt: true,
          canViewStory: true,
          canUpdateProof: true,
        },
      }),
      this.prisma.dayActivity.count({ where: nannyCompletedWhere }),
      this.prisma.dayActivity.count({
        where: {
          ...nannyCompletedWhere,
          OR: this.categoryKeywordWhere(MEAL_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...nannyCompletedWhere,
          OR: this.categoryKeywordWhere(ACTIVITY_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...nannyCompletedWhere,
          OR: this.categoryKeywordWhere(CARE_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...nannyCompletedWhere,
          proofs: { some: {} },
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          status: ActivityStatus.SKIPPED,
          feedback: {
            is: {
              submittedByUserId: nannyUserId,
            },
          },
          dayPlan: {
            childId,
          },
        },
      }),
      this.prisma.dayActivity.findMany({
        where: nannyCompletedWhere,
        select: {
          dayPlan: {
            select: {
              date: true,
            },
          },
        },
      }),
      this.prisma.dayActivity.count({ where: periodTaskWhere }),
      this.prisma.dayActivity.count({
        where: {
          ...periodCompletedWhere,
          proofs: { some: {} },
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...periodCompletedWhere,
          proofs: { none: {} },
        },
      }),
      this.prisma.dayActivity.findMany({
        where: periodTaskWhere,
        include: {
          dayPlan: {
            select: {
              id: true,
              date: true,
              child: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
          feedback: {
            select: {
              id: true,
              submittedByUserId: true,
              enjoyment: true,
              childMood: true,
              completionRate: true,
              submittedAt: true,
            },
          },
          proofs: {
            select: {
              id: true,
              mediaAsset: {
                select: {
                  id: true,
                  url: true,
                  type: true,
                  mimeType: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy:
          period === 'overview'
            ? [{ updatedAt: 'desc' }, { sortOrder: 'asc' }]
            : [{ startTime: 'asc' }, { sortOrder: 'asc' }],
        take: limit,
      }),
      this.prisma.nannyPortfolioHighlight.findMany({
        where: {
          nannyUserId,
          OR: [{ childId }, { childId: null }],
        },
        include: {
          mediaAsset: {
            select: {
              id: true,
              url: true,
              type: true,
              mimeType: true,
            },
          },
        },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: 9,
      }),
      this.prisma.rewardAccount.findUnique({
        where: { userId: nannyUserId },
      }),
    ]);

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (!nanny || nanny.role !== UserRole.NANNY || !nanny.nannyProfile) {
      throw new NotFoundException('Nanny profile not found');
    }

    if (!caregiverAccess && !nannyChildLink) {
      throw new NotFoundException('Nanny is not linked with this child');
    }

    const daysOnDuty = new Set(
      dutyActivities.map((item) =>
        item.dayPlan.date.toISOString().slice(0, 10),
      ),
    ).size;
    const totalEarnedPoints =
      rewardAccount?.lifetimeEarned ??
      completedTasks * POINTS_PER_COMPLETED_TASK;
    const redeemedPoints = rewardAccount?.lifetimeSpent ?? 0;
    const availablePoints =
      rewardAccount?.balance ?? Math.max(totalEarnedPoints - redeemedPoints, 0);
    const careScore = this.calculateCareScore({
      completedTasks,
      completedWithProofs,
      skippedTasks,
      daysOnDuty,
      profileRating: nanny.nannyProfile.averageRating,
    });
    const joinedAt =
      caregiverAccess?.acceptedAt ??
      caregiverAccess?.createdAt ??
      nannyChildLink?.createdAt ??
      nanny.nannyProfile.joinedAt ??
      nanny.nannyProfile.createdAt;

    return {
      success: true,
      message: 'Nanny profile fetched successfully',
      data: {
        nanny: {
          id: nanny.id,
          fullName: nanny.fullName,
          email: nanny.email,
          phoneNumber: nanny.phoneNumber,
          profilePictureUrl: nanny.profilePictureUrl,
          status: nanny.nannyProfile.status,
          headline: nanny.nannyProfile.headline,
          bio: nanny.nannyProfile.bio,
          yearsExperience: nanny.nannyProfile.yearsExperience,
          joinedAt,
          caringFor: {
            id: child.id,
            name: child.name,
            avatar: child.avatar,
          },
          family: child.parentUser,
          careTeamAccess: caregiverAccess
            ? {
                id: caregiverAccess.id,
                manageDailyPlans: caregiverAccess.manageDailyPlans,
                manageGroceryLists: caregiverAccess.manageGroceryLists,
                editChildProfile: caregiverAccess.editChildProfile,
                accessChildInsights: caregiverAccess.accessChildInsights,
              }
            : null,
          careScore,
        },
        overview: {
          activitiesDone,
          mealsServed,
          careMomentsDone,
          daysOnDuty,
          completedTasks,
        },
        points: {
          perCompletedTask: POINTS_PER_COMPLETED_TASK,
          completedTasks,
          totalEarned: totalEarnedPoints,
          redeemed: redeemedPoints,
          available: availablePoints,
        },
        periodStats: {
          period,
          startDate: range?.start ?? null,
          endDate: range?.end ?? null,
          totalTasks: periodTotalTasks,
          withProofs: periodWithProofs,
          proofMissing: periodProofMissing,
        },
        tasks: periodTasks.map((task) =>
          this.formatNannyProfileTask(task, nannyUserId),
        ),
        recentHighlights: recentHighlights.map((highlight) => ({
          id: highlight.id,
          title: highlight.title,
          description: highlight.description,
          imageUrl: highlight.mediaAsset?.url ?? highlight.imageUrl,
          media: highlight.mediaAsset,
          isFeatured: highlight.isFeatured,
          createdAt: highlight.createdAt,
        })),
        portfolio: {
          skills: nanny.nannyProfile.skills,
          training: nanny.nannyProfile.training,
          languages: nanny.nannyProfile.languages,
          portfolioImageUrls: nanny.nannyProfile.portfolioImageUrls,
          experience: nanny.nannyProfile.experience,
          perks: nanny.nannyProfile.perks,
          experiences: nanny.nannyProfile.experiences,
          certifications: nanny.nannyProfile.certifications,
        },
      },
    };
  }

  private invitationInclude() {
    return {
      child: {
        include: {
          parentUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              profilePictureUrl: true,
              parentProfile: true,
            },
          },
        },
      },
    };
  }

  private formatInvitation(link: any) {
    return {
      id: link.id,
      canViewStory: link.canViewStory,
      canUpdateProof: link.canUpdateProof,
      createdAt: link.createdAt,
      parent: {
        id: link.child.parentUser.id,
        fullName: link.child.parentUser.fullName,
        email: link.child.parentUser.email,
        phoneNumber: link.child.parentUser.phoneNumber,
        profilePictureUrl: link.child.parentUser.profilePictureUrl,
        address: link.child.parentUser.parentProfile?.address,
      },
      child: {
        id: link.child.id,
        name: link.child.name,
        avatar: link.child.avatar,
        gender: link.child.gender,
        birthDate: link.child.birthDate,
      },
    };
  }

  private ensureNanny(user: CurrentUserPayload) {
    if (user.role !== UserRole.NANNY) {
      throw new BadRequestException('Only nanny users can access invitations');
    }
  }

  private ensureParent(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parent users can create invitations');
    }
  }

  private currentUserId(user: CurrentUserPayload) {
    const userId = user.id ?? user.userId;
    if (!userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return userId;
  }

  private resolveProfileRange(period: 'overview' | 'week' | 'month') {
    if (period === 'overview') return null;

    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);

    if (period === 'week') {
      const day = start.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setUTCDate(start.getUTCDate() + mondayOffset);
    } else {
      start.setUTCDate(1);
    }

    const end = new Date(start);
    if (period === 'week') {
      end.setUTCDate(start.getUTCDate() + 7);
    } else {
      end.setUTCMonth(start.getUTCMonth() + 1);
    }

    return { start, end };
  }

  private categoryKeywordWhere(keywords: string[]) {
    return keywords.map((keyword) => ({
      category: {
        contains: keyword,
        mode: 'insensitive' as const,
      },
    }));
  }

  private calculateCareScore(input: {
    completedTasks: number;
    completedWithProofs: number;
    skippedTasks: number;
    daysOnDuty: number;
    profileRating?: number | null;
  }) {
    const totalDecidedTasks = input.completedTasks + input.skippedTasks;

    if (totalDecidedTasks === 0) {
      return input.profileRating ? Math.round(input.profileRating * 20) : 0;
    }

    const completionScore = (input.completedTasks / totalDecidedTasks) * 50;
    const proofScore =
      input.completedTasks > 0
        ? (input.completedWithProofs / input.completedTasks) * 30
        : 0;
    const consistencyScore = Math.min(input.daysOnDuty / 30, 1) * 20;

    return Math.min(
      100,
      Math.round(completionScore + proofScore + consistencyScore),
    );
  }

  private formatNannyProfileTask(task: any, nannyUserId: string) {
    const completedByThisNanny =
      task.status === ActivityStatus.COMPLETED &&
      task.feedback?.submittedByUserId === nannyUserId;

    return {
      id: task.id,
      dayPlanId: task.dayPlanId,
      child: task.dayPlan.child,
      date: task.dayPlan.date,
      category: task.category,
      title: task.title,
      description: task.description,
      startTime: task.startTime,
      endTime: task.endTime,
      status: task.status,
      imageUrl: task.imageUrl,
      detail: task.detail,
      proofCount: task.proofs.length,
      hasProof: task.proofs.length > 0,
      pointsEarned: completedByThisNanny ? POINTS_PER_COMPLETED_TASK : 0,
      feedback: task.feedback
        ? {
            id: task.feedback.id,
            enjoyment: task.feedback.enjoyment,
            childMood: task.feedback.childMood,
            completionRate: task.feedback.completionRate,
            submittedAt: task.feedback.submittedAt,
            submittedByCurrentNanny:
              task.feedback.submittedByUserId === nannyUserId,
          }
        : null,
      proofs: task.proofs.map((proof: any) => ({
        id: proof.id,
        media: proof.mediaAsset,
      })),
    };
  }
}
