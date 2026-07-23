import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import {
  CompleteAiResultDto,
  CompleteRecordingDto,
  CreateChildDto,
  CreateGuidedDayPlanDto,
  CreateManualDayPlanDto,
  ManualActivityDto,
  CreateNannyLinkDto,
  RequestAiGenerationDto,
  UpdateBedtimeStoryDto,
  UpdateChildDto,
} from './dto';
import { CreateBedtimeStoryDto } from './dto/story-recording.dto';

@Injectable()
export class todayService {
  constructor(private readonly prisma: PrismaService) {}

  async createChild(user: CurrentUserPayload, dto: CreateChildDto) {
    this.ensureParentOrAdmin(user);

    return this.prisma.child.create({
      data: {
        parentUserId: user.userId,
        name: dto.name,
        weight: dto.weight,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender as any,
        avatar: dto.avatarUrl,
        allergies: dto.allergies ?? [],
        dietaryNotes: dto.dietaryNotes,
        medicalNotes: dto.medicalNotes,
        personality: dto.personality,
        sleepRoutine: dto.sleepRoutine,
        favoriteThings: dto.favoriteThings ?? [],
      },
    });
  }

  async listChildren(user: CurrentUserPayload) {
    if (user.role === 'NANNY') {
      const links = await this.prisma.nannyChildLink.findMany({
        where: { nannyUserId: user.userId },
        include: { child: true },
        orderBy: { createdAt: 'desc' },
      });

      return links.map((link) => ({
        ...link.child,
        nannyPermissions: {
          canViewStory: link.canViewStory,
          canUpdateProof: link.canUpdateProof,
        },
      }));
    }

    return this.prisma.child.findMany({
      where: user.role === 'ADMIN' ? {} : { parentUserId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChild(user: CurrentUserPayload, childId: string) {
    await this.ensureCanReadChild(user, childId);

    return this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });
  }

  async updateChild(
    user: CurrentUserPayload,
    childId: string,
    dto: UpdateChildDto,
  ) {
    await this.ensureCanManageChild(user, childId);

    return this.prisma.child.update({
      where: { id: childId },
      data: {
        name: dto.name,
        weight: dto.weight,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender as any,
        avatar: dto.avatarUrl,
        allergies: dto.allergies,
        dietaryNotes: dto.dietaryNotes,
        medicalNotes: dto.medicalNotes,
        personality: dto.personality,
        sleepRoutine: dto.sleepRoutine,
        favoriteThings: dto.favoriteThings,
      },
    });
  }

  async deleteChild(user: CurrentUserPayload, childId: string) {
    await this.ensureCanManageChild(user, childId);
    await this.prisma.child.delete({ where: { id: childId } });
    return { message: 'Child profile deleted successfully' };
  }

  async createGuidedDraft(
    user: CurrentUserPayload,
    childId: string,
    dto: CreateGuidedDayPlanDto,
  ) {
    await this.ensureCanManageChild(user, childId);
    await this.ensureNoPlanForDate(childId, dto.date);

    return this.prisma.dayPlan.create({
      data: {
        childId,
        date: this.toDayDate(dto.date),
        mode: 'GUIDED',
        status: 'DRAFT',
        guidedAnswers: dto.guidedAnswers ?? {},
        createdByUserId: user.userId,
      } as any,
      include: this.dayPlanInclude(),
    });
  }

  async updateGuidedAnswers(
    user: CurrentUserPayload,
    dayPlanId: string,
    guidedAnswers: Record<string, unknown>,
  ) {
    const dayPlan = await this.ensureCanManageDayPlan(user, dayPlanId);

    if (dayPlan.mode !== 'GUIDED') {
      throw new BadRequestException(
        'Guided answers can only be updated on guided plans',
      );
    }

    return this.prisma.dayPlan.update({
      where: { id: dayPlanId },
      data: {
        guidedAnswers,
        status: 'DRAFT',
      } as any,
      include: this.dayPlanInclude(),
    });
  }

  async requestAiGeneration(
    user: CurrentUserPayload,
    dayPlanId: string,
    dto: RequestAiGenerationDto,
  ) {
    const dayPlan = await this.ensureCanManageDayPlan(user, dayPlanId);
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: dayPlan.childId },
    });

    const aiInput = {
      child,
      date: dayPlan.date,
      guidedAnswers: dayPlan.guidedAnswers,
      requestedProvider: dto.aiProvider,
      requestedModel: dto.aiModel,
    };

    return this.prisma.dayPlan.update({
      where: { id: dayPlanId },
      data: {
        status: 'AI_PENDING',
        aiInput,
      } as any,
      include: this.dayPlanInclude(),
    });
  }

  async completeAiResult(
    user: CurrentUserPayload,
    dayPlanId: string,
    dto: CompleteAiResultDto,
  ) {
    const dayPlan = await this.ensureCanManageDayPlan(user, dayPlanId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.activities) {
        await tx.dayActivity.deleteMany({ where: { dayPlanId } });
        await tx.dayActivity.createMany({
          data: dto.activities.map((activity, index) =>
            this.mapActivityInput(dayPlanId, activity, index),
          ) as any,
        });
      }

      await tx.bedtimeStory.upsert({
        where: { dayPlanId },
        create: {
          dayPlanId,
          title: dto.story.title,
          storyText: dto.story.storyText,
          imagePrompt: dto.story.imagePrompt,
          coverImageUrl: dto.story.coverImageUrl,
          aiProvider: dto.story.aiProvider,
          aiModel: dto.story.aiModel,
        },
        update: {
          title: dto.story.title,
          storyText: dto.story.storyText,
          imagePrompt: dto.story.imagePrompt,
          coverImageUrl: dto.story.coverImageUrl,
          aiProvider: dto.story.aiProvider,
          aiModel: dto.story.aiModel,
        },
      });

      return tx.dayPlan.update({
        where: { id: dayPlanId },
        data: {
          status: 'READY',
          aiOutput: dto.aiOutput ?? dto,
          title: dayPlan.title ?? `${dto.story.title}`,
          summary: dto.story.storyText.slice(0, 180),
        } as any,
        include: this.dayPlanInclude(),
      });
    });
  }

  async createManualPlan(
    user: CurrentUserPayload,
    childId: string,
    dto: CreateManualDayPlanDto,
  ) {
    await this.ensureCanManageChild(user, childId);
    await this.ensureNoPlanForDate(childId, dto.date);

    return this.prisma.$transaction(async (tx) => {
      const dayPlan = await tx.dayPlan.create({
        data: {
          childId,
          date: this.toDayDate(dto.date),
          mode: 'MANUAL',
          status: 'DRAFT',
          title: dto.title,
          createdByUserId: user.userId,
        } as any,
      });

      if (dto.activities?.length) {
        await tx.dayActivity.createMany({
          data: dto.activities.map((activity, index) =>
            this.mapActivityInput(dayPlan.id, activity, index),
          ) as any,
        });
      }

      return tx.dayPlan.findUniqueOrThrow({
        where: { id: dayPlan.id },
        include: this.dayPlanInclude(),
      });
    });
  }

  async getDayPlan(user: CurrentUserPayload, dayPlanId: string) {
    await this.ensureCanReadDayPlan(user, dayPlanId);

    return this.prisma.dayPlan.findUniqueOrThrow({
      where: { id: dayPlanId },
      include: this.dayPlanInclude(),
    });
  }

  async getChildDayPlans(user: CurrentUserPayload, childId: string) {
    await this.ensureCanReadChild(user, childId);

    return this.prisma.dayPlan.findMany({
      where: { childId },
      include: this.dayPlanInclude(),
      orderBy: { date: 'desc' },
    });
  }

  async markDayPlanReady(user: CurrentUserPayload, dayPlanId: string) {
    await this.ensureCanManageDayPlan(user, dayPlanId);

    return this.prisma.dayPlan.update({
      where: { id: dayPlanId },
      data: { status: 'READY' } as any,
      include: this.dayPlanInclude(),
    });
  }

  async getBedtimeStory(user: CurrentUserPayload, dayPlanId: string) {
    await this.ensureCanReadDayPlan(user, dayPlanId);

    const story = await this.prisma.bedtimeStory.findUnique({
      where: { dayPlanId },
    });

    if (!story) {
      throw new NotFoundException('Bedtime story not found');
    }

    return story;
  }

  async createManualBedtimeStory(
    user: CurrentUserPayload,
    dayPlanId: string,
    dto: CreateBedtimeStoryDto,
  ) {
    const dayPlan = await this.ensureCanManageDayPlan(user, dayPlanId);

    return this.prisma.bedtimeStory.upsert({
      where: { dayPlanId },
      create: {
        dayPlanId,
        title: dto.title,
        storyText: dto.storyText,
        imagePrompt: dto.imagePrompt,
        coverImageUrl: dto.coverImageUrl,
      },
      update: {
        title: dto.title,
        storyText: dto.storyText,
        imagePrompt: dto.imagePrompt,
        coverImageUrl: dto.coverImageUrl,
      },
    });
  }

  async updateBedtimeStory(
    user: CurrentUserPayload,
    storyId: string,
    dto: UpdateBedtimeStoryDto,
  ) {
    const story = await this.prisma.bedtimeStory.findUniqueOrThrow({
      where: { id: storyId },
      include: { dayPlan: true },
    });

    await this.ensureCanManageDayPlan(user, story.dayPlanId);

    return this.prisma.bedtimeStory.update({
      where: { id: storyId },
      data: dto,
    });
  }

  async listBedtimeStories(user: CurrentUserPayload, childId: string) {
    await this.ensureCanReadChild(user, childId);

    return this.prisma.bedtimeStory.findMany({
      where: { dayPlan: { childId } },
      orderBy: { createdAt: 'desc' },
      include: {
        dayPlan: {
          select: {
            id: true,
            date: true,
            status: true,
          },
        },
      },
    });
  }

  async createRecordingUploadUrl(
    user: CurrentUserPayload,
    storyId: string,
    mimeType: string,
  ) {
    const story = await this.prisma.bedtimeStory.findUniqueOrThrow({
      where: { id: storyId },
    });
    await this.ensureCanManageDayPlan(user, story.dayPlanId);

    const extension = this.mimeToExtension(mimeType);
    const storageKey = `story-recordings/${user.userId}/${storyId}.${extension}`;

    return {
      storageKey,
      uploadUrl: `/media/upload/${storageKey}`,
      method: 'PUT',
      mimeType,
    };
  }

  async completeRecording(
    user: CurrentUserPayload,
    storyId: string,
    dto: CompleteRecordingDto,
  ) {
    const story = await this.prisma.bedtimeStory.findUniqueOrThrow({
      where: { id: storyId },
    });
    await this.ensureCanManageDayPlan(user, story.dayPlanId);

    await this.prisma.mediaAsset.create({
      data: {
        ownerUserId: user.userId,
        type: 'AUDIO',
        url: dto.audioUrl,
        storageKey: dto.storageKey,
        durationSec: dto.durationSec,
      } as any,
    });

    return this.prisma.bedtimeStory.update({
      where: { id: storyId },
      data: {
        parentAudioUrl: dto.audioUrl,
        parentAudioKey: dto.storageKey,
        audioDurationSec: dto.durationSec,
      },
    });
  }

  async createNannyLink(
    user: CurrentUserPayload,
    childId: string,
    dto: CreateNannyLinkDto,
  ) {
    await this.ensureCanManageChild(user, childId);

    const nanny = await this.prisma.user.findUnique({
      where: { id: dto.nannyUserId },
    });

    if (!nanny || nanny.role !== 'NANNY') {
      throw new BadRequestException('Nanny user not found');
    }

    return this.prisma.nannyChildLink.upsert({
      where: {
        nannyUserId_childId: {
          nannyUserId: dto.nannyUserId,
          childId,
        },
      },
      create: {
        nannyUserId: dto.nannyUserId,
        childId,
        canViewStory: dto.canViewStory ?? true,
        canUpdateProof: dto.canUpdateProof ?? true,
      },
      update: {
        canViewStory: dto.canViewStory ?? true,
        canUpdateProof: dto.canUpdateProof ?? true,
      },
    });
  }

  async listNannyLinks(user: CurrentUserPayload, childId: string) {
    await this.ensureCanManageChild(user, childId);

    return this.prisma.nannyChildLink.findMany({
      where: { childId },
      include: {
        nannyUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            profilePictureUrl: true,
            verificationStatus: true,
            nannyProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeNannyLink(
    user: CurrentUserPayload,
    childId: string,
    nannyUserId: string,
  ) {
    await this.ensureCanManageChild(user, childId);

    await this.prisma.nannyChildLink.delete({
      where: {
        nannyUserId_childId: {
          nannyUserId,
          childId,
        },
      },
    });

    return { message: 'Nanny removed from child successfully' };
  }

  async searchNannies(user: CurrentUserPayload, query?: string) {
    this.ensureParentOrAdmin(user);
    const search = query?.trim();

    return this.prisma.user.findMany({
      where: {
        role: 'NANNY',
        isActive: true,
        verificationStatus: 'APPROVED',
        OR: search
          ? [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        verificationStatus: true,
        nannyProfile: true,
      },
      orderBy: { fullName: 'asc' },
      take: 25,
    });
  }

  async listNannyChildren(user: CurrentUserPayload) {
    this.ensureNannyOrAdmin(user);

    return this.prisma.nannyChildLink.findMany({
      where: user.role === 'ADMIN' ? {} : { nannyUserId: user.userId },
      include: { child: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNannyProfile(user: CurrentUserPayload, nannyUserId: string) {
    if (user.role !== 'ADMIN' && user.userId !== nannyUserId) {
      const linkedChild = await this.prisma.nannyChildLink.findFirst({
        where: {
          nannyUserId,
          child: {
            parentUserId: user.userId,
          },
        },
      });

      if (!linkedChild) {
        throw new ForbiddenException('You cannot view this nanny profile');
      }
    }

    const profile = await this.prisma.nannyProfile.findUnique({
      where: { userId: nannyUserId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            profilePictureUrl: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Nanny profile not found');
    }

    return profile;
  }

  async getNannyToday(user: CurrentUserPayload, childId: string) {
    await this.ensureCanReadChildAsNanny(user, childId);

    const today = this.toDayDate(new Date().toISOString());

    const plan = await this.prisma.dayPlan.findFirst({
      where: { childId, date: today },
      include: this.dayPlanInclude(),
    });

    if (!plan) {
      throw new NotFoundException('No plan found for today');
    }

    return plan;
  }

  async getNannyStoryPlayback(user: CurrentUserPayload, storyId: string) {
    const story = await this.prisma.bedtimeStory.findUniqueOrThrow({
      where: { id: storyId },
      include: { dayPlan: true },
    });
    const link = await this.ensureCanReadChildAsNanny(
      user,
      story.dayPlan.childId,
    );

    if (!link.canViewStory && user.role !== 'ADMIN') {
      throw new ForbiddenException('Nanny cannot view story for this child');
    }

    return {
      storyId: story.id,
      title: story.title,
      storyText: story.storyText,
      parentAudioUrl: story.parentAudioUrl,
      audioDurationSec: story.audioDurationSec,
    };
  }

  private ensureParentOrAdmin(user: CurrentUserPayload) {
    if (!['PARENT', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only parents can manage child day setup');
    }
  }

  private ensureNannyOrAdmin(user: CurrentUserPayload) {
    if (!['NANNY', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only nannies can access this resource');
    }
  }

  private async ensureCanReadChild(user: CurrentUserPayload, childId: string) {
    if (user.role === 'ADMIN') return;
    if (user.role === 'NANNY') {
      await this.ensureCanReadChildAsNanny(user, childId);
      return;
    }
    await this.ensureCanManageChild(user, childId);
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

  private async ensureCanReadDayPlan(
    user: CurrentUserPayload,
    dayPlanId: string,
  ) {
    const dayPlan = await this.prisma.dayPlan.findUnique({
      where: { id: dayPlanId },
    });

    if (!dayPlan) {
      throw new NotFoundException('Day plan not found');
    }

    await this.ensureCanReadChild(user, dayPlan.childId);
    return dayPlan;
  }

  private async ensureNoPlanForDate(childId: string, date: string) {
    const existingPlan = await this.prisma.dayPlan.findFirst({
      where: {
        childId,
        date: this.toDayDate(date),
      },
    });

    if (existingPlan) {
      throw new BadRequestException('A day plan already exists for this date');
    }
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
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp4')) return 'm4a';
    return 'm4a';
  }

  private dayPlanInclude() {
    return {
      child: true,
      activities: {
        orderBy: { sortOrder: 'asc' as const },
      },
      bedtimeStory: true,
    };
  }
}
