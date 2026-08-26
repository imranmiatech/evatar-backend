import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const BYTES_IN_GB = 1024 * 1024 * 1024;

type MembershipPlanStorageLimits = {
  photoVideoStorageGb: number;
  storyStorageCount: number;
  documentStorageGb: number;
};

type MembershipStorageUsage = {
  photoVideoBytesUsed: number;
  photoVideoStorageGb: number;
  storyCountUsed: number;
  storyStorageCount: number;
  documentBytesUsed: number;
  documentStorageGb: number;
};

@Injectable()
export class MembershipStorageService {
  constructor(private readonly prisma: PrismaService) {}

  async getStorageSummary(accountOwnerId: string) {
    const [limits, usage] = await Promise.all([
      this.getEffectiveStorageLimits(accountOwnerId),
      this.getStorageUsage(accountOwnerId),
    ]);

    return {
      limits,
      usage: {
        photoVideoBytesUsed: usage.photoVideoBytesUsed,
        photoVideoGbUsed: this.bytesToGb(usage.photoVideoBytesUsed),
        photoVideoStorageGb: limits.photoVideoStorageGb,
        storyCountUsed: usage.storyCountUsed,
        storyStorageCount: limits.storyStorageCount,
        documentBytesUsed: usage.documentBytesUsed,
        documentGbUsed: this.bytesToGb(usage.documentBytesUsed),
        documentStorageGb: limits.documentStorageGb,
      },
    };
  }

  async assertCanUploadPhotoVideo(accountOwnerId: string, fileSizeBytes: number) {
    const { limits, usage } = await this.getStorageState(accountOwnerId);
    const nextUsageBytes = usage.photoVideoBytesUsed + Math.max(0, fileSizeBytes);

    if (
      limits.photoVideoStorageGb > 0 &&
      nextUsageBytes > this.gbToBytes(limits.photoVideoStorageGb)
    ) {
      throw new BadRequestException(
        `Photo and video storage limit exceeded for your current plan. Allowed: ${limits.photoVideoStorageGb} GB.`,
      );
    }
  }

  async assertCanUploadDocuments(
    accountOwnerId: string,
    fileSizesBytes: number[],
  ) {
    const { limits, usage } = await this.getStorageState(accountOwnerId);
    const nextUsageBytes =
      usage.documentBytesUsed +
      fileSizesBytes.reduce((sum, value) => sum + Math.max(0, value || 0), 0);

    if (
      limits.documentStorageGb > 0 &&
      nextUsageBytes > this.gbToBytes(limits.documentStorageGb)
    ) {
      throw new BadRequestException(
        `Document storage limit exceeded for your current plan. Allowed: ${limits.documentStorageGb} GB.`,
      );
    }
  }

  async assertCanCreateStory(accountOwnerId: string, storyIncrement = 1) {
    const { limits, usage } = await this.getStorageState(accountOwnerId);
    const nextCount = usage.storyCountUsed + Math.max(0, storyIncrement);

    if (
      limits.storyStorageCount > 0 &&
      nextCount > limits.storyStorageCount
    ) {
      throw new BadRequestException(
        `Story storage limit exceeded for your current plan. Allowed: ${limits.storyStorageCount} stories.`,
      );
    }
  }

  private async getStorageState(accountOwnerId: string) {
    const [limits, usage] = await Promise.all([
      this.getEffectiveStorageLimits(accountOwnerId),
      this.getStorageUsage(accountOwnerId),
    ]);

    return { limits, usage };
  }

  private async getEffectiveStorageLimits(
    accountOwnerId: string,
  ): Promise<MembershipPlanStorageLimits> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId: accountOwnerId },
      include: { plan: true },
    });

    const plan =
      subscription?.plan ||
      (await this.prisma.subscriptionPlan.findFirst({
        where: { isActive: true, isComplimentary: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }));

    if (!plan) {
      throw new BadRequestException('Complimentary membership plan is not configured.');
    }

    return {
      photoVideoStorageGb: plan.photoVideoStorageGb ?? 0,
      storyStorageCount: plan.storyStorageCount ?? 0,
      documentStorageGb: plan.documentStorageGb ?? 0,
    };
  }

  private async getStorageUsage(
    accountOwnerId: string,
  ): Promise<MembershipStorageUsage> {
    const [mediaAssets, storyCountResult, documents] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: {
          dayActivityProofs: {
            some: {
              dayActivity: {
                dayPlan: {
                  child: {
                    parentUserId: accountOwnerId,
                  },
                },
              },
            },
          },
        },
        distinct: ['id'],
        select: {
          sizeBytes: true,
        },
      }),
      this.prisma.bedtimeStory.count({
        where: {
          dayPlan: {
            child: {
              parentUserId: accountOwnerId,
            },
          },
        },
      }),
      this.prisma.kycDocument.findMany({
        where: {
          kycVerification: {
            userId: accountOwnerId,
          },
        },
        select: {
          fileSize: true,
        },
      }),
    ]);

    return {
      photoVideoBytesUsed: mediaAssets.reduce(
        (sum, asset) => sum + Math.max(0, asset.sizeBytes ?? 0),
        0,
      ),
      photoVideoStorageGb: 0,
      storyCountUsed: storyCountResult,
      storyStorageCount: 0,
      documentBytesUsed: documents.reduce(
        (sum, document) => sum + Math.max(0, document.fileSize ?? 0),
        0,
      ),
      documentStorageGb: 0,
    };
  }

  private gbToBytes(value: number) {
    return value * BYTES_IN_GB;
  }

  private bytesToGb(value: number) {
    return Number((value / BYTES_IN_GB).toFixed(3));
  }
}
