import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareModuleCategory,
  CareModuleAdminStatus,
  CareModuleProgressStatus,
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
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { RewardsService } from '../../rewards/rewards.service';
import { StorageService } from '../../../common/storage/storage.service';

import { CareChildInsightsQueryDto } from '../dto/care-child-insights-query.dto';
import {
  CareHomeQueryDto,
  CareHomeTabsQueryDto,
  CareModuleQueryDto,
  CareModuleTab,
} from '../dto/care-module-query.dto';
import { CareMonthlyHighlightsQueryDto } from '../dto/care-monthly-highlights-query.dto';
import { CreateCareChildNoteDto } from '../dto/create-care-child-note.dto';


import { SubmitCareQuizDto } from '../dto/submit-care-quiz.dto';



const moduleListSelect = {
  id: true,
  title: true,
  shortDescription: true,
  coverImageUrl: true,
  videoUrl: true,
  category: true,
  completionPoints: true,
  ageGroup: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  questions: { select: { id: true } },
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



@Injectable()
export class CarehubQuizService {
  private ageGroupForMonths(ageMonths: number) {
    if (ageMonths <= 6) return '0-6 months';
    if (ageMonths <= 12) return '6-12 months';
    if (ageMonths <= 24) return '12-24 months';
    if (ageMonths <= 48) return '2-4 years';
    return '4 years +';
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
    private readonly storageService: StorageService,
  ) { }

  /* async deleteModule(user: CurrentUserPayload, id: string) {

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
  } */
  /* async assignModule(user: CurrentUserPayload, dto: AssignCareModuleDto) {

    const userId = this.currentUserId(user);
    await this.assertCanAssignCare(userId, dto.childId);

    const [module, nanny] = await Promise.all([
      this.prisma.careModule.findFirst({
        where: { id: dto.moduleId, isPublished: true },
        select: { id: true },
      }),
      this.resolveProgressNanny(dto.userId, dto.childId),
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

    const progress = await this.prisma.careModuleProgress.upsert({
      where: {
        moduleId_childId_userId: {
          moduleId: dto.moduleId,
          childId: dto.childId,
          userId: nanny.id,
        },
      },
      update: {
        
        status: CareModuleProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      create: {
        moduleId: dto.moduleId,
        childId: dto.childId,
        userId: nanny.id,
        
        status: CareModuleProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: this.progressInclude(),
    });

    return {
      success: true,
      message: 'Care module assigned successfully',
      data: this.formatProgress(progress as any),
    };
  } */

  async startQuiz(user: CurrentUserPayload, moduleId: string) {
    const userId = this.currentUserId(user);
    const module = await this.prisma.careModule.findUnique({
      where: { id: moduleId },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            type: true,
            sortOrder: true,
            options: {
              select: { id: true, label: true, sortOrder: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Care module not found');
    }

    let progress = await this.prisma.careModuleProgress.findUnique({
      where: { moduleId_userId: { moduleId, userId } },
    });

    if (!progress) {
      progress = await this.prisma.careModuleProgress.create({
        data: {
          moduleId,
          userId,
          status: CareModuleProgressStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    } else if (
      progress.status === CareModuleProgressStatus.PENDING ||
      (progress.status === CareModuleProgressStatus.IN_PROGRESS && !progress.startedAt)
    ) {
      progress = await this.prisma.careModuleProgress.update({
        where: { id: progress.id },
        data: {
          status: CareModuleProgressStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Quiz started successfully',
      data: {
        moduleId: module.id,
        title: module.title,
        questions: module.questions,
      },
    };
  }

  async submitQuiz(
    user: CurrentUserPayload,
    moduleId: string,
    dto: SubmitCareQuizDto,
  ) {
    const userId = this.currentUserId(user);
    const module = await this.prisma.careModule.findUnique({
      where: { id: moduleId },
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

    let progress = await this.prisma.careModuleProgress.findUnique({
      where: { moduleId_userId: { moduleId, userId } },
    });

    if (!progress) {
      progress = await this.prisma.careModuleProgress.create({
        data: {
          moduleId,
          userId,
          status: CareModuleProgressStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }

    const lockedUntil = this.quizLockedUntil(progress);
    if (lockedUntil && lockedUntil > new Date()) {
      throw new BadRequestException(
        `This quiz is locked until ${lockedUntil.toISOString()}`,
      );
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
        progressId: progress!.id,
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
    const pointsEarned = isPerfectScore && !progress.pointsAwardedAt ? module.completionPoints : progress.pointsEarned;
    const pointsAwardedAt =
      isPerfectScore && !progress.pointsAwardedAt
        ? new Date()
        : progress.pointsAwardedAt;

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        answerRows.map((answer) =>
          tx.careQuizAnswer.upsert({
            where: {
              progressId_questionId: {
                progressId: progress!.id,
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

      progress = await tx.careModuleProgress.update({
        where: { id: progress!.id },
        data: {
          status: isPerfectScore
            ? CareModuleProgressStatus.COMPLETED
            : CareModuleProgressStatus.IN_PROGRESS,
          completedAt: isPerfectScore ? new Date() : null,
          totalQuestions,
          correctAnswers,
          score,
          pointsEarned,
          pointsAwardedAt,
          startedAt: progress!.startedAt ?? new Date(),
        },
      });
    });

    if (isPerfectScore) {
      await this.rewardsService.awardCareModuleCompletion(
        progress.userId,
        progress.id,
        module.completionPoints,
        {
          moduleId: module.id,
          moduleTitle: module.title,
          completedByRole: user.role,
        },
      );
      
      if (progress.assignedById && user.role === UserRole.NANNY) {
        await this.rewardsService.awardCareModuleCompletion(
          progress.assignedById,
          progress.id,
          module.completionPoints,
          {
            moduleId: module.id,
            moduleTitle: module.title,
            completedByRole: UserRole.PARENT,
          },
        );
      }
    }

    const result = await this.getQuizResult(user, moduleId);
    return {
      ...result,
      message: 'Quiz submitted successfully',
    };
  }

  async getQuizResult(user: CurrentUserPayload, moduleId: string) {
    const userId = this.currentUserId(user);
    const progress = await this.prisma.careModuleProgress.findUnique({
      where: { moduleId_userId: { moduleId, userId } },
      include: this.progressInclude(),
    });

    if (!progress) {
      throw new NotFoundException('Quiz progress not found');
    }

    const answers = await this.prisma.careQuizAnswer.findMany({
      where: { progressId: progress.id },
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
        progress: this.formatProgressSummary(progress),
        result: {
          correctAnswers: progress.correctAnswers ?? 0,
          totalQuestions: progress.totalQuestions ?? answers.length,
          score: progress.score ?? 0,
          pointsEarned: progress.pointsEarned,
          pointsAwardedAt: progress.pointsAwardedAt,
          canRetakeQuiz: !this.quizLockedUntil(progress),
          quizLockedUntil: this.quizLockedUntil(progress),
          completedAt: progress.completedAt,
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

  private validateQuestions(questions: any) {
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
      const progressWhere = await this.progressWhereForUser(
        user,
        countQuery,
        tab,
      );

      return this.prisma.careModuleProgress.count({
        where: {
          ...progressWhere,
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
    const adminStatus = undefined;
    const category = query.category;
    const searchCategories = query.search
      ? this.matchingCareCategories(query.search)
      : [];

    return {
      ...(!isAdmin && { isPublished: true }),

      ...(category && { category: category }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          { shortDescription: { contains: query.search, mode: "insensitive" as const } },
          {
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

  private async progressWhereForUser(
    user: CurrentUserPayload,
    query: CareModuleQueryDto,
    tab: CareModuleTab,
  ) {
    const userId = this.currentUserId(user);
    const tabWhere = this.progressTabWhere(tab);

    if (this.isNanny(user)) {
      return {
        userId: userId,
        ...(query.childId && { childId: query.childId }),
        ...tabWhere,
      } satisfies Prisma.CareModuleProgressWhereInput;
    }

    const childIds = query.childId
      ? [query.childId]
      : await this.accessibleChildIds(userId);

    return {


      ...tabWhere,
    } satisfies Prisma.CareModuleProgressWhereInput;
  }

  private progressTabWhere(tab: CareModuleTab) {
    if (tab === CareModuleTab.IN_PROGRESS) {
      return {
        OR: [
          {
            status: {
              in: [
                CareModuleProgressStatus.IN_PROGRESS,
                CareModuleProgressStatus.IN_PROGRESS,
              ],
            },
          },
          {
            status: CareModuleProgressStatus.COMPLETED,
            score: { lt: 100 },
          },
        ],
      } satisfies Prisma.CareModuleProgressWhereInput;
    }

    if (tab === CareModuleTab.COMPLETED) {
      return {
        status: CareModuleProgressStatus.COMPLETED,
        score: 100,
      } satisfies Prisma.CareModuleProgressWhereInput;
    }

    return {};
  }

  private async progressMapForCards(
    user: CurrentUserPayload,
    query: CareModuleQueryDto,
    moduleIds: string[],
  ) {
    if (moduleIds.length === 0) {
      return new Map<string, Prisma.CareModuleProgressGetPayload<object>>();
    }

    const userId = this.currentUserId(user);
    const childIds = query.childId
      ? [query.childId]
      : this.isNanny(user)
        ? undefined
        : await this.accessibleChildIds(userId);

    const progresses = await this.prisma.careModuleProgress.findMany({
      where: {
        moduleId: { in: moduleIds },
        ...(this.isNanny(user)
          ? { userId: userId }
          : {


          }),
      },
      orderBy: { updatedAt: 'desc' },
    });

    return new Map(
      progresses.map((progress) => [progress.moduleId, progress]),
    );
  }

  private async savedModuleIds(
    userId: string,
    moduleIds: string[],
    childId?: string,
  ) {
    if (moduleIds.length === 0 || !childId) return new Set<string>();

    const saves = await this.prisma.careModuleSave.findMany({
      where: { userId, moduleId: { in: moduleIds } },
      select: { moduleId: true },
    });

    return new Set(saves.map((save) => save.moduleId));
  }

  private async findRelevantProgress(
    user: CurrentUserPayload,
    moduleId: string,
  ) {
    if (!this.isNanny(user)) return null;

    return this.prisma.careModuleProgress.findFirst({
      where: {
        moduleId,
        userId: this.currentUserId(user),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getProgressForUser(
    user: CurrentUserPayload,
    progressId: string,
  ) {
    const progress = await this.prisma.careModuleProgress.findUnique({
      where: { id: progressId },
      include: this.progressInclude(),
    });

    if (!progress) {
      throw new NotFoundException('Care progress not found');
    }

    const userId = this.currentUserId(user);
    if (this.isNanny(user)) {
      if (progress.userId !== userId) {
        throw new ForbiddenException(
          'This progress belongs to another nanny',
        );
      }
      return progress;
    }


    return progress;
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
    userId: string,
    childId: string,
  ) {
    const [progress, nannyLink, caregiverAccess] = await Promise.all([
      this.prisma.careModuleProgress.findFirst({
        where: { userId },
        select: { id: true },
      }),
      this.prisma.nannyChildLink.findFirst({
        where: { childId, nannyUserId: userId },
        select: { id: true },
      }),
      this.prisma.caregiverAccess.findFirst({
        where: {
          childId,
          invitedUserId: userId,
          role: CaregiverAccessRole.NANNY,
          status: CaregiverAccessStatus.ACCEPTED,
          OR: [{ careLearningAccess: true }, { nannyDevelopment: true }],
        },
        select: { id: true },
      }),
    ]);

    if (!progress && !nannyLink && !caregiverAccess) {
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
    const [children, accesses, nannyProgresss, nannyLinks] =
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
          select: { id: true },
        }),
        this.prisma.careModuleProgress.findMany({
          where: { userId },
          select: { id: true },
        }),
        this.prisma.nannyChildLink.findMany({
          where: { nannyUserId: userId },
          select: { id: true },
        }),
      ]);

    return [
      ...new Set([
        ...children.map((child) => child.id),



      ]),
    ];
  }

  private async resolveProgressNanny(
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
    userId: string,
    childId: string,
  ) {
    const [caregiverAccess, nannyLink] = await Promise.all([
      this.prisma.caregiverAccess.findFirst({
        where: {
          childId,
          invitedUserId: userId,
          role: CaregiverAccessRole.NANNY,
          status: {
            in: [CaregiverAccessStatus.PENDING, CaregiverAccessStatus.ACCEPTED],
          },
        },
        select: { id: true },
      }),
      this.prisma.nannyChildLink.findFirst({
        where: { childId, nannyUserId: userId },
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
      progress?:
      | Prisma.CareModuleProgressGetPayload<{
        include: ReturnType<CarehubQuizService['progressInclude']>;
      }>
      | Prisma.CareModuleProgressGetPayload<object>
      | null;
    } = {},
  ) {
    return {
      id: module.id,
      title: module.title,

      description: module.shortDescription ?? undefined,
      coverImageUrl: module.coverImageUrl,
      videoUrl: module.videoUrl,
      category: module.category,

      coinReward: module.completionPoints,
      ageGroup: module.ageGroup,

      keyTakeaway: (module as any).keyTakeaway,
      isPublished: module.isPublished,
      isSaved: Boolean(options.isSaved),
      questionCount: module.questions.length,
      progress: options.progress
        ? this.formatProgressSummary(options.progress)
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
      progress?: Prisma.CareModuleProgressGetPayload<object> | null;
    } = {},
  ) {
    return {
      id: module.id,
      title: module.title,

      description: module.shortDescription ?? undefined,
      coverImageUrl: module.coverImageUrl,
      videoUrl: module.videoUrl,
      category: module.category,

      coinReward: module.completionPoints,
      ageGroup: module.ageGroup,


      contentSections: module.moduleDescriptions,
      keyTakeaway: (module as any).keyTakeaway,
      isPublished: module.isPublished,
      adminStatus: module.adminStatus,
      isSaved: Boolean(options.isSaved),
      progress: options.progress
        ? this.formatProgressSummary(options.progress)
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

  private formatProgress(
    progress: Prisma.CareModuleProgressGetPayload<{
      include: ReturnType<CarehubQuizService['progressInclude']>;
    }>,
  ) {
    return {
      ...this.formatProgressSummary(progress),
      module: progress.module,

      nanny: (progress as any).user,

    };
  }

  private formatInsightActivity(
    activity: Prisma.DayActivityGetPayload<{
      include: ReturnType<CarehubQuizService['insightActivityInclude']>;
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
      include: ReturnType<CarehubQuizService['childNoteInclude']>;
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
      include: ReturnType<CarehubQuizService['childNoteInclude']>;
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

  private formatProgressSummary(
    progress:
      | Prisma.CareModuleProgressGetPayload<{
        include: ReturnType<CarehubQuizService['progressInclude']>;
      }>
      | Prisma.CareModuleProgressGetPayload<object>,
  ) {
    const status = this.effectiveProgressStatus(progress);

    return {
      id: progress.id,
      moduleId: progress.moduleId,

      userId: progress.userId,

      status,
      score: progress.score,
      totalQuestions: progress.totalQuestions,
      correctAnswers: progress.correctAnswers,
      pointsEarned: progress.pointsEarned,
      pointsAwardedAt: progress.pointsAwardedAt,
      canRetakeQuiz: !this.quizLockedUntil(progress),
      quizLockedUntil: this.quizLockedUntil(progress),
      startedAt: progress.startedAt,
      completedAt:
        status === CareModuleProgressStatus.COMPLETED
          ? progress.completedAt
          : null,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    };
  }

  private effectiveProgressStatus(
    progress: Prisma.CareModuleProgressGetPayload<object>,
  ) {


    if (
      progress.status === CareModuleProgressStatus.COMPLETED &&
      (progress.score ?? 0) < 100
    ) {
      return CareModuleProgressStatus.IN_PROGRESS;
    }

    return progress.status;
  }

  private quizLockedUntil(
    progress: Prisma.CareModuleProgressGetPayload<object>,
  ) {
    if (!progress.pointsAwardedAt) return null;

    const lockedUntil = new Date(progress.pointsAwardedAt);
    lockedUntil.setMonth(lockedUntil.getMonth() + QUIZ_RETAKE_COOLDOWN_MONTHS);

    return lockedUntil > new Date() ? lockedUntil : null;
  }

  private paginatedModules(
    modules: ReturnType<CarehubQuizService['formatModuleCard']>[],
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

  private progressInclude() {
    return {
      module: { select: moduleListSelect },

      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
        },
      },
    } satisfies Prisma.CareModuleProgressInclude;
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
