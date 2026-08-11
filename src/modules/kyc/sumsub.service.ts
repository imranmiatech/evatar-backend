import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus, VerificationStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

type SumsubAccessTokenResponse = {
  token: string;
  userId: string;
};

type SumsubWebhookPayload = {
  applicantId?: string;
  inspectionId?: string;
  externalUserId?: string;
  type?: string;
  reviewStatus?: string;
  levelName?: string;
  reviewResult?: {
    reviewAnswer?: string;
    reviewRejectType?: string;
    rejectLabels?: string[];
    moderationComment?: string;
    clientComment?: string;
  };
};

@Injectable()
export class SumsubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generateSdkAccessToken(userId: string) {
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
      throw new BadRequestException('User not found');
    }

    if (user.role !== UserRole.PARENT && user.role !== UserRole.NANNY) {
      throw new BadRequestException('Sumsub verification is only available for Parent and Nanny users');
    }

    const levelName = this.levelNameForRole(user.role);
    const ttlInSecs = Number(this.configService.get<string>('SUMSUB_TOKEN_TTL_SECONDS') || 600);
    const body = JSON.stringify({
      userId: user.id,
      levelName,
      ttlInSecs,
      applicantIdentifiers: {
        email: user.email,
        phone: user.phoneNumber,
      },
    });

    const response = await this.sumsubRequest<SumsubAccessTokenResponse>(
      'POST',
      '/resources/accessTokens/sdk',
      body,
    );

    return {
      ...response,
      levelName,
      ttlInSecs,
      verificationStatus: user.verificationStatus,
    };
  }

  async handleWebhook(
    payload: SumsubWebhookPayload,
    rawBody: Buffer,
    digest?: string,
    digestAlg?: string,
  ) {
    this.verifyWebhookSignature(rawBody, digest, digestAlg);

    const userId = payload.externalUserId;
    if (!userId) {
      throw new BadRequestException('Sumsub webhook externalUserId is missing');
    }

    const status = this.statusFromWebhook(payload);
    const rejectionReason = this.rejectionReasonFromWebhook(payload);
    const shouldActivate = status === VerificationStatus.APPROVED;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        vendorApplicantId: payload.applicantId,
        verificationStatus: status,
        rejectionReason,
        reviewedAt: this.isFinalReview(payload) ? new Date() : undefined,
        status: shouldActivate ? UserStatus.ACTIVE : undefined,
      },
    });

    return {
      received: true,
      userId,
      applicantId: payload.applicantId,
      eventType: payload.type,
      verificationStatus: status,
    };
  }

  private async sumsubRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: string,
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('SUMSUB_BASE_URL') || 'https://api.sumsub.com';
    const appToken = this.configService.get<string>('SUMSUB_APP_TOKEN') || '';
    const secretKey = this.configService.get<string>('SUMSUB_SECRET_KEY') || '';

    if (this.isDummy(appToken) || this.isDummy(secretKey)) {
      throw new BadRequestException('Sumsub is not configured. Replace dummy SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY in .env.');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secretKey)
      .update(`${timestamp}${method}${path}${body || ''}`)
      .digest('hex');

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': appToken,
        'X-App-Access-Ts': timestamp,
        'X-App-Access-Sig': signature,
      },
      body,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new InternalServerErrorException({
        message: 'Sumsub request failed',
        statusCode: response.status,
        error: data,
      });
    }

    return data as T;
  }

  private verifyWebhookSignature(
    rawBody: Buffer,
    digest?: string,
    digestAlg = 'HMAC_SHA256_HEX',
  ) {
    const secretKey = this.configService.get<string>('SUMSUB_WEBHOOK_SECRET') || '';
    const allowUnsignedDevWebhook =
      this.configService.get<string>('NODE_ENV') === 'development' && this.isDummy(secretKey);

    if (allowUnsignedDevWebhook && !digest) {
      return;
    }

    if (!secretKey || this.isDummy(secretKey)) {
      throw new UnauthorizedException('Sumsub webhook secret is not configured');
    }

    if (!digest) {
      throw new UnauthorizedException('Missing Sumsub webhook digest');
    }

    const algorithm = this.webhookDigestAlgorithm(digestAlg);
    const expected = createHmac(algorithm, secretKey).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(digest, 'hex');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Sumsub webhook digest');
    }
  }

  private webhookDigestAlgorithm(digestAlg: string): 'sha1' | 'sha256' | 'sha512' {
    switch (digestAlg) {
      case 'HMAC_SHA1_HEX':
        return 'sha1';
      case 'HMAC_SHA512_HEX':
        return 'sha512';
      case 'HMAC_SHA256_HEX':
      default:
        return 'sha256';
    }
  }

  private statusFromWebhook(payload: SumsubWebhookPayload): VerificationStatus {
    const reviewAnswer = payload.reviewResult?.reviewAnswer;

    if (reviewAnswer === 'GREEN') {
      return VerificationStatus.APPROVED;
    }

    if (reviewAnswer === 'RED') {
      return VerificationStatus.REJECTED;
    }

    if (payload.type === 'applicantPending' || payload.reviewStatus === 'pending') {
      return VerificationStatus.UNDER_REVIEW;
    }

    if (payload.type === 'applicantCreated') {
      return VerificationStatus.PENDING;
    }

    return VerificationStatus.UNDER_REVIEW;
  }

  private rejectionReasonFromWebhook(payload: SumsubWebhookPayload) {
    if (payload.reviewResult?.reviewAnswer !== 'RED') {
      return null;
    }

    return (
      payload.reviewResult.moderationComment ||
      payload.reviewResult.rejectLabels?.join(', ') ||
      payload.reviewResult.clientComment ||
      'Sumsub verification rejected'
    );
  }

  private isFinalReview(payload: SumsubWebhookPayload) {
    return payload.type === 'applicantReviewed' || Boolean(payload.reviewResult?.reviewAnswer);
  }

  private levelNameForRole(role: UserRole) {
    if (role === UserRole.NANNY) {
      return this.configService.get<string>('SUMSUB_NANNY_LEVEL_NAME') || 'nanny-basic-kyc';
    }

    return this.configService.get<string>('SUMSUB_PARENT_LEVEL_NAME') || 'parent-basic-kyc';
  }

  private isDummy(value: string) {
    return !value || value.toLowerCase().startsWith('dummy_');
  }
}
