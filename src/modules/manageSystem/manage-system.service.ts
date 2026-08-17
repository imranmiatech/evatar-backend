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
import * as bcrypt from 'bcrypt';
import { MailService } from '../../common/mail/mail.service';
import { TwilioService } from '../../common/twilio/twilio.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateManageSystemInvitationDto } from './dto/create-manage-system-invitation.dto';
import { SearchManageSystemDto } from './dto/search-manage-system.dto';
import { UpdateManageSystemPermissionsDto } from './dto/update-manage-system-permissions.dto';

const PERMISSION_KEYS = [
  'dailyActivitiesRecipes',
  'manageDailyPlans',
  'viewGroceryLists',
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
    'viewGroceryLists',
    'manageGroceryLists',
    'editChildProfile',
    'accessChildInsights',
  ],
  [CaregiverAccessRole.PARENT]: [
    'manageDailyPlans',
    'manageBilling',
    'manageCareTeam',
    'manageGroceryOrders',
    'editChildProfile',
    'addRemoveChildren',
  ],
  [CaregiverAccessRole.FAMILY_MEMBER]: [
    'dailyActivitiesRecipes',
    'manageDailyPlans',
    'manageCareTeam',
    'viewGroceryLists',
    'manageGroceryLists',
    'groceryOrdering',
    'careLearningAccess',
    'nannyDevelopment',
    'accessChildInsights',
    'memoriesStories',
  ],
} satisfies Record<CaregiverAccessRole, readonly PermissionKey[]>;

const DEFAULT_TRUE_BY_ROLE = {
  [CaregiverAccessRole.NANNY]: ['viewGroceryLists', 'manageGroceryLists'],
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
  viewGroceryLists: 'View Grocery Lists',
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
  viewGroceryLists:
    'Allow this caregiver to view kitchen inventory and shopping lists without editing them.',
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

type LoadedAccess = Prisma.CaregiverAccessGetPayload<{
  include: typeof accessInclude;
}>;

@Injectable()
export class ManageSystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * Screen 1: Get Account Owner & Categorized Caregiver List
   */
  async getManageCaregivers(userId: string) {
    const accessibleChildIds = await this.getAccessibleChildIds(
      userId,
      'manageCareTeam',
    );

    const children = await this.prisma.child.findMany({
      where: {
        id: { in: accessibleChildIds },
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

    const accesses = await this.prisma.caregiverAccess.findMany({
      where: {
        status: { not: CaregiverAccessStatus.REVOKED },
        childId: { in: children.map((child) => child.id) },
      },
      include: accessInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const ownerUser = children[0]?.parentUser;
    const accountOwner = ownerUser
      ? {
          id: ownerUser.id,
          name: ownerUser.fullName,
          email: ownerUser.email,
          image: ownerUser.profilePictureUrl,
          childIds: children.map((child) => child.id),
          childNames: children.map((child) => child.name),
        }
      : null;

    const caregivers = accesses.map((access) =>
      this.formatManageCaregiver(access),
    );

    return {
      success: true,
      data: {
        accountOwner,
        caregivers,
        sections: this.caregiverSections(accountOwner, caregivers),
      },
    };
  }

  /**
   * Screen 2: Select Child List (with avatar & formatted age)
   */
  async getMyChildren(userId: string) {
    const accessibleChildIds = await this.getAccessibleChildIds(userId);

    const children =
      accessibleChildIds.length === 0
        ? []
        : await this.prisma.child.findMany({
            where: { id: { in: accessibleChildIds } },
            select: {
              id: true,
              name: true,
              avatar: true,
              birthDate: true,
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
            orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
          });

    return {
      success: true,
      message: 'Children fetched successfully',
      data: children.map((child) => {
        const age = this.formatChildPickerAge(child.birthDate);

        return {
          id: child.id,
          name: child.name,
          image: child.avatar,
          avatar: child.avatar,
          birthDate: child.birthDate,
          age,
          ageLabel: age?.label ?? null,
          isAccountOwner: child.parentUserId === userId,
          accountOwner: {
            id: child.parentUser.id,
            name: child.parentUser.fullName,
            email: child.parentUser.email,
            image: child.parentUser.profilePictureUrl,
          },
        };
      }),
    };
  }

  /**
   * Screen 5 ("On Platform"): Search registered users by email or name
   */
  async searchUsers(userId: string, dto: SearchManageSystemDto) {
    const query = dto.query?.trim();

    if (!query && !dto.role) {
      return this.getManageCaregivers(userId);
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

  /**
   * Screen 5: Create invitation to Nanny, Parent, or Family Member
   */
  async createInvitation(
    inviterUserId: string,
    childId: string,
    dto: CreateManageSystemInvitationDto,
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
      if (invitedUser.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('Invited user must be active');
      }
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
    if (existing?.status === CaregiverAccessStatus.ACCEPTED) {
      throw new BadRequestException(
        'This caregiver already has accepted access for this child',
      );
    }

    let tempPin: string | null = null;
    let targetUserId = invitedUser?.id;

    if (!invitedUser && dto.invitedEmail) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.invitedEmail.toLowerCase() },
        select: { id: true },
      });

      if (existingUser) {
        targetUserId = existingUser.id;
      } else if (
        dto.role === CaregiverAccessRole.PARENT ||
        dto.role === CaregiverAccessRole.FAMILY_MEMBER
      ) {
        tempPin = Math.floor(1000 + Math.random() * 9000).toString();
        const hashedPassword = await bcrypt.hash(tempPin, 10);
        const userRole =
          dto.role === CaregiverAccessRole.PARENT ? UserRole.PARENT : UserRole.PARENT;

        const createdUser = await this.prisma.user.create({
          data: {
            email: dto.invitedEmail.toLowerCase(),
            fullName:
              dto.invitedName ||
              (dto.role === CaregiverAccessRole.PARENT
                ? 'Parent Member'
                : 'Family Member'),
            passwordHash: hashedPassword,
            role: userRole,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
          },
          select: { id: true },
        });

        targetUserId = createdUser.id;
      }
    }

    const data = {
      invitedUserId: targetUserId,
      invitedEmail: dto.invitedEmail?.toLowerCase(),
      invitedPhone: dto.invitedPhone,
      invitedName:
        dto.role === CaregiverAccessRole.FAMILY_MEMBER
          ? dto.invitedName?.trim()
          : null,
      invitedByUserId: inviterUserId,
      role: dto.role,
      relationship:
        dto.role === CaregiverAccessRole.FAMILY_MEMBER ||
        dto.role === CaregiverAccessRole.PARENT
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
    const delivered = await this.deliverInvite(access, token, tempPin);

    return {
      success: true,
      message: tempPin
        ? 'Invitation created & 4-digit PIN password generated for caregiver!'
        : 'Invitation created',
      data: {
        ...this.formatAccess(access),
        inviteToken: token,
        tempPin: tempPin || undefined,
        inviteUrl,
        shareMessage: shareLinks.message,
        whatsappLink: shareLinks.whatsappLink,
        emailDelivered: delivered.emailDelivered,
        whatsappDelivered: delivered.whatsappDelivered,
      },
    };
  }

  /**
   * Screen 4: Get caregiver or Nanny permission modal data
   */
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
      data: this.formatAccessPermissions(access),
    };
  }

  /**
   * Screen 4: Update caregiver or Nanny permissions
   */
  async updatePermissions(
    userId: string,
    accessId: string,
    dto: UpdateManageSystemPermissionsDto,
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
      data: this.applyPermissionHierarchy({
        ...this.nonRolePermissionResets(access.role),
        ...this.permissionUpdates(dto, access.role),
      }),
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Permissions updated',
      data: this.formatAccessPermissions(updated),
    };
  }

  /**
   * Screen 1: Revoke or remove caregiver / Nanny access
   */
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

  // ==========================================
  // Helper Logic Methods
  // ==========================================

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

  private formatManageCaregiver(access: LoadedAccess) {
    const caregiverUser = access.invitedUser;
    const name =
      caregiverUser?.fullName ??
      access.invitedName ??
      access.invitedEmail ??
      access.invitedPhone ??
      'Invited Caregiver';

    return {
      id: access.id,
      childId: access.childId,
      childName: access.child.name,
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      name,
      fullName: name,
      email: caregiverUser?.email ?? access.invitedEmail ?? null,
      phone: caregiverUser?.phoneNumber ?? access.invitedPhone ?? null,
      image: caregiverUser?.profilePictureUrl ?? null,
      isAccountOwner: false,
      permissions: this.formatAccessPermissions(access),
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    };
  }

  private formatAccess(access: LoadedAccess) {
    return {
      id: access.id,
      childId: access.childId,
      childName: access.child.name,
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      inviteChannel: access.inviteChannel,
      invitedUserId: access.invitedUserId,
      invitedEmail: access.invitedEmail,
      invitedPhone: access.invitedPhone,
      invitedName: access.invitedName,
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
      permissions: this.pickPermissions(access),
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    };
  }

  private formatAccessPermissions(access: LoadedAccess) {
    const allowedKeys = ROLE_PERMISSION_KEYS[access.role];
    const toggles = allowedKeys.map((key) => {
      let title = PERMISSION_LABELS[key];
      let description = PERMISSION_DESCRIPTIONS[key];

      if (access.role === CaregiverAccessRole.PARENT) {
        if (key === 'manageDailyPlans') {
          title = 'Manage Daily Plans';
          description =
            'Allow the parent to adjust, generate activities, meals, and schedules when needed.';
        } else if (key === 'manageBilling') {
          title = 'Manage Subscription & Billing';
          description =
            'Allow this parent to manage memberships, payments, and billing details.';
        } else if (key === 'manageCareTeam') {
          title = 'Manage Nannies & Family Members';
          description =
            'Allow this parent to invite, manage, and remove caregivers and family members.';
        } else if (key === 'manageGroceryOrders') {
          title = 'Manage Grocery Orders';
          description =
            'Allow this parent to review, place, and track grocery orders for the family.';
        } else if (key === 'editChildProfile') {
          title = 'Manage Child Profiles';
          description =
            'Allow this parent to add, edit, or remove child profiles within the family account.';
        } else if (key === 'addRemoveChildren') {
          title = 'Add or remove children';
          description =
            'Allow this parent to add, edit, or remove child profiles.';
        }
      } else if (access.role === CaregiverAccessRole.FAMILY_MEMBER) {
        if (key === 'dailyActivitiesRecipes') {
          title = 'Daily Activities & Recipes';
          description =
            "Allow access to view your child's daily activities, recipes, and completed tasks.";
        } else if (key === 'manageDailyPlans') {
          title = 'Manage Daily Plans';
          description =
            'Allow this member to create, edit, and organize activities and recipes for your child.';
        } else if (key === 'manageCareTeam') {
          title = 'Care Team Management';
          description =
            'Allow this member to add, remove, and manage nannies assigned to your child.';
        } else if (key === 'manageGroceryLists') {
          title = 'Grocery Management';
          description =
            'Allow this member to manage grocery lists, create requests, and update grocery items.';
        } else if (key === 'groceryOrdering') {
          title = 'Grocery Ordering';
          description =
            'Allow this member to generate vouchers, review quotations, and place grocery orders.';
        } else if (key === 'careLearningAccess') {
          title = 'Care Learning Access';
          description =
            'Allow this member to access childcare lessons, guidance, and educational care modules.';
        } else if (key === 'nannyDevelopment') {
          title = 'Nanny Development';
          description =
            "Allow this member to assign care modules and monitor the nanny's learning progress.";
        } else if (key === 'accessChildInsights') {
          title = 'Child Insights & Progress';
          description =
            'Allow this member to view developmental insights, milestones, nutrition reports, and add observations.';
        } else if (key === 'memoriesStories') {
          title = 'Memories & Stories';
          description =
            "Allow this member to access, download, and contribute to your child's photos, memories, and bedtime stories.";
        }
      }

      return {
        key,
        title,
        label: title,
        description,
        value: access[key],
        enabled: access[key],
      };
    });

    return {
      accessId: access.id,
      childId: access.childId,
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      toggles,
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

  private formatChildPickerAge(birthDate: Date | null) {
    if (!birthDate) return null;
    const now = new Date();
    let years = now.getFullYear() - birthDate.getFullYear();
    let months = now.getMonth() - birthDate.getMonth();
    let days = now.getDate() - birthDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
      ).getDate();
      days += prevMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [
      years > 0 ? `${years} year${years > 1 ? 's' : ''}` : null,
      months > 0 ? `${months} month${months > 1 ? 's' : ''}` : null,
      `${days} day${days !== 1 ? 's' : ''}`,
    ].filter(Boolean);

    return {
      years,
      months,
      days,
      label: parts.join(', '),
    };
  }

  private userRoleForCaregiverRole(role?: CaregiverAccessRole): UserRole | null {
    if (role === CaregiverAccessRole.NANNY) return UserRole.NANNY;
    if (role === CaregiverAccessRole.PARENT) return UserRole.PARENT;
    return null;
  }

  private assertUserMatchesCaregiverRole(
    userRole: UserRole,
    accessRole: CaregiverAccessRole,
  ) {
    if (
      accessRole === CaregiverAccessRole.NANNY &&
      userRole !== UserRole.NANNY
    ) {
      throw new BadRequestException(
        'Selected user is not registered as a Nanny',
      );
    }
  }

  private assertInviteChannelTarget(
    inviteChannel: CaregiverInviteChannel,
    dto: CreateManageSystemInvitationDto,
  ) {
    if (
      (inviteChannel === CaregiverInviteChannel.EMAIL ||
        inviteChannel === CaregiverInviteChannel.EMAIL_WHATSAPP) &&
      !dto.invitedEmail &&
      !dto.invitedUserId
    ) {
      throw new BadRequestException('Email address required for email invite');
    }

    if (
      (inviteChannel === CaregiverInviteChannel.WHATSAPP ||
        inviteChannel === CaregiverInviteChannel.EMAIL_WHATSAPP) &&
      !dto.invitedPhone &&
      !dto.invitedUserId
    ) {
      throw new BadRequestException('Phone number required for WhatsApp invite');
    }
  }

  private async resolveInvitedUser(dto: CreateManageSystemInvitationDto) {
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
    dto: CreateManageSystemInvitationDto,
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
            dto.role === CaregiverAccessRole.FAMILY_MEMBER ||
            dto.role === CaregiverAccessRole.PARENT
              ? dto.relationship
              : null,
          inviteChannel: CaregiverInviteChannel.LINK,
          invitedUserId: null,
          invitedEmail: null,
          invitedPhone: null,
          status: CaregiverAccessStatus.PENDING,
        },
        select: { id: true, status: true },
      });
    }

    return this.prisma.caregiverAccess.findFirst({
      where: {
        childId,
        role: dto.role,
        relationship:
          dto.role === CaregiverAccessRole.FAMILY_MEMBER ||
          dto.role === CaregiverAccessRole.PARENT
            ? dto.relationship
            : null,
        OR: targetWhere,
      },
      select: { id: true, status: true },
    });
  }

  private permissionsForRole(
    role: CaregiverAccessRole,
    dto: CreateManageSystemInvitationDto,
  ): PermissionMap {
    const defaultTrue = new Set<PermissionKey>(DEFAULT_TRUE_BY_ROLE[role]);
    const allowed = new Set<PermissionKey>(ROLE_PERMISSION_KEYS[role]);

    return PERMISSION_KEYS.reduce((acc, key) => {
      if (!allowed.has(key)) {
        acc[key] = false;
        return acc;
      }

      if (typeof dto[key] === 'boolean') {
        acc[key] = dto[key]!;
      } else {
        acc[key] = defaultTrue.has(key);
      }

      return acc;
    }, {} as PermissionMap);
  }

  private permissionUpdates(
    dto: UpdateManageSystemPermissionsDto,
    role: CaregiverAccessRole,
  ): Partial<PermissionMap> {
    const allowed = new Set<PermissionKey>(ROLE_PERMISSION_KEYS[role]);

    return PERMISSION_KEYS.reduce((acc, key) => {
      if (allowed.has(key) && typeof dto[key] === 'boolean') {
        acc[key] = dto[key]!;
      }
      return acc;
    }, {} as Partial<PermissionMap>);
  }

  private nonRolePermissionResets(role: CaregiverAccessRole): Partial<PermissionMap> {
    const allowed = new Set<PermissionKey>(ROLE_PERMISSION_KEYS[role]);

    return PERMISSION_KEYS.reduce((acc, key) => {
      if (!allowed.has(key)) {
        acc[key] = false;
      }
      return acc;
    }, {} as Partial<PermissionMap>);
  }

  private applyPermissionHierarchy(data: Partial<PermissionMap>): Partial<PermissionMap> {
    const next = { ...data };
    if (next.manageGroceryLists) {
      next.viewGroceryLists = true;
    }
    return next;
  }

  private fullPermissions(): PermissionMap {
    return PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as PermissionMap);
  }

  private pickPermissions(access: Record<string, any>): PermissionMap {
    return PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = Boolean(access[key]);
      return acc;
    }, {} as PermissionMap);
  }

  private permissionSelect() {
    return PERMISSION_KEYS.reduce(
      (acc, key) => {
        acc[key] = true;
        return acc;
      },
      {} as Record<PermissionKey, true>,
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private inviteUrl(token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('APP_URL') ??
      'https://alurei.app';

    return `${frontendUrl.replace(/\/$/, '')}/caregiver/invite?token=${encodeURIComponent(
      token,
    )}`;
  }

  private inviteShareLinks(access: LoadedAccess, inviteUrl: string) {
    const inviterName = access.invitedByUser.fullName;
    const childName = access.child.name;
    const roleLabel =
      access.role === CaregiverAccessRole.FAMILY_MEMBER && access.relationship
        ? access.relationship.toLowerCase()
        : access.role.toLowerCase();

    const message = `${inviterName} invited you to join ${childName}'s care team on Alurei as a ${roleLabel}. Click to accept: ${inviteUrl}`;
    const whatsappLink = `https://wa.me/${(
      access.invitedPhone ??
      access.invitedUser?.phoneNumber ??
      ''
    ).replace(/[^\d+]/g, '')}?text=${encodeURIComponent(message)}`;

    return { message, whatsappLink };
  }

  /**
   * Preview caregiver invitation by token
   */
  async previewInvitation(token: string) {
    const inviteTokenHash = this.hashToken(token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      include: accessInclude,
    });

    if (!access) {
      throw new NotFoundException('Invitation not found or token has expired');
    }

    if (access.status === CaregiverAccessStatus.REVOKED) {
      throw new BadRequestException('This invitation has been revoked');
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }

    return {
      success: true,
      data: this.formatAccess(access),
    };
  }

  /**
   * Accept caregiver invitation
   */
  async acceptInvitation(userId: string, token: string) {
    const inviteTokenHash = this.hashToken(token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      select: { id: true, childId: true, role: true, status: true, expiresAt: true, invitedUserId: true, invitedEmail: true },
    });

    if (!access) {
      throw new NotFoundException('Invitation not found or token has expired');
    }

    if (access.status === CaregiverAccessStatus.ACCEPTED) {
      return { success: true, message: 'Invitation already accepted' };
    }

    if (access.status === CaregiverAccessStatus.REVOKED) {
      throw new BadRequestException('This invitation has been revoked');
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      throw new BadRequestException('This invitation token has expired');
    }

    const updated = await this.prisma.caregiverAccess.update({
      where: { id: access.id },
      data: {
        invitedUserId: userId,
        status: CaregiverAccessStatus.ACCEPTED,
        acceptedAt: new Date(),
        inviteTokenHash: null,
      },
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Caregiver invitation accepted successfully!',
      data: this.formatAccess(updated),
    };
  }

  /**
   * Decline caregiver invitation
   */
  async declineInvitation(userId: string, token: string) {
    const inviteTokenHash = this.hashToken(token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      select: { id: true, childId: true },
    });

    if (!access) {
      throw new NotFoundException('Invitation not found');
    }

    const updated = await this.prisma.caregiverAccess.update({
      where: { id: access.id },
      data: {
        status: CaregiverAccessStatus.REVOKED,
        revokedAt: new Date(),
        inviteTokenHash: null,
      },
      include: accessInclude,
    });

    return {
      success: true,
      message: 'Caregiver invitation declined',
      data: this.formatAccess(updated),
    };
  }

  /**
   * Quick Accept link for direct email button click.
   * If user is registered: accepts directly.
   * If user is NOT registered: redirects to Signup form to complete setup & auto-accept.
   */
  async acceptInvitationHtml(token: string) {
    const inviteTokenHash = this.hashToken(token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      include: accessInclude,
    });

    if (!access) {
      return {
        html: `<div style="font-family:sans-serif; text-align:center; padding:40px; color:#ef4444; background:#0f172a; min-height:100vh;">
          <h2>❌ Invalid or Expired Invitation</h2>
          <p style="color:#94a3b8;">This invitation link is no longer valid.</p>
        </div>`,
      };
    }

    // Check if user already exists on platform
    let targetUser = access.invitedUser;
    if (!targetUser && access.invitedEmail) {
      targetUser = await this.prisma.user.findUnique({
        where: { email: access.invitedEmail.toLowerCase() },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          role: true,
          profilePictureUrl: true,
        },
      });
    }

    if (targetUser) {
      // User IS on platform -> Accept directly & redirect to app login
      await this.prisma.caregiverAccess.update({
        where: { id: access.id },
        data: {
          invitedUserId: targetUser.id,
          status: CaregiverAccessStatus.ACCEPTED,
          acceptedAt: new Date(),
          inviteTokenHash: null,
        },
      });

      const appUrl =
        this.configService.get<string>('APP_URL') ?? 'http://localhost:5000';
      const redirectUrl = `${appUrl.replace(/\/$/, '')}/manage-system-ui?email=${encodeURIComponent(targetUser.email)}&accepted=true`;
      return { redirectUrl };
    }

    // User IS NOT on platform -> Direct HTTP Redirect to Signup Form
    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:5000';
    const redirectSignupUrl = `${appUrl.replace(/\/$/, '')}/manage-system-ui?action=signup&token=${encodeURIComponent(token)}&email=${encodeURIComponent(access.invitedEmail || '')}&role=${encodeURIComponent(access.role)}`;

    return { redirectUrl: redirectSignupUrl };
  }

  /**
   * Complete signup and auto-accept caregiver invitation in one step
   */
  async acceptSignupInvitation(dto: {
    token: string;
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role?: string;
  }) {
    const inviteTokenHash = this.hashToken(dto.token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      include: accessInclude,
    });

    if (!access) {
      throw new NotFoundException('Invitation token is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const userRole =
      dto.role === CaregiverAccessRole.NANNY ? UserRole.NANNY : UserRole.PARENT;

    const user = await this.prisma.user.upsert({
      where: { email: dto.email.toLowerCase() },
      update: {
        fullName: dto.fullName,
        passwordHash: hashedPassword,
        status: UserStatus.ACTIVE,
        verificationStatus: 'APPROVED',
      },
      create: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber || null,
        passwordHash: hashedPassword,
        role: userRole,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationStatus: 'APPROVED',
      },
    });

    const updatedAccess = await this.prisma.caregiverAccess.update({
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
      message: 'Account created and caregiver invitation accepted successfully!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        access: this.formatAccess(updatedAccess),
      },
    };
  }

  /**
   * Quick Decline link for direct email button click
   */
  async declineInvitationHtml(token: string) {
    const inviteTokenHash = this.hashToken(token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      include: accessInclude,
    });

    if (!access) {
      return `<div style="font-family:sans-serif; text-align:center; padding:40px; color:#ef4444;">
        <h2>❌ Invalid or Expired Invitation</h2>
      </div>`;
    }

    await this.prisma.caregiverAccess.update({
      where: { id: access.id },
      data: {
        status: CaregiverAccessStatus.REVOKED,
        revokedAt: new Date(),
        inviteTokenHash: null,
      },
    });

    return `<div style="font-family:sans-serif; text-align:center; padding:40px; color:#f87171; background:#0f172a; min-height:100vh;">
      <h2>❌ Invitation Declined</h2>
      <p style="color:#f8fafc; font-size:16px;">You have declined the invitation for <strong>${access.child.name}</strong>.</p>
      <a href="/manage-system-ui" style="display:inline-block; margin-top:20px; background:#334155; color:white; padding:12px 24px; border-radius:10px; text-decoration:none;">Go to App</a>
    </div>`;
  }

  private async deliverInvite(
    access: LoadedAccess,
    token: string,
    tempPin?: string | null,
  ) {
    let emailDelivered = false;
    let whatsappDelivered = false;

    const email = access.invitedEmail ?? access.invitedUser?.email;
    const phone = access.invitedPhone ?? access.invitedUser?.phoneNumber;

    const appBaseUrl =
      this.configService.get<string>('APP_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:5000';

    const cleanBaseUrl = appBaseUrl.replace(/\/$/, '');
    const acceptUrl = `${cleanBaseUrl}/api/v1/manage-system/invitations/${encodeURIComponent(token)}/accept-html`;
    const declineUrl = `${cleanBaseUrl}/api/v1/manage-system/invitations/${encodeURIComponent(token)}/decline-html`;
    const previewUrl = `${cleanBaseUrl}/manage-system-ui?token=${encodeURIComponent(token)}`;

    const inviterName = access.invitedByUser.fullName;
    const childName = access.child.name;
    const roleLabel =
      access.role === CaregiverAccessRole.FAMILY_MEMBER && access.relationship
        ? access.relationship.toLowerCase()
        : access.role.toLowerCase();

    const subject = `Caregiver Invitation for ${childName}`;
    let textMessage = `${inviterName} has invited you to join ${childName}'s care team on Alurei as a ${roleLabel}.\nAccept: ${acceptUrl}\nDecline: ${declineUrl}`;

    if (tempPin) {
      textMessage += `\nYour 4-Digit Password for login: ${tempPin}`;
    }

    const pinBoxHtml = tempPin
      ? `
        <div style="background: rgba(94, 234, 212, 0.08); border: 1px dashed #5eead4; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: left;">
          <h4 style="color: #5eead4; margin: 0 0 8px 0; font-size: 1rem;">🔑 Your Direct Login Credentials</h4>
          <p style="margin: 4px 0; color: #f8fafc; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 4px 0; color: #f8fafc; font-size: 14px;"><strong>4-Digit Password / PIN:</strong> <span style="font-size: 1.25rem; font-weight: 800; color: #5eead4; letter-spacing: 3px; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">${tempPin}</span></p>
          <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">Use this email and 4-digit password to log into Alurei directly!</p>
        </div>
      `
      : '';

    const htmlContent = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid #334155;">
        <h2 style="color: #5eead4; margin-top: 0;">Caregiver Invitation</h2>
        <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join <strong>${childName}</strong>'s care team on Alurei as a <strong>${roleLabel}</strong>.
        </p>

        ${pinBoxHtml}

        <div style="margin: 28px 0;">
          <a href="${acceptUrl}" style="background: #0d9488; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; margin-right: 12px;">
            ✅ Accept Invitation
          </a>
          <a href="${declineUrl}" style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 12px 24px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block;">
            ❌ Decline
          </a>
        </div>

        <p style="font-size: 13px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 16px;">
          Or preview in app: <a href="${previewUrl}" style="color: #38bdf8; word-break: break-all;">${previewUrl}</a>
        </p>
      </div>
    `;

    if (email) {
      try {
        await this.mailService.sendMail({
          to: email,
          subject,
          text: textMessage,
          html: htmlContent,
        });
        emailDelivered = true;
      } catch (err) {
        // Logging error silently
      }
    }

    if (phone) {
      try {
        await this.twilioService.sendSms(phone, textMessage);
        whatsappDelivered = true;
      } catch (err) {
        // Logging error silently
      }
    }

    return { emailDelivered, whatsappDelivered };
  }
}
