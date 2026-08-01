import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityStatus, MediaType, UserRole } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../common/storage/storage.service';
import { CaregiverService } from '../caregiver/caregiver.service';
import { RewardsService } from '../rewards/rewards.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NannyFeedbackQueryDto } from './dto/nanny-feedback-query.dto';
import { SubmitNannyFeedbackDto } from './dto/submit-nanny-feedback.dto';

type UploadedImageFile = {
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class NannyFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
    private readonly storageService: StorageService,
    private readonly rewardsService: RewardsService,
  ) {}

  async getFeedbacks(user: CurrentUserPayload, query: NannyFeedbackQueryDto) {
    const userId = this.currentUserId(user);
    const childIds = query.childId
      ? [query.childId]
      : await this.caregiverService.getAccessibleChildIds(
          userId,
          'dailyActivitiesRecipes',
        );

    if (query.childId) {
      await this.caregiverService.assertChildPermission(
        userId,
        query.childId,
        'dailyActivitiesRecipes',
      );
    }

    const targetDate = this.resolveDate(query.date);
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const activities = await this.prisma.dayActivity.findMany({
      where: {
        feedback: { isNot: null },
        dayPlan: {
          childId: { in: childIds },
          date: {
            gte: targetDate,
            lt: nextDate,
          },
        },
      },
      include: this.feedbackInclude(),
      orderBy: [{ startTime: 'asc' }, { sortOrder: 'asc' }],
    });

    return {
      success: true,
      message: 'Nanny feedback fetched successfully',
      data: activities.map((activity) => this.formatFeedbackActivity(activity)),
    };
  }

  async getScheduleFeedback(user: CurrentUserPayload, dayActivityId: string) {
    const userId = this.currentUserId(user);
    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: dayActivityId },
      include: this.feedbackInclude(),
    });

    if (!activity) {
      throw new NotFoundException('Schedule/task not found');
    }

    await this.caregiverService.assertChildPermission(
      userId,
      activity.dayPlan.childId,
      'dailyActivitiesRecipes',
    );

    return {
      success: true,
      message: 'Nanny feedback fetched successfully',
      data: this.formatFeedbackActivity(activity),
    };
  }

  async submitScheduleFeedback(
    user: CurrentUserPayload,
    dayActivityId: string,
    dto: SubmitNannyFeedbackDto,
    image?: UploadedImageFile,
  ) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);

    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: dayActivityId },
      include: {
        dayPlan: {
          select: {
            id: true,
            childId: true,
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
        feedback: true,
        proofs: {
          include: {
            mediaAsset: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Schedule/task not found');
    }

    await this.caregiverService.assertChildPermission(
      nannyUserId,
      activity.dayPlan.childId,
      'dailyActivitiesRecipes',
    );

    const status = dto.status ?? ActivityStatus.COMPLETED;
    const imageMedia = image
      ? await this.createFeedbackImage(nannyUserId, dayActivityId, image)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const feedback = await tx.dayActivityFeedback.upsert({
        where: { dayActivityId },
        update: {
          submittedByUserId: nannyUserId,
          enjoyment: dto.enjoyment,
          childMood: dto.childMood,
          completionRate: dto.completionRate,
          note: dto.note,
          submittedAt: new Date(),
        },
        create: {
          dayActivityId,
          submittedByUserId: nannyUserId,
          enjoyment: dto.enjoyment,
          childMood: dto.childMood,
          completionRate: dto.completionRate,
          note: dto.note,
        },
      });

      const dayActivity = await tx.dayActivity.update({
        where: { id: dayActivityId },
        data: {
          status,
          nannyNote: dto.note,
          ...(imageMedia && { proofMediaId: imageMedia.id }),
        },
        include: {
          dayPlan: {
            select: {
              id: true,
              childId: true,
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
          proofs: {
            include: { mediaAsset: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return { feedback, dayActivity };
    });

    const reward =
      updated.dayActivity.status === ActivityStatus.COMPLETED
        ? await this.rewardsService.awardCompletedTask(
            nannyUserId,
            dayActivityId,
            {
              title: updated.dayActivity.title,
              childId: updated.dayActivity.dayPlan.childId,
              childName: updated.dayActivity.dayPlan.child.name,
              completedByRole: UserRole.NANNY,
            },
          )
        : null;

    return {
      success: true,
      message: 'Nanny feedback submitted successfully',
      data: {
        schedule: {
          id: updated.dayActivity.id,
          dayPlanId: updated.dayActivity.dayPlanId,
          child: updated.dayActivity.dayPlan.child,
          date: updated.dayActivity.dayPlan.date,
          category: updated.dayActivity.category,
          title: updated.dayActivity.title,
          description: updated.dayActivity.description,
          startTime: updated.dayActivity.startTime,
          endTime: updated.dayActivity.endTime,
          status: updated.dayActivity.status,
        },
        feedback: updated.feedback,
        reward: reward
          ? {
              awarded: reward.awarded,
              pointsEarned: reward.awarded ? 2 : 0,
              balance: reward.account.balance,
            }
          : null,
        proofs: updated.dayActivity.proofs.map((item) => ({
          id: item.id,
          caption: item.caption,
          createdAt: item.createdAt,
          media: {
            id: item.mediaAsset.id,
            type: item.mediaAsset.type,
            url: item.mediaAsset.url,
            mimeType: item.mediaAsset.mimeType,
            sizeBytes: item.mediaAsset.sizeBytes,
            durationSec: item.mediaAsset.durationSec,
          },
        })),
      },
    };
  }

  async updateScheduleFeedback(
    user: CurrentUserPayload,
    dayActivityId: string,
    dto: SubmitNannyFeedbackDto,
    image?: UploadedImageFile,
  ) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);
    const activity = await this.findActivityForMutation(dayActivityId);

    await this.caregiverService.assertChildPermission(
      nannyUserId,
      activity.dayPlan.childId,
      'dailyActivitiesRecipes',
    );

    if (!activity.feedback) {
      throw new NotFoundException('Feedback not found for this schedule/task');
    }

    const imageMedia = image
      ? await this.createFeedbackImage(nannyUserId, dayActivityId, image)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.dayActivityFeedback.update({
        where: { dayActivityId },
        data: {
          submittedByUserId: nannyUserId,
          ...(dto.enjoyment !== undefined && { enjoyment: dto.enjoyment }),
          ...(dto.childMood !== undefined && { childMood: dto.childMood }),
          ...(dto.completionRate !== undefined && {
            completionRate: dto.completionRate,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
          submittedAt: new Date(),
        },
      });

      return tx.dayActivity.update({
        where: { id: dayActivityId },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.note !== undefined && { nannyNote: dto.note }),
          ...(imageMedia && { proofMediaId: imageMedia.id }),
        },
        include: this.feedbackInclude(),
      });
    });

    const reward =
      updated.status === ActivityStatus.COMPLETED
        ? await this.rewardsService.awardCompletedTask(
            nannyUserId,
            dayActivityId,
            {
              title: updated.title,
              childId: updated.dayPlan.childId,
              childName: updated.dayPlan.child.name,
              completedByRole: UserRole.NANNY,
            },
          )
        : null;

    return {
      success: true,
      message: 'Nanny feedback updated successfully',
      data: {
        ...this.formatFeedbackActivity(updated),
        reward: reward
          ? {
              awarded: reward.awarded,
              pointsEarned: reward.awarded ? 2 : 0,
              balance: reward.account.balance,
            }
          : null,
      },
    };
  }

  async deleteScheduleFeedback(
    user: CurrentUserPayload,
    dayActivityId: string,
  ) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);
    const activity = await this.findActivityForMutation(dayActivityId);

    await this.caregiverService.assertChildPermission(
      nannyUserId,
      activity.dayPlan.childId,
      'dailyActivitiesRecipes',
    );

    if (!activity.feedback && activity.proofs.length === 0) {
      throw new NotFoundException('Feedback not found for this schedule/task');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dayActivityFeedback.deleteMany({ where: { dayActivityId } });
      await tx.dayActivityProof.deleteMany({ where: { dayActivityId } });
      await tx.dayActivity.update({
        where: { id: dayActivityId },
        data: {
          status: ActivityStatus.PLANNED,
          nannyNote: null,
          proofMediaId: null,
        },
      });
    });

    return {
      success: true,
      message: 'Nanny feedback deleted successfully',
      data: {
        dayActivityId,
        status: ActivityStatus.PLANNED,
      },
    };
  }

  private async createFeedbackImage(
    nannyUserId: string,
    dayActivityId: string,
    image: UploadedImageFile,
  ) {
    const url = await this.storageService.uploadFile(
      image as Parameters<StorageService['uploadFile']>[0],
      'nanny-feedback-images',
    );
    const type = this.mediaTypeFromMime(image.mimetype);

    const mediaAsset = await this.prisma.mediaAsset.create({
      data: {
        ownerUserId: nannyUserId,
        type,
        url,
        storageKey: url,
        mimeType: image.mimetype,
        sizeBytes: image.size,
      },
    });

    await this.prisma.dayActivityProof.create({
      data: {
        dayActivityId,
        mediaAssetId: mediaAsset.id,
        uploadedByUserId: nannyUserId,
      },
    });

    return mediaAsset;
  }

  private async findActivityForMutation(dayActivityId: string) {
    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: dayActivityId },
      include: {
        dayPlan: {
          select: {
            id: true,
            childId: true,
          },
        },
        feedback: true,
        proofs: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Schedule/task not found');
    }

    return activity;
  }

  private mediaTypeFromMime(mimeType?: string) {
    if (mimeType?.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType?.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.IMAGE;
  }

  private feedbackInclude() {
    return {
      dayPlan: {
        select: {
          id: true,
          childId: true,
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
        include: {
          submittedByUser: {
            select: {
              id: true,
              fullName: true,
              profilePictureUrl: true,
            },
          },
        },
      },
      proofs: {
        include: { mediaAsset: true },
        orderBy: { createdAt: 'desc' as const },
      },
      proofMedia: true,
    };
  }

  private formatFeedbackActivity(activity: any) {
    return {
      schedule: {
        id: activity.id,
        dayPlanId: activity.dayPlanId,
        child: activity.dayPlan.child,
        date: activity.dayPlan.date,
        category: activity.category,
        title: activity.title,
        description: activity.description,
        startTime: activity.startTime,
        endTime: activity.endTime,
        status: activity.status,
        imageUrl: activity.imageUrl,
        detail: activity.detail,
      },
      feedback: activity.feedback
        ? {
            id: activity.feedback.id,
            enjoyment: activity.feedback.enjoyment,
            childMood: activity.feedback.childMood,
            completionRate: activity.feedback.completionRate,
            note: activity.feedback.note,
            submittedAt: activity.feedback.submittedAt,
            parentSeenAt: activity.feedback.parentSeenAt,
            submittedBy: activity.feedback.submittedByUser,
          }
        : null,
      image: activity.proofMedia
        ? {
            id: activity.proofMedia.id,
            type: activity.proofMedia.type,
            url: activity.proofMedia.url,
            mimeType: activity.proofMedia.mimeType,
            sizeBytes: activity.proofMedia.sizeBytes,
            durationSec: activity.proofMedia.durationSec,
          }
        : null,
      proofs: activity.proofs.map((item: any) => ({
        id: item.id,
        caption: item.caption,
        createdAt: item.createdAt,
        media: {
          id: item.mediaAsset.id,
          type: item.mediaAsset.type,
          url: item.mediaAsset.url,
          mimeType: item.mediaAsset.mimeType,
          sizeBytes: item.mediaAsset.sizeBytes,
          durationSec: item.mediaAsset.durationSec,
        },
      })),
    };
  }

  private resolveDate(dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private ensureNanny(user: CurrentUserPayload) {
    if (user.role !== UserRole.NANNY) {
      throw new ForbiddenException('Only nanny users can submit feedback');
    }
  }

  private currentUserId(user: CurrentUserPayload) {
    const userId = user.id ?? user.userId;
    if (!userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return userId;
  }
}
