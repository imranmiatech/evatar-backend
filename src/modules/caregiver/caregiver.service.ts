import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CaregiverAccessRole,
  CaregiverAccessStatus,
  CaregiverInviteChannel,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../common/mail/mail.service';
import { TwilioService } from '../../common/twilio/twilio.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaregiverInvitationDto } from './dto/create-caregiver-invitation.dto';
import { SearchCaregiversDto } from './dto/search-caregivers.dto';
import { UpdateCaregiverPermissionsDto } from './dto/update-caregiver-permissions.dto';

const PERMISSION_KEYS = [
  'dailyActivitiesRecipes',
  'manageDailyPlans',
  'manageGroceryLists',
  'editChildProfile',
  'accessChildInsights',
  'addRemoveChildren',
  'manageBilling',
  'manageCareTeam',
  'manageGroceryOrders',
  'groceryOrdering',
  'careLearningAccess',
  'nannyDevelopment',
  'memoriesStories',
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];
type PermissionMap = Record<PermissionKey, boolean>;

const accessInclude = {
  child: {
    select: {
      id: true,
      name: true,
      avatar: true,
      parentUserId: true,
      parentUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
        },
      },
    },
  },
  invitedUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
      profilePictureUrl: true,
    },
  },
  invitedByUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      profilePictureUrl: true,
    },
  },
} satisfies Prisma.CaregiverAccessInclude;

@Injectable()
export class CaregiverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly twilioService: TwilioService,
  ) {}

  async getChildCaregivers(userId: string, childId: string) {
    await this.assertChildPermission(userId, childId, 'manageCareTeam');

    const [child, accesses] = await Promise.all([
      this.prisma.child.findUnique({
        where: { id: childId },
        select: {
          id: true,
          name: true,
          parentUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profilePictureUrl: true,
            },
          },
        },
      }),
      this.prisma.caregiverAccess.findMany({
        where: {
          childId,
          status: { not: CaregiverAccessStatus.REVOKED },
        },
        include: accessInclude,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const accountOwner = {
      ...child.parentUser,
      childId: child.id,
      childName: child.name,
      isOwner: true,
      permissions: this.fullPermissions(),
    };
    const caregivers = accesses.map((access) => this.formatAccess(access));

    return {
      success: true,
      data: {
        accountOwner,
        caregivers,
        sections: this.caregiverSections(accountOwner, caregivers),
      },
    };
  }

  async createInvitation(
    inviterUserId: string,
    childId: string,
    dto: CreateCaregiverInvitationDto,
  ) {
    await this.assertChildPermission(inviterUserId, childId, 'manageCareTeam');

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, name: true, parentUserId: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const invitedUser = await this.resolveInvitedUser(dto);
    if (invitedUser?.id === child.parentUserId) {
      throw new BadRequestException('The child owner already has full access');
    }

    if (invitedUser) {
      this.assertUserMatchesCaregiverRole(invitedUser.role, dto.role);
    }

    if (!invitedUser && !dto.invitedEmail && !dto.invitedPhone) {
      throw new BadRequestException(
        'Invite an existing user, email, phone number, or share returned inviteUrl',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const inviteTokenHash = this.hashToken(token);
    const permissions = this.permissionsForRole(dto.role, dto);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const inviteChannel =
      dto.inviteChannel ??
      (dto.invitedUserId
        ? CaregiverInviteChannel.IN_APP
        : dto.invitedEmail && dto.invitedPhone
          ? CaregiverInviteChannel.EMAIL_WHATSAPP
          : dto.invitedEmail
            ? CaregiverInviteChannel.EMAIL
            : dto.invitedPhone
              ? CaregiverInviteChannel.WHATSAPP
              : CaregiverInviteChannel.LINK);

    this.assertInviteChannelTarget(inviteChannel, dto);

    const existing = await this.findExistingAccess(
      childId,
      dto,
      invitedUser?.id,
    );
    const data = {
      invitedUserId: invitedUser?.id,
      invitedEmail: dto.invitedEmail?.toLowerCase(),
      invitedPhone: dto.invitedPhone,
      invitedName:
        dto.role === CaregiverAccessRole.FAMILY_MEMBER
          ? dto.invitedName?.trim()
          : null,
      invitedByUserId: inviterUserId,
      role: dto.role,
      relationship:
        dto.role === CaregiverAccessRole.FAMILY_MEMBER
          ? dto.relationship
          : null,
      status: CaregiverAccessStatus.PENDING,
      inviteChannel,
      inviteTokenHash,
      expiresAt,
      acceptedAt: null,
      revokedAt: null,
      ...permissions,
    };

    const access = existing
      ? await this.prisma.caregiverAccess.update({
          where: { id: existing.id },
          data,
          include: accessInclude,
        })
      : await this.prisma.caregiverAccess.create({
          data: { childId, ...data },
          include: accessInclude,
        });

    const inviteUrl = this.inviteUrl(token);
    const delivered = await this.deliverInvite(access, inviteUrl);

    return {
      success: true,
      message: 'Invitation created',
      data: {
        ...this.formatAccess(access),
        inviteUrl,
        inviteToken: token,
        delivered,
      },
    };
  }

  async previewInvitation(token: string) {
    const access = await this.findByToken(token);
    this.assertInvitationOpen(access);

    return {
      success: true,
      data: this.formatAccess(access),
    };
  }

  async acceptInvitation(userId: string, token: string) {
    const access = await this.findByToken(token);
    this.assertInvitationOpen(access);

    if (access.invitedUserId && access.invitedUserId !== userId) {
      throw new ForbiddenException('This invitation belongs to another user');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phoneNumber: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      access.invitedEmail &&
      access.invitedEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new ForbiddenException('This invitation was sent to another email');
    }

    if (access.invitedPhone && access.invitedPhone !== user.phoneNumber) {
      throw new ForbiddenException('This invitation was sent to another phone');
    }

    this.assertUserMatchesCaregiverRole(user.role, access.role);

    const accepted = await this.prisma.caregiverAccess.update({
      where: { id: access.id },
      data: {
        invitedUserId: user.id,
        status: CaregiverAccessStatus.ACCEPTED,
        acceptedAt: new Date(),
        inviteTokenHash: null,
      },
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Invitation accepted',
      data: this.formatAccess(accepted),
    };
  }

  async updatePermissions(
    userId: string,
    accessId: string,
    dto: UpdateCaregiverPermissionsDto,
  ) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { id: accessId },
      select: { id: true, childId: true, status: true },
    });

    if (!access) {
      throw new NotFoundException('Caregiver access not found');
    }

    await this.assertChildPermission(userId, access.childId, 'manageCareTeam');

    const updated = await this.prisma.caregiverAccess.update({
      where: { id: accessId },
      data: this.permissionUpdates(dto),
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Permissions updated',
      data: this.formatAccess(updated),
    };
  }

  async removeAccess(userId: string, accessId: string) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { id: accessId },
      select: { id: true, childId: true },
    });

    if (!access) {
      throw new NotFoundException('Caregiver access not found');
    }

    await this.assertChildPermission(userId, access.childId, 'manageCareTeam');

    const revoked = await this.prisma.caregiverAccess.update({
      where: { id: accessId },
      data: {
        status: CaregiverAccessStatus.REVOKED,
        revokedAt: new Date(),
        inviteTokenHash: null,
      },
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Caregiver access removed',
      data: this.formatAccess(revoked),
    };
  }

  async removeNannyAccess(userId: string, accessId: string) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { id: accessId },
      select: { id: true, childId: true, role: true },
    });

    if (!access) {
      throw new NotFoundException('Nanny access not found');
    }

    if (access.role !== CaregiverAccessRole.NANNY) {
      throw new BadRequestException('This access record is not a nanny');
    }

    await this.assertChildPermission(userId, access.childId, 'manageCareTeam');

    const revoked = await this.prisma.caregiverAccess.update({
      where: { id: accessId },
      data: {
        status: CaregiverAccessStatus.REVOKED,
        revokedAt: new Date(),
        inviteTokenHash: null,
      },
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Nanny removed successfully',
      data: this.formatAccess(revoked),
    };
  }

  async searchUsers(userId: string, dto: SearchCaregiversDto) {
    const query = dto.query?.trim();

    if (!query && !dto.role) {
      return this.getManageCaregivers(userId, dto.childId);
    }

    const role = this.userRoleForCaregiverRole(dto.role);

    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        ...(role && { role }),
        ...(query && {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phoneNumber: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        profilePictureUrl: true,
      },
      orderBy: { fullName: 'asc' },
      take: 20,
    });

    return { success: true, data: users };
  }

  private async getManageCaregivers(userId: string, childId?: string) {
    const children = await this.prisma.child.findMany({
      where: {
        parentUserId: userId,
        ...(childId && { id: childId }),
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        parentUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (childId && children.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const accesses = await this.prisma.caregiverAccess.findMany({
      where: {
        status: { not: CaregiverAccessStatus.REVOKED },
        child: {
          parentUserId: userId,
          ...(childId && { id: childId }),
        },
      },
      include: accessInclude,
      orderBy: { createdAt: 'asc' },
    });

    const ownerUser = children[0]?.parentUser;
    const accountOwner = ownerUser
      ? {
          ...ownerUser,
          childIds: children.map((child) => child.id),
          childNames: children.map((child) => child.name),
          isOwner: true,
          permissions: this.fullPermissions(),
        }
      : null;
    const caregivers = accesses.map((access) => this.formatAccess(access));

    return {
      success: true,
      data: {
        accountOwner,
        caregivers,
        sections: this.caregiverSections(accountOwner, caregivers),
      },
    };
  }

  async getAccessibleChildIds(
    userId: string,
    permission?: PermissionKey,
  ): Promise<string[]> {
    const ownedChildren = await this.prisma.child.findMany({
      where: { parentUserId: userId },
      select: { id: true },
    });

    const delegatedAccesses = await this.prisma.caregiverAccess.findMany({
      where: {
        invitedUserId: userId,
        status: CaregiverAccessStatus.ACCEPTED,
        ...(permission && { [permission]: true }),
      },
      select: { childId: true },
    });

    return [
      ...new Set([
        ...ownedChildren.map((child) => child.id),
        ...delegatedAccesses.map((access) => access.childId),
      ]),
    ];
  }

  async assertChildPermission(
    userId: string,
    childId: string,
    permission: PermissionKey,
  ) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { parentUserId: true },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (child.parentUserId === userId) {
      return { isOwner: true, permissions: this.fullPermissions() };
    }

    const access = await this.prisma.caregiverAccess.findFirst({
      where: {
        childId,
        invitedUserId: userId,
        status: CaregiverAccessStatus.ACCEPTED,
      },
      select: this.permissionSelect(),
    });

    if (!access || !access[permission]) {
      throw new ForbiddenException('You do not have access to this child');
    }

    return { isOwner: false, permissions: this.pickPermissions(access) };
  }

  private async resolveInvitedUser(dto: CreateCaregiverInvitationDto) {
    if (dto.invitedUserId) {
      return this.prisma.user.findUnique({
        where: { id: dto.invitedUserId },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
        },
      });
    }

    if (!dto.invitedEmail && !dto.invitedPhone) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        OR: [
          dto.invitedEmail
            ? { email: dto.invitedEmail.toLowerCase() }
            : undefined,
          dto.invitedPhone ? { phoneNumber: dto.invitedPhone } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
      },
    });
  }

  private async findExistingAccess(
    childId: string,
    dto: CreateCaregiverInvitationDto,
    invitedUserId?: string,
  ) {
    return this.prisma.caregiverAccess.findFirst({
      where: {
        childId,
        role: dto.role,
        status: {
          in: [CaregiverAccessStatus.PENDING, CaregiverAccessStatus.ACCEPTED],
        },
        OR: [
          invitedUserId ? { invitedUserId } : undefined,
          dto.invitedEmail
            ? { invitedEmail: dto.invitedEmail.toLowerCase() }
            : undefined,
          dto.invitedPhone ? { invitedPhone: dto.invitedPhone } : undefined,
        ].filter(Boolean) as Prisma.CaregiverAccessWhereInput[],
      },
      select: { id: true },
    });
  }

  private async findByToken(token: string) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash: this.hashToken(token) },
      include: accessInclude,
    });

    if (!access) {
      throw new NotFoundException('Invitation not found');
    }

    return access;
  }

  private assertInvitationOpen(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    if (access.status !== CaregiverAccessStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }
  }

  private assertUserMatchesCaregiverRole(
    userRole: UserRole,
    caregiverRole: CaregiverAccessRole,
  ) {
    if (
      caregiverRole === CaregiverAccessRole.NANNY &&
      userRole !== UserRole.NANNY
    ) {
      throw new BadRequestException('Invited user must be a nanny');
    }

    if (
      caregiverRole === CaregiverAccessRole.PARENT &&
      userRole !== UserRole.PARENT
    ) {
      throw new BadRequestException('Invited user must be a parent');
    }
  }

  private userRoleForCaregiverRole(role?: CaregiverAccessRole) {
    if (role === CaregiverAccessRole.NANNY) return UserRole.NANNY;
    if (role === CaregiverAccessRole.PARENT) return UserRole.PARENT;
    return undefined;
  }

  private assertInviteChannelTarget(
    inviteChannel: CaregiverInviteChannel,
    dto: CreateCaregiverInvitationDto,
  ) {
    if (inviteChannel === CaregiverInviteChannel.EMAIL && !dto.invitedEmail) {
      throw new BadRequestException('Email is required for email invitation');
    }

    if (
      inviteChannel === CaregiverInviteChannel.WHATSAPP &&
      !dto.invitedPhone
    ) {
      throw new BadRequestException(
        'Phone number is required for WhatsApp invitation',
      );
    }

    if (
      inviteChannel === CaregiverInviteChannel.EMAIL_WHATSAPP &&
      (!dto.invitedEmail || !dto.invitedPhone)
    ) {
      throw new BadRequestException(
        'Email and phone number are required for email and WhatsApp invitation',
      );
    }
  }

  private permissionsForRole(
    role: CaregiverAccessRole,
    dto: UpdateCaregiverPermissionsDto,
  ): PermissionMap {
    const defaults: Record<CaregiverAccessRole, PermissionMap> = {
      [CaregiverAccessRole.NANNY]: {
        ...this.emptyPermissions(),
        manageGroceryLists: true,
      },
      [CaregiverAccessRole.PARENT]: {
        ...this.emptyPermissions(),
        manageDailyPlans: true,
        manageCareTeam: true,
      },
      [CaregiverAccessRole.FAMILY_MEMBER]: {
        ...this.emptyPermissions(),
        dailyActivitiesRecipes: true,
        careLearningAccess: true,
        accessChildInsights: true,
        memoriesStories: true,
      },
    };

    return { ...defaults[role], ...this.permissionUpdates(dto) };
  }

  private permissionUpdates(dto: UpdateCaregiverPermissionsDto) {
    return Object.fromEntries(
      PERMISSION_KEYS.filter((key) => dto[key] !== undefined).map((key) => [
        key,
        dto[key],
      ]),
    ) as Partial<PermissionMap>;
  }

  private fullPermissions(): PermissionMap {
    return Object.fromEntries(
      PERMISSION_KEYS.map((key) => [key, true]),
    ) as PermissionMap;
  }

  private emptyPermissions(): PermissionMap {
    return Object.fromEntries(
      PERMISSION_KEYS.map((key) => [key, false]),
    ) as PermissionMap;
  }

  private permissionSelect() {
    return Object.fromEntries(
      PERMISSION_KEYS.map((key) => [key, true]),
    ) as Record<PermissionKey, true>;
  }

  private pickPermissions(access: Partial<PermissionMap>) {
    return Object.fromEntries(
      PERMISSION_KEYS.map((key) => [key, Boolean(access[key])]),
    ) as PermissionMap;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private inviteUrl(token: string) {
    const appUrl =
      this.configService.get<string>('APP_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      (this.configService.get<string>('NODE_ENV') === 'production'
        ? 'https://app.alurei.com'
        : 'http://127.0.0.1:5500');

    return `${appUrl.replace(/\/$/, '')}/invite/accept?token=${token}`;
  }

  private async deliverInvite(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
    inviteUrl: string,
  ) {
    const message = `${access.invitedByUser.fullName} invited you to care for ${access.child.name}. Accept here: ${inviteUrl}`;
    const delivered = {
      email: false,
      whatsapp: false,
    };

    if (
      access.invitedEmail &&
      (
        [
          CaregiverInviteChannel.EMAIL,
          CaregiverInviteChannel.EMAIL_WHATSAPP,
        ] as CaregiverInviteChannel[]
      ).includes(access.inviteChannel)
    ) {
      try {
        delivered.email = await this.mailService.sendDummyEmail(
          access.invitedEmail,
          `Invitation to care for ${access.child.name}`,
          message,
        );
      } catch {
        delivered.email = false;
      }
    }

    if (
      access.invitedPhone &&
      (
        [
          CaregiverInviteChannel.WHATSAPP,
          CaregiverInviteChannel.EMAIL_WHATSAPP,
        ] as CaregiverInviteChannel[]
      ).includes(access.inviteChannel)
    ) {
      try {
        await this.twilioService.sendSms(access.invitedPhone, message);
        delivered.whatsapp = true;
      } catch {
        delivered.whatsapp = false;
      }
    }

    return delivered;
  }

  private formatAccess(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    return {
      id: access.id,
      child: {
        id: access.child.id,
        name: access.child.name,
        avatar: access.child.avatar,
      },
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      inviteChannel: access.inviteChannel,
      invitedName: access.invitedName,
      displayName:
        access.invitedUser?.fullName ??
        access.invitedName ??
        access.invitedEmail ??
        access.invitedPhone,
      invitedEmail: access.invitedEmail,
      invitedPhone: access.invitedPhone,
      invitedUser: access.invitedUser,
      invitedByUser: access.invitedByUser,
      permissions: this.pickPermissions(access),
      acceptedAt: access.acceptedAt,
      revokedAt: access.revokedAt,
      expiresAt: access.expiresAt,
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    };
  }

  private caregiverSections(accountOwner: any, caregivers: any[]) {
    return [
      {
        key: 'ACCOUNT_OWNER',
        title: 'Account Owner',
        items: accountOwner ? [accountOwner] : [],
      },
      {
        key: CaregiverAccessRole.NANNY,
        title: 'Nanny',
        items: caregivers.filter(
          (item) => item.role === CaregiverAccessRole.NANNY,
        ),
      },
      {
        key: CaregiverAccessRole.PARENT,
        title: 'Parent',
        items: caregivers.filter(
          (item) => item.role === CaregiverAccessRole.PARENT,
        ),
      },
      {
        key: CaregiverAccessRole.FAMILY_MEMBER,
        title: 'Family member',
        items: caregivers.filter(
          (item) => item.role === CaregiverAccessRole.FAMILY_MEMBER,
        ),
      },
    ];
  }
}
