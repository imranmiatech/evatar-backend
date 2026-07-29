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
    const totalEarned = completedTasks * NANNY_TASK_POINTS;
    const redeemed = this.readRedeemedPoints(nanny.nannyProfile.perks);
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
          languages: nanny.nannyProfile.languages,
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
          perkDetails: {
            totalEarned,
            redeemed,
            available: Math.max(totalEarned - redeemed, 0),
            perCompletedTask: NANNY_TASK_POINTS,
          },
          skillsAndTraining: {
            items: skillsAndTraining,
            visibleItems: skillsAndTraining.slice(0, 5),
            remainingCount: Math.max(skillsAndTraining.length - 5, 0),
          },
          professionalExperience: nanny.nannyProfile.experiences.map(
            (experience) => this.formatExperience(experience),
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

    const [nanny, completedTasks, highlights, linkedChildren] =
      await Promise.all([
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
      ]);

    if (!nanny || nanny.role !== UserRole.NANNY || !nanny.nannyProfile) {
      throw new NotFoundException('Nanny profile not found');
    }

    const nannyWithProfile = {
      ...nanny,
      nannyProfile: nanny.nannyProfile,
    };
    const totalEarned = completedTasks * NANNY_TASK_POINTS;
    const redeemed = this.readRedeemedPoints(nanny.nannyProfile.perks);

    return {
      success: true,
      message: 'My nanny portfolio fetched successfully',
      data: this.formatNannyPortfolioOnly({
        nanny: nannyWithProfile,
        joinedAt: nanny.nannyProfile.joinedAt ?? nanny.createdAt,
        totalEarned,
        redeemed,
        highlights,
        linkedChildren,
      }),
    };
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
      this.prisma.careModuleAssignment.findFirst({
        where: { childId, nannyUserId },
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
      title: 'My Portfolio',
      header: {
        id: input.nanny.id,
        fullName: input.nanny.fullName,
        email: input.nanny.email,
        phoneNumber: input.nanny.phoneNumber,
        profilePictureUrl: input.nanny.profilePictureUrl,
        withAlurieSince: input.joinedAt,
        withAlurieSinceLabel: this.formatMonthYear(input.joinedAt),
        yearsExperience: input.nanny.nannyProfile.yearsExperience,
        languages: input.nanny.nannyProfile.languages,
        verification: {
          emergencyContactVerified:
            input.nanny.nannyProfile.emergencyContactVerified,
          backgroundCheckVerified:
            input.nanny.nannyProfile.backgroundCheckVerified,
        },
      },
      perkDetails: {
        totalEarned: input.totalEarned,
        redeemed: input.redeemed,
        available: Math.max(input.totalEarned - input.redeemed, 0),
        perCompletedTask: NANNY_TASK_POINTS,
      },
      skillsAndTraining: {
        items: skillsAndTraining,
        visibleItems: skillsAndTraining.slice(0, 5),
        remainingCount: Math.max(skillsAndTraining.length - 5, 0),
      },
      professionalExperience: input.nanny.nannyProfile.experiences.map(
        (experience) => this.formatExperience(experience),
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
      infantsCount: experience.infantsCount,
      durationYears: this.experienceDurationYears(
        experience.startDate,
        experience.endDate,
      ),
      description: experience.description,
    };
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

  private readRedeemedPoints(perks: unknown) {
    if (!perks || typeof perks !== 'object') return 0;

    const value = (perks as Record<string, unknown>).redeemedPoints;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private formatMonthYear(date: Date | null) {
    if (!date) return null;

    return date.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
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
