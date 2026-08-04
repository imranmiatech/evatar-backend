import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminUserQueryDto, AdminUserRoleFilter, AdminUserStatusFilter, AdminUserPlanFilter } from './dto/admin-user-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UserRole, UserStatus, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get User Management Overview Stats & Per-Enum Counts
   */
  async getUserStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeToday,
      newThisWeek,
      trialUsers,
      paidMembers,
      suspended,
      parentCount,
      nannyCount,
      adminCount,
      activeStatusCount,
      trialStatusCount,
      suspendedStatusCount,
      familyPlanCount,
      starterPlanCount,
      premiumPlanCount,
    ] = await Promise.all([
      // Top 6 metric cards
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          updatedAt: { gte: startOfToday },
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.userSubscription.count({
        where: {
          OR: [
            { status: SubscriptionStatus.FREE_TRIAL },
            { trialEndsAt: { gte: now } },
          ],
        },
      }),
      this.prisma.userSubscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      this.prisma.user.count({
        where: { status: { in: [UserStatus.INACTIVE, UserStatus.PENDING] } },
      }),

      // Role Enum Counts
      this.prisma.user.count({ where: { role: UserRole.PARENT } }),
      this.prisma.user.count({ where: { role: UserRole.NANNY } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),

      // Status Enum Counts
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.userSubscription.count({
        where: {
          OR: [
            { status: SubscriptionStatus.FREE_TRIAL },
            { trialEndsAt: { gte: now } },
          ],
        },
      }),
      this.prisma.user.count({ where: { status: { in: [UserStatus.INACTIVE, UserStatus.PENDING] } } }),

      // Plan Enum Counts
      this.prisma.userSubscription.count({
        where: { plan: { name: { contains: 'Family', mode: 'insensitive' } } },
      }),
      this.prisma.userSubscription.count({
        where: { plan: { name: { contains: 'Starter', mode: 'insensitive' } } },
      }),
      this.prisma.userSubscription.count({
        where: { plan: { name: { contains: 'Premium', mode: 'insensitive' } } },
      }),
    ]);

    return {
      metrics: {
        totalUsers: { count: totalUsers, growth: '+1.85%' },
        activeToday: { count: activeToday, growth: '+3.4%' },
        newThisWeek: { count: newThisWeek, growth: '+7.3%' },
        trialUsers: { count: trialUsers, growth: '+5.9%' },
        paidMembers: { count: paidMembers, growth: '+3.3%' },
        suspended: { count: suspended, growth: '+20%' },
      },
      enumCounts: {
        roles: {
          ALL: totalUsers,
          PARENT: parentCount,
          NANNY: nannyCount,
          ADMIN: adminCount,
        },
        statuses: {
          ALL: totalUsers,
          ACTIVE: activeStatusCount,
          TRIAL: trialStatusCount,
          SUSPENDED: suspendedStatusCount,
        },
        plans: {
          ALL: totalUsers,
          FAMILY: familyPlanCount,
          STARTER: starterPlanCount,
          PREMIUM: premiumPlanCount,
          FREE_TRIAL: trialStatusCount,
        },
      },
    };
  }

  /**
   * Get Users Table List with Search, Filter & Pagination
   */
  async getUsers(query: AdminUserQueryDto) {
    const { search, role, status, plan, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search && search.trim() !== '') {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role && role !== AdminUserRoleFilter.ALL) {
      where.role = role as UserRole;
    }

    if (status && status !== AdminUserStatusFilter.ALL) {
      if (status === AdminUserStatusFilter.ACTIVE) {
        where.status = UserStatus.ACTIVE;
      } else if (status === AdminUserStatusFilter.SUSPENDED) {
        where.status = { in: [UserStatus.INACTIVE, UserStatus.PENDING] };
      } else if (status === AdminUserStatusFilter.TRIAL) {
        where.userSubscription = { status: SubscriptionStatus.FREE_TRIAL };
      }
    }

    if (plan && plan !== AdminUserPlanFilter.ALL) {
      if (plan === AdminUserPlanFilter.FREE_TRIAL) {
        where.userSubscription = { status: SubscriptionStatus.FREE_TRIAL };
      } else {
        where.userSubscription = {
          plan: {
            name: { contains: plan, mode: 'insensitive' },
          },
        };
      }
    }

    const [totalItems, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userSubscription: {
            include: {
              plan: true,
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => {
      const isTrial = u.userSubscription?.status === SubscriptionStatus.FREE_TRIAL || (u.userSubscription?.trialEndsAt && u.userSubscription.trialEndsAt > new Date());
      
      let planName = 'Starter';
      if (isTrial) {
        planName = 'Starter (Trial)';
      } else if (u.userSubscription?.plan?.name) {
        planName = u.userSubscription.plan.name;
      }

      let statusBadge = 'Active';
      if (u.status === UserStatus.INACTIVE || u.status === UserStatus.PENDING) {
        statusBadge = 'Suspended';
      } else if (isTrial) {
        statusBadge = 'Trial';
      }

      let roleBadge = 'Parent';
      if (u.role === UserRole.NANNY) roleBadge = 'Nanny';
      if (u.role === UserRole.ADMIN) roleBadge = 'Admin';

      const joinedFormatted = new Date(u.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phoneNumber: u.phoneNumber || 'N/A',
        profilePictureUrl: u.profilePictureUrl,
        role: roleBadge,
        rawRole: u.role,
        plan: planName,
        status: statusBadge,
        rawStatus: u.status,
        joined: joinedFormatted,
        createdAt: u.createdAt,
      };
    });

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items: formattedUsers,
      meta: {
        totalItems,
        page,
        limit,
        totalPages,
        shownText: `${formattedUsers.length} of ${totalItems} users shown`,
      },
    };
  }

  /**
   * Get Single User Details
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        parentProfile: true,
        nannyProfile: true,
        child: true,
        userSubscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  /**
   * Edit User Profile & Subscription
   */
  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updateData: any = {};
    if (dto.fullName) updateData.fullName = dto.fullName;
    if (dto.email) updateData.email = dto.email;
    if (dto.phoneNumber) updateData.phoneNumber = dto.phoneNumber;
    if (dto.role) updateData.role = dto.role;
    if (dto.status) updateData.status = dto.status;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (dto.planName) {
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { name: { contains: dto.planName, mode: 'insensitive' } },
      });
      if (plan) {
        const now = new Date();
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await this.prisma.userSubscription.upsert({
          where: { userId: id },
          update: { planId: plan.id, status: SubscriptionStatus.ACTIVE },
          create: {
            userId: id,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: nextMonth,
          },
        });
      }
    }

    return {
      message: 'User updated successfully',
      user: updatedUser,
    };
  }

  /**
   * Delete User
   */
  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.user.delete({ where: { id } });

    return {
      message: 'User deleted successfully',
      userId: id,
    };
  }
}
