import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareModuleCategory,
  CareModuleAdminStatus,
  CareModuleAssignmentStatus,
  CareQuestionType,
  ChildMood,
  CaregiverAccessRole,
  CaregiverAccessStatus,
  MediaType,
  Prisma,
  TaskCompletionRate,
  TaskEnjoymentLevel,
  UserRole,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { StorageService } from '../../common/storage/storage.service';
import { AssignCareModuleDto } from './dto/assign-care-module.dto';
import { CareChildInsightsQueryDto } from './dto/care-child-insights-query.dto';
import {
  CareHomeQueryDto,
  CareHomeTabsQueryDto,
  CareModuleQueryDto,
  CareModuleTab,
} from './dto/care-module-query.dto';
import { CareMonthlyHighlightsQueryDto } from './dto/care-monthly-highlights-query.dto';
import { CreateCareChildNoteDto } from './dto/create-care-child-note.dto';
import { CreateCareModuleDto } from './dto/create-care-module.dto';
import { UpdateCareModuleDto } from './dto/update-care-module.dto';
import { SubmitCareQuizDto } from './dto/submit-care-quiz.dto';
import { ToggleCareModuleStatusDto } from './dto/toggle-care-module-status.dto';
import { SaveCareModuleDto } from './dto/save-care-module.dto';

const moduleListSelect = {
  id: true,
  title: true,
  subtitle: true,
  description: true,
  coverImageUrl: true,
  videoUrl: true,
  category: true,
  estimatedMinutes: true,
  coinReward: true,
  suggestedMinAgeYears: true,
  suggestedMaxAgeYears: true,
  keyTakeaway: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  questions: {
    select: { id: true },
  },
} satisfies Prisma.CareModuleSelect;

const moduleDetailInclude = {
  questions: {
    include: {
      options: {
        select: {
          id: true,
          label: true,
          isCorrect: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.CareModuleInclude;

const QUIZ_PERFECT_SCORE_POINTS = 2;
const QUIZ_RETAKE_COOLDOWN_MONTHS = 1;
const FAVORITE_ENJOYMENT = [
  TaskEnjoymentLevel.LOVE_IT,
  TaskEnjoymentLevel.ENJOY_IT,
] as const;
const FAVORITE_MOODS = [ChildMood.EXCITED, ChildMood.HAPPY] as const;
const FAVORITE_COMPLETION = TaskCompletionRate.FULL_PLATE;
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

const CARE_HOME_TOPICS = [
  { id: 'ALL', label: 'All Topics', value: null },
  {
    id: CareModuleCategory.CHILD_SAFETY,
    label: 'Child Safety',
    value: CareModuleCategory.CHILD_SAFETY,
  },
  {
    id: CareModuleCategory.NUTRITION_FEEDING,
    label: 'Nutrition & Feeding',
    value: CareModuleCategory.NUTRITION_FEEDING,
  },
  {
    id: CareModuleCategory.SLEEP_ROUTINES,
    label: 'Sleep & Routines',
    value: CareModuleCategory.SLEEP_ROUTINES,
  },
  {
    id: CareModuleCategory.CHILD_DEVELOPMENT,
    label: 'Child Development',
    value: CareModuleCategory.CHILD_DEVELOPMENT,
  },
  {
    id: CareModuleCategory.FIRST_AID,
    label: 'First Aid',
    value: CareModuleCategory.FIRST_AID,
  },
  {
    id: CareModuleCategory.PLAY_LEARNING,
    label: 'Play & Learning',
    value: CareModuleCategory.PLAY_LEARNING,
  },
  {
    id: CareModuleCategory.COMMUNICATION,
    label: 'Communication',
    value: CareModuleCategory.COMMUNICATION,
  },
  {
    id: CareModuleCategory.HEALTH_HYGIENE,
    label: 'Health & Hygiene',
    value: CareModuleCategory.HEALTH_HYGIENE,
  },
  {
    id: CareModuleCategory.OTHER,
    label: 'Other',
    value: CareModuleCategory.OTHER,
  },
] as const;

type CareModuleSuggestedAgeRange = {
  suggestedMinAgeYears?: number;
  suggestedMaxAgeYears?: number;
};

type CreateCareModuleInput = CreateCareModuleDto & CareModuleSuggestedAgeRange;

@Injectable()
export class CareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
    private readonly storageService: StorageService,
  ) {}

  async createModule(
    user: CurrentUserPayload,
    dto: any,
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    this.ensureAdmin(user);

    let questions = this.parseFormValue(dto.questions);
    let contentSections = this.parseFormValue(dto.contentSections);
    let isPublished =
      typeof dto.isPublished === 'string'
        ? dto.isPublished === 'true'
        : dto.isPublished;
    let coinReward = dto.coinReward !== undefined ? Number(dto.coinReward) : 5;
    let estimatedMinutes =
      dto.estimatedMinutes !== undefined && dto.estimatedMinutes !== ''
        ? Number(dto.estimatedMinutes)
        : 15;
    let suggestedMinAgeYears =
      dto.suggestedMinAgeYears !== undefined
        ? Number(dto.suggestedMinAgeYears)
        : undefined;
    let suggestedMaxAgeYears =
      dto.suggestedMaxAgeYears !== undefined
        ? Number(dto.suggestedMaxAgeYears)
        : undefined;

    let coverImageUrl = dto.coverImageUrl?.trim();
    let videoUrl = dto.videoUrl?.trim();

    if (files?.coverImage?.[0]) {
      coverImageUrl = await this.storageService.uploadFile(
        files.coverImage[0],
        'care-modules/covers',
      );
    }
    if (files?.video?.[0]) {
      videoUrl = await this.storageService.uploadFile(
        files.video[0],
        'care-modules/videos',
      );
    }

    if (Array.isArray(questions)) {
      this.validateQuestions(questions);
    }
    this.validateSuggestedAgeRange({
      suggestedMinAgeYears,
      suggestedMaxAgeYears,
    });

    const module = await this.prisma.careModule.create({
      data: {
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim(),
        description: dto.description?.trim(),
        coverImageUrl,
        videoUrl,
        category: dto.category,
        estimatedMinutes,
        coinReward,
        suggestedMinAgeYears,
        suggestedMaxAgeYears,
        contentTitle: dto.contentTitle?.trim(),
        contentSections: contentSections ?? {},
        keyTakeaway: dto.keyTakeaway?.trim(),
        isPublished:
          isPublished ?? dto.adminStatus === CareModuleAdminStatus.PUBLISHED,
        adminStatus:
          dto.adminStatus ??
          (isPublished
            ? CareModuleAdminStatus.PUBLISHED
            : CareModuleAdminStatus.DRAFT),
        createdByUserId: this.currentUserId(user),
        ...(Array.isArray(questions) &&
          questions.length > 0 && {
            questions: {
              create: questions.map((question: any, questionIndex: number) => ({
                question: question.question.trim(),
                type: question.type ?? CareQuestionType.SINGLE_CHOICE,
                explanation: question.explanation.trim(),
                sortOrder: questionIndex + 1,
                options: {
                  create: question.options.map(
                    (option: any, optionIndex: number) => ({
                      label: option.label.trim(),
                      isCorrect: Boolean(option.isCorrect),
                      sortOrder: optionIndex + 1,
                    }),
                  ),
                },
              })),
            },
          }),
      },
      include: moduleDetailInclude,
    });

    return {
      success: true,
      message: 'Care module created successfully',
      data: this.formatModuleDetail(module),
    };
  }

  async updateModule(
    user: CurrentUserPayload,
    id: string,
    dto: any,
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    this.ensureAdmin(user);

    const existing = await this.prisma.careModule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Care module not found');
    }

    let questions =
      dto.questions !== undefined
        ? this.parseFormValue(dto.questions)
        : undefined;
    let contentSections =
      dto.contentSections !== undefined
        ? this.parseFormValue(dto.contentSections)
        : undefined;
    let isPublished =
      dto.isPublished !== undefined
        ? typeof dto.isPublished === 'string'
          ? dto.isPublished === 'true'
          : dto.isPublished
        : undefined;
    let coinReward =
      dto.coinReward !== undefined ? Number(dto.coinReward) : undefined;
    let estimatedMinutes =
      dto.estimatedMinutes !== undefined
        ? Number(dto.estimatedMinutes)
        : undefined;
    let suggestedMinAgeYears =
      dto.suggestedMinAgeYears !== undefined
        ? Number(dto.suggestedMinAgeYears)
        : undefined;
    let suggestedMaxAgeYears =
      dto.suggestedMaxAgeYears !== undefined
        ? Number(dto.suggestedMaxAgeYears)
        : undefined;

    let coverImageUrl = dto.coverImageUrl?.trim();
    let videoUrl = dto.videoUrl?.trim();

    if (files?.coverImage?.[0]) {
      coverImageUrl = await this.storageService.uploadFile(
        files.coverImage[0],
        'care-modules/covers',
      );
    }
    if (files?.video?.[0]) {
      videoUrl = await this.storageService.uploadFile(
        files.video[0],
        'care-modules/videos',
      );
    }

    if (Array.isArray(questions)) {
      this.validateQuestions(questions);
      await this.prisma.careQuizQuestion.deleteMany({
        where: { moduleId: id },
      });
    }

    const updated = await this.prisma.careModule.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle?.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(estimatedMinutes !== undefined && { estimatedMinutes }),
        ...(coinReward !== undefined && { coinReward }),
        ...(suggestedMinAgeYears !== undefined && { suggestedMinAgeYears }),
        ...(suggestedMaxAgeYears !== undefined && { suggestedMaxAgeYears }),
        ...(dto.contentTitle !== undefined && {
          contentTitle: dto.contentTitle?.trim(),
        }),
        ...(contentSections !== undefined && { contentSections }),
        ...(dto.keyTakeaway !== undefined && {
          keyTakeaway: dto.keyTakeaway?.trim(),
        }),
        ...(isPublished !== undefined && {
          isPublished,
          adminStatus: isPublished
            ? CareModuleAdminStatus.PUBLISHED
            : CareModuleAdminStatus.DRAFT,
        }),
        ...(dto.adminStatus !== undefined && {
          adminStatus: dto.adminStatus,
          isPublished: dto.adminStatus === CareModuleAdminStatus.PUBLISHED,
        }),
        ...(Array.isArray(questions) && {
          questions: {
            create: questions.map((question: any, questionIndex: number) => ({
              question: question.question.trim(),
              type: question.type ?? CareQuestionType.SINGLE_CHOICE,
              explanation: question.explanation.trim(),
              sortOrder: questionIndex + 1,
              options: {
                create: question.options.map(
                  (option: any, optionIndex: number) => ({
                    label: option.label.trim(),
                    isCorrect: Boolean(option.isCorrect),
                    sortOrder: optionIndex + 1,
                  }),
                ),
              },
            })),
          },
        }),
      },
      include: moduleDetailInclude,
    });

    return {
      success: true,
      message: 'Care module updated successfully',
      data: this.formatModuleDetail(updated),
    };
  }

  async deleteModule(user: CurrentUserPayload, id: string) {
    this.ensureAdmin(user);

    const existing = await this.prisma.careModule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Care module not found');
    }

    await this.prisma.careModule.delete({ where: { id } });

    return {
      success: true,
      message: 'Care module deleted successfully',
    };
  }

  async getSuggestedModules(
    user: CurrentUserPayload,
    childId: string,
    query: CareModuleQueryDto,
  ) {
    const userId = this.currentUserId(user);

    if (this.isNanny(user)) {
      await this.assertNannyCanViewChildCare(userId, childId);
    } else {
      await this.assertCanViewCare(userId, childId);
    }

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, name: true, birthDate: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const ageYears = child.birthDate
      ? this.childAgeYears(child.birthDate)
      : null;
    const moduleWhere = {
      ...this.moduleWhere(query, user),
      ...(ageYears !== null && {
        suggestedMinAgeYears: { lte: ageYears },
        suggestedMaxAgeYears: { gte: ageYears },
      }),
    } satisfies Prisma.CareModuleWhereInput;

    const [modules, total] = await Promise.all([
      this.prisma.careModule.findMany({
        where: moduleWhere,
        select: moduleListSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.careModule.count({ where: moduleWhere }),
    ]);

    const [savedIds, assignmentByModuleId] = await Promise.all([
      this.savedModuleIds(
        userId,
        modules.map((module) => module.id),
        childId,
      ),
      this.assignmentMapForCards(
        user,
        { ...query, childId },
        modules.map((module) => module.id),
      ),
    ]);
    const cards = modules.map((module) =>
      this.formatModuleCard(module, {
        isSaved: savedIds.has(module.id),
        assignment: assignmentByModuleId.get(module.id),
      }),
    );

    return {
      success: true,
      message: 'Suggested care modules fetched successfully',
      data: {
        child,
        ageYears,
        modules: cards,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        ageMatched: ageYears !== null,
        warning:
          ageYears === null
            ? 'Child birthDate is missing, so suggestions are not filtered by age.'
            : undefined,
      },
    };
  }

  async getCareHome(user: CurrentUserPayload, query: CareHomeQueryDto) {
    const userId = this.currentUserId(user);
    const { adminStatus, ageGroup, category, topicId, ...baseHomeQuery } =
      query;
    const activeTab = baseHomeQuery.tab ?? CareModuleTab.ALL;
    const canApplyTopic = activeTab === CareModuleTab.ALL;
    const selectedTopicId =
      canApplyTopic && topicId && topicId !== 'ALL' ? topicId : null;
    if (
      topicId &&
      topicId !== 'ALL' &&
      !Object.values(CareModuleCategory).includes(
        topicId as CareModuleCategory,
      )
    ) {
      throw new BadRequestException('Invalid topicId');
    }

    const moduleQuery = {
      ...baseHomeQuery,
      ...(selectedTopicId && {
        category: selectedTopicId as CareModuleCategory,
      }),
    };

    const [account, careChildren] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
          role: true,
        },
      }),
      this.getMyCareChildren(user),
    ]);

    if (!account) {
      throw new NotFoundException('User not found');
    }

    const children = careChildren.data;
    const selectedChildId = moduleQuery.childId ?? children[0]?.id ?? null;
    const homeQuery = {
      ...moduleQuery,
      ...(selectedChildId && { childId: selectedChildId }),
    };
    const moduleResponse = await this.getModules(user, homeQuery);

    return {
      success: true,
      message: 'Care home fetched successfully',
      data: {
        user: {
          id: account.id,
          name: account.fullName,
          email: account.email,
          image: account.profilePictureUrl,
          role: account.role,
          greeting: this.timeGreeting(),
        },
        selectedChildId,
        modules: moduleResponse.data,
        caregivingHub: {
          title: 'Explore Baby handling lesson',
          subtitle:
            "Assign care modules to your nanny based on your child's needs.",
          selectedChildId,
          modules: moduleResponse.data,
        },
        meta: {
          ...moduleResponse.meta,
          filters: {
            childId: selectedChildId,
            tab: activeTab,
            topicId: selectedTopicId ?? 'ALL',
            search: homeQuery.search ?? null,
            nannyUserId: homeQuery.nannyUserId ?? null,
          },
        },
      },
    };
  }

  async getCareHomeTabs(user: CurrentUserPayload, query: CareHomeTabsQueryDto) {
    if (!query.childId) {
      throw new BadRequestException('childId query parameter is required');
    }

    const userId = this.currentUserId(user);
    if (this.isNanny(user)) {
      await this.assertNannyCanViewChildCare(userId, query.childId);
    } else {
      await this.assertCanViewCare(userId, query.childId);
    }

    const homeQuery = {
      childId: query.childId,
      page: 1,
      limit: 1,
    };
    const tabCounts = await this.careHomeTabCounts(user, homeQuery);

    return {
      success: true,
      message: 'Care home tabs fetched successfully',
      meta: {
        childId: query.childId ?? null,
      },
      data: [
        {
          id: CareModuleTab.ALL,
          key: CareModuleTab.ALL,
          label: 'All Modules',
          count: tabCounts.all,
          isActive: true,
        },
        {
          id: CareModuleTab.IN_PROGRESS,
          key: CareModuleTab.IN_PROGRESS,
          label: 'In progress',
          count: tabCounts.inProgress,
          isActive: false,
        },
        {
          id: CareModuleTab.COMPLETED,
          key: CareModuleTab.COMPLETED,
          label: 'Completed',
          count: tabCounts.completed,
          isActive: false,
        },
        {
          id: CareModuleTab.SAVED,
          key: CareModuleTab.SAVED,
          label: 'Saved',
          count: tabCounts.saved,
          isActive: false,
        },
      ],
    };
  }

  getCareHomeTopics() {
    return {
      success: true,
      message: 'Care home topics fetched successfully',
      data: CARE_HOME_TOPICS.map(({ id, label }) => ({ id, label })),
    };
  }

  async getMyCareChildren(user: CurrentUserPayload) {
    const userId = this.currentUserId(user);
    const childIds = await this.accessibleChildIds(userId);

    const children = await this.prisma.child.findMany({
      where: {
        id: { in: childIds },
        OR: [
          { nannies: { some: {} } },
          {
            caregiverAccesses: {
              some: {
                role: CaregiverAccessRole.NANNY,
                status: CaregiverAccessStatus.ACCEPTED,
              },
            },
          },
          { careAssignments: { some: {} } },
        ],
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        gender: true,
        birthDate: true,
        parentUserId: true,
        parentUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      message: 'Care children fetched successfully',
      data: children.map((child) => ({
        ...child,
        ageYears: child.birthDate ? this.childAgeYears(child.birthDate) : null,
      })),
    };
  }

  async getChildInsights(
    user: CurrentUserPayload,
    childId: string,
    query: CareChildInsightsQueryDto,
  ) {
    const userId = this.currentUserId(user);

    if (this.isNanny(user)) {
      await this.assertNannyCanViewChildCare(userId, childId);
    } else {
      await this.assertCanViewCare(userId, childId);
    }

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, name: true, avatar: true, birthDate: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const range = this.resolveInsightsRange(query);
    const baseWhere = {
      dayPlan: {
        childId,
        date: {
          gte: range.start,
          lt: range.end,
        },
      },
    } satisfies Prisma.DayActivityWhereInput;

    const favoriteWhere = {
      ...baseWhere,
      feedback: {
        is: {
          enjoyment: { in: [...FAVORITE_ENJOYMENT] },
          childMood: { in: [...FAVORITE_MOODS] },
          completionRate: FAVORITE_COMPLETION,
        },
      },
    } satisfies Prisma.DayActivityWhereInput;

    const [activitiesDone, mealsLogged, favoriteMeals, favoriteActivities] =
      await Promise.all([
        this.prisma.dayActivity.count({
          where: {
            ...baseWhere,
            OR: this.categoryKeywordWhere(ACTIVITY_CATEGORY_KEYWORDS),
          },
        }),
        this.prisma.dayActivity.count({
          where: {
            ...baseWhere,
            OR: this.categoryKeywordWhere(MEAL_CATEGORY_KEYWORDS),
          },
        }),
        this.prisma.dayActivity.findMany({
          where: {
            ...favoriteWhere,
            OR: this.categoryKeywordWhere(MEAL_CATEGORY_KEYWORDS),
          },
          include: this.insightActivityInclude(),
          orderBy: [
            { feedback: { submittedAt: 'desc' } },
            { updatedAt: 'desc' },
          ],
          take: 10,
        }),
        this.prisma.dayActivity.findMany({
          where: {
            ...favoriteWhere,
            OR: this.categoryKeywordWhere(ACTIVITY_CATEGORY_KEYWORDS),
          },
          include: this.insightActivityInclude(),
          orderBy: [
            { feedback: { submittedAt: 'desc' } },
            { updatedAt: 'desc' },
          ],
          take: 10,
        }),
      ]);

    return {
      success: true,
      message: 'Care child insights fetched successfully',
      data: {
        child: {
          ...child,
          ageYears: child.birthDate
            ? this.childAgeYears(child.birthDate)
            : null,
        },
        period: {
          type: query.period ?? 'month',
          month: range.month,
          week: range.week,
          startDate: range.start,
          endDate: range.end,
        },
        meta: {
          activitiesDone,
          mealsLogged,
        },
        favoriteActivities: favoriteActivities.map((activity) =>
          this.formatInsightActivity(activity),
        ),
        favoriteMeals: favoriteMeals.map((activity) =>
          this.formatInsightActivity(activity),
        ),
      },
    };
  }

  async getMonthlyHighlights(
    user: CurrentUserPayload,
    childId: string,
    query: CareMonthlyHighlightsQueryDto,
  ) {
    const userId = this.currentUserId(user);

    if (this.isNanny(user)) {
      await this.assertNannyCanViewChildCare(userId, childId);
    } else {
      await this.assertCanViewCare(userId, childId);
    }

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, name: true, avatar: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const range = this.resolveMonthRange(query.month);
    const proofWhere = {
      mediaAsset: {
        type: MediaType.IMAGE,
      },
      dayActivity: {
        dayPlan: {
          childId,
          date: {
            gte: range.start,
            lt: range.end,
          },
        },
        feedback: {
          is: {
            enjoyment: { in: [...FAVORITE_ENJOYMENT] },
            childMood: { in: [...FAVORITE_MOODS] },
            completionRate: FAVORITE_COMPLETION,
          },
        },
      },
    } satisfies Prisma.DayActivityProofWhereInput;

    const [proofs, totalProofs] = await Promise.all([
      this.prisma.dayActivityProof.findMany({
        where: proofWhere,
        include: {
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
            include: {
              dayPlan: { select: { id: true, date: true } },
              feedback: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.dayActivityProof.count({ where: proofWhere }),
    ]);

    return {
      success: true,
      message: 'Care monthly highlights fetched successfully',
      data: {
        child,
        period: {
          month: range.month,
          label: range.label,
          startDate: range.start,
          endDate: range.end,
        },
        summary: {
          photos: totalProofs,
        },
        previewImages: proofs.slice(0, 3).map((proof) => proof.mediaAsset.url),
        highlights: proofs.map((proof) => ({
          id: proof.id,
          imageUrl: proof.mediaAsset.url,
          caption: proof.caption,
          createdAt: proof.createdAt,
          uploadedByUser: proof.uploadedByUser,
          activity: {
            id: proof.dayActivity.id,
            title: proof.dayActivity.title,
            category: proof.dayActivity.category,
            description: proof.dayActivity.description,
            date: proof.dayActivity.dayPlan.date,
            feedback: proof.dayActivity.feedback
              ? {
                  enjoyment: proof.dayActivity.feedback.enjoyment,
                  childMood: proof.dayActivity.feedback.childMood,
                  completionRate: proof.dayActivity.feedback.completionRate,
                  note: proof.dayActivity.feedback.note,
                }
              : null,
          },
        })),
      },
    };
  }

  async getChildNotes(user: CurrentUserPayload, childId: string) {
    await this.assertCanUseChildNotes(user, childId);

    const notes = await this.prisma.careChildNote.findMany({
      where: { childId },
      include: this.childNoteInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Care child notes fetched successfully',
      data: notes.map((note) => this.formatChildNote(note, childId)),
    };
  }

  async createChildNote(
    user: CurrentUserPayload,
    childId: string,
    dto: CreateCareChildNoteDto,
  ) {
    await this.assertCanUseChildNotes(user, childId);

    const note = await this.prisma.careChildNote.create({
      data: {
        childId,
        authorUserId: this.currentUserId(user),
        note: dto.note.trim(),
      },
      include: this.childNoteInclude(),
    });

    return {
      success: true,
      message: 'Care child note created successfully',
      data: this.formatChildNote(note, childId),
    };
  }

  async deleteChildNote(
    user: CurrentUserPayload,
    childId: string,
    noteId: string,
  ) {
    await this.assertCanUseChildNotes(user, childId);

    const note = await this.prisma.careChildNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        childId: true,
        authorUserId: true,
        child: { select: { parentUserId: true } },
      },
    });

    if (!note || note.childId !== childId) {
      throw new NotFoundException('Care child note not found');
    }

    const userId = this.currentUserId(user);
    if (note.authorUserId !== userId && note.child.parentUserId !== userId) {
      throw new ForbiddenException('You cannot delete this care note');
    }

    await this.prisma.careChildNote.delete({ where: { id: noteId } });

    return {
      success: true,
      message: 'Care child note deleted successfully',
    };
  }

  async getModules(user: CurrentUserPayload, query: CareModuleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const userId = this.currentUserId(user);
    const tab = query.tab ?? CareModuleTab.ALL;

    if (query.childId) {
      if (this.isNanny(user)) {
        await this.assertNannyCanViewChildCare(userId, query.childId);
      } else {
        await this.assertCanViewCare(userId, query.childId);
      }
    }

    const moduleWhere = this.moduleWhere(query, user);

    if (tab === CareModuleTab.SAVED) {
      const where = {
        userId,
        ...(query.childId && { childId: query.childId }),
        module: moduleWhere,
      } satisfies Prisma.CareModuleSaveWhereInput;

      const [saves, total] = await Promise.all([
        this.prisma.careModuleSave.findMany({
          where,
          include: { module: { select: moduleListSelect } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.careModuleSave.count({ where }),
      ]);

      return this.paginatedModules(
        saves.map((save) =>
          this.formatModuleCard(save.module, {
            isSaved: true,
          }),
        ),
        total,
        page,
        limit,
      );
    }

    if (
      (query.childId && tab === CareModuleTab.ALL) ||
      tab === CareModuleTab.IN_PROGRESS ||
      tab === CareModuleTab.COMPLETED ||
      this.isNanny(user)
    ) {
      const where = await this.assignmentWhereForUser(user, query, tab);
      const [assignments, total] = await Promise.all([
        this.prisma.careModuleAssignment.findMany({
          where: { ...where, module: moduleWhere },
          include: {
            module: { select: moduleListSelect },
            child: { select: { id: true, name: true, avatar: true } },
            nannyUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profilePictureUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.careModuleAssignment.count({
          where: { ...where, module: moduleWhere },
        }),
      ]);

      const savedIds = await this.savedModuleIds(
        userId,
        assignments.map((assignment) => assignment.moduleId),
        query.childId,
      );

      return this.paginatedModules(
        assignments.map((assignment) =>
          this.formatModuleCard(assignment.module, {
            assignment,
            isSaved: savedIds.has(assignment.moduleId),
          }),
        ),
        total,
        page,
        limit,
      );
    }

    const [modules, total] = await Promise.all([
      this.prisma.careModule.findMany({
        where: moduleWhere,
        select: moduleListSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.careModule.count({ where: moduleWhere }),
    ]);

    const [savedIds, assignmentByModuleId] = await Promise.all([
      this.savedModuleIds(
        userId,
        modules.map((module) => module.id),
        query.childId,
      ),
      this.assignmentMapForCards(
        user,
        query,
        modules.map((module) => module.id),
      ),
    ]);

    return this.paginatedModules(
      modules.map((module) =>
        this.formatModuleCard(module, {
          isSaved: savedIds.has(module.id),
          assignment: assignmentByModuleId.get(module.id),
        }),
      ),
      total,
      page,
      limit,
    );
  }

  async getAdminModules(user: CurrentUserPayload, query: CareModuleQueryDto) {
    this.ensureAdmin(user);

    const where = this.moduleWhere(query, user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [totalModules, published, draft, modules, total] = await Promise.all([
      this.prisma.careModule.count(),
      this.prisma.careModule.count({
        where: { adminStatus: CareModuleAdminStatus.PUBLISHED },
      }),
      this.prisma.careModule.count({
        where: { adminStatus: CareModuleAdminStatus.DRAFT },
      }),
      this.prisma.careModule.findMany({
        where,
        include: {
          _count: {
            select: {
              assignments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.careModule.count({ where }),
    ]);

    const formattedModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      subtitle: m.subtitle,
      description: m.description,
      coverImageUrl: m.coverImageUrl,
      videoUrl: m.videoUrl,
      category: m.category,
      ageGroup: this.formatAgeRange(
        m.suggestedMinAgeYears,
        m.suggestedMaxAgeYears,
      ),
      suggestedMinAgeYears: m.suggestedMinAgeYears,
      suggestedMaxAgeYears: m.suggestedMaxAgeYears,
      estimatedMinutes: m.estimatedMinutes ?? 15,
      coinReward: m.coinReward,
      adminStatus: m.adminStatus,
      isPublished: m.isPublished,
      assignedNanniesCount: m._count.assignments,
      assignedText: `${m._count.assignments} Nannies`,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return {
      stats: {
        totalModules,
        published,
        draft,
      },
      modules: formattedModules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleModuleStatus(
    user: CurrentUserPayload,
    moduleId: string,
    dto?: ToggleCareModuleStatusDto,
  ) {
    this.ensureAdmin(user);

    const module = await this.prisma.careModule.findUnique({
      where: { id: moduleId },
      select: { id: true, adminStatus: true, isPublished: true },
    });

    if (!module) {
      throw new NotFoundException(`Care module with ID ${moduleId} not found`);
    }

    let nextStatus: CareModuleAdminStatus;
    if (dto?.adminStatus) {
      nextStatus = dto.adminStatus;
    } else {
      nextStatus =
        module.adminStatus === CareModuleAdminStatus.PUBLISHED
          ? CareModuleAdminStatus.DRAFT
          : CareModuleAdminStatus.PUBLISHED;
    }

    const isPublished = nextStatus === CareModuleAdminStatus.PUBLISHED;

    const updated = await this.prisma.careModule.update({
      where: { id: moduleId },
      data: {
        adminStatus: nextStatus,
        isPublished,
      },
      select: {
        id: true,
        title: true,
        adminStatus: true,
        isPublished: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async getAdminModuleDetail(user: CurrentUserPayload, moduleId: string) {
    this.ensureAdmin(user);

    const module = await this.prisma.careModule.findUnique({
      where: { id: moduleId },
      include: moduleDetailInclude,
    });

    if (!module) {
      throw new NotFoundException(`Care module with ID ${moduleId} not found`);
    }

    const assignedNanniesCount = await this.prisma.careModuleAssignment.count({
      where: { moduleId },
    });

    return {
      success: true,
      message: 'Admin care module details fetched successfully',
      data: {
        ...this.formatModuleDetail(module),
        ageGroup: this.formatAgeRange(
          module.suggestedMinAgeYears,
          module.suggestedMaxAgeYears,
        ),
        assignedNanniesCount,
        assignedText: `${assignedNanniesCount} Nannies`,
      },
    };
  }

  async getModuleDetail(
    user: CurrentUserPayload,
    moduleId: string,
    assignmentId?: string,
    childId?: string,
  ) {
    const userId = this.currentUserId(user);
    const module = await this.prisma.careModule.findFirst({
      where: {
        id: moduleId,
        ...(!this.isAdmin(user) && { isPublished: true }),
      },
      include: moduleDetailInclude,
    });

    if (!module) {
      throw new NotFoundException('Care module not found');
    }

    const assignment = assignmentId
      ? await this.getAssignmentForUser(user, assignmentId)
      : await this.findRelevantAssignment(user, moduleId);

    if (
      assignment &&
      assignment.status === CareModuleAssignmentStatus.ASSIGNED
    ) {
      await this.prisma.careModuleAssignment.update({
        where: { id: assignment.id },
        data: {
          status: CareModuleAssignmentStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
      assignment.status = CareModuleAssignmentStatus.IN_PROGRESS;
      assignment.startedAt = new Date();
    }

    const savedChildId = childId ?? assignment?.childId;
    const isSaved = savedChildId
      ? await this.prisma.careModuleSave.findUnique({
          where: {
            moduleId_userId_childId: {
              moduleId,
              userId,
              childId: savedChildId,
            },
          },
          select: { id: true },
        })
      : null;

    return {
      success: true,
      message: 'Care module fetched successfully',
      data: this.formatModuleDetail(module, {
        assignment,
        isSaved: Boolean(isSaved),
      }),
    };
  }

  async assignModule(user: CurrentUserPayload, dto: AssignCareModuleDto) {
    const userId = this.currentUserId(user);
    await this.assertCanAssignCare(userId, dto.childId);

    const [module, nanny] = await Promise.all([
      this.prisma.careModule.findFirst({
        where: { id: dto.moduleId, isPublished: true },
        select: { id: true },
      }),
      this.resolveAssignmentNanny(dto.nannyUserId, dto.childId),
    ]);

    if (!module) {
      throw new NotFoundException('Published care module not found');
    }

    if (!nanny) {
      throw new NotFoundException('Nanny user not found');
    }

    if (nanny.role !== UserRole.NANNY) {
      throw new BadRequestException('Assigned user must be a nanny');
    }

    await this.assertNannyBelongsToChild(nanny.id, dto.childId);

    const assignment = await this.prisma.careModuleAssignment.upsert({
      where: {
        moduleId_childId_nannyUserId: {
          moduleId: dto.moduleId,
          childId: dto.childId,
          nannyUserId: nanny.id,
        },
      },
      update: {
        assignedByUserId: userId,
        status: CareModuleAssignmentStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      create: {
        moduleId: dto.moduleId,
        childId: dto.childId,
        nannyUserId: nanny.id,
        assignedByUserId: userId,
        status: CareModuleAssignmentStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: this.assignmentInclude(),
    });

    return {
      success: true,
      message: 'Care module assigned successfully',
      data: this.formatAssignment(assignment),
    };
  }

  async saveModule(
    user: CurrentUserPayload,
    moduleId: string,
    dto: SaveCareModuleDto,
  ) {
    const userId = this.currentUserId(user);
    await this.assertPublishedModule(moduleId);
    await this.assertCanSaveModuleForChild(user, dto.childId);

    const save = await this.prisma.careModuleSave.upsert({
      where: {
        moduleId_userId_childId: {
          moduleId,
          userId,
          childId: dto.childId,
        },
      },
      update: {},
      create: { moduleId, userId, childId: dto.childId },
    });

    return {
      success: true,
      message: 'Care module saved successfully',
      data: save,
    };
  }

  async removeSavedModule(
    user: CurrentUserPayload,
    moduleId: string,
    dto: SaveCareModuleDto,
  ) {
    const userId = this.currentUserId(user);
    await this.assertCanSaveModuleForChild(user, dto.childId);

    await this.prisma.careModuleSave.deleteMany({
      where: { moduleId, userId, childId: dto.childId },
    });

    return {
      success: true,
      message: 'Care module removed from saved list',
    };
  }

  async submitQuiz(
    user: CurrentUserPayload,
    assignmentId: string,
    dto: SubmitCareQuizDto,
  ) {
    const assignment = await this.getAssignmentForUser(user, assignmentId);
    const lockedUntil = this.quizLockedUntil(assignment);
    if (lockedUntil && lockedUntil > new Date()) {
      throw new BadRequestException(
        `This quiz is locked until ${lockedUntil.toISOString()}`,
      );
    }

    const module = await this.prisma.careModule.findUnique({
      where: { id: assignment.moduleId },
      include: {
        questions: {
          include: { options: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Care module not found');
    }

    const answersByQuestionId = new Map(
      dto.answers.map((answer) => [answer.questionId, answer.selectedOptionId]),
    );

    if (answersByQuestionId.size !== module.questions.length) {
      throw new BadRequestException('Answer all quiz questions before submit');
    }

    const answerRows = module.questions.map((question) => {
      const selectedOptionId = answersByQuestionId.get(question.id);
      const selectedOption = question.options.find(
        (option) => option.id === selectedOptionId,
      );

      if (!selectedOption) {
        throw new BadRequestException(
          'Selected option does not match question',
        );
      }

      return {
        assignmentId,
        questionId: question.id,
        selectedOptionId: selectedOption.id,
        isCorrect: selectedOption.isCorrect,
      };
    });

    const correctAnswers = answerRows.filter(
      (answer) => answer.isCorrect,
    ).length;
    const totalQuestions = module.questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const isPerfectScore = correctAnswers === totalQuestions;
    const pointsEarned =
      isPerfectScore && !assignment.pointsAwardedAt
        ? QUIZ_PERFECT_SCORE_POINTS
        : assignment.pointsEarned;
    const pointsAwardedAt =
      isPerfectScore && !assignment.pointsAwardedAt
        ? new Date()
        : assignment.pointsAwardedAt;

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        answerRows.map((answer) =>
          tx.careQuizAnswer.upsert({
            where: {
              assignmentId_questionId: {
                assignmentId,
                questionId: answer.questionId,
              },
            },
            update: {
              selectedOptionId: answer.selectedOptionId,
              isCorrect: answer.isCorrect,
              answeredAt: new Date(),
            },
            create: answer,
          }),
        ),
      );

      await tx.careModuleAssignment.update({
        where: { id: assignmentId },
        data: {
          status: isPerfectScore
            ? CareModuleAssignmentStatus.COMPLETED
            : CareModuleAssignmentStatus.IN_PROGRESS,
          completedAt: isPerfectScore ? new Date() : null,
          totalQuestions,
          correctAnswers,
          score,
          pointsEarned,
          pointsAwardedAt,
          startedAt: assignment.startedAt ?? new Date(),
        },
      });
    });

    if (isPerfectScore) {
      await this.rewardsService.awardCareModuleCompletion(
        assignment.nannyUserId,
        assignmentId,
        QUIZ_PERFECT_SCORE_POINTS,
        {
          moduleId: module.id,
          moduleTitle: module.title,
          childId: assignment.childId,
          completedByRole: user.role,
        },
      );
    }

    return this.getQuizResult(user, assignmentId);
  }

  async getQuizResult(user: CurrentUserPayload, assignmentId: string) {
    const assignment = await this.getAssignmentForUser(user, assignmentId);
    const answers = await this.prisma.careQuizAnswer.findMany({
      where: { assignmentId },
      include: {
        selectedOption: { select: { id: true, label: true, isCorrect: true } },
        question: {
          include: {
            options: {
              select: {
                id: true,
                label: true,
                isCorrect: true,
                sortOrder: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { question: { sortOrder: 'asc' } },
    });

    return {
      success: true,
      message: 'Care quiz result fetched successfully',
      data: {
        assignment: this.formatAssignmentSummary(assignment),
        result: {
          correctAnswers: assignment.correctAnswers ?? 0,
          totalQuestions: assignment.totalQuestions ?? answers.length,
          score: assignment.score ?? 0,
          pointsEarned: assignment.pointsEarned,
          pointsAwardedAt: assignment.pointsAwardedAt,
          canRetakeQuiz: !this.quizLockedUntil(assignment),
          quizLockedUntil: this.quizLockedUntil(assignment),
          completedAt: assignment.completedAt,
        },
        answers: answers.map((answer) => ({
          questionId: answer.questionId,
          question: answer.question.question,
          explanation: answer.question.explanation,
          selectedOptionId: answer.selectedOptionId,
          selectedOption: answer.selectedOption,
          isCorrect: answer.isCorrect,
          options: answer.question.options.map((option) => ({
            id: option.id,
            label: option.label,
            isCorrect: option.isCorrect,
            state:
              option.id === answer.selectedOptionId
                ? answer.isCorrect
                  ? 'selected_correct'
                  : 'selected_wrong'
                : option.isCorrect
                  ? 'correct'
                  : 'neutral',
          })),
        })),
      },
    };
  }

  private validateQuestions(questions: CreateCareModuleDto['questions']) {
    for (const question of questions) {
      const correctCount = question.options.filter(
        (option) => option.isCorrect,
      ).length;

      if (correctCount !== 1) {
        throw new BadRequestException(
          'Each quiz question must have exactly one correct option',
        );
      }

      if (
        question.type === CareQuestionType.TRUE_FALSE &&
        question.options.length !== 2
      ) {
        throw new BadRequestException(
          'True/false questions must have exactly two options',
        );
      }
    }
  }

  private parseFormValue(val: any) {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }

  private validateSuggestedAgeRange(dto: CareModuleSuggestedAgeRange) {
    if (
      dto.suggestedMinAgeYears !== undefined &&
      dto.suggestedMaxAgeYears !== undefined &&
      dto.suggestedMinAgeYears > dto.suggestedMaxAgeYears
    ) {
      throw new BadRequestException(
        'suggestedMinAgeYears cannot be greater than suggestedMaxAgeYears',
      );
    }
  }

  private async careHomeTabCounts(
    user: CurrentUserPayload,
    query: CareModuleQueryDto,
  ) {
    const [all, inProgress, completed, saved] = await Promise.all([
      this.countModulesForTab(user, query, CareModuleTab.ALL),
      this.countModulesForTab(user, query, CareModuleTab.IN_PROGRESS),
      this.countModulesForTab(user, query, CareModuleTab.COMPLETED),
      this.countModulesForTab(user, query, CareModuleTab.SAVED),
    ]);

    return { all, inProgress, completed, saved };
  }

  private async countModulesForTab(
    user: CurrentUserPayload,
    query: CareModuleQueryDto,
    tab: CareModuleTab,
  ) {
    const userId = this.currentUserId(user);
    const countQuery = { ...query, tab };
    const moduleWhere = this.moduleWhere(countQuery, user);

    if (tab === CareModuleTab.SAVED) {
      return this.prisma.careModuleSave.count({
        where: {
          userId,
          ...(query.childId && { childId: query.childId }),
          module: moduleWhere,
        },
      });
    }

    if (
      tab === CareModuleTab.IN_PROGRESS ||
      tab === CareModuleTab.COMPLETED ||
      this.isNanny(user)
    ) {
      const assignmentWhere = await this.assignmentWhereForUser(
        user,
        countQuery,
        tab,
      );

      return this.prisma.careModuleAssignment.count({
        where: {
          ...assignmentWhere,
          module: moduleWhere,
        },
      });
    }

    return this.prisma.careModule.count({ where: moduleWhere });
  }

  private timeGreeting() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
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

  private moduleWhere(query: CareModuleQueryDto, user?: CurrentUserPayload) {
    const isAdmin = user && this.isAdmin(user);
    const adminStatus = query.adminStatus;
    const category = query.category;
    const searchCategories = query.search
      ? this.matchingCareCategories(query.search)
      : [];

    return {
      ...(!isAdmin && { isPublished: true }),
      ...(isAdmin &&
        adminStatus &&
        adminStatus !== CareModuleAdminStatus.ALL && {
          adminStatus: adminStatus,
        }),
      ...(category && { category: category }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          {
            subtitle: { contains: query.search, mode: 'insensitive' as const },
          },
          {
            description: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          },
          ...(searchCategories.length > 0
            ? [{ category: { in: searchCategories } }]
            : []),
        ],
      }),
    } satisfies Prisma.CareModuleWhereInput;
  }

  private matchingCareCategories(search: string): CareModuleCategory[] {
    const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    const searchWords = normalizedSearch.split(' ').filter(Boolean);

    if (searchWords.length === 0) {
      return [];
    }

    return CARE_HOME_TOPICS.flatMap((topic) => {
      if (!topic.value) {
        return [];
      }

      const topicWords = `${topic.id} ${topic.label}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ');

      return topicWords.includes(normalizedSearch.trim()) ||
        searchWords.some((word) => topicWords.includes(word))
        ? [topic.value]
        : [];
    });
  }

  private formatAgeRange(min?: number | null, max?: number | null): string {
    if (min != null && max != null) return `${min}-${max} years`;
    if (min != null) return `${min}+ years`;
    if (max != null) return `Up to ${max} years`;
    return 'All ages';
  }

  private async assignmentWhereForUser(
    user: CurrentUserPayload,
    query: CareModuleQueryDto,
    tab: CareModuleTab,
  ) {
    const userId = this.currentUserId(user);
    const tabWhere = this.assignmentTabWhere(tab);

    if (this.isNanny(user)) {
      return {
        nannyUserId: userId,
        ...(query.childId && { childId: query.childId }),
        ...tabWhere,
      } satisfies Prisma.CareModuleAssignmentWhereInput;
    }

    const childIds = query.childId
      ? [query.childId]
      : await this.accessibleChildIds(userId);

    return {
      childId: { in: childIds },
      ...(query.nannyUserId && { nannyUserId: query.nannyUserId }),
      ...tabWhere,
    } satisfies Prisma.CareModuleAssignmentWhereInput;
  }

  private assignmentTabWhere(tab: CareModuleTab) {
    if (tab === CareModuleTab.IN_PROGRESS) {
      return {
        OR: [
          {
            status: {
              in: [
                CareModuleAssignmentStatus.ASSIGNED,
                CareModuleAssignmentStatus.IN_PROGRESS,
              ],
            },
          },
          {
            status: CareModuleAssignmentStatus.COMPLETED,
            score: { lt: 100 },
          },
        ],
      } satisfies Prisma.CareModuleAssignmentWhereInput;
    }

    if (tab === CareModuleTab.COMPLETED) {
      return {
        status: CareModuleAssignmentStatus.COMPLETED,
        score: 100,
      } satisfies Prisma.CareModuleAssignmentWhereInput;
    }

    return {};
  }

  private async assignmentMapForCards(
    user: CurrentUserPayload,
    query: CareModuleQueryDto,
    moduleIds: string[],
  ) {
    if (moduleIds.length === 0) {
      return new Map<string, Prisma.CareModuleAssignmentGetPayload<object>>();
    }

    const userId = this.currentUserId(user);
    const childIds = query.childId
      ? [query.childId]
      : this.isNanny(user)
        ? undefined
        : await this.accessibleChildIds(userId);

    const assignments = await this.prisma.careModuleAssignment.findMany({
      where: {
        moduleId: { in: moduleIds },
        ...(this.isNanny(user)
          ? { nannyUserId: userId }
          : {
              childId: { in: childIds },
              ...(query.nannyUserId && { nannyUserId: query.nannyUserId }),
            }),
      },
      orderBy: { updatedAt: 'desc' },
    });

    return new Map(
      assignments.map((assignment) => [assignment.moduleId, assignment]),
    );
  }

  private async savedModuleIds(
    userId: string,
    moduleIds: string[],
    childId?: string,
  ) {
    if (moduleIds.length === 0 || !childId) return new Set<string>();

    const saves = await this.prisma.careModuleSave.findMany({
      where: { userId, childId, moduleId: { in: moduleIds } },
      select: { moduleId: true },
    });

    return new Set(saves.map((save) => save.moduleId));
  }

  private async findRelevantAssignment(
    user: CurrentUserPayload,
    moduleId: string,
  ) {
    if (!this.isNanny(user)) return null;

    return this.prisma.careModuleAssignment.findFirst({
      where: {
        moduleId,
        nannyUserId: this.currentUserId(user),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getAssignmentForUser(
    user: CurrentUserPayload,
    assignmentId: string,
  ) {
    const assignment = await this.prisma.careModuleAssignment.findUnique({
      where: { id: assignmentId },
      include: this.assignmentInclude(),
    });

    if (!assignment) {
      throw new NotFoundException('Care assignment not found');
    }

    const userId = this.currentUserId(user);
    if (this.isNanny(user)) {
      if (assignment.nannyUserId !== userId) {
        throw new ForbiddenException(
          'This assignment belongs to another nanny',
        );
      }
      return assignment;
    }

    await this.assertCanViewCare(userId, assignment.childId);
    return assignment;
  }

  private async assertCanViewCare(userId: string, childId: string) {
    await this.assertChildAccess(userId, childId, [
      'careLearningAccess',
      'nannyDevelopment',
      'manageCareTeam',
    ]);
  }

  private async assertCanAssignCare(userId: string, childId: string) {
    await this.assertChildAccess(userId, childId, [
      'manageCareTeam',
      'nannyDevelopment',
    ]);
  }

  private async assertCanSaveModuleForChild(
    user: CurrentUserPayload,
    childId: string,
  ) {
    const userId = this.currentUserId(user);

    if (this.isNanny(user)) {
      await this.assertNannyCanViewChildCare(userId, childId);
      return;
    }

    await this.assertCanViewCare(userId, childId);
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

  private async accessibleChildIds(userId: string) {
    const [children, accesses, nannyAssignments, nannyLinks] =
      await Promise.all([
        this.prisma.child.findMany({
          where: { parentUserId: userId },
          select: { id: true },
        }),
        this.prisma.caregiverAccess.findMany({
          where: {
            invitedUserId: userId,
            status: CaregiverAccessStatus.ACCEPTED,
            OR: [
              { careLearningAccess: true },
              { nannyDevelopment: true },
              { manageCareTeam: true },
            ],
          },
          select: { childId: true },
        }),
        this.prisma.careModuleAssignment.findMany({
          where: { nannyUserId: userId },
          select: { childId: true },
        }),
        this.prisma.nannyChildLink.findMany({
          where: { nannyUserId: userId },
          select: { childId: true },
        }),
      ]);

    return [
      ...new Set([
        ...children.map((child) => child.id),
        ...accesses.map((access) => access.childId),
        ...nannyAssignments.map((assignment) => assignment.childId),
        ...nannyLinks.map((link) => link.childId),
      ]),
    ];
  }

  private async resolveAssignmentNanny(
    nannyUserIdOrAccessId: string,
    childId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: nannyUserIdOrAccessId },
      select: { id: true, role: true, fullName: true },
    });

    if (user) {
      return user;
    }

    const access = await this.prisma.caregiverAccess.findFirst({
      where: {
        id: nannyUserIdOrAccessId,
        childId,
        role: CaregiverAccessRole.NANNY,
      },
      select: {
        invitedUserId: true,
        invitedUser: {
          select: { id: true, role: true, fullName: true },
        },
      },
    });

    if (!access) {
      throw new NotFoundException('Nanny user or access record not found');
    }

    if (!access.invitedUserId || !access.invitedUser) {
      throw new BadRequestException(
        'Nanny invitation is not linked to a user yet',
      );
    }

    return access.invitedUser;
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
          status: {
            in: [CaregiverAccessStatus.PENDING, CaregiverAccessStatus.ACCEPTED],
          },
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

  private async assertPublishedModule(moduleId: string) {
    const module = await this.prisma.careModule.findFirst({
      where: { id: moduleId, isPublished: true },
      select: { id: true },
    });

    if (!module) {
      throw new NotFoundException('Published care module not found');
    }
  }

  private formatModuleCard(
    module: Prisma.CareModuleGetPayload<{ select: typeof moduleListSelect }>,
    options: {
      isSaved?: boolean;
      assignment?:
        | Prisma.CareModuleAssignmentGetPayload<{
            include: ReturnType<CareService['assignmentInclude']>;
          }>
        | Prisma.CareModuleAssignmentGetPayload<object>
        | null;
    } = {},
  ) {
    return {
      id: module.id,
      title: module.title,
      subtitle: module.subtitle,
      description: module.description,
      coverImageUrl: module.coverImageUrl,
      videoUrl: module.videoUrl,
      category: module.category,
      estimatedMinutes: module.estimatedMinutes,
      coinReward: module.coinReward,
      suggestedMinAgeYears: module.suggestedMinAgeYears,
      suggestedMaxAgeYears: module.suggestedMaxAgeYears,
      keyTakeaway: module.keyTakeaway,
      isPublished: module.isPublished,
      isSaved: Boolean(options.isSaved),
      questionCount: module.questions.length,
      assignment: options.assignment
        ? this.formatAssignmentSummary(options.assignment)
        : null,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    };
  }

  private formatModuleDetail(
    module: Prisma.CareModuleGetPayload<{
      include: typeof moduleDetailInclude;
    }>,
    options: {
      isSaved?: boolean;
      assignment?: Prisma.CareModuleAssignmentGetPayload<object> | null;
    } = {},
  ) {
    return {
      id: module.id,
      title: module.title,
      subtitle: module.subtitle,
      description: module.description,
      coverImageUrl: module.coverImageUrl,
      videoUrl: module.videoUrl,
      category: module.category,
      estimatedMinutes: module.estimatedMinutes,
      coinReward: module.coinReward,
      suggestedMinAgeYears: module.suggestedMinAgeYears,
      suggestedMaxAgeYears: module.suggestedMaxAgeYears,
      contentTitle: module.contentTitle,
      contentSections: module.contentSections,
      keyTakeaway: module.keyTakeaway,
      isPublished: module.isPublished,
      adminStatus: module.adminStatus,
      isSaved: Boolean(options.isSaved),
      assignment: options.assignment
        ? this.formatAssignmentSummary(options.assignment)
        : null,
      questions: module.questions.map((question) => ({
        id: question.id,
        question: question.question,
        type: question.type,
        explanation: question.explanation,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          isCorrect: option.isCorrect,
        })),
      })),
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    };
  }

  private formatAssignment(
    assignment: Prisma.CareModuleAssignmentGetPayload<{
      include: ReturnType<CareService['assignmentInclude']>;
    }>,
  ) {
    return {
      ...this.formatAssignmentSummary(assignment),
      module: assignment.module,
      child: assignment.child,
      nanny: assignment.nannyUser,
      assignedByUser: assignment.assignedByUser,
    };
  }

  private formatInsightActivity(
    activity: Prisma.DayActivityGetPayload<{
      include: ReturnType<CareService['insightActivityInclude']>;
    }>,
  ) {
    return {
      id: activity.id,
      dayPlanId: activity.dayPlanId,
      date: activity.dayPlan.date,
      category: activity.category,
      title: activity.title,
      description: activity.description,
      imageUrl: activity.imageUrl,
      status: activity.status,
      startTime: activity.startTime,
      endTime: activity.endTime,
      feedback: activity.feedback
        ? {
            enjoyment: activity.feedback.enjoyment,
            childMood: activity.feedback.childMood,
            completionRate: activity.feedback.completionRate,
            note: activity.feedback.note,
            submittedAt: activity.feedback.submittedAt,
            submittedByUser: activity.feedback.submittedByUser,
          }
        : null,
    };
  }

  private formatChildNote(
    note: Prisma.CareChildNoteGetPayload<{
      include: ReturnType<CareService['childNoteInclude']>;
    }>,
    childId: string,
  ) {
    return {
      id: note.id,
      childId: note.childId,
      note: note.note,
      author: {
        id: note.authorUser.id,
        fullName: note.authorUser.fullName,
        email: note.authorUser.email,
        role: note.authorUser.role,
        profilePictureUrl: note.authorUser.profilePictureUrl,
        relationship: this.noteAuthorRelationship(note, childId),
        displayName: `${note.authorUser.fullName} (${this.noteAuthorRelationship(
          note,
          childId,
        )})`,
      },
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  private noteAuthorRelationship(
    note: Prisma.CareChildNoteGetPayload<{
      include: ReturnType<CareService['childNoteInclude']>;
    }>,
    childId: string,
  ) {
    if (note.child.parentUserId === note.authorUserId) return 'Parent';
    if (note.authorUser.role === UserRole.NANNY) return 'Nanny';

    const access = note.authorUser.caregiverAccesses.find(
      (item) => item.childId === childId,
    );

    return access?.relationship ?? access?.role ?? note.authorUser.role;
  }

  private resolveInsightsRange(query: CareChildInsightsQueryDto) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const startOfNextMonth = new Date(Date.UTC(year, month, 1));

    if ((query.period ?? 'month') === 'week') {
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

  private resolveMonthRange(month?: number) {
    const now = new Date();
    const selectedMonth = month ?? now.getUTCMonth() + 1;
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), selectedMonth - 1, 1),
    );
    const end = new Date(Date.UTC(now.getUTCFullYear(), selectedMonth, 1));

    return {
      month: selectedMonth,
      label: start.toLocaleString('en-US', {
        month: 'long',
        timeZone: 'UTC',
      }),
      start,
      end,
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

  private formatAssignmentSummary(
    assignment:
      | Prisma.CareModuleAssignmentGetPayload<{
          include: ReturnType<CareService['assignmentInclude']>;
        }>
      | Prisma.CareModuleAssignmentGetPayload<object>,
  ) {
    const status = this.effectiveAssignmentStatus(assignment);

    return {
      id: assignment.id,
      moduleId: assignment.moduleId,
      childId: assignment.childId,
      nannyUserId: assignment.nannyUserId,
      assignedByUserId: assignment.assignedByUserId,
      status,
      score: assignment.score,
      totalQuestions: assignment.totalQuestions,
      correctAnswers: assignment.correctAnswers,
      pointsEarned: assignment.pointsEarned,
      pointsAwardedAt: assignment.pointsAwardedAt,
      canRetakeQuiz: !this.quizLockedUntil(assignment),
      quizLockedUntil: this.quizLockedUntil(assignment),
      startedAt: assignment.startedAt,
      completedAt:
        status === CareModuleAssignmentStatus.COMPLETED
          ? assignment.completedAt
          : null,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private effectiveAssignmentStatus(
    assignment: Prisma.CareModuleAssignmentGetPayload<object>,
  ) {
    if (assignment.status === CareModuleAssignmentStatus.ASSIGNED) {
      return CareModuleAssignmentStatus.IN_PROGRESS;
    }

    if (
      assignment.status === CareModuleAssignmentStatus.COMPLETED &&
      (assignment.score ?? 0) < 100
    ) {
      return CareModuleAssignmentStatus.IN_PROGRESS;
    }

    return assignment.status;
  }

  private quizLockedUntil(
    assignment: Prisma.CareModuleAssignmentGetPayload<object>,
  ) {
    if (!assignment.pointsAwardedAt) return null;

    const lockedUntil = new Date(assignment.pointsAwardedAt);
    lockedUntil.setMonth(lockedUntil.getMonth() + QUIZ_RETAKE_COOLDOWN_MONTHS);

    return lockedUntil > new Date() ? lockedUntil : null;
  }

  private paginatedModules(
    modules: ReturnType<CareService['formatModuleCard']>[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      success: true,
      message: 'Care modules fetched successfully',
      data: modules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private assignmentInclude() {
    return {
      module: { select: moduleListSelect },
      child: { select: { id: true, name: true, avatar: true } },
      nannyUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
        },
      },
      assignedByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
        },
      },
    } satisfies Prisma.CareModuleAssignmentInclude;
  }

  private insightActivityInclude() {
    return {
      dayPlan: {
        select: {
          id: true,
          date: true,
        },
      },
      feedback: {
        include: {
          submittedByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profilePictureUrl: true,
            },
          },
        },
      },
    } satisfies Prisma.DayActivityInclude;
  }

  private childNoteInclude() {
    return {
      child: { select: { id: true, parentUserId: true } },
      authorUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          profilePictureUrl: true,
          caregiverAccesses: {
            select: {
              childId: true,
              role: true,
              relationship: true,
            },
          },
        },
      },
    } satisfies Prisma.CareChildNoteInclude;
  }

  private async assertCanUseChildNotes(
    user: CurrentUserPayload,
    childId: string,
  ) {
    const userId = this.currentUserId(user);

    if (this.isNanny(user)) {
      await this.assertNannyCanViewChildCare(userId, childId);
      return;
    }

    await this.assertCanViewCare(userId, childId);
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

  private ensureAdmin(user: CurrentUserPayload) {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
