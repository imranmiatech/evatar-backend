import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateNannyInvitationDto } from './dto/create-nanny-invitation.dto';

@Injectable()
export class NanyService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(
    user: CurrentUserPayload,
    dto: CreateNannyInvitationDto,
  ) {
    this.ensureParent(user);
    const parentUserId = this.currentUserId(user);

    const nanny = await this.prisma.user.findUnique({
      where: { email: dto.nannyEmail },
      select: {
        id: true,
        role: true,
        email: true,
        fullName: true,
      },
    });

    if (!nanny || nanny.role !== UserRole.NANNY) {
      throw new NotFoundException('Nanny user not found');
    }

    const child = dto.childId
      ? await this.prisma.child.findFirst({
          where: {
            id: dto.childId,
            parentUserId,
          },
        })
      : await this.prisma.child.create({
          data: {
            parentUserId,
            name: dto.childName?.trim() || 'Child',
          },
        });

    if (!child) {
      throw new NotFoundException('Child not found for this parent');
    }

    const invitation = await this.prisma.nannyChildLink.upsert({
      where: {
        nannyUserId_childId: {
          nannyUserId: nanny.id,
          childId: child.id,
        },
      },
      update: {
        canViewStory: dto.canViewStory ?? true,
        canUpdateProof: dto.canUpdateProof ?? true,
      },
      create: {
        nannyUserId: nanny.id,
        childId: child.id,
        canViewStory: dto.canViewStory ?? true,
        canUpdateProof: dto.canUpdateProof ?? true,
      },
      include: this.invitationInclude(),
    });

    return {
      success: true,
      message: 'Nanny invitation created successfully',
      data: this.formatInvitation(invitation),
    };
  }

  async getMyInvitations(user: CurrentUserPayload) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);

    const invitations = await this.prisma.nannyChildLink.findMany({
      where: { nannyUserId },
      include: this.invitationInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: invitations.map((link) => this.formatInvitation(link)),
    };
  }

  async acceptInvitation(user: CurrentUserPayload, linkId: string) {
    this.ensureNanny(user);
    const nannyUserId = this.currentUserId(user);

    const invitation = await this.prisma.nannyChildLink.findFirst({
      where: {
        id: linkId,
        nannyUserId,
      },
      include: this.invitationInclude(),
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return {
      success: true,
      message: 'Invitation accepted successfully',
      data: this.formatInvitation(invitation),
    };
  }

  private invitationInclude() {
    return {
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
    };
  }

  private formatInvitation(link: any) {
    return {
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
    };
  }

  private ensureNanny(user: CurrentUserPayload) {
    if (user.role !== UserRole.NANNY) {
      throw new BadRequestException('Only nanny users can access invitations');
    }
  }

  private ensureParent(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parent users can create invitations');
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
