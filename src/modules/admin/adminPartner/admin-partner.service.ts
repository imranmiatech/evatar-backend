import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus, VerificationStatus } from '@prisma/client';
import { MailService } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RejectPartnerDto } from './dto/reject-partner.dto';

@Injectable()
export class AdminPartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getPartners(status?: string) {
    const where = {
      role: UserRole.PARTNER,
      ...(this.statusFilter(status) && { status: this.statusFilter(status) }),
    };

    const partners = await this.prisma.user.findMany({
      where,
      include: {
        partnerProfile: true,
        stores: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: partners.map((partner) => this.formatPartner(partner)),
      message: 'Partner requests fetched successfully.',
    };
  }

  async getPartner(id: string) {
    const partner = await this.findPartner(id);

    return {
      data: this.formatPartner(partner),
      message: 'Partner request fetched successfully.',
    };
  }

  async approvePartner(id: string, adminUserId: string) {
    const partner = await this.findPartner(id);

    if (partner.status === UserStatus.ACTIVE) {
      throw new BadRequestException('Partner is already approved.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
        rejectionReason: null,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        partnerProfile: {
          update: {
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
          },
        },
      },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    await this.mailService.sendDummyEmail(
      updated.email,
      'Your Alurei Partners account has been approved',
      `Hi ${updated.fullName},

Good news — your Alurei Partners request has been approved.

You can now log in and start setting up your partner rewards and store details.

Thank you,
Alurei Partners Team`,
    );

    return {
      data: this.formatPartner(updated),
      message: 'Partner approved successfully.',
    };
  }

  async rejectPartner(id: string, adminUserId: string, dto: RejectPartnerDto) {
    const partner = await this.findPartner(id);

    if (partner.status === UserStatus.ACTIVE) {
      throw new BadRequestException('Approved partners cannot be rejected. Suspend the account instead.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: dto.reason,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        partnerProfile: {
          update: {
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
          },
        },
      },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    await this.mailService.sendDummyEmail(
      updated.email,
      'Your Alurei Partners request was not approved',
      `Hi ${updated.fullName},

Thank you for applying to Alurei Partners.

After reviewing your request, we are unable to approve it at this time.

Reason: ${dto.reason}

If you believe this was a mistake, please contact our support team.

Thank you,
Alurei Partners Team`,
    );

    return {
      data: this.formatPartner(updated),
      message: 'Partner rejected successfully.',
    };
  }

  private async findPartner(id: string) {
    const partner = await this.prisma.user.findFirst({
      where: { id, role: UserRole.PARTNER },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    if (!partner) {
      throw new NotFoundException('Partner request not found.');
    }

    return partner;
  }

  private statusFilter(status?: string) {
    if (!status || status.toUpperCase() === 'ALL') return undefined;

    const normalized = status.toUpperCase();
    if (normalized === 'APPROVED') return UserStatus.ACTIVE;
    if (normalized === 'REJECTED') return UserStatus.INACTIVE;
    if (normalized === 'PENDING') return UserStatus.PENDING;

    if (Object.values(UserStatus).includes(normalized as UserStatus)) {
      return normalized as UserStatus;
    }

    return undefined;
  }

  private formatPartner(partner: any) {
    return {
      id: partner.id,
      businessName: partner.partnerProfile?.businessName ?? partner.fullName,
      businessCategory: partner.partnerProfile?.businessCategory ?? null,
      shortDescription: partner.partnerProfile?.shortDescription ?? null,
      website: partner.partnerProfile?.website ?? null,
      country: partner.partnerProfile?.country ?? null,
      city: partner.partnerProfile?.city ?? null,
      address: partner.partnerProfile?.address ?? null,
      openingHours: partner.partnerProfile?.openingHours ?? null,
      contactPerson: partner.partnerProfile?.contactPerson ?? partner.fullName,
      contactRole: partner.partnerProfile?.contactRole ?? null,
      contactEmail: partner.partnerProfile?.contactEmail ?? partner.email,
      contactPhone: partner.partnerProfile?.contactPhone ?? partner.phoneNumber,
      email: partner.email,
      phoneNumber: partner.phoneNumber,
      status: this.partnerStatusLabel(partner.status, partner.verificationStatus),
      rawStatus: partner.status,
      verificationStatus: partner.verificationStatus,
      rejectionReason: partner.rejectionReason,
      reviewedBy: partner.reviewedBy,
      reviewedAt: partner.reviewedAt,
      submittedAt: partner.createdAt,
      stores: partner.stores,
    };
  }

  private partnerStatusLabel(
    status: UserStatus,
    verificationStatus: VerificationStatus,
  ) {
    if (status === UserStatus.ACTIVE) return 'APPROVED';
    if (verificationStatus === VerificationStatus.REJECTED) return 'REJECTED';
    return 'PENDING';
  }
}
