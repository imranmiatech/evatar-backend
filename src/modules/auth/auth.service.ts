import { BadRequestException, Injectable, InternalServerErrorException, HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import {
  NotificationType,
  OtpPurpose,
  RelationshipType,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { TwilioService } from '../../common/twilio/twilio.service';
import { MailService } from '../../common/mail/mail.service';
import { NotificationService } from '../notification/notification.service';
import { SigninDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private twilioService: TwilioService,
    private mailService: MailService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  async signup(dto: SignupDto) {
    // 1. Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phoneNumber: dto.phoneNumber || undefined },
        ].filter(Boolean),
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new BadRequestException('Email already in use');
      }
      if (existingUser.phoneNumber === dto.phoneNumber) {
        throw new BadRequestException('Phone number already in use');
      }
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. Create user (and Profile if parent) in a transaction
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            fullName:
              dto.role === UserRole.PARTNER
                ? dto.businessName!
                : dto.fullName!,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            passwordHash,
            preferredLanguage: dto.preferredLanguage,
            role: dto.role,
          },
        });

        if (dto.role === UserRole.PARENT) {
          await tx.parentProfile.create({
            data: {
              userId: createdUser.id,
              relationship: this.relationshipType(dto.relationType),
              address: this.parentAddress(dto),
              street: dto.street ?? '',
              postalCode: dto.postCode ?? '',
              city: dto.city ?? '',
              state: dto.state ?? '',
              country: dto.country,
              membershipPlan: dto.membershipPlan,
            },
          });
        }

        if (dto.role === UserRole.NANNY) {
          await tx.nannyProfile.create({
            data: {
              userId: createdUser.id,
              languages: dto.preferredLanguage ? [dto.preferredLanguage] : [],
            },
          });
        }

        if (dto.role === UserRole.PARTNER) {
          await tx.partnerProfile.create({
            data: {
              userId: createdUser.id,
              businessName: dto.businessName!,
              businessCategory: dto.businessCategory!,
              shortDescription: dto.shortDescription,
              website: dto.website,
              country: dto.businessCountry!,
              city: dto.businessCity!,
              address: dto.businessAddress!,
              openingHours: dto.openingHours,
              contactPerson: dto.contactPerson!,
              contactRole: dto.contactRole,
              contactEmail: dto.contactEmail || dto.email,
              contactPhone: dto.contactPhone || dto.phoneNumber,
            },
          });

          await tx.store.create({
            data: {
              userId: createdUser.id,
              name: dto.businessName!,
              description: dto.shortDescription,
              address: dto.businessAddress,
              city: dto.businessCity,
            },
          });
        }

        if (dto.role === UserRole.PARTNER) {
          return createdUser;
        }

        // 4. Generate 4-digit OTP
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString(); // e.g., '4821'

        // 5. Store OTP in database
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Valid for 10 minutes

        await tx.otpCode.create({
          data: {
            userId: createdUser.id,
            code: otpCode,
            purpose: OtpPurpose.SIGNUP_VERIFICATION,
            expiresAt,
          },
        });

        // 6. Send OTP based on selected delivery method
        const deliveryMethod = (dto.otpDeliveryMethod || 'EMAIL').toUpperCase();
        await this.sendOtp(deliveryMethod, dto.email, dto.phoneNumber, otpCode);

        return createdUser;
      });

      // Remove passwordHash before returning to client
      const { passwordHash: _, ...result } = user;

      if (result.role === UserRole.PARTNER) {
        await this.sendPartnerSubmittedEmail(result.email, result.fullName);
        await this.notifyAdminsOfSignup(result);

        return {
          message:
            'Your partner request has been submitted. Please wait for admin approval before logging in.',
          user: result,
        };
      }

      await this.notifyAdminsOfSignup(result);

      return {
        message: 'Signup successful. Please verify your OTP.',
        user: result,
      };
    } catch (error) {
      console.error('Signup error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create account');
    }
  }
  

  async signin(dto: SigninDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phoneNumber: dto.phoneNumber || undefined },
        ].filter(Boolean),
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    if (
      user.status === UserStatus.DELETED ||
      user.status === UserStatus.INACTIVE ||
      user.status === UserStatus.PENDING ||
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.SUSPENDED
    ) {
      if (user.role === UserRole.PARTNER && user.status === UserStatus.PENDING) {
        throw new BadRequestException(
          'Your partner request is pending admin approval. Please wait for approval before logging in.',
        );
      }

      if (
        user.role === UserRole.PARTNER &&
        user.verificationStatus === VerificationStatus.REJECTED
      ) {
        throw new BadRequestException(
          user.rejectionReason ||
            'Your partner request was not approved. Please contact support.',
        );
      }

      throw new BadRequestException('Account is not active. Please contact support.');
    }

    // Remove passwordHash before returning to client
    const { passwordHash: _, ...result } = user;
    
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      message: 'Signin successful',
      user: result,
      ...tokens,
    };
  }

  async me(user: CurrentUserPayload) {
    const userId = user.id ?? user.userId;
    if (!userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        preferredLanguage: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        status: true,
        termsAccepted: true,
        verificationStatus: true,
        rejectionReason: true,
        reviewedBy: true,
        reviewedAt: true,
        vendorApplicantId: true,
        createdAt: true,
        updatedAt: true,
        parentProfile: true,
        nannyProfile: true,
        partnerProfile: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    if (profile.role === UserRole.NANNY && profile.nannyProfile) {
      const careScore = await this.calculateNannyCareScore(
        userId,
        profile.nannyProfile.averageRating,
      );

      return {
        ...profile,
        careScore,
        nannyProfile: {
          ...profile.nannyProfile,
          careScore,
        },
      };
    }

    return profile;
  }

  private async calculateNannyCareScore(
    userId: string,
    profileRating?: number | null,
  ): Promise<number> {
    const [completedProofs, completedCareAssignments] = await Promise.all([
      this.prisma.dayActivityProof.count({
        where: { uploadedByUserId: userId },
      }),
      this.prisma.careModuleAssignment.count({
        where: { nannyUserId: userId, status: 'COMPLETED' },
      }),
    ]);

    const baseScore = profileRating ? Math.round(profileRating * 20) : 80;
    const activityBonus = Math.min(completedProofs * 2, 10);
    const careModuleBonus = Math.min(completedCareAssignments * 5, 10);

    return Math.min(100, Math.max(0, baseScore + activityBonus + careModuleBonus));
  }

  private relationshipType(value?: string) {
    const normalized = value?.trim().toUpperCase();
    if (
      normalized &&
      Object.values(RelationshipType).includes(normalized as RelationshipType)
    ) {
      return normalized as RelationshipType;
    }

    return RelationshipType.GUARDIAN;
  }

  private parentAddress(dto: SignupDto) {
    return [dto.street, dto.city, dto.state, dto.country, dto.postCode]
      .filter(Boolean)
      .join(', ');
  }

  private async sendPartnerSubmittedEmail(email: string, fullName: string) {
    await this.mailService.sendDummyEmail(
      email,
      'Alurei Partners request received',
      `Hi ${fullName},

Your partner request has been submitted successfully.

Our team will review your business details and get in touch shortly. Please allow 3-5 business days for the review process.

You will be able to log in after your partner account is approved.

Thank you,
Alurei Partners Team`,
    );
  }

  private async notifyAdminsOfSignup(result: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  }) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        select: { id: true },
      });

      const title =
        result.role === UserRole.PARTNER
          ? 'New Partner Request'
          : 'New User Registration';
      const actionUrl =
        result.role === UserRole.PARTNER
          ? `/admin/partners/${result.id}`
          : `/admin/users/${result.id}`;

      for (const admin of admins) {
        await this.notificationService.createNotification({
          userId: admin.id,
          type: NotificationType.INVITATION_ACCEPTED,
          title,
          message: `${result.fullName} (${result.role}) registered.`,
          iconType: 'AVATAR',
          actionText: 'View Users',
          actionUrl,
          metadata: {
            newUserId: result.id,
            fullName: result.fullName,
            email: result.email,
            role: result.role,
          },
        });
      }
    } catch (err) {
      console.error('Failed to notify admins of new signup:', err);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    if (!dto.email && !dto.phoneNumber) {
      throw new BadRequestException('Email or phone number is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phoneNumber: dto.phoneNumber || undefined },
        ].filter(Boolean),
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Valid for 10 minutes

    // Store OTP
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        code: otpCode,
        purpose: OtpPurpose.PASSWORD_RESET,
        expiresAt,
      },
    });

    // Send OTP
    const deliveryMethod = dto.phoneNumber ? 'PHONE' : 'EMAIL';
    await this.sendOtp(deliveryMethod, user.email, user.phoneNumber || undefined, otpCode);

    return {
      message: `OTP sent successfully to your ${deliveryMethod.toLowerCase()}`,
    };
  }

  async verifySignupOtp(dto: VerifySignupOtpDto) {
    if (!dto.email && !dto.phoneNumber) {
      throw new BadRequestException('Email or phone number is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phoneNumber: dto.phoneNumber || undefined },
        ].filter(Boolean),
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.SIGNUP_VERIFICATION,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new BadRequestException('No pending signup verification found');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (otpRecord.code !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP code');
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: Boolean(dto.email) || user.isEmailVerified,
          isPhoneVerified: Boolean(dto.phoneNumber) || user.isPhoneVerified,
          status: UserStatus.ACTIVE,
          verificationStatus: user.verificationStatus,
        },
      }),
      this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    const { passwordHash: _, ...result } = updatedUser;
    const tokens = await this.generateTokens(updatedUser.id, updatedUser.role);

    return {
      message: 'Signup verified successfully',
      user: result,
      ...tokens,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.email && !dto.phoneNumber) {
      throw new BadRequestException('Email or phone number is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phoneNumber: dto.phoneNumber || undefined },
        ].filter(Boolean),
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the latest active OTP for password reset
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new BadRequestException('No pending password reset request found');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (otpRecord.code !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Update password and mark OTP as consumed
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return {
      message: 'Password has been reset successfully',
    };
  }

  async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN') || '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '30d') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
  /**
   * Mock method to send OTP. In production, integrate AWS SNS/Twilio/SendGrid here.
   */
  private async sendOtp(
    deliveryMethod: string,
    email: string,
    phoneNumber?: string,
    otpCode?: string,
  ) {
    const messageBody = `Your EvaTurner verification code is: ${otpCode}`;

    if (deliveryMethod === 'EMAIL') {
      console.log(`[EmailService] Sending OTP ${otpCode} to email: ${email}`);
      await this.mailService.sendDummyEmail(
        email,
        'EvaTurner OTP Verification',
        messageBody,
      );
    } else if (deliveryMethod === 'PHONE') {
      if (!phoneNumber) {
        throw new BadRequestException('Phone number is required for PHONE OTP delivery');
      }
      console.log(`[SmsService] Sending OTP ${otpCode} to phone: ${phoneNumber}`);
      await this.twilioService.sendSms(phoneNumber, messageBody);
    } else {
      console.log(`[DefaultService] Sending OTP ${otpCode} to email: ${email}`);
      await this.mailService.sendDummyEmail(
        email,
        'EvaTurner OTP Verification',
        messageBody,
      );
    }
  }
}
