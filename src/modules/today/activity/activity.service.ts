import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../../common/auth/current-user.decorator';
import { AddActivityDto, CompleteProofDto, UpdateActivityDto } from '../dto';
import type { ManualActivityDto } from '../dto';
import { AddActivityFromTemplateDto } from './dto';
import type {
  ActivityPermissions,
  ActivitySummary,
} from './types/activity-response.types';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getParentFeed(
    user: CurrentUserPayload,
    childId: string,
    date?: string,
  ) {
    this.ensureParentOrAdmin(user);
    await this.ensureCanManageChild(user, childId);

    return this.getActivityFeed(childId, this.parentPermissions(), date);
  }

  async getNannyFeed(
    user: CurrentUserPayload,
    childId: string,
    date?: string,
  ) {
    const link = await this.ensureCanReadChildAsNanny(user, childId);

    return this.getActivityFeed(
      childId,
      this.nannyPermissions(link.canUpdateProof, link.canViewStory),
      date,
    );
  }

  async getActivityDetail(user: CurrentUserPayload, activityId: string) {
    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: activityId },
      include: {
        dayPlan: {
          include: {
            child: true,
            bedtimeStory: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const permissions = await this.ensureCanReadActivity(
      user,
      activity.dayPlan.childId,
    );
    const proofMedia = activity.proofMediaId
      ? await this.prisma.mediaAsset.findUnique({
          where: { id: activity.proofMediaId },
        })
      : null;

    return {
      ...activity,
      proofMedia,
      permissions,
    };
  }

  async addActivity(
    user: CurrentUserPayload,
    dayPlanId: string,
    dto: AddActivityDto,
  ) {
    await this.ensureCanManageDayPlan(user, dayPlanId);

    return this.prisma.dayActivity.create({
      data: this.mapActivityInput(dayPlanId, dto, dto.sortOrder ?? 0) as any,
    });
  }

  async updateActivity(
    user: CurrentUserPayload,
    activityId: string,
    dto: UpdateActivityDto,
  ) {
    await this.ensureCanManageActivity(user, activityId);

    return this.prisma.dayActivity.update({
      where: { id: activityId },
      data: {
        category: dto.category,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        detail: dto.detail as any,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        status: dto.status as any,
        nannyNote: dto.nannyNote,
        parentNote: dto.parentNote,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deleteActivity(user: CurrentUserPayload, activityId: string) {
    await this.ensureCanManageActivity(user, activityId);
    await this.prisma.dayActivity.delete({ where: { id: activityId } });
    return { message: 'Activity deleted successfully' };
  }

  async listActivityTemplates(category?: string) {
    return this.prisma.activityTemplate.findMany({
      where: {
        isActive: true,
        category: category || undefined,
      },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
  }

  async getActivityTemplate(templateId: string) {
    return this.prisma.activityTemplate.findUniqueOrThrow({
      where: { id: templateId },
    });
  }

  async addActivityFromTemplate(
    user: CurrentUserPayload,
    dayPlanId: string,
    templateId: string,
    dto: AddActivityFromTemplateDto,
  ) {
    await this.ensureCanManageDayPlan(user, dayPlanId);
    const template = await this.getActivityTemplate(templateId);

    return this.prisma.dayActivity.create({
      data: {
        dayPlanId,
        category: template.category,
        title: template.title,
        description: template.description,
        imageUrl: template.imageUrl,
        detail: template.detail,
        templateId: template.id,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        sortOrder: dto.sortOrder ?? 0,
      } as any,
    });
  }

  async nannyUpdateActivityStatus(
    user: CurrentUserPayload,
    activityId: string,
    status: string,
    nannyNote?: string,
  ) {
    const activity = await this.prisma.dayActivity.findUniqueOrThrow({
      where: { id: activityId },
      include: { dayPlan: true },
    });
    const link = await this.ensureCanReadChildAsNanny(
      user,
      activity.dayPlan.childId,
    );

    if (!link.canUpdateProof && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot update proof for this child');
    }

    return this.prisma.dayActivity.update({
      where: { id: activityId },
      data: {
        status: status as any,
        nannyNote,
      },
    });
  }

  async createProofUploadUrl(
    user: CurrentUserPayload,
    activityId: string,
    mimeType: string,
  ) {
    const activity = await this.prisma.dayActivity.findUniqueOrThrow({
      where: { id: activityId },
      include: { dayPlan: true },
    });
    const link = await this.ensureCanReadChildAsNanny(
      user,
      activity.dayPlan.childId,
    );

    if (!link.canUpdateProof && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot update proof for this child');
    }

    const extension = this.mimeToExtension(mimeType);
    const storageKey = `activity-proof/${user.userId}/${activityId}.${extension}`;

    return {
      storageKey,
      uploadUrl: `/media/upload/${storageKey}`,
      method: 'PUT',
      mimeType,
    };
  }

  async completeActivityProof(
    user: CurrentUserPayload,
    activityId: string,
    dto: CompleteProofDto,
  ) {
    const activity = await this.prisma.dayActivity.findUniqueOrThrow({
      where: { id: activityId },
      include: { dayPlan: true },
    });
    const link = await this.ensureCanReadChildAsNanny(
      user,
      activity.dayPlan.childId,
    );

    if (!link.canUpdateProof && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot update proof for this child');
    }

    const media = await this.prisma.mediaAsset.create({
      data: {
        ownerUserId: user.userId,
        type: (dto.mimeType || '').startsWith('video/') ? 'VIDEO' : 'IMAGE',
        url: dto.mediaUrl,
        storageKey: dto.storageKey,
        mimeType: dto.mimeType,
      } as any,
    });

    return this.prisma.dayActivity.update({
      where: { id: activityId },
      data: { proofMediaId: media.id },
    });
  }

  private async getActivityFeed(
    childId: string,
    permissions: ActivityPermissions,
    date?: string,
  ) {
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });
    const selectedDate = this.toDayDate(date || new Date().toISOString());
    const dayPlan = await this.prisma.dayPlan.findFirst({
      where: { childId, date: selectedDate },
      include: {
        activities: {
          orderBy: { sortOrder: 'asc' },
        },
        bedtimeStory: true,
      },
    });
    const activities = dayPlan?.activities ?? [];

    return {
      child,
      dayPlan,
      activities,
      summary: this.summarizeActivities(activities),
      permissions,
    };
  }

  private async ensureCanReadActivity(
    user: CurrentUserPayload,
    childId: string,
  ) {
    if (user.role === 'ADMIN') return this.parentPermissions();
    if (user.role === 'NANNY') {
      const link = await this.ensureCanReadChildAsNanny(user, childId);
      return this.nannyPermissions(link.canUpdateProof, link.canViewStory);
    }

    await this.ensureCanManageChild(user, childId);
    return this.parentPermissions();
  }

  private ensureParentOrAdmin(user: CurrentUserPayload) {
    if (!['PARENT', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only parents can manage child activities');
    }
  }

  private ensureNannyOrAdmin(user: CurrentUserPayload) {
    if (!['NANNY', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only nannies can access this resource');
    }
  }

  private async ensureCanManageChild(
    user: CurrentUserPayload,
    childId: string,
  ) {
    this.ensureParentOrAdmin(user);
    if (user.role === 'ADMIN') return;

    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        parentUserId: user.userId,
      },
    });

    if (!child) {
      throw new NotFoundException('Child profile not found');
    }
  }

  private async ensureCanReadChildAsNanny(
    user: CurrentUserPayload,
    childId: string,
  ) {
    if (user.role === 'ADMIN') {
      return {
        canViewStory: true,
        canUpdateProof: true,
      };
    }

    this.ensureNannyOrAdmin(user);

    const link = await this.prisma.nannyChildLink.findUnique({
      where: {
        nannyUserId_childId: {
          nannyUserId: user.userId,
          childId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Child profile not assigned to this nanny');
    }

    return link;
  }

  private async ensureCanManageDayPlan(
    user: CurrentUserPayload,
    dayPlanId: string,
  ) {
    const dayPlan = await this.prisma.dayPlan.findUnique({
      where: { id: dayPlanId },
    });

    if (!dayPlan) {
      throw new NotFoundException('Day plan not found');
    }

    await this.ensureCanManageChild(user, dayPlan.childId);
    return dayPlan;
  }

  private async ensureCanManageActivity(
    user: CurrentUserPayload,
    activityId: string,
  ) {
    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: activityId },
      include: { dayPlan: true },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    await this.ensureCanManageChild(user, activity.dayPlan.childId);
    return activity;
  }

  private mapActivityInput(
    dayPlanId: string,
    activity: ManualActivityDto,
    index: number,
  ) {
    return {
      dayPlanId,
      category: activity.category,
      title: activity.title,
      description: activity.description,
      imageUrl: activity.imageUrl,
      detail: activity.detail as any,
      startTime: activity.startTime ? new Date(activity.startTime) : undefined,
      endTime: activity.endTime ? new Date(activity.endTime) : undefined,
      sortOrder: activity.sortOrder ?? index,
    };
  }

  private summarizeActivities(activities: Array<{ status: string }>) {
    return activities.reduce<ActivitySummary>(
      (summary, activity) => {
        if (activity.status === 'IN_PROGRESS') summary.inProgress += 1;
        else if (activity.status === 'COMPLETED') summary.completed += 1;
        else if (activity.status === 'SKIPPED') summary.skipped += 1;
        else summary.planned += 1;

        summary.total += 1;
        return summary;
      },
      {
        planned: 0,
        inProgress: 0,
        completed: 0,
        skipped: 0,
        total: 0,
      },
    );
  }

  private parentPermissions(): ActivityPermissions {
    return {
      canEdit: true,
      canUpdateProof: false,
      canViewStory: true,
    };
  }

  private nannyPermissions(
    canUpdateProof: boolean,
    canViewStory: boolean,
  ): ActivityPermissions {
    return {
      canEdit: false,
      canUpdateProof,
      canViewStory,
    };
  }

  private toDayDate(date: string) {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private mimeToExtension(mimeType: string) {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('quicktime')) return 'mov';
    return 'jpg';
  }
}
