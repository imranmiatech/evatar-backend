import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class NanyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyInvitations(user: CurrentUserPayload) {
    this.ensureNanny(user);

    const invitations = await this.prisma.nannyChildLink.findMany({
      where: { nannyUserId: user.userId },
      include: {
        child: {
          include: {
            parentUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                profilePictureUrl: true,
                parentProfile: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: invitations.map((link) => ({
        id: link.id,
        canViewStory: link.canViewStory,
        canUpdateProof: link.canUpdateProof,
        createdAt: link.createdAt,
        parent: {
          id: link.child.parentUser.id,
          fullName: link.child.parentUser.fullName,
          email: link.child.parentUser.email,
          phoneNumber: link.child.parentUser.phoneNumber,
          profilePictureUrl: link.child.parentUser.profilePictureUrl,
          address: link.child.parentUser.parentProfile?.address,
        },
        child: {
          id: link.child.id,
          name: link.child.name,
          avatar: link.child.avatar,
          gender: link.child.gender,
          birthDate: link.child.birthDate,
        },
      })),
    };
  }

  async acceptInvitation(user: CurrentUserPayload, linkId: string) {
    this.ensureNanny(user);

    const invitation = await this.prisma.nannyChildLink.findFirst({
      where: {
        id: linkId,
        nannyUserId: user.userId,
      },
      include: {
        child: {
          include: {
            parentUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                profilePictureUrl: true,
                parentProfile: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return {
      success: true,
      message: 'Invitation accepted successfully',
      data: invitation,
    };
  }

  private ensureNanny(user: CurrentUserPayload) {
    if (user.role !== UserRole.NANNY) {
      throw new BadRequestException('Only nanny users can access invitations');
    }
  }
}
