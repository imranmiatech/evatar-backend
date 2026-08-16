import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareModuleCategory,
  CareModuleAdminStatus,
  CareQuestionType,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';
import { StorageService } from '../../../../common/storage/storage.service';
import { AdminCareModuleQueryDto } from '../dto/admin-care-module-query.dto';
import { CreateCareModuleDto } from '../dto/create-care-module.dto';
import { UpdateCareModuleDto } from '../dto/update-care-module.dto';
import { ToggleCareModuleStatusDto } from '../dto/toggle-care-module-status.dto';

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

type CareModuleSuggestedAgeRange = {
  suggestedMinAgeMonths?: number;
  suggestedMaxAgeMonths?: number;
};

@Injectable()
export class CareManageService {
  constructor(
    private readonly prisma: PrismaService,
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
    let moduleDescriptions = this.parseFormValue(dto.moduleDescriptions);
    let isPublished =
      typeof dto.isPublished === 'string'
        ? dto.isPublished === 'true'
        : dto.isPublished;
    let completionPoints = dto.completionPoints !== undefined ? Number(dto.completionPoints) : 50;
    let ageGroup = dto.ageGroup?.trim();

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

    console.log("CurrentUserPayload", user); console.log("PAYLOAD", JSON.stringify({ title: dto.title, createdByUserId: this.currentUserId(user) }, null, 2));
    const module = await this.prisma.careModule.create({
      data: {
        title: dto.title.trim(),
        shortDescription: dto.shortDescription?.trim(),
        coverImageUrl,
        videoUrl,
        category: dto.category,
        completionPoints,
        ageGroup,
        moduleDescriptions: moduleDescriptions ?? [],
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
    let moduleDescriptions =
      dto.moduleDescriptions !== undefined
        ? this.parseFormValue(dto.moduleDescriptions)
        : undefined;
    let isPublished =
      dto.isPublished !== undefined
        ? typeof dto.isPublished === 'string'
          ? dto.isPublished === 'true'
          : dto.isPublished
        : undefined;
    let completionPoints =
      dto.completionPoints !== undefined ? Number(dto.completionPoints) : undefined;
    let ageGroup = dto.ageGroup?.trim();

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
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription?.trim() }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(completionPoints !== undefined && { completionPoints }),
        ...(ageGroup !== undefined && { ageGroup }),
        ...(moduleDescriptions !== undefined && { moduleDescriptions }),
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

  async getAdminModules(user: CurrentUserPayload, query: AdminCareModuleQueryDto) {
    this.ensureAdmin(user);

    const adminStatus = query.adminStatus;
    const category = query.category;

    const searchCategories = query.search
      ? Object.values(CareModuleCategory).filter((c) =>
          c.toLowerCase().includes(query.search!.toLowerCase()),
        )
      : [];

    const where = {
      ...(adminStatus &&
        adminStatus !== CareModuleAdminStatus.ALL && {
          adminStatus: adminStatus as CareModuleAdminStatus,
        }),
      ...(category && { category: category }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          {
            shortDescription: { contains: query.search, mode: 'insensitive' as const },
          },
          ...(searchCategories.length > 0
            ? [{ category: { in: searchCategories } }]
            : []),
        ],
      }),
    } satisfies Prisma.CareModuleWhereInput;

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
              progresses: true,
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
      shortDescription: m.shortDescription,
      coverImageUrl: m.coverImageUrl,
      videoUrl: m.videoUrl,
      category: m.category,
      ageGroup: m.ageGroup,
      completionPoints: m.completionPoints,
      adminStatus: m.adminStatus,
      isPublished: m.isPublished,
      assignedNanniesCount: m._count.progresses,
      assignedText: `${m._count.progresses} Nannies`,
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

    const assignedNanniesCount = await this.prisma.careModuleProgress.count({
      where: { moduleId },
    });

    return {
      success: true,
      message: 'Admin care module details fetched successfully',
      data: {
        ...this.formatModuleDetail(module),
        assignedNanniesCount,
        assignedText: `${assignedNanniesCount} Nannies`,
      },
    };
  }

  private validateQuestions(questions: any[]) {
    for (const question of questions) {
      const correctCount = question.options.filter(
        (option: any) => option.isCorrect,
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

  private formatAgeRange(min?: number | null, max?: number | null): string {
    if (min != null && max != null) return `${min}-${max} months`;
    if (min != null) return `${min}+ months`;
    if (max != null) return `Up to ${max} months`;
    return 'All ages';
  }

  private formatModuleDetail(
    module: Prisma.CareModuleGetPayload<{
      include: typeof moduleDetailInclude;
    }>
  ) {
    return {
      id: module.id,
      title: module.title,
      shortDescription: module.shortDescription,
      coverImageUrl: module.coverImageUrl,
      videoUrl: module.videoUrl,
      category: module.category,
      completionPoints: module.completionPoints,
      ageGroup: module.ageGroup,
      moduleDescriptions: module.moduleDescriptions,
      keyTakeaway: module.keyTakeaway,
      isPublished: module.isPublished,
      adminStatus: module.adminStatus,
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

  private currentUserId(user: CurrentUserPayload) {
    return user.userId ?? user.id;
  }

  private isAdmin(user: CurrentUserPayload) {
    return user.role === UserRole.ADMIN;
  }

  private ensureAdmin(user: CurrentUserPayload) {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
