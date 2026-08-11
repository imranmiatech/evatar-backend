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
  VerificationStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../common/mail/mail.service';
import { TwilioService } from '../../common/twilio/twilio.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaregiverInvitationDto } from './dto/create-caregiver-invitation.dto';
import { ListNanniesDto } from './dto/list-nannies.dto';
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

const ROLE_PERMISSION_KEYS = {
  [CaregiverAccessRole.NANNY]: [
    'manageDailyPlans',
    'manageGroceryLists',
    'editChildProfile',
    'accessChildInsights',
  ],
  [CaregiverAccessRole.PARENT]: [
    'manageDailyPlans',
    'manageBilling',
    'manageCareTeam',
    'manageGroceryOrders',
    'addRemoveChildren',
  ],
  [CaregiverAccessRole.FAMILY_MEMBER]: [
    'dailyActivitiesRecipes',
    'manageDailyPlans',
    'manageCareTeam',
    'manageGroceryLists',
    'groceryOrdering',
    'careLearningAccess',
    'nannyDevelopment',
    'accessChildInsights',
    'memoriesStories',
  ],
} satisfies Record<CaregiverAccessRole, readonly PermissionKey[]>;

const DEFAULT_TRUE_BY_ROLE = {
  [CaregiverAccessRole.NANNY]: ['manageGroceryLists'],
  [CaregiverAccessRole.PARENT]: ['manageDailyPlans', 'manageCareTeam'],
  [CaregiverAccessRole.FAMILY_MEMBER]: [
    'dailyActivitiesRecipes',
    'careLearningAccess',
    'accessChildInsights',
    'memoriesStories',
  ],
} satisfies Record<CaregiverAccessRole, readonly PermissionKey[]>;

const PERMISSION_LABELS = {
  dailyActivitiesRecipes: 'Daily Activities & Recipes',
  manageDailyPlans: 'Manage Daily Plans',
  manageGroceryLists: 'Manage Grocery Lists',
  editChildProfile: 'Edit Child Profile',
  accessChildInsights: 'Child Insights & Progress',
  addRemoveChildren: 'Manage Child Profiles',
  manageBilling: 'Manage Subscription & Billing',
  manageCareTeam: 'Care Team Management',
  manageGroceryOrders: 'Manage Grocery Orders',
  groceryOrdering: 'Grocery Ordering',
  careLearningAccess: 'Care Learning Access',
  nannyDevelopment: 'Nanny Development',
  memoriesStories: 'Memories & Stories',
} satisfies Record<PermissionKey, string>;

const PERMISSION_DESCRIPTIONS = {
  dailyActivitiesRecipes:
    "Allow access to view your child's daily activities, recipes, and completed tasks.",
  manageDailyPlans:
    'Allow this caregiver to create, edit, and organize activities and recipes for your child.',
  manageGroceryLists:
    'Allow this caregiver to manage grocery lists, create requests, and update grocery items.',
  editChildProfile:
    "Allow this caregiver to update your child's profile information and preferences.",
  accessChildInsights:
    'Allow access to developmental insights, milestones, nutrition reports, and child observations.',
  addRemoveChildren:
    'Allow this caregiver to add, edit, or remove child profiles within the family account.',
  manageBilling:
    'Allow this caregiver to manage memberships, payments, and billing details.',
  manageCareTeam:
    'Allow this caregiver to add, remove, and manage nannies and caregivers for the child.',
  manageGroceryOrders:
    'Allow this caregiver to review, place, and track grocery orders for the family.',
  groceryOrdering:
    'Allow this caregiver to generate vouchers, review quotes, and place grocery orders.',
  careLearningAccess:
    'Allow this caregiver to access childcare lessons, guidance, and educational care modules.',
  nannyDevelopment:
    'Allow this caregiver to assign care modules and monitor nanny learning progress.',
  memoriesStories:
    "Allow this caregiver to access, download, and contribute to your child's photos, memories, and bedtime stories.",
} satisfies Record<PermissionKey, string>;

const accessInclude = {
  child: {
    select: {
      id: true,
      name: true,
      birthDate: true,
      avatar: true,
      parentUserId: true,
      parentUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          profilePictureUrl: true,
          parentProfile: {
            select: {
              address: true,
              street: true,
              city: true,
              state: true,
              country: true,
              postalCode: true,
            },
          },
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
      id: child.parentUser.id,
      fullName: child.parentUser.fullName,
      email: child.parentUser.email,
      image: child.parentUser.profilePictureUrl,
      childId: child.id,
      childName: child.name,
      isOwner: true,
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

    if (
      inviteChannel !== CaregiverInviteChannel.LINK &&
      !invitedUser &&
      !dto.invitedEmail &&
      !dto.invitedPhone
    ) {
      throw new BadRequestException(
        'Invite an existing user, email, phone number, or share returned inviteUrl',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const inviteTokenHash = this.hashToken(token);
    const permissions = this.permissionsForRole(dto.role, dto);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

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
    const shareLinks = this.inviteShareLinks(access, inviteUrl);
    const delivered = await this.deliverInvite(access, shareLinks.message);

    return {
      success: true,
      message: 'Invitation created',
      data: {
        ...this.formatAccess(access),
        inviteUrl,
        inviteToken: token,
        delivered,
        delivery: {
          email: {
            requested: this.shouldSendEmail(access),
            sent: delivered.email,
            to: access.invitedEmail,
          },
          whatsapp: {
            requested: this.shouldSendWhatsapp(access),
            sent: delivered.whatsapp,
            to: access.invitedPhone,
          },
        },
        shareLinks,
      },
    };
  }

  async previewInvitation(token: string) {
    const access = await this.findByToken(token);
    this.assertInvitationOpen(access);

    return {
      success: true,
      data: this.formatInvitationReview(access),
    };
  }

  async getMyPendingInvitations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phoneNumber: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accesses = await this.prisma.caregiverAccess.findMany({
      where: {
        role: this.caregiverRoleForUserRole(user.role),
        status: CaregiverAccessStatus.PENDING,
        OR: [
          { invitedUserId: user.id },
          { invitedEmail: user.email.toLowerCase() },
          user.phoneNumber ? { invitedPhone: user.phoneNumber } : undefined,
        ].filter(Boolean) as Prisma.CaregiverAccessWhereInput[],
      },
      include: accessInclude,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: accesses.map((access) => this.formatInvitationReview(access)),
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
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
        verificationStatus: true,
      },
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
    this.assertUserCanAcceptInvitation(user.verificationStatus, access.role);

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

  async getPermissions(userId: string, accessId: string) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { id: accessId },
      include: accessInclude,
    });

    if (!access) {
      throw new NotFoundException('Caregiver access not found');
    }

    await this.assertChildPermission(userId, access.childId, 'manageCareTeam');

    return {
      success: true,
      message: 'Permissions fetched',
      data: this.formatAccessPermissions(access),
    };
  }

  async updatePermissions(
    userId: string,
    accessId: string,
    dto: UpdateCaregiverPermissionsDto,
  ) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { id: accessId },
      select: { id: true, childId: true, role: true, status: true },
    });

    if (!access) {
      throw new NotFoundException('Caregiver access not found');
    }

    await this.assertChildPermission(userId, access.childId, 'manageCareTeam');

    const updated = await this.prisma.caregiverAccess.update({
      where: { id: accessId },
      data: {
        ...this.nonRolePermissionResets(access.role),
        ...this.permissionUpdates(dto, access.role),
      },
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Permissions updated',
      data: this.formatAccessPermissions(updated),
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

    return {
      success: true,
      data: users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        image: user.profilePictureUrl,
      })),
    };
  }

  async listNannies(query: ListNanniesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: UserRole.NANNY,
      status: UserStatus.ACTIVE,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [nannies, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          profilePictureUrl: true,
          status: true,
          createdAt: true,
          nannyProfile: {
            select: {
              id: true,
              headline: true,
              bio: true,
              hourlyRateCents: true,
              completedJobs: true,
              repeatFamilies: true,
              averageRating: true,
              totalReviews: true,
              yearsExperience: true,
              skills: true,
              languages: true,
              portfolioImageUrls: true,
              backgroundCheckVerified: true,
              emergencyContactVerified: true,
              status: true,
              joinedAt: true,
            },
          },
        },
        orderBy: [{ fullName: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      message: 'Nannies fetched successfully',
      data: nannies.map((nanny) => ({
        id: nanny.id,
        fullName: nanny.fullName,
        email: nanny.email,
        phoneNumber: nanny.phoneNumber,
        image: nanny.profilePictureUrl,
        status: nanny.status,
        createdAt: nanny.createdAt,
        profile: nanny.nannyProfile,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
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
          id: ownerUser.id,
          fullName: ownerUser.fullName,
          email: ownerUser.email,
          image: ownerUser.profilePictureUrl,
          childIds: children.map((child) => child.id),
          childNames: children.map((child) => child.name),
          isOwner: true,
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
    const targetWhere = [
      invitedUserId ? { invitedUserId } : undefined,
      dto.invitedEmail
        ? { invitedEmail: dto.invitedEmail.toLowerCase() }
        : undefined,
      dto.invitedPhone ? { invitedPhone: dto.invitedPhone } : undefined,
    ].filter(Boolean) as Prisma.CaregiverAccessWhereInput[];

    if (targetWhere.length === 0) {
      return this.prisma.caregiverAccess.findFirst({
        where: {
          childId,
          role: dto.role,
          relationship:
            dto.role === CaregiverAccessRole.FAMILY_MEMBER
              ? dto.relationship
              : null,
          inviteChannel: CaregiverInviteChannel.LINK,
          invitedUserId: null,
          invitedEmail: null,
          invitedPhone: null,
          status: CaregiverAccessStatus.PENDING,
        },
        select: { id: true },
      });
    }

    return this.prisma.caregiverAccess.findFirst({
      where: {
        childId,
        role: dto.role,
        status: {
          in: [CaregiverAccessStatus.PENDING, CaregiverAccessStatus.ACCEPTED],
        },
        OR: targetWhere,
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

  private assertUserCanAcceptInvitation(
    verificationStatus: VerificationStatus,
    caregiverRole: CaregiverAccessRole,
  ) {
    if (
      caregiverRole === CaregiverAccessRole.NANNY &&
      verificationStatus !== VerificationStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Complete identity verification before accepting a nanny invitation',
      );
    }
  }

  private userRoleForCaregiverRole(role?: CaregiverAccessRole) {
    if (role === CaregiverAccessRole.NANNY) return UserRole.NANNY;
    if (role === CaregiverAccessRole.PARENT) return UserRole.PARENT;
    return undefined;
  }

  private caregiverRoleForUserRole(role: UserRole) {
    if (role === UserRole.NANNY) return CaregiverAccessRole.NANNY;
    if (role === UserRole.PARENT) return CaregiverAccessRole.PARENT;
    return CaregiverAccessRole.FAMILY_MEMBER;
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
    return {
      ...this.defaultPermissionsForRole(role),
      ...this.permissionUpdates(dto, role),
    };
  }

  private permissionUpdates(
    dto: UpdateCaregiverPermissionsDto,
    role?: CaregiverAccessRole,
  ) {
    const keys = role ? ROLE_PERMISSION_KEYS[role] : PERMISSION_KEYS;

    return Object.fromEntries(
      keys
        .filter((key) => dto[key] !== undefined)
        .map((key) => [key, dto[key]]),
    ) as Partial<PermissionMap>;
  }

  private defaultPermissionsForRole(role: CaregiverAccessRole): PermissionMap {
    const permissions = this.emptyPermissions();

    for (const key of DEFAULT_TRUE_BY_ROLE[role]) {
      permissions[key] = true;
    }

    return permissions;
  }

  private nonRolePermissionResets(role: CaregiverAccessRole) {
    const roleKeys = new Set<PermissionKey>(ROLE_PERMISSION_KEYS[role]);

    return Object.fromEntries(
      PERMISSION_KEYS.filter((key) => !roleKeys.has(key)).map((key) => [
        key,
        false,
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

  private pickRolePermissions(
    role: CaregiverAccessRole,
    access: Partial<PermissionMap>,
  ) {
    return Object.fromEntries(
      ROLE_PERMISSION_KEYS[role].map((key) => [key, Boolean(access[key])]),
    ) as Partial<PermissionMap>;
  }

  private permissionFields(
    role: CaregiverAccessRole,
    access: Partial<PermissionMap>,
  ) {
    return ROLE_PERMISSION_KEYS[role].map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
      description: PERMISSION_DESCRIPTIONS[key],
      value: Boolean(access[key]),
    }));
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
    message: string,
  ) {
    const delivered = {
      email: false,
      whatsapp: false,
    };

    if (this.shouldSendEmail(access)) {
      try {
        delivered.email = await this.mailService.sendDummyEmail(
          access.invitedEmail!,
          `Invitation to care for ${access.child.name}`,
          message,
        );
      } catch {
        delivered.email = false;
      }
    }

    if (this.shouldSendWhatsapp(access)) {
      try {
        await this.twilioService.sendWhatsapp(access.invitedPhone!, message);
        delivered.whatsapp = true;
      } catch {
        delivered.whatsapp = false;
      }
    }

    return delivered;
  }

  private shouldSendEmail(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    return (
      Boolean(access.invitedEmail) &&
      (
        [
          CaregiverInviteChannel.EMAIL,
          CaregiverInviteChannel.EMAIL_WHATSAPP,
        ] as CaregiverInviteChannel[]
      ).includes(access.inviteChannel)
    );
  }

  private shouldSendWhatsapp(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    return (
      Boolean(access.invitedPhone) &&
      (
        [
          CaregiverInviteChannel.WHATSAPP,
          CaregiverInviteChannel.EMAIL_WHATSAPP,
        ] as CaregiverInviteChannel[]
      ).includes(access.inviteChannel)
    );
  }

  private inviteShareLinks(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
    inviteUrl: string,
  ) {
    const subject = `Invitation to care for ${access.child.name}`;
    const message = `${access.invitedByUser.fullName} invited you to care for ${access.child.name}. Accept here: ${inviteUrl}`;
    const whatsappNumber = access.invitedPhone?.replace(/[^\d]/g, '');

    return {
      inviteUrl,
      message,
      email: access.invitedEmail
        ? `mailto:${encodeURIComponent(access.invitedEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
        : null,
      whatsapp: whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
        : null,
    };
  }

  private formatInvitationReview(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    return {
      invitation: {
        id: access.id,
        role: access.role,
        relationship: access.relationship,
        status: access.status,
        expiresAt: access.expiresAt,
        createdAt: access.createdAt,
      },
      parent: {
        id: access.child.parentUser.id,
        fullName: access.child.parentUser.fullName,
        email: access.child.parentUser.email,
        phoneNumber: access.child.parentUser.phoneNumber,
        image: access.child.parentUser.profilePictureUrl,
        address: access.child.parentUser.parentProfile?.address ?? null,
        street: access.child.parentUser.parentProfile?.street ?? null,
        city: access.child.parentUser.parentProfile?.city ?? null,
        state: access.child.parentUser.parentProfile?.state ?? null,
        country: access.child.parentUser.parentProfile?.country ?? null,
        postalCode: access.child.parentUser.parentProfile?.postalCode ?? null,
      },
      child: {
        id: access.child.id,
        name: access.child.name,
        image: access.child.avatar,
        birthDate: access.child.birthDate,
        age: this.formatChildAge(access.child.birthDate),
      },
      invitedCaregiver: {
        displayName:
          access.invitedUser?.fullName ??
          access.invitedName ??
          access.invitedEmail ??
          access.invitedPhone,
        email: access.invitedEmail,
        phoneNumber: access.invitedPhone,
        user: access.invitedUser
          ? {
              id: access.invitedUser.id,
              fullName: access.invitedUser.fullName,
              email: access.invitedUser.email,
              phoneNumber: access.invitedUser.phoneNumber,
              role: access.invitedUser.role,
              image: access.invitedUser.profilePictureUrl,
            }
          : null,
      },
      permissions: this.pickRolePermissions(access.role, access),
      rawAccess: this.formatAccess(access),
    };
  }

  private formatAccess(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    return {
      id: access.id,
      child: {
        id: access.child.id,
        name: access.child.name,
        image: access.child.avatar,
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
      image: access.invitedUser?.profilePictureUrl ?? null,
      invitedEmail: access.invitedEmail,
      invitedPhone: access.invitedPhone,
      invitedUser: access.invitedUser
        ? {
            id: access.invitedUser.id,
            fullName: access.invitedUser.fullName,
            email: access.invitedUser.email,
            phoneNumber: access.invitedUser.phoneNumber,
            role: access.invitedUser.role,
            image: access.invitedUser.profilePictureUrl,
          }
        : null,
      invitedByUser: {
        id: access.invitedByUser.id,
        fullName: access.invitedByUser.fullName,
        email: access.invitedByUser.email,
        image: access.invitedByUser.profilePictureUrl,
      },
      acceptedAt: access.acceptedAt,
      revokedAt: access.revokedAt,
      expiresAt: access.expiresAt,
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    };
  }

  private formatChildAge(birthDate?: Date | null) {
    if (!birthDate) return null;

    const today = new Date();
    let years = today.getUTCFullYear() - birthDate.getUTCFullYear();
    let months = today.getUTCMonth() - birthDate.getUTCMonth();

    if (today.getUTCDate() < birthDate.getUTCDate()) {
      months -= 1;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years > 0) {
      return months > 0 ? `${years} years ${months} months old` : `${years} years old`;
    }

    return `${months} months old`;
  }

  private formatAccessPermissions(
    access: Prisma.CaregiverAccessGetPayload<{ include: typeof accessInclude }>,
  ) {
    return {
      accessId: access.id,
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      displayName:
        access.invitedUser?.fullName ??
        access.invitedName ??
        access.invitedEmail ??
        access.invitedPhone,
      image: access.invitedUser?.profilePictureUrl ?? null,
      child: {
        id: access.child.id,
        name: access.child.name,
        image: access.child.avatar,
      },
      permissions: this.pickRolePermissions(access.role, access),
      permissionFields: this.permissionFields(access.role, access),
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
