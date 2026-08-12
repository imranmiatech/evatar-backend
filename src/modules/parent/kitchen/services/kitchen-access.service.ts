import { ForbiddenException, Injectable } from '@nestjs/common';
import { CaregiverAccessStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';

type GroceryPermission =
  | 'viewGroceryLists'
  | 'manageGroceryLists'
  | 'groceryOrdering'
  | 'manageGroceryOrders';

@Injectable()
export class KitchenAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveWritableParentUserId(
    user: CurrentUserPayload,
    targetUserId?: string,
    permission: GroceryPermission = 'manageGroceryLists',
  ) {
    if (user.role === UserRole.ADMIN) {
      return targetUserId ?? user.userId;
    }

    if (user.role === UserRole.PARENT) {
      return user.userId;
    }

    if (user.role !== UserRole.NANNY) {
      throw new ForbiddenException(
        'You do not have access to kitchen features',
      );
    }

    const parentIds = await this.getAccessibleParentUserIds(
      user.userId,
      permission,
    );

    if (!parentIds.length) {
      throw new ForbiddenException(
        'Parent permission is required for this kitchen action',
      );
    }

    if (targetUserId) {
      if (!parentIds.includes(targetUserId)) {
        throw new ForbiddenException(
          'You do not have access to this parent kitchen',
        );
      }

      return targetUserId;
    }

    return parentIds[0];
  }

  async resolveReadableParentUserIds(
    user: CurrentUserPayload,
    permission: GroceryPermission = 'manageGroceryLists',
  ) {
    if (user.role === UserRole.ADMIN) {
      return undefined;
    }

    if (user.role === UserRole.PARENT) {
      return [user.userId];
    }

    if (user.role !== UserRole.NANNY) {
      throw new ForbiddenException(
        'You do not have access to kitchen features',
      );
    }

    const parentIds = await this.getAccessibleParentUserIds(
      user.userId,
      permission,
    );

    if (!parentIds.length) {
      throw new ForbiddenException(
        'Parent permission is required for this kitchen action',
      );
    }

    return parentIds;
  }

  async canAccessParentUser(
    user: CurrentUserPayload,
    parentUserId: string,
    permission: GroceryPermission = 'manageGroceryLists',
  ) {
    if (user.role === UserRole.ADMIN || user.userId === parentUserId) {
      return true;
    }

    if (user.role !== UserRole.NANNY) {
      return false;
    }

    const parentIds = await this.getAccessibleParentUserIds(
      user.userId,
      permission,
    );
    return parentIds.includes(parentUserId);
  }

  private async getAccessibleParentUserIds(
    nannyUserId: string,
    permission: GroceryPermission,
  ) {
    const accesses = await this.prisma.caregiverAccess.findMany({
      where: {
        invitedUserId: nannyUserId,
        status: CaregiverAccessStatus.ACCEPTED,
        [permission]: true,
      },
      select: {
        child: {
          select: {
            parentUserId: true,
          },
        },
      },
    });

    return [
      ...new Set(
        accesses.map((access) => access.child.parentUserId).filter(Boolean),
      ),
    ];
  }
}
