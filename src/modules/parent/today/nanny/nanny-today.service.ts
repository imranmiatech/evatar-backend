import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { NannyBedtimeSubmissionDto, NannyTaskSubmissionDto } from './dto';
import type { TimelineItem } from './types/nanny-today.types';

type NannyLinkPermissions = {
  canViewStory: boolean;
  canUpdateProof: boolean;
};

@Injectable()
export class NannyTodayService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(user: CurrentUserPayload, childId?: string, date?: string) {
    this.ensureNannyOrAdmin(user);

    const links = await this.prisma.nannyChildLink.findMany({
      where: user.role === 'ADMIN' ? {} : { nannyUserId: user.userId },
      include: { child: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!links.length) {
      return {
        nanny: await this.getNannyUser(user.userId),
        children: [],
        selectedChild: null,
        dayPlan: null,
        timeline: [],
        bedtimeStory: null,
        permissions: this.permissionsFor({
          canUpdateProof: false,
          canViewStory: false,
        }),
      };
    }

    const selectedLink = childId
      ? links.find((link) => link.childId === childId)
      : links[0];

    if (!selectedLink) {
      throw new NotFoundException('Child profile not assigned to this nanny');
    }

    const selectedDate = this.toDayDate(date || new Date().toISOString());
    const dayPlan = await this.prisma.dayPlan.findFirst({
      where: { childId: selectedLink.childId, date: selectedDate },
      include: {
        activities: {
          orderBy: { sortOrder: 'asc' },
        },
        bedtimeStory: true,
      },
    });

    const activities = dayPlan?.activities ?? [];
    const schedules = activities.length
      ? await this.prisma.kitchenSchedule.findMany({
          where: {
            childId: selectedLink.childId,
            date: selectedDate,
            dayActivityId: { in: activities.map((activity) => activity.id) },
          },
          include: {
            recipe: {
              include: {
                ingredients: { orderBy: { sortOrder: 'asc' } },
                steps: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        })
      : [];
    const schedulesByActivity = new Map(
      schedules
        .filter((schedule) => schedule.dayActivityId)
        .map((schedule) => [schedule.dayActivityId as string, schedule]),
    );

    const timeline = [
      ...this.routineItems(dayPlan?.guidedAnswers),
      ...activities.map((activity) =>
        this.activityItem(activity, schedulesByActivity.get(activity.id)),
      ),
      ...(dayPlan?.bedtimeStory
        ? [this.storyItem(dayPlan.bedtimeStory, activities.length + 100)]
        : []),
    ].sort((left, right) => this.timelineSort(left, right));

    return {
      nanny: await this.getNannyUser(user.userId),
      children: links.map((link) => ({
        ...link.child,
        nannyPermissions: {
          canViewStory: link.canViewStory,
          canUpdateProof: link.canUpdateProof,
        },
      })),
      selectedChild: selectedLink.child,
      dayPlan,
      timeline,
      bedtimeStory:
        dayPlan?.bedtimeStory && selectedLink.canViewStory
          ? dayPlan.bedtimeStory
          : null,
      permissions: this.permissionsFor(selectedLink),
    };
  }

  async getTaskDetail(user: CurrentUserPayload, activityId: string) {
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

    const link = await this.ensureCanReadChildAsNanny(
      user,
      activity.dayPlan.childId,
    );
    const recipeAssignment = await this.getRecipeAssignment(activity.id);
    const proofMedia = activity.proofMediaId
      ? await this.prisma.mediaAsset.findUnique({
          where: { id: activity.proofMediaId },
        })
      : null;
    const detail = this.objectValue(activity.detail);

    return {
      activity,
      child: activity.dayPlan.child,
      dayPlan: {
        id: activity.dayPlan.id,
        date: activity.dayPlan.date,
        title: activity.dayPlan.title,
        status: activity.dayPlan.status,
      },
      recipeAssignment,
      proof: {
        required: link.canUpdateProof,
        media: proofMedia,
      },
      submission: detail.nannySubmission ?? null,
      developerNote:
        detail.developerNote ?? this.defaultDeveloperNote(activity),
      aiFeedback: detail.aiFeedback ?? null,
      actions: {
        canUpdateStatus: link.canUpdateProof,
        canSubmitProof: link.canUpdateProof,
        canViewRecipe: Boolean(recipeAssignment?.recipe),
        canViewBedtimeStory: link.canViewStory,
      },
    };
  }

  async getTaskRecipe(user: CurrentUserPayload, activityId: string) {
    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: activityId },
      include: { dayPlan: true },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    await this.ensureCanReadChildAsNanny(user, activity.dayPlan.childId);
    const recipeAssignment = await this.getRecipeAssignment(activity.id);

    if (!recipeAssignment?.recipe) {
      throw new NotFoundException('Recipe is not assigned to this task');
    }

    return recipeAssignment.recipe;
  }

  async submitTask(
    user: CurrentUserPayload,
    activityId: string,
    dto: NannyTaskSubmissionDto,
  ) {
    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: activityId },
      include: { dayPlan: true },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const link = await this.ensureCanReadChildAsNanny(
      user,
      activity.dayPlan.childId,
    );

    if (!link.canUpdateProof && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot submit proof for this child');
    }

    await this.ensureProofMediaExists(dto.proofMediaIds);

    const nextStatus = dto.status ?? 'COMPLETED';
    const submission = {
      status: nextStatus,
      proofMediaIds: dto.proofMediaIds ?? [],
      checklist: dto.checklist ?? null,
      mood: dto.mood ?? null,
      completion: dto.completion ?? null,
      nannyNote: dto.nannyNote ?? null,
      submittedByUserId: user.userId,
      submittedAt: new Date().toISOString(),
    };
    const aiFeedback = this.buildAiFeedback(activity.title, submission);
    const detail = {
      ...this.objectValue(activity.detail),
      nannySubmission: submission,
      aiFeedback,
    };

    await this.prisma.dayActivity.update({
      where: { id: activityId },
      data: {
        status: nextStatus as any,
        nannyNote: dto.nannyNote,
        proofMediaId: dto.proofMediaIds?.[0],
        detail: detail as any,
      },
    });

    return this.getTaskDetail(user, activityId);
  }

  async getBedtime(user: CurrentUserPayload, storyId: string) {
    const story = await this.prisma.bedtimeStory.findUnique({
      where: { id: storyId },
      include: {
        dayPlan: {
          include: {
            child: true,
          },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Bedtime story not found');
    }

    const link = await this.ensureCanReadChildAsNanny(
      user,
      story.dayPlan.childId,
    );

    if (!link.canViewStory && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot view story for this child');
    }

    return {
      story: {
        id: story.id,
        title: story.title,
        storyText: story.storyText,
        coverImageUrl: story.coverImageUrl,
        parentAudioUrl: story.parentAudioUrl,
        audioDurationSec: story.audioDurationSec,
      },
      child: story.dayPlan.child,
      dayPlan: {
        id: story.dayPlan.id,
        date: story.dayPlan.date,
        title: story.dayPlan.title,
      },
      submission: this.bedtimeSubmissionFromAiOutput(
        story.dayPlan.aiOutput,
        story.id,
      ),
    };
  }

  async submitBedtime(
    user: CurrentUserPayload,
    storyId: string,
    dto: NannyBedtimeSubmissionDto,
  ) {
    const story = await this.prisma.bedtimeStory.findUnique({
      where: { id: storyId },
      include: { dayPlan: true },
    });

    if (!story) {
      throw new NotFoundException('Bedtime story not found');
    }

    const link = await this.ensureCanReadChildAsNanny(
      user,
      story.dayPlan.childId,
    );

    if (!link.canViewStory && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot submit this story');
    }

    const aiOutput = this.objectValue(story.dayPlan.aiOutput);
    const submissions = this.objectValue(aiOutput.nannyBedtimeSubmissions);
    const submission = {
      nannyNote: dto.nannyNote ?? null,
      feedback: dto.feedback ?? null,
      submittedByUserId: user.userId,
      submittedAt: new Date().toISOString(),
    };

    await this.prisma.dayPlan.update({
      where: { id: story.dayPlanId },
      data: {
        aiOutput: {
          ...aiOutput,
          nannyBedtimeSubmissions: {
            ...submissions,
            [story.id]: submission,
          },
        } as any,
      },
    });

    return this.getBedtime(user, storyId);
  }

  private async getRecipeAssignment(activityId: string) {
    return this.prisma.kitchenSchedule.findFirst({
      where: { dayActivityId: activityId },
      include: {
        recipe: {
          include: {
            ingredients: { orderBy: { sortOrder: 'asc' } },
            steps: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  private async ensureProofMediaExists(proofMediaIds?: string[]) {
    if (!proofMediaIds?.length) return;

    const media = await this.prisma.mediaAsset.findMany({
      where: { id: { in: proofMediaIds } },
      select: { id: true },
    });
    const found = new Set(media.map((item) => item.id));
    const missing = proofMediaIds.filter((id) => !found.has(id));

    if (missing.length) {
      throw new BadRequestException({
        message: 'Some proof media ids were not found',
        missing,
      });
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

  private ensureNannyOrAdmin(user: CurrentUserPayload) {
    if (!['NANNY', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only nannies can access this resource');
    }
  }

  private async getNannyUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        nannyProfile: true,
      },
    });
  }

  private activityItem(activity: any, schedule?: any): TimelineItem {
    return {
      type: 'activity',
      id: activity.id,
      activityId: activity.id,
      category: activity.category,
      title: activity.title,
      subtitle: activity.description,
      timeLabel: this.timeLabel(activity.startTime, activity.endTime),
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      imageUrl: activity.imageUrl,
      hasRecipe: Boolean(schedule?.recipe),
      recipeId: schedule?.recipeId ?? null,
      proofRequired: true,
      proofMediaId: activity.proofMediaId,
      sortOrder: activity.sortOrder,
    };
  }

  private storyItem(story: any, sortOrder: number): TimelineItem {
    return {
      type: 'story',
      id: story.id,
      storyId: story.id,
      category: 'BEDTIME_STORY',
      title: "Today's bedtime story",
      subtitle: story.title,
      timeLabel: null,
      startTime: null,
      endTime: null,
      status: 'PLANNED',
      imageUrl: story.coverImageUrl,
      hasRecipe: false,
      recipeId: null,
      proofRequired: false,
      proofMediaId: null,
      sortOrder,
    };
  }

  private routineItems(guidedAnswers: unknown): TimelineItem[] {
    const answers = this.objectValue(guidedAnswers);
    const cycle = Array.isArray(answers.typicalDailyCycle)
      ? answers.typicalDailyCycle
      : [];

    return cycle.map((item: any, index) => ({
      type: 'routine',
      id: `routine-${index}`,
      category: 'ROUTINE',
      title: item.title || 'Routine',
      subtitle: null,
      timeLabel: item.time || this.timeRange(item.startTime, item.endTime),
      startTime: null,
      endTime: null,
      status: 'PLANNED',
      imageUrl: null,
      hasRecipe: false,
      recipeId: null,
      proofRequired: false,
      proofMediaId: null,
      sortOrder: index - 100,
    }));
  }

  private timelineSort(left: TimelineItem, right: TimelineItem) {
    const leftTime = left.startTime?.getTime();
    const rightTime = right.startTime?.getTime();

    if (leftTime && rightTime) return leftTime - rightTime;
    if (leftTime) return -1;
    if (rightTime) return 1;

    return left.sortOrder - right.sortOrder;
  }

  private bedtimeSubmissionFromAiOutput(aiOutput: unknown, storyId: string) {
    const output = this.objectValue(aiOutput);
    const submissions = this.objectValue(output.nannyBedtimeSubmissions);
    return submissions[storyId] ?? null;
  }

  private buildAiFeedback(title: string, submission: Record<string, unknown>) {
    return {
      title: 'Care feedback',
      summary: `${title} submission has been recorded.`,
      recommendation:
        submission.status === 'SKIPPED'
          ? 'Review why this task was skipped before repeating the plan.'
          : 'Keep the next transition calm and consistent.',
      generatedAt: new Date().toISOString(),
    };
  }

  private defaultDeveloperNote(activity: { category: string; title: string }) {
    return {
      title: 'Care guidance',
      body: `Complete ${activity.title}, add proof if required, then submit feedback for the parent.`,
      category: activity.category,
    };
  }

  private permissionsFor(link: NannyLinkPermissions) {
    return {
      canUpdateProof: link.canUpdateProof,
      canViewStory: link.canViewStory,
      canSubmitTask: link.canUpdateProof,
    };
  }

  private objectValue(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private timeLabel(startTime?: Date | null, endTime?: Date | null) {
    if (!startTime && !endTime) return null;
    if (startTime && endTime) {
      return `${this.clock(startTime)} - ${this.clock(endTime)}`;
    }
    return this.clock(startTime || endTime);
  }

  private timeRange(startTime?: string, endTime?: string) {
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    return startTime || endTime || null;
  }

  private clock(date?: Date | null) {
    if (!date) return null;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(date);
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
}
