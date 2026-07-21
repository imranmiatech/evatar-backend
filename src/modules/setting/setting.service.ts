import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto, DeleteAccountDto } from './dto/setting.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SettingService {
  constructor(private readonly prisma: PrismaService) {}

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
        data: { isActive: false },
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
}
