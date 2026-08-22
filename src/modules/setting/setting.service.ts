import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ChangePasswordDto,
  CreateStripeOnboardingLinkDto,
  DeleteAccountDto,
  SavePayoutMethodDto,
  UpdateMembershipRoutingDto,
} from './dto/setting.dto';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { PaymentAccountService } from '../payment/payment-account.service';

@Injectable()
export class SettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentAccountService: PaymentAccountService,
  ) {}

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async deleteAccount(userId: string, deleteAccountDto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Wrap in a transaction to ensure both happen or neither
    await this.prisma.$transaction(async (prisma) => {
      // Create deletion feedback record
      await prisma.accountDeletion.upsert({
        where: { userId },
        update: {
          reason: deleteAccountDto.reason,
          details: deleteAccountDto.details,
        },
        create: {
          userId,
          reason: deleteAccountDto.reason,
          details: deleteAccountDto.details,
        }
      });

      // Soft delete user
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.DELETED },
      });
    });

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  async getDeletedAccounts() {
    const deletedAccounts = await this.prisma.accountDeletion.findMany({
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
            createdAt: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      data: deletedAccounts,
    };
  }

  async getDeletedAccountById(id: string) {
    const deletedAccount = await this.prisma.accountDeletion.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
            createdAt: true,
          }
        }
      }
    });

    if (!deletedAccount) {
      throw new NotFoundException('Deleted account record not found');
    }

    return {
      success: true,
      data: deletedAccount,
    };
  }

  async getMyPayoutMethods(userId: string) {
    return {
      success: true,
      data: await this.paymentAccountService.getPayoutMethods(userId),
    };
  }

  async saveMyPayoutMethod(userId: string, dto: SavePayoutMethodDto) {
    return {
      success: true,
      message: 'Payout method saved successfully.',
      data: await this.paymentAccountService.savePayoutMethod(userId, dto),
    };
  }

  async setDefaultPayoutMethod(userId: string, payoutMethodId: string) {
    return {
      success: true,
      message: 'Default payout method updated successfully.',
      data: await this.paymentAccountService.setDefaultPayoutMethod(
        userId,
        payoutMethodId,
      ),
    };
  }

  async removeDefaultPayoutMethod(userId: string, payoutMethodId: string) {
    return {
      success: true,
      message: 'Default marker removed successfully.',
      data: await this.paymentAccountService.removeDefaultPayoutMethod(
        userId,
        payoutMethodId,
      ),
    };
  }

  async getPaymentRoutingOverview() {
    return {
      success: true,
      data: await this.paymentAccountService.getPaymentRoutingOverview(),
    };
  }

  async updateMembershipRouting(dto: UpdateMembershipRoutingDto) {
    return {
      success: true,
      message: 'Membership subscription routing updated successfully.',
      data: await this.paymentAccountService.updateMembershipRouting(dto),
    };
  }

  async resolvePaymentRecipient(
    context: string,
    options: { nannyUserId?: string; productId?: string } = {},
  ) {
    return {
      success: true,
      data: await this.paymentAccountService.resolvePaymentRecipient(
        context,
        options,
      ),
    };
  }

  async createStripeOnboardingLink(
    userId: string,
    dto: CreateStripeOnboardingLinkDto,
  ) {
    return {
      success: true,
      message: 'Stripe onboarding link created successfully.',
      data: await this.paymentAccountService.createStripeOnboardingLink(
        userId,
        dto,
      ),
    };
  }

  async getStripeConnectStatus(userId: string) {
    return {
      success: true,
      data: await this.paymentAccountService.getStripeConnectStatus(userId),
    };
  }
}
