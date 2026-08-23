import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityStatus,
  CaregiverAccessRole,
  CaregiverAccessStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileNannyPortfolioQueryDto } from './dto/profile-nanny-portfolio-query.dto';
import { UpdateMyNannyPortfolioDto } from './dto/update-my-nanny-portfolio.dto';

const nannyPortfolioUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  profilePictureUrl: true,
  role: true,
  createdAt: true,
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
} satisfies Prisma.UserSelect;

const nannyPortfolioHighlightInclude = {
  mediaAsset: {
    select: {
      id: true,
      url: true,
      type: true,
      mimeType: true,
    },
  },
} satisfies Prisma.NannyPortfolioHighlightInclude;

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
  'ART',
  'MUSIC',
  'STORY',
];
const CARE_LAYER_CATEGORY_KEYWORDS = [
  'CARE',
  'NAP',
  'BEDTIME',
  'ROUTINE',
  'HYGIENE',
  'SAFETY',
];
const NANNY_TASK_POINTS = 2;
const PORTFOLIO_VISIBLE_SKILL_COUNT = 4;
const PROFILE_MEAL_DOMAINS = [
  {
    label: 'Growth & Energy',
    keywords: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'MEAL', 'FOOD'],
  },
  {
    label: 'Brain Development',
    keywords: ['BRAIN', 'LEARNING', 'FINGER', 'COLOR', 'TEXTURE'],
  },
  {
    label: 'Gut Immunity',
    keywords: ['GUT', 'IMMUNITY', 'FRUIT', 'VEGETABLE', 'YOGURT'],
  },
  {
    label: 'Exploration & Learning',
    keywords: ['EXPLORE', 'EXPLORATION', 'LEARNING', 'TASTE', 'SENSORY'],
  },
  {
    label: 'Routine & Mealtime Calm',
    keywords: ['ROUTINE', 'CALM', 'MEALTIME', 'DINNER', 'LUNCH'],
  },
] as const;
const PROFILE_CARE_DOMAINS = [
  {
    label: 'Nutrition & Mealtimes',
    keywords: ['NUTRITION', 'MEAL', 'FOOD', 'SNACK'],
  },
  {
    label: 'Behaviour & Regulation',
    keywords: ['BEHAVIOR', 'BEHAVIOUR', 'REGULATION', 'CALM'],
  },
  {
    label: 'Language Development',
    keywords: ['LANGUAGE', 'READING', 'STORY', 'COMMUNICATION'],
  },
  {
    label: 'Safety & Awareness',
    keywords: ['SAFETY', 'AWARENESS', 'HYGIENE'],
  },
] as const;
const PROFILE_ACTIVITY_DOMAINS = [
  {
    label: 'Physical Development',
    keywords: ['PHYSICAL', 'OUTDOOR', 'MOVEMENT', 'MOTOR'],
  },
  {
    label: 'Cognitive Development',
    keywords: ['COGNITIVE', 'PUZZLE', 'LEARNING', 'STUDY'],
  },
  {
    label: 'Language Development',
    keywords: ['LANGUAGE', 'READING', 'STORY', 'COMMUNICATION'],
  },
  {
    label: 'Social Development',
    keywords: ['SOCIAL', 'SHARING', 'GROUP'],
  },
  {
    label: 'Sensory Development',
    keywords: ['SENSORY', 'ART', 'MUSIC', 'COLOR', 'TEXTURE'],
  },
] as const;

type NannyPortfolioUser = Prisma.UserGetPayload<{
  select: typeof nannyPortfolioUserSelect;
}>;
type NannyPortfolioUserWithProfile = NannyPortfolioUser & {
  nannyProfile: NonNullable<NannyPortfolioUser['nannyProfile']>;
};
type NannyPortfolioHighlightRow = Prisma.NannyPortfolioHighlightGetPayload<{
  include: typeof nannyPortfolioHighlightInclude;
}>;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignedNannyPortfolio(
    user: CurrentUserPayload,
    childId: string,
    nannyUserId: string,
    query: ProfileNannyPortfolioQueryDto,
  ) {
    const userId = this.currentUserId(user);

    if (!this.isAdmin(user)) {
      if (this.isNanny(user)) {
        if (userId !== nannyUserId) {
          throw new ForbiddenException(
            'You cannot view another nanny portfolio for this child',
          );
        }
        await this.assertNannyCanViewChildCare(userId, childId);
      } else {
        await this.assertCanViewCare(userId, childId);
      }
    }

    await this.assertNannyBelongsToChild(nannyUserId, childId);

    const range = this.resolvePortfolioRange(query);
    const rangeFilter = range
      ? {
          date: {
            gte: range.start,
            lt: range.end,
          },
        }
      : undefined;
    const baseCompletedWhere = {
      status: ActivityStatus.COMPLETED,
      feedback: { is: { submittedByUserId: nannyUserId } },
      dayPlan: {
        childId,
        ...(rangeFilter ?? {}),
      },
    } satisfies Prisma.DayActivityWhereInput;
    const allTimeCompletedWhere = {
      status: ActivityStatus.COMPLETED,
      feedback: { is: { submittedByUserId: nannyUserId } },
      dayPlan: { childId },
    } satisfies Prisma.DayActivityWhereInput;

    const [
      child,
      nanny,
      caregiverAccess,
      nannyChildLink,
      completedTasks,
      mealsServed,
      careLayersCompleted,
      activitiesCompleted,
      experiencesByNanny,
      highlights,
      linkedChildren,
      mealBreakdown,
      careBreakdown,
      activityBreakdown,
      rewardAccount,
    ] = await Promise.all([
      this.prisma.child.findUnique({
        where: { id: childId },
        select: {
          id: true,
          name: true,
          avatar: true,
          birthDate: true,
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
        select: nannyPortfolioUserSelect,
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
        },
      }),
      this.prisma.nannyChildLink.findUnique({
        where: {
          nannyUserId_childId: {
            nannyUserId,
            childId,
          },
        },
        select: { id: true, createdAt: true },
      }),
      this.prisma.dayActivity.count({ where: baseCompletedWhere }),
      this.prisma.dayActivity.count({
        where: {
          ...baseCompletedWhere,
          OR: this.categoryKeywordWhere(MEAL_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...baseCompletedWhere,
          OR: this.categoryKeywordWhere(CARE_LAYER_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...baseCompletedWhere,
          OR: this.categoryKeywordWhere(ACTIVITY_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.findMany({
        where: allTimeCompletedWhere,
        select: {
          dayPlan: {
            select: {
              child: {
                select: { id: true, name: true, birthDate: true },
              },
            },
          },
        },
        distinct: ['dayPlanId'],
      }),
      this.prisma.nannyPortfolioHighlight.findMany({
        where: {
          nannyUserId,
          OR: [{ childId }, { childId: null }],
        },
        include: nannyPortfolioHighlightInclude,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: 9,
      }),
      this.linkedChildren(nannyUserId),
      this.domainCounts(baseCompletedWhere, PROFILE_MEAL_DOMAINS),
      this.domainCounts(baseCompletedWhere, PROFILE_CARE_DOMAINS),
      this.domainCounts(baseCompletedWhere, PROFILE_ACTIVITY_DOMAINS),
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

    const joinedAt =
      caregiverAccess?.acceptedAt ??
      caregiverAccess?.createdAt ??
      nannyChildLink?.createdAt ??
      nanny.nannyProfile.joinedAt ??
      nanny.createdAt;
    const totalEarned =
      rewardAccount?.lifetimeEarned ?? completedTasks * NANNY_TASK_POINTS;
    const redeemed = rewardAccount?.lifetimeSpent ?? 0;
    const available =
      rewardAccount?.balance ?? Math.max(totalEarned - redeemed, 0);
    const skillsAndTraining = [
      ...nanny.nannyProfile.skills,
      ...nanny.nannyProfile.training,
    ];

    return {
      success: true,
      message: 'Assigned nanny portfolio fetched successfully',
      data: {
        header: {
          id: nanny.id,
          fullName: nanny.fullName,
          profilePictureUrl: nanny.profilePictureUrl,
          withAlurieSince: joinedAt,
          withAlurieSinceLabel: this.formatMonthYear(joinedAt),
          yearsExperience: nanny.nannyProfile.yearsExperience,
          yearsExperienceLabel: this.formatYearsExperienceLabel(
            nanny.nannyProfile.yearsExperience,
          ),
          languages: nanny.nannyProfile.languages,
          languagesLabel: this.formatLanguagesLabel(
            nanny.nannyProfile.languages,
          ),
          caringFor: {
            id: child.id,
            name: child.name,
            avatar: child.avatar,
            ageYears: child.birthDate
              ? this.childAgeYears(child.birthDate)
              : null,
          },
          family: child.parentUser,
          careTeam: {
            parent: child.parentUser,
            child: {
              id: child.id,
              name: child.name,
              avatar: child.avatar,
            },
          },
          verification: {
            emergencyContactVerified:
              nanny.nannyProfile.emergencyContactVerified,
            backgroundCheckVerified: nanny.nannyProfile.backgroundCheckVerified,
          },
        },
        portfolioTab: {
          perkDetails: this.buildPerkDetails(totalEarned, redeemed, available),
          skillsAndTraining: this.buildSkillsAndTraining(skillsAndTraining),
          professionalExperience: this.buildProfessionalExperience(
            nanny.nannyProfile.experiences,
          ),
          certifications: nanny.nannyProfile.certifications,
          highlights: this.formatHighlights(highlights),
        },
        insightsTab: {
          period: {
            type: query.period ?? 'overview',
            startDate: range?.start ?? null,
            endDate: range?.end ?? null,
            month: range?.month ?? null,
            week: range?.week ?? null,
          },
          ageGroups: this.nannyAgeGroups([
            ...linkedChildren,
            ...experiencesByNanny.map((item) => item.dayPlan.child),
          ]),
          mealsServed: {
            total: mealsServed,
            subtitle: 'Supported nutrition & development',
            breakdown: mealBreakdown,
          },
          careLayersCompleted: {
            total: careLayersCompleted,
            subtitle: 'Supporting everyday wellbeing',
            breakdown: careBreakdown,
          },
          activitiesCompleted: {
            total: activitiesCompleted,
            subtitle: 'Across developmental domains',
            breakdown: activityBreakdown,
          },
        },
      },
    };
  }

  async getMyNannyPortfolio(user: CurrentUserPayload) {
    const nannyUserId = this.currentUserId(user);

    if (!this.isNanny(user)) {
      throw new ForbiddenException('Nanny access required');
    }

    const completedWhere = {
      status: ActivityStatus.COMPLETED,
      feedback: { is: { submittedByUserId: nannyUserId } },
    } satisfies Prisma.DayActivityWhereInput;

    const [
      nanny,
      completedTasks,
      highlights,
      linkedChildren,
      rewardAccount,
    ] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: nannyUserId },
          select: nannyPortfolioUserSelect,
        }),
        this.prisma.dayActivity.count({ where: completedWhere }),
        this.prisma.nannyPortfolioHighlight.findMany({
          where: { nannyUserId },
          include: nannyPortfolioHighlightInclude,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
          take: 9,
        }),
        this.linkedChildren(nannyUserId),
        this.prisma.rewardAccount.findUnique({
          where: { userId: nannyUserId },
        }),
      ]);

    if (!nanny || nanny.role !== UserRole.NANNY || !nanny.nannyProfile) {
      throw new NotFoundException('Nanny profile not found');
    }

    const nannyWithProfile = {
      ...nanny,
      nannyProfile: nanny.nannyProfile,
    };
    const totalEarned =
      rewardAccount?.lifetimeEarned ?? completedTasks * NANNY_TASK_POINTS;
    const redeemed = rewardAccount?.lifetimeSpent ?? 0;

    return {
      success: true,
      message: 'My nanny portfolio fetched successfully',
      data: this.formatNannyPortfolioOnly({
        nanny: nannyWithProfile,
        joinedAt: nanny.nannyProfile.joinedAt ?? nanny.createdAt,
        totalEarned,
        redeemed,
        available:
          rewardAccount?.balance ?? Math.max(totalEarned - redeemed, 0),
        highlights,
        linkedChildren,
      }),
    };
  }

  async getMyNannyPortfolioInsights(
    user: CurrentUserPayload,
    query: ProfileNannyPortfolioQueryDto = {},
  ) {
    const nannyUserId = this.currentUserId(user);

    if (!this.isNanny(user)) {
      throw new ForbiddenException('Nanny access required');
    }

    const range = this.resolvePortfolioRange(query);
    const rangeFilter = range
      ? {
          date: {
            gte: range.start,
            lt: range.end,
          },
        }
      : undefined;
    const completedWhere = {
      status: ActivityStatus.COMPLETED,
      feedback: { is: { submittedByUserId: nannyUserId } },
      dayPlan: {
        ...(rangeFilter ?? {}),
      },
    } satisfies Prisma.DayActivityWhereInput;
    const allTimeCompletedWhere = {
      status: ActivityStatus.COMPLETED,
      feedback: { is: { submittedByUserId: nannyUserId } },
    } satisfies Prisma.DayActivityWhereInput;

    const [
      nanny,
      linkedChildren,
      mealsServed,
      careLayersCompleted,
      activitiesCompleted,
      experiencesByNanny,
      mealBreakdown,
      careBreakdown,
      activityBreakdown,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: nannyUserId },
        select: {
          id: true,
          role: true,
        },
      }),
      this.linkedChildren(nannyUserId),
      this.prisma.dayActivity.count({
        where: {
          ...completedWhere,
          OR: this.categoryKeywordWhere(MEAL_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...completedWhere,
          OR: this.categoryKeywordWhere(CARE_LAYER_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          ...completedWhere,
          OR: this.categoryKeywordWhere(ACTIVITY_CATEGORY_KEYWORDS),
        },
      }),
      this.prisma.dayActivity.findMany({
        where: allTimeCompletedWhere,
        select: {
          dayPlan: {
            select: {
              child: {
                select: { id: true, name: true, birthDate: true },
              },
            },
          },
        },
        distinct: ['dayPlanId'],
      }),
      this.domainCounts(completedWhere, PROFILE_MEAL_DOMAINS),
      this.domainCounts(completedWhere, PROFILE_CARE_DOMAINS),
      this.domainCounts(completedWhere, PROFILE_ACTIVITY_DOMAINS),
    ]);

    if (!nanny || nanny.role !== UserRole.NANNY) {
      throw new NotFoundException('Nanny profile not found');
    }

    return {
      success: true,
      message: 'My nanny portfolio insights fetched successfully',
      data: {
        screenTitle: "Nanny's Portfolio",
        tabs: this.buildPortfolioTabs(),
        defaultTab: 'insights',
        insightsTab: this.buildInsightsTab({
          period: {
            type: query.period ?? 'overview',
            startDate: range?.start ?? null,
            endDate: range?.end ?? null,
            month: range?.month ?? null,
            week: range?.week ?? null,
          },
          ageGroups: this.nannyAgeGroups([
            ...linkedChildren,
            ...experiencesByNanny.map((item) => item.dayPlan.child),
          ]),
          mealsServed: {
            total: mealsServed,
            subtitle: 'Supported nutrition & development',
            breakdown: mealBreakdown,
          },
          careLayersCompleted: {
            total: careLayersCompleted,
            subtitle: 'Supporting everyday wellbeing',
            breakdown: careBreakdown,
          },
          activitiesCompleted: {
            total: activitiesCompleted,
            subtitle: 'Across developmental domains',
            breakdown: activityBreakdown,
          },
        }),
      },
    };
  }

  async getMyNannyPortfolioScreenTime(user: CurrentUserPayload) {
    const nannyUserId = this.currentUserId(user);

    if (!this.isNanny(user)) {
      throw new ForbiddenException('Nanny access required');
    }

    const nanny = await this.prisma.user.findUnique({
      where: { id: nannyUserId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!nanny || nanny.role !== UserRole.NANNY) {
      throw new NotFoundException('Nanny profile not found');
    }

    const progresses = await this.prisma.careModuleProgress.findMany({
      where: {
        userId: nannyUserId,
      },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        answers: {
          select: {
            answeredAt: true,
          },
          orderBy: {
            answeredAt: 'asc',
          },
        },
      },
    });

    const totalMinutes = this.calculateScreenTimeMinutes(progresses);

    return {
      success: true,
      message: 'My nanny portfolio screen time fetched successfully',
      data: {
        title: 'Screen Time',
        totalMinutes,
        text: `${totalMinutes} minutes of screen time shifted into developmental activities`,
      },
    };
  }

  async updateMyNannyPortfolio(
    user: CurrentUserPayload,
    dto: UpdateMyNannyPortfolioDto,
  ) {
    const nannyUserId = this.currentUserId(user);

    if (!this.isNanny(user)) {
      throw new ForbiddenException('Only nannies can update this portfolio');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: nannyUserId },
      select: {
        id: true,
        role: true,
        nannyProfile: {
          select: { id: true },
        },
      },
    });

    if (!existingUser || existingUser.role !== UserRole.NANNY) {
      throw new NotFoundException('Nanny profile not found');
    }

    const skills = dto.skills
      ? [...new Set(dto.skills.map((item) => item.trim()).filter(Boolean))]
      : undefined;
    const training = dto.training
      ? [...new Set(dto.training.map((item) => item.trim()).filter(Boolean))]
      : undefined;
    const professionalExperience = dto.professionalExperience?.map(
      (experience) => ({
        familyName: experience.familyName.trim(),
        startDate: experience.startDate,
        endDate: experience.endDate,
        childrenCount: experience.childrenCount,
        infantsCount: experience.infantsCount,
        description: experience.description?.trim() || undefined,
      }),
    );

    if (!existingUser.nannyProfile) {
      await this.prisma.nannyProfile.create({
        data: {
          userId: nannyUserId,
          skills: skills ?? [],
          training: training ?? [],
          experiences: professionalExperience
            ? {
                create: professionalExperience,
              }
            : undefined,
        },
      });
    } else {
      await this.prisma.nannyProfile.update({
        where: { userId: nannyUserId },
        data: {
          ...(skills !== undefined && { skills }),
          ...(training !== undefined && { training }),
          ...(professionalExperience !== undefined && {
            experiences: {
              deleteMany: {},
              create: professionalExperience,
            },
          }),
        },
      });
    }

    return this.getMyNannyPortfolio(user);
  }

  private async linkedChildren(nannyUserId: string) {
    return this.prisma.child.findMany({
      where: {
        OR: [
          { nannies: { some: { nannyUserId } } },
          {
            caregiverAccesses: {
              some: {
                invitedUserId: nannyUserId,
                role: CaregiverAccessRole.NANNY,
                status: CaregiverAccessStatus.ACCEPTED,
              },
            },
          },
        ],
      },
      select: { id: true, name: true, avatar: true, birthDate: true },
    });
  }

  private async assertCanViewCare(userId: string, childId: string) {
    await this.assertChildAccess(userId, childId, [
      'careLearningAccess',
      'nannyDevelopment',
      'manageCareTeam',
    ]);
  }

  private async assertNannyCanViewChildCare(
    nannyUserId: string,
    childId: string,
  ) {
    const [assignment, nannyLink, caregiverAccess] = await Promise.all([
      this.prisma.careModuleProgress.findFirst({
        where: { userId: nannyUserId },
        select: { id: true },
      }),
      this.prisma.nannyChildLink.findFirst({
        where: { childId, nannyUserId },
        select: { id: true },
      }),
      this.prisma.caregiverAccess.findFirst({
        where: {
          childId,
          invitedUserId: nannyUserId,
          role: CaregiverAccessRole.NANNY,
          status: CaregiverAccessStatus.ACCEPTED,
          OR: [{ careLearningAccess: true }, { nannyDevelopment: true }],
        },
        select: { id: true },
      }),
    ]);

    if (!assignment && !nannyLink && !caregiverAccess) {
      throw new ForbiddenException(
        'You do not have access to this care module',
      );
    }
  }

  private async assertChildAccess(
    userId: string,
    childId: string,
    permissions: Array<keyof Prisma.CaregiverAccessWhereInput>,
  ) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { parentUserId: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (child.parentUserId === userId) return;

    const access = await this.prisma.caregiverAccess.findFirst({
      where: {
        childId,
        invitedUserId: userId,
        status: CaregiverAccessStatus.ACCEPTED,
        OR: permissions.map((permission) => ({ [permission]: true })),
      },
      select: { id: true },
    });

    if (!access) {
      throw new ForbiddenException(
        'You do not have access to this care module',
      );
    }
  }

  private async assertNannyBelongsToChild(
    nannyUserId: string,
    childId: string,
  ) {
    const [caregiverAccess, nannyLink] = await Promise.all([
      this.prisma.caregiverAccess.findFirst({
        where: {
          childId,
          invitedUserId: nannyUserId,
          role: CaregiverAccessRole.NANNY,
          status: CaregiverAccessStatus.ACCEPTED,
        },
        select: { id: true },
      }),
      this.prisma.nannyChildLink.findFirst({
        where: { childId, nannyUserId },
        select: { id: true },
      }),
    ]);

    if (!caregiverAccess && !nannyLink) {
      throw new BadRequestException('Nanny is not assigned to this child');
    }
  }

  private formatNannyPortfolioOnly(input: {
    nanny: NannyPortfolioUserWithProfile;
    joinedAt: Date;
    totalEarned: number;
    redeemed: number;
    available: number;
    highlights: NannyPortfolioHighlightRow[];
    linkedChildren: Array<{
      id: string;
      name: string;
      avatar?: string | null;
      birthDate: Date | null;
    }>;
  }) {
    const skillsAndTraining = [
      ...input.nanny.nannyProfile.skills,
      ...input.nanny.nannyProfile.training,
    ];

    return {
      screenTitle: "Nanny's Portfolio",
      title: 'My Portfolio',
      tabs: this.buildPortfolioTabs(),
      defaultTab: 'portfolio',
      header: {
        id: input.nanny.id,
        fullName: input.nanny.fullName,
        email: input.nanny.email,
        phoneNumber: input.nanny.phoneNumber,
        profilePictureUrl: input.nanny.profilePictureUrl,
        withAlurieSince: input.joinedAt,
        withAlurieSinceLabel: this.formatMonthYear(input.joinedAt),
        yearsExperience: input.nanny.nannyProfile.yearsExperience,
        yearsExperienceLabel: this.formatYearsExperienceLabel(
          input.nanny.nannyProfile.yearsExperience,
        ),
        languages: input.nanny.nannyProfile.languages,
        languagesLabel: this.formatLanguagesLabel(
          input.nanny.nannyProfile.languages,
        ),
        verification: {
          emergencyContactVerified:
            input.nanny.nannyProfile.emergencyContactVerified,
          backgroundCheckVerified:
            input.nanny.nannyProfile.backgroundCheckVerified,
        },
      },
      perkDetails: this.buildPerkDetails(
        input.totalEarned,
        input.redeemed,
        input.available,
      ),
      skillsAndTraining: this.buildSkillsAndTraining(skillsAndTraining),
      professionalExperience: this.buildProfessionalExperience(
        input.nanny.nannyProfile.experiences,
      ),
      certifications: input.nanny.nannyProfile.certifications,
      highlights: this.formatHighlights(input.highlights),
      ageGroups: this.nannyAgeGroups(input.linkedChildren),
      linkedChildren: input.linkedChildren,
    };
  }

  private formatExperience(
    experience: NannyPortfolioUserWithProfile['nannyProfile']['experiences'][number],
  ) {
    return {
      id: experience.id,
      familyName: experience.familyName,
      startDate: experience.startDate,
      endDate: experience.endDate,
      periodLabel: this.formatExperiencePeriod(
        experience.startDate,
        experience.endDate,
      ),
      childrenCount: experience.childrenCount,
      childrenLabel:
        experience.childrenCount === null || experience.childrenCount === undefined
          ? null
          : `${experience.childrenCount} ${
              experience.childrenCount === 1 ? 'child' : 'children'
            }`,
      infantsCount: experience.infantsCount,
      infantsLabel:
        experience.infantsCount === null || experience.infantsCount === undefined
          ? null
          : `${experience.infantsCount} ${
              experience.infantsCount === 1 ? 'infant' : 'infants'
            }`,
      durationYears: this.experienceDurationYears(
        experience.startDate,
        experience.endDate,
      ),
      durationLabel: this.formatExperienceDurationLabel(
        experience.startDate,
        experience.endDate,
      ),
      description: experience.description,
    };
  }

  private buildPerkDetails(totalEarned: number, redeemed: number, available: number) {
    return {
      totalEarned,
      redeemed,
      available,
      perCompletedTask: NANNY_TASK_POINTS,
      cards: [
        { key: 'totalEarned', label: 'Total Earned', value: totalEarned },
        { key: 'redeemed', label: 'Redeemed', value: redeemed },
      ],
    };
  }

  private buildSkillsAndTraining(skillsAndTraining: string[]) {
    return {
      items: skillsAndTraining,
      visibleItems: skillsAndTraining.slice(0, PORTFOLIO_VISIBLE_SKILL_COUNT),
      remainingCount: Math.max(
        skillsAndTraining.length - PORTFOLIO_VISIBLE_SKILL_COUNT,
        0,
      ),
      remainingLabel:
        skillsAndTraining.length > PORTFOLIO_VISIBLE_SKILL_COUNT
          ? `+${skillsAndTraining.length - PORTFOLIO_VISIBLE_SKILL_COUNT} More`
          : null,
    };
  }

  private buildProfessionalExperience(
    experiences: NannyPortfolioUserWithProfile['nannyProfile']['experiences'],
  ) {
    return experiences.map((experience) => this.formatExperience(experience));
  }

  private buildPortfolioTabs() {
    return [
      { key: 'portfolio', label: 'Portfolio' },
      { key: 'insights', label: 'Insights' },
    ];
  }

  private buildInsightsTab(input: {
    period: {
      type: 'overview' | 'week' | 'month';
      startDate: Date | null;
      endDate: Date | null;
      month: number | null;
      week: number | null;
    };
    ageGroups: Array<{
      key: string;
      label: string;
      range: string;
      childCount: number;
    }>;
    mealsServed: {
      total: number;
      subtitle: string;
      breakdown: Array<{ label: string; value: number }>;
    };
    careLayersCompleted: {
      total: number;
      subtitle: string;
      breakdown: Array<{ label: string; value: number }>;
    };
    activitiesCompleted: {
      total: number;
      subtitle: string;
      breakdown: Array<{ label: string; value: number }>;
    };
  }) {
    return {
      period: input.period,
      ageGroups: input.ageGroups,
      ageGroupChips: input.ageGroups.map((group) => ({
        key: group.key,
        label: `${group.label} (${group.range})`,
        childCount: group.childCount,
      })),
      cards: [
        this.buildInsightCard(
          'mealsServed',
          `${input.mealsServed.total} meals served`,
          input.mealsServed.subtitle,
          input.mealsServed.breakdown,
        ),
        this.buildInsightCard(
          'careLayersCompleted',
          `${input.careLayersCompleted.total} care layers completed`,
          input.careLayersCompleted.subtitle,
          input.careLayersCompleted.breakdown,
        ),
        this.buildInsightCard(
          'activitiesCompleted',
          `${input.activitiesCompleted.total} activities completed`,
          input.activitiesCompleted.subtitle,
          input.activitiesCompleted.breakdown,
        ),
      ],
    };
  }

  private buildInsightCard(
    key: 'mealsServed' | 'careLayersCompleted' | 'activitiesCompleted',
    title: string,
    subtitle: string,
    breakdown: Array<{ label: string; value: number }>,
  ) {
    return {
      key,
      title,
      subtitle,
      breakdown,
    };
  }

  private calculateScreenTimeMinutes(
    progresses: Array<{
      id: string;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      answers: Array<{ answeredAt: Date }>;
    }>,
  ) {
    const MAX_SESSION_MS = 3 * 60 * 60 * 1000;
    const totalMs = progresses.reduce((sum, progress) => {
      const firstAnswerAt = progress.answers[0]?.answeredAt ?? null;
      const lastAnswerAt =
        progress.answers.length > 0
          ? progress.answers[progress.answers.length - 1].answeredAt
          : null;

      let durationMs = 0;

      if (progress.startedAt && progress.completedAt) {
        durationMs = progress.completedAt.getTime() - progress.startedAt.getTime();
      } else if (firstAnswerAt && lastAnswerAt) {
        durationMs = lastAnswerAt.getTime() - firstAnswerAt.getTime();
      } else if (
        progress.startedAt &&
        firstAnswerAt &&
        progress.answers.length === 1
      ) {
        durationMs = firstAnswerAt.getTime() - progress.startedAt.getTime();
      }

      if (durationMs <= 0) {
        return sum;
      }

      return sum + Math.min(durationMs, MAX_SESSION_MS);
    }, 0);

    return Math.round(totalMs / 60000);
  }

  private formatHighlights(highlights: NannyPortfolioHighlightRow[]) {
    return highlights.map((highlight) => ({
      id: highlight.id,
      title: highlight.title,
      description: highlight.description,
      imageUrl: highlight.mediaAsset?.url ?? highlight.imageUrl,
      media: highlight.mediaAsset,
      isFeatured: highlight.isFeatured,
      createdAt: highlight.createdAt,
    }));
  }

  private resolvePortfolioRange(query: ProfileNannyPortfolioQueryDto) {
    const period = query.period ?? 'overview';

    if (period === 'overview') return null;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const startOfNextMonth = new Date(Date.UTC(year, month, 1));

    if (period === 'week') {
      const week = query.week ?? this.currentWeekOfMonth(now);
      const start = new Date(startOfMonth);
      start.setUTCDate(start.getUTCDate() + (week - 1) * 7);

      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);

      return {
        month,
        week,
        start,
        end: end > startOfNextMonth ? startOfNextMonth : end,
      };
    }

    return {
      month,
      week: null,
      start: startOfMonth,
      end: startOfNextMonth,
    };
  }

  private currentWeekOfMonth(date: Date) {
    return Math.min(Math.ceil(date.getUTCDate() / 7), 5);
  }

  private categoryKeywordWhere(keywords: string[]) {
    return keywords.map((keyword) => ({
      category: { contains: keyword, mode: 'insensitive' as const },
    }));
  }

  private async domainCounts(
    baseWhere: Prisma.DayActivityWhereInput,
    domains: ReadonlyArray<{
      label: string;
      keywords: readonly string[];
    }>,
  ) {
    const counts = await Promise.all(
      domains.map((domain) =>
        this.prisma.dayActivity.count({
          where: {
            ...baseWhere,
            OR: this.categoryKeywordWhere([...domain.keywords]),
          },
        }),
      ),
    );

    return domains.map((domain, index) => ({
      label: domain.label,
      value: counts[index],
    }));
  }

  private formatMonthYear(date: Date | null) {
    if (!date) return null;

    return date.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private formatLanguagesLabel(languages: string[]) {
    if (!languages.length) return null;
    return languages.join(' & ');
  }

  private formatYearsExperienceLabel(yearsExperience?: number | null) {
    if (yearsExperience === null || yearsExperience === undefined) return null;
    return `${yearsExperience} ${
      yearsExperience === 1 ? 'Year' : 'Years'
    } Experience`;
  }

  private formatExperiencePeriod(startDate: Date | null, endDate: Date | null) {
    const startLabel = this.formatMonthYear(startDate);
    const endLabel = endDate ? this.formatMonthYear(endDate) : 'Present';

    if (!startLabel) return endLabel;
    return `${startLabel} - ${endLabel}`;
  }

  private experienceDurationYears(
    startDate: Date | null,
    endDate: Date | null,
  ) {
    if (!startDate) return null;

    const end = endDate ?? new Date();
    let years = end.getUTCFullYear() - startDate.getUTCFullYear();
    const monthDelta = end.getUTCMonth() - startDate.getUTCMonth();
    const dayDelta = end.getUTCDate() - startDate.getUTCDate();

    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
      years -= 1;
    }

    return Math.max(years, 0);
  }

  private formatExperienceDurationLabel(
    startDate: Date | null,
    endDate: Date | null,
  ) {
    const years = this.experienceDurationYears(startDate, endDate);
    if (years === null) return null;
    return `${years} ${years === 1 ? 'year' : 'years'} duration`;
  }

  private nannyAgeGroups(
    children: Array<{ id: string; name: string; birthDate: Date | null }>,
  ) {
    const groupByKey = new Map<
      string,
      { key: string; label: string; range: string; childCount: number }
    >();
    const uniqueChildren = new Map(children.map((child) => [child.id, child]));

    for (const child of uniqueChildren.values()) {
      if (!child.birthDate) continue;

      const ageMonths = this.childAgeMonths(child.birthDate);
      const group = this.ageGroupForMonths(ageMonths);
      const existing = groupByKey.get(group.key);

      if (existing) {
        existing.childCount += 1;
      } else {
        groupByKey.set(group.key, { ...group, childCount: 1 });
      }
    }

    return [...groupByKey.values()];
  }

  private childAgeYears(birthDate: Date) {
    const today = new Date();
    let ageYears = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
    const dayDelta = today.getUTCDate() - birthDate.getUTCDate();

    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
      ageYears -= 1;
    }

    return Math.max(ageYears, 0);
  }

  private childAgeMonths(birthDate: Date) {
    const today = new Date();
    let ageMonths =
      (today.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
      (today.getUTCMonth() - birthDate.getUTCMonth());

    if (today.getUTCDate() < birthDate.getUTCDate()) {
      ageMonths -= 1;
    }

    return Math.max(ageMonths, 0);
  }

  private ageGroupForMonths(ageMonths: number) {
    if (ageMonths <= 12) {
      return { key: 'BABIES', label: 'Babies', range: '0-12m' };
    }

    if (ageMonths <= 24) {
      return { key: 'TODDLERS', label: 'Toddlers', range: '13-24m' };
    }

    if (ageMonths <= 60) {
      return { key: 'PRESCHOOLERS', label: 'Preschoolers', range: '2-5y' };
    }

    return { key: 'CHILDREN', label: 'Children', range: '5y+' };
  }

  private currentUserId(user: CurrentUserPayload) {
    return user.userId ?? user.id;
  }

  private isAdmin(user: CurrentUserPayload) {
    return user.role === UserRole.ADMIN;
  }

  private isNanny(user: CurrentUserPayload) {
    return user.role === UserRole.NANNY;
  }
}
