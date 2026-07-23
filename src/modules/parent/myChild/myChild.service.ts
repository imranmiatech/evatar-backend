import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

type AuthUser = CurrentUserPayload & { id?: string };

@Injectable()
export class MyChildService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyChildren(user: AuthUser) {
    const userId = this.getUserId(user);

    const children = await this.prisma.child.findMany({
      where: this.getChildWhere(user, userId),
      select: {
        id: true,
        name: true,
        avatar: true,
        birthDate: true,
        createdAt: true,
        nannies: {
          select: {
            nannyUser: {
              select: {
                id: true,
                fullName: true,
                profilePictureUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = children.map((child) => {
      const assignedNannies = child.nannies.map(({ nannyUser }) => ({
        id: nannyUser.id,
        name: nannyUser.fullName,
        avatar: nannyUser.profilePictureUrl,
      }));

      return {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        birthDate: child.birthDate,
        age: this.formatAge(child.birthDate),
        assignedNannies,
        assignedNannyText: assignedNannies.length
          ? `Assigned: ${assignedNannies.map((nanny) => nanny.name).join(', ')}`
          : 'Assigned: None',
      };
    });

    return {
      total: data.length,
      children: data,
    };
  }

  async getChildProfile(user: AuthUser, childId: string) {
    await this.ensureCanReadChild(user, childId);

    const [child, memoriesCount, storiesCount] = await Promise.all([
      this.prisma.child.findUnique({
        where: { id: childId },
        select: {
          id: true,
          name: true,
          avatar: true,
          birthDate: true,
          nannies: {
            select: {
              canViewStory: true,
              canUpdateProof: true,
              nannyUser: {
                select: {
                  id: true,
                  fullName: true,
                  profilePictureUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.dayActivity.count({
        where: {
          dayPlan: { childId },
          imageUrl: { not: null },
        },
      }),
      this.prisma.bedtimeStory.count({
        where: {
          dayPlan: { childId },
        },
      }),
    ]);

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const caregivers = child.nannies.map((link) => ({
      id: link.nannyUser.id,
      name: link.nannyUser.fullName,
      avatar: link.nannyUser.profilePictureUrl,
      permissions: {
        canViewStory: link.canViewStory,
        canUpdateProof: link.canUpdateProof,
      },
    }));

    return {
      id: child.id,
      name: child.name,
      avatar: child.avatar,
      birthDate: child.birthDate,
      age: this.formatAge(child.birthDate),
      caregivers,
      stats: {
        memories: memoriesCount,
        stories: storiesCount,
      },
    };
  }

  async getChildMemories(user: AuthUser, childId: string) {
    await this.ensureCanReadChild(user, childId);

    const activities = await this.prisma.dayActivity.findMany({
      where: {
        dayPlan: { childId },
        imageUrl: { not: null },
      },
      select: {
        id: true,
        title: true,
        category: true,
        imageUrl: true,
        createdAt: true,
        dayPlan: {
          select: {
            id: true,
            date: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    return {
      total: activities.length,
      memories: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        category: activity.category,
        type: 'IMAGE',
        url: activity.imageUrl,
        date: activity.dayPlan.date,
        source: 'DAY_ACTIVITY',
      })),
    };
  }

  async deleteChildMemory(user: AuthUser, childId: string, memoryId: string) {
    await this.ensureCanManageChild(user, childId);

    const memory = await this.prisma.dayActivity.findFirst({
      where: {
        id: memoryId,
        dayPlan: { childId },
        imageUrl: { not: null },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (!memory) {
      throw new NotFoundException('Memory image not found');
    }

    await this.prisma.dayActivity.update({
      where: { id: memory.id },
      data: {
        imageUrl: null,
      },
    });

    return {
      message: 'Memory image deleted successfully',
      deletedMemoryId: memory.id,
    };
  }

  async getChildBedtimeStories(user: AuthUser, childId: string) {
    await this.ensureCanReadChild(user, childId);

    const stories = await this.prisma.bedtimeStory.findMany({
      where: {
        dayPlan: { childId },
      },
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        parentAudioUrl: true,
        audioDurationSec: true,
        createdAt: true,
        dayPlan: {
          select: {
            id: true,
            date: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return {
      total: stories.length,
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        coverImageUrl: story.coverImageUrl,
        audioUrl: story.parentAudioUrl,
        durationSec: story.audioDurationSec,
        date: story.dayPlan.date,
        dayPlanId: story.dayPlan.id,
      })),
    };
  }

  async getChildPersonality(user: AuthUser, childId: string) {
    await this.ensureCanReadChild(user, childId);

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: {
        id: true,
        name: true,
        favoriteThings: true,
        personality: true,
        dietaryNotes: true,
        medicalNotes: true,
        additionalNotes: true,
      },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    return {
      childId: child.id,
      favoriteFoods: child.favoriteThings,
      declinedFoods: [],
      favoriteActivities: [],
      lowEngagement: [],
      notes: {
        dietary: child.dietaryNotes,
        medical: child.medicalNotes,
        additional: child.additionalNotes,
      },
      snapshot: {
        summary:
          child.personality ??
          `${child.name}'s personality snapshot will appear here as caregivers add more activities, stories, and daily notes.`,
      },
    };
  }

  private getChildWhere(user: AuthUser, userId: string) {
    if (user.role === 'ADMIN') {
      return {};
    }

    if (user.role === 'NANNY') {
      return {
        nannies: {
          some: {
            nannyUserId: userId,
          },
        },
      };
    }

    return { parentUserId: userId };
  }

  private async ensureCanReadChild(user: AuthUser, childId: string) {
    const userId = this.getUserId(user);

    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        OR:
          user.role === 'ADMIN'
            ? undefined
            : [
                { parentUserId: userId },
                {
                  nannies: {
                    some: {
                      nannyUserId: userId,
                    },
                  },
                },
              ],
      },
      select: { id: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }
  }

  private async ensureCanManageChild(user: AuthUser, childId: string) {
    const userId = this.getUserId(user);

    if (user.role === 'ADMIN') {
      await this.prisma.child.findUniqueOrThrow({ where: { id: childId } });
      return;
    }

    if (user.role !== 'PARENT') {
      throw new ForbiddenException('Only parents can delete child memories');
    }

    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        parentUserId: userId,
      },
      select: { id: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }
  }

  private getUserId(user: AuthUser) {
    const userId = user.userId ?? user.id;

    if (!userId) {
      throw new ForbiddenException('User id missing from token payload');
    }

    return userId;
  }

  private formatAge(birthDate: Date | null) {
    if (!birthDate) {
      return null;
    }

    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
      const previousMonthLastDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        0,
      ).getDate();
      months -= 1;
      days += previousMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [
      this.formatAgePart(years, 'year'),
      this.formatAgePart(months, 'month'),
      this.formatAgePart(days, 'day'),
    ].filter(Boolean);

    return parts.length ? parts.join(' ') : '0 days';
  }

  private formatAgePart(value: number, unit: string) {
    if (value <= 0) {
      return null;
    }

    return `${value} ${unit}${value === 1 ? '' : 's'}`;
  }
}
