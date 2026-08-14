import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';
import { AdminActivityQueryDto } from '../dto/activity-query.dto';
import { StorageService } from '../../../../common/storage/storage.service';
import { resolveAgeGroupRange } from '../../../../common/helpers/age-group.helper';

@Injectable()
export class AdminActivityService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async createActivity(
    dto: CreateActivityDto,
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const {
      benefits,
      steps,
      progressions,
      coverImage,
      video,
      ageGroup,
      ...activityData
    } = dto;
    const ageRange = resolveAgeGroupRange(ageGroup);

    let imageUrl: string | undefined = undefined;
    let videoUrl: string | undefined = undefined;

    if (files?.coverImage?.[0]) {
      imageUrl = await this.storageService.uploadFile(
        files.coverImage[0],
        'activities/covers',
      );
    }
    if (files?.video?.[0]) {
      videoUrl = await this.storageService.uploadFile(
        files.video[0],
        'activities/videos',
      );
    }

    return this.prisma.activity.create({
      data: {
        ...activityData,
        minAgeMonths: activityData.minAgeMonths ?? ageRange?.minAgeMonths,
        maxAgeMonths: activityData.maxAgeMonths ?? ageRange?.maxAgeMonths,
        isActive: activityData.status === 'PUBLISHED',
        imageUrl,
        videoUrl,
        ...(benefits && { benefits: { create: benefits } }),
        ...(steps && { steps: { create: steps } }),
        ...(progressions && { progressions: { create: progressions } }),
      },
      include: { benefits: true, steps: true, progressions: true },
    });
  }

  async updateActivity(
    id: string,
    dto: UpdateActivityDto,
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');

    const {
      benefits,
      steps,
      progressions,
      coverImage,
      video,
      ageGroup,
      ...activityData
    } = dto;
    const ageRange = resolveAgeGroupRange(ageGroup);

    let imageUrl: string | undefined = undefined;
    let videoUrl: string | undefined = undefined;

    if (files?.coverImage?.[0]) {
      imageUrl = await this.storageService.uploadFile(
        files.coverImage[0],
        'activities/covers',
      );
    }
    if (files?.video?.[0]) {
      videoUrl = await this.storageService.uploadFile(
        files.video[0],
        'activities/videos',
      );
    }

    return this.prisma.activity.update({
      where: { id },
      data: {
        ...activityData,
        ...(ageRange && {
          minAgeMonths: activityData.minAgeMonths ?? ageRange.minAgeMonths,
          maxAgeMonths: activityData.maxAgeMonths ?? ageRange.maxAgeMonths,
        }),
        ...(activityData.status && {
          isActive: activityData.status === 'PUBLISHED',
        }),
        ...(imageUrl && { imageUrl }),
        ...(videoUrl && { videoUrl }),
        ...(benefits && {
          benefits: {
            deleteMany: {},
            create: benefits,
          },
        }),
        ...(steps && {
          steps: {
            deleteMany: {},
            create: steps,
          },
        }),
        ...(progressions && {
          progressions: {
            deleteMany: {},
            create: progressions,
          },
        }),
      },
      include: { benefits: true, steps: true, progressions: true },
    });
  }

  async getAllActivities(query: AdminActivityQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const ageWhere = {
      ...(query.minAge !== undefined && {
        minAgeMonths: { lte: query.minAge },
      }),
      ...(query.maxAge !== undefined && {
        maxAgeMonths: { gte: query.maxAge },
      }),
    };

    const where = {
      ...(query.search && {
        title: { contains: query.search, mode: 'insensitive' as const },
      }),
      ...(query.location && { location: { has: query.location } }),
      ...(query.status && { status: query.status }),
      ...ageWhere,
    };

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: {
          benefits: true,
          steps: { orderBy: { stepNumber: 'asc' } },
          progressions: { orderBy: { level: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getActivityById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        benefits: true,
        steps: { orderBy: { stepNumber: 'asc' } },
        progressions: { orderBy: { level: 'asc' } },
      },
    });

    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async deleteActivity(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');

    await this.prisma.activity.delete({ where: { id } });
    return { id };
  }
}
