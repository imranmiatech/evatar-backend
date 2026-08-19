import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CaregiverAccessRole,
  CaregiverAccessStatus,
  CaregiverInviteChannel,
  CaregiverRelationship,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../../common/mail/mail.service';
import { TwilioService } from '../../../common/twilio/twilio.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CaregiverService,
  DEFAULT_TRUE_BY_ROLE,
  LoadedAccess,
  PERMISSION_KEYS,
  PermissionKey,
  PermissionMap,
  ROLE_PERMISSION_KEYS,
  accessInclude,
} from '../caregiver/caregiver.service';
import { CreateManageSystemInvitationDto } from './dto/create-manage-system-invitation.dto';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly twilioService: TwilioService,
    private readonly caregiverService: CaregiverService,
  ) {}

  /**
   * Screen 5: Create invitation to Nanny, Parent, or Family Member
   */
  async createInvitation(
    inviterUserId: string,
    childId: string,
    dto: CreateManageSystemInvitationDto,
  ) {
    await this.caregiverService.assertChildPermission(
      inviterUserId,
      childId,
      'manageCareTeam',
    );

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
      dto.channel ??
      (dto.invitedEmail && dto.invitedPhone
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
        const userRole = UserRole.PARENT;

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
          ? (dto.relationship as CaregiverRelationship)
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
        ...this.caregiverService.formatAccess(access),
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
      data: this.caregiverService.formatAccess(access),
    };
  }

  /**
   * Accept caregiver invitation
   */
  async acceptInvitation(userId: string, token: string) {
    const inviteTokenHash = this.hashToken(token);
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { inviteTokenHash },
      select: {
        id: true,
        childId: true,
        role: true,
        status: true,
        expiresAt: true,
        invitedUserId: true,
        invitedEmail: true,
      },
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
      data: this.caregiverService.formatAccess(updated),
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
      data: this.caregiverService.formatAccess(updated),
    };
  }

  /**
   * Quick Accept link for direct email button click.
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
        access: this.caregiverService.formatAccess(updatedAccess),
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

  // ==========================================
  // Helper Token & Delivery Methods
  // ==========================================

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
      !dto.invitedEmail
    ) {
      throw new BadRequestException('Email address required for email invite');
    }

    if (
      (inviteChannel === CaregiverInviteChannel.WHATSAPP ||
        inviteChannel === CaregiverInviteChannel.EMAIL_WHATSAPP) &&
      !dto.invitedPhone
    ) {
      throw new BadRequestException('Phone number required for WhatsApp invite');
    }
  }

  private async resolveInvitedUser(dto: CreateManageSystemInvitationDto) {
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
              ? (dto.relationship as CaregiverRelationship)
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
            ? (dto.relationship as CaregiverRelationship)
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
