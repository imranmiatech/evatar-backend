import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CaregiverAccessRole,
  CaregiverAccessStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchManageSystemDto } from './dto/search-manage-system.dto';
import { UpdateManageSystemPermissionsDto } from './dto/update-manage-system-permissions.dto';

export const PERMISSION_KEYS = [
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

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionMap = Record<PermissionKey, boolean>;

export const ROLE_PERMISSION_KEYS = {
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

export const DEFAULT_TRUE_BY_ROLE = {
  [CaregiverAccessRole.NANNY]: ['viewGroceryLists', 'manageGroceryLists'],
  [CaregiverAccessRole.PARENT]: ['manageDailyPlans', 'manageCareTeam'],
  [CaregiverAccessRole.FAMILY_MEMBER]: [
    'dailyActivitiesRecipes',
    'careLearningAccess',
    'accessChildInsights',
    'memoriesStories',
  ],
} satisfies Record<CaregiverAccessRole, readonly PermissionKey[]>;

export const PERMISSION_LABELS = {
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

export const PERMISSION_DESCRIPTIONS = {
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

export const accessInclude = {
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

export type LoadedAccess = Prisma.CaregiverAccessGetPayload<{
  include: typeof accessInclude;
}>;

@Injectable()
export class CaregiverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Screen 1: Get Account Owner & Categorized Caregiver List
   */
  async getManageCaregivers(userId: string, childId?: string) {
    const accessibleChildIds = childId
      ? [(await this.getChildAccessContext(userId, childId)).childId]
      : await this.getAccessibleChildIds(userId);
    const manageableChildIds = await this.getAccessibleChildIds(
      userId,
      'manageCareTeam',
    );

    const children = await this.prisma.child.findMany({
      where: { id: { in: accessibleChildIds } },
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

    const ownerUser = children[0]?.parentUser ?? accesses[0]?.child?.parentUser;
    const accountOwner = ownerUser
      ? {
          id: ownerUser.id,
          name: ownerUser.fullName,
          email: ownerUser.email,
          image: ownerUser.profilePictureUrl,
          childIds: children.map((child) => child.id),
          childNames: children.map((child) => child.name),
          canManageCareTeam: children.some((child) =>
            manageableChildIds.includes(child.id),
          ),
        }
      : null;

    const caregivers = accesses.map((access) =>
      this.formatManageCaregiver(
        access,
        manageableChildIds.includes(access.childId),
      ),
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
   * Screen 5 ("On Platform"): Search registered users by email or name
   */
  async searchUsers(userId: string, dto: SearchManageSystemDto) {
    const query = dto.query?.trim();

    if (!query) {
      return this.getManageCaregivers(userId);
    }

    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
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

  async getChildAccessContext(userId: string, childId: string) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: {
        id: true,
        name: true,
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
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (child.parentUserId === userId) {
      const permissions = this.fullPermissions();
      return {
        childId: child.id,
        childName: child.name,
        isOwner: true,
        accessRole: 'ACCOUNT_OWNER',
        permissions,
        permissionItems: this.permissionItemsFromMap(permissions),
        accountOwner: {
          id: child.parentUser.id,
          name: child.parentUser.fullName,
          email: child.parentUser.email,
          image: child.parentUser.profilePictureUrl,
        },
      };
    }

    const access = await this.prisma.caregiverAccess.findFirst({
      where: {
        childId,
        invitedUserId: userId,
        status: CaregiverAccessStatus.ACCEPTED,
      },
      include: accessInclude,
    });

    if (!access) {
      throw new ForbiddenException('You do not have access to this child');
    }

    const permissions = this.pickPermissions(access);
    return {
      childId: child.id,
      childName: child.name,
      isOwner: false,
      accessRole: access.role,
      relationship: access.relationship,
      permissions,
      permissionItems: this.permissionItemsFromMap(permissions),
      accountOwner: {
        id: child.parentUser.id,
        name: child.parentUser.fullName,
        email: child.parentUser.email,
        image: child.parentUser.profilePictureUrl,
      },
    };
  }

  formatAccess(access: LoadedAccess, canManageCareTeam = false) {
    const caregiverUser = access.invitedUser;
    const baseName =
      caregiverUser?.fullName ??
      access.invitedName ??
      access.invitedEmail ??
      access.invitedPhone ??
      'Invited Caregiver';
    const name = caregiverUser ? baseName : `${baseName} (Invited Member)`;

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
      canManageCareTeam,
      permissions: this.formatAccessPermissions(access),
      createdAt: access.createdAt,
    };
  }

  formatManageCaregiver(access: LoadedAccess, canManageCareTeam = false) {
    return this.formatAccess(access, canManageCareTeam);
  }

  caregiverSections(accountOwner: any, caregivers: any[]) {
    return {
      accountOwner: accountOwner ? [accountOwner] : [],
      nannies: caregivers.filter(
        (c) => c.role === CaregiverAccessRole.NANNY,
      ),
      parents: caregivers.filter(
        (c) => c.role === CaregiverAccessRole.PARENT,
      ),
      familyMembers: caregivers.filter(
        (c) => c.role === CaregiverAccessRole.FAMILY_MEMBER,
      ),
    };
  }

  formatAccessPermissions(access: LoadedAccess) {
    const roleKeys = ROLE_PERMISSION_KEYS[access.role];
    const items = roleKeys.map((key) => {
      const isEnabled = Boolean((access as any)[key]);
      return {
        key,
        label: PERMISSION_LABELS[key],
        description: PERMISSION_DESCRIPTIONS[key],
        isEnabled,
      };
    });

    return {
      accessId: access.id,
      childId: access.childId,
      childName: access.child.name,
      role: access.role,
      relationship: access.relationship,
      status: access.status,
      user: {
        id: access.invitedUser?.id ?? null,
        name:
          access.invitedUser?.fullName ??
          access.invitedName ??
          access.invitedEmail ??
          'Caregiver',
        email: access.invitedUser?.email ?? access.invitedEmail ?? null,
        image: access.invitedUser?.profilePictureUrl ?? null,
      },
      items,
    };
  }

  permissionItemsFromMap(permissions: PermissionMap) {
    return PERMISSION_KEYS.map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
      description: PERMISSION_DESCRIPTIONS[key],
      isEnabled: Boolean(permissions[key]),
    }));
  }

  fullPermissions(): PermissionMap {
    return PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as PermissionMap);
  }

  permissionSelect() {
    return PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<PermissionKey, true>);
  }

  pickPermissions(access: Record<string, any>): PermissionMap {
    return PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = Boolean(access[key]);
      return acc;
    }, {} as PermissionMap);
  }

  permissionUpdates(
    dto: UpdateManageSystemPermissionsDto,
    role: CaregiverAccessRole,
  ) {
    const allowedKeys = ROLE_PERMISSION_KEYS[role];
    const updates: Partial<Record<PermissionKey, boolean>> = {};

    for (const key of allowedKeys) {
      if (typeof (dto as any)[key] === 'boolean') {
        updates[key] = (dto as any)[key];
      }
    }
    return updates;
  }

  nonRolePermissionResets(role: CaregiverAccessRole) {
    const allowed = new Set<string>(ROLE_PERMISSION_KEYS[role]);
    const resets: Partial<Record<PermissionKey, boolean>> = {};
    for (const key of PERMISSION_KEYS) {
      if (!allowed.has(key)) {
        resets[key] = false;
      }
    }
    return resets;
  }

  applyPermissionHierarchy(data: Record<string, any>) {
    const updated = { ...data };
    if (updated.manageDailyPlans) {
      updated.dailyActivitiesRecipes = true;
    }
    if (updated.manageGroceryLists) {
      updated.viewGroceryLists = true;
    }
    return updated;
  }
}
