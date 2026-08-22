import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus, VerificationStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

type SumsubAccessTokenResponse = {
  token: string;
  userId: string;
};

type SumsubApplicantResponse = {
  id: string;
};

type SumsubSdkBootstrapResponse = SumsubAccessTokenResponse & {
  applicantId: string;
  levelName: string;
  ttlInSecs: number;
  verificationStatus: VerificationStatus;
  customizationName: string | null;
};

type SumsubApplicantActionResponse = {
  id: string;
  applicantId?: string;
  requiredIdDocs?: Record<string, unknown>;
};

type SumsubWebhookPayload = {
  applicantId?: string;
  inspectionId?: string;
  externalUserId?: string;
  type?: string;
  reviewStatus?: string;
  levelName?: string;
  applicantActionId?: string;
  actionId?: string;
  reviewResult?: {
    reviewAnswer?: string;
    reviewRejectType?: string;
    rejectLabels?: string[];
    moderationComment?: string;
    clientComment?: string;
  };
};

type SumsubDuplicateCheckResponse = {
  checks?: Array<{
    answer?: string;
    similarSearchInfo?: {
      answer?: string;
      duplicateApplicantHits?: Array<{
        applicantId?: string;
        matchedFields?: string[];
        types?: string[];
      }>;
    };
  }>;
};

type SumsubIdDocResponse = Array<{
  idDocType?: string;
  country?: string;
  number?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dob?: string;
}>;

type SumsubUploadDocumentResponse = {
  idDocType?: string;
  country?: string;
  idDocSubType?: string;
  imageId?: number | string;
  warnings?: Array<{
    code?: string;
    message?: string;
    shouldBeDoubleSided?: boolean;
    shouldBeDoublePaged?: boolean;
    documentDeclinedBefore?: boolean;
  }>;
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
  [key: string]: unknown;
};

type SumsubRequestOptions = {
  body?: string | Buffer;
  contentType?: string;
  additionalHeaders?: Record<string, string>;
};

@Injectable()
export class SumsubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generateSdkAccessToken(
    userId: string,
    options?: {
      lang?: string;
      externalActionId?: string;
      levelNameOverride?: string;
    },
  ) {
    const user = await this.getEligibleUser(userId);
    const levelName =
      options?.levelNameOverride || this.levelNameForRole(user.role);
    const applicantId = await this.ensureApplicantProfile(user.id, {
      lang: options?.lang,
      levelName,
    });
    const ttlInSecs = Number(
      this.configService.get<string>('SUMSUB_TOKEN_TTL_SECONDS') || 600,
    );

    const body = JSON.stringify({
      userId: user.id,
      applicantId,
      levelName,
      ttlInSecs,
      externalActionId: options?.externalActionId,
      applicantIdentifiers: {
        email: user.email,
        phone: user.phoneNumber,
      },
    });

    const response = await this.sumsubRequest<SumsubAccessTokenResponse>(
      'POST',
      '/resources/accessTokens/sdk',
      {
        body,
        contentType: 'application/json',
      },
    );

    return {
      ...response,
      applicantId,
      levelName,
      ttlInSecs,
      verificationStatus: user.verificationStatus,
      customizationName: this.customizationNameForRole(user.role),
    } satisfies SumsubSdkBootstrapResponse;
  }

  async ensureApplicantProfile(
    userId: string,
    options?: { lang?: string; levelName?: string },
  ) {
    const user = await this.getEligibleUser(userId);

    if (user.vendorApplicantId) {
      return user.vendorApplicantId;
    }

    const levelName = options?.levelName || this.levelNameForRole(user.role);
    const path = `/resources/applicants?levelName=${encodeURIComponent(levelName)}`;
    const body = JSON.stringify({
      externalUserId: user.id,
      email: user.email,
      phone: user.phoneNumber,
      lang: options?.lang || 'en',
      fixedInfo: {
        email: user.email,
        phone: user.phoneNumber,
      },
    });

    const response = await this.sumsubRequest<SumsubApplicantResponse>(
      'POST',
      path,
      {
        body,
        contentType: 'application/json',
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { vendorApplicantId: response.id },
    });

    return response.id;
  }

  async createLivenessAction(userId: string, options?: { lang?: string }) {
    const user = await this.getEligibleUser(userId);
    const applicantId = await this.ensureApplicantProfile(userId, {
      lang: options?.lang,
    });
    const actionLevelName = this.actionLevelNameForRole(user.role);
    const externalActionId = `kyc-liveness-${userId}-${Date.now()}`;
    const path = `/resources/applicantActions/-/forApplicant/${encodeURIComponent(applicantId)}?levelName=${encodeURIComponent(actionLevelName)}`;
    const body = JSON.stringify({
      externalActionId,
      email: user.email,
      phone: user.phoneNumber,
    });

    try {
      const action = await this.sumsubRequest<SumsubApplicantActionResponse>(
        'POST',
        path,
        {
          body,
          contentType: 'application/json',
        },
      );

      const sdk = await this.generateSdkAccessToken(userId, {
        lang: options?.lang,
        externalActionId,
        levelNameOverride: actionLevelName,
      });

      return {
        applicantId,
        actionId: action.id,
        actionLevelName,
        sdk,
        requiredIdDocs: action.requiredIdDocs ?? null,
        mode: 'ACTION',
      };
    } catch (error) {
      if (!this.isMissingActionLevelError(error)) {
        throw error;
      }

      const sdk = await this.generateSdkAccessToken(userId, {
        lang: options?.lang,
      });

      return {
        applicantId,
        actionId: null,
        actionLevelName: null,
        sdk,
        requiredIdDocs: null,
        mode: 'APPLICANT_LEVEL_FALLBACK',
      };
    }
  }

  async uploadVerificationDocument(
    applicantId: string,
    metadata: {
      idDocType: string;
      country: string;
      idDocSubType?: string;
      firstName?: string;
      lastName?: string;
      middleName?: string;
      number?: string;
      issuedDate?: string;
      validUntil?: string;
      dob?: string;
    },
    file: Express.Multer.File,
  ) {
    const multipart = this.buildMultipartBody({ metadata, file });

    return this.sumsubRequest<SumsubUploadDocumentResponse>(
      'POST',
      `/resources/applicants/${encodeURIComponent(applicantId)}/info/idDoc`,
      {
        body: multipart.body,
        contentType: multipart.contentType,
        additionalHeaders: {
          'X-Return-Doc-Warnings': 'true',
        },
      },
    );
  }

  async requestApplicantCheck(applicantId: string, reason?: string) {
    const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : '';

    return this.sumsubRequest<Record<string, unknown>>(
      'POST',
      `/resources/applicants/${encodeURIComponent(applicantId)}/status/pending${suffix}`,
    );
  }

  async getApplicantStatus(applicantId: string) {
    return this.sumsubRequest<Record<string, any>>(
      'GET',
      `/resources/applicants/${encodeURIComponent(applicantId)}/status`,
    );
  }

  async getVerificationStepsStatus(applicantId: string) {
    return this.sumsubRequest<Record<string, any>>(
      'GET',
      `/resources/applicants/${encodeURIComponent(applicantId)}/requiredIdDocsStatus`,
    );
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

    let status = this.statusFromWebhook(payload);
    let rejectionReason = this.rejectionReasonFromWebhook(payload);
    const duplicateReason =
      payload.applicantId && payload.type !== 'applicantActionReviewed'
        ? await this.duplicateReasonFromApplicant(payload.applicantId)
        : null;

    if (duplicateReason) {
      status = VerificationStatus.REJECTED;
      rejectionReason = duplicateReason;
    }

    const nextUserStatus = this.userStatusFromWebhook(payload, status);
    const isLivenessEvent =
      payload.type === 'applicantActionReviewed' ||
      Boolean(payload.actionId || payload.applicantActionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          vendorApplicantId: payload.applicantId,
          verificationStatus: status,
          rejectionReason,
          reviewedAt: this.isFinalReview(payload) ? new Date() : undefined,
          status: nextUserStatus,
        },
      });

      const latestVerification = await tx.kycVerification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestVerification) {
        await tx.kycVerification.update({
          where: { id: latestVerification.id },
          data: {
            applicantId: payload.applicantId ?? latestVerification.applicantId,
            actionId:
              payload.actionId ??
              payload.applicantActionId ??
              latestVerification.actionId,
            actionType: isLivenessEvent
              ? 'LIVENESS_FACE_MATCH'
              : latestVerification.actionType,
            status,
            reviewStatus: payload.reviewStatus ?? latestVerification.reviewStatus,
            reviewAnswer:
              payload.reviewResult?.reviewAnswer ??
              latestVerification.reviewAnswer,
            rejectionReason,
            isLivenessValid:
              isLivenessEvent && payload.reviewResult?.reviewAnswer === 'GREEN'
                ? true
                : latestVerification.isLivenessValid,
            reviewedAt: this.isFinalReview(payload) ? new Date() : undefined,
          },
        });
      }
    });

    if (payload.applicantId) {
      await this.syncApplicantDocumentData(userId, payload.applicantId).catch(
        () => undefined,
      );
    }

    return {
      received: true,
      userId,
      applicantId: payload.applicantId,
      actionId: payload.actionId ?? payload.applicantActionId,
      eventType: payload.type,
      verificationStatus: status,
    };
  }

  private async sumsubRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: SumsubRequestOptions = {},
  ): Promise<T> {
    const baseUrl =
      this.configService.get<string>('SUMSUB_BASE_URL') ||
      'https://api.sumsub.com';
    const appToken = this.configService.get<string>('SUMSUB_APP_TOKEN') || '';
    const secretKey = this.configService.get<string>('SUMSUB_SECRET_KEY') || '';

    if (this.isDummy(appToken) || this.isDummy(secretKey)) {
      throw new BadRequestException(
        'Sumsub is not configured. Replace dummy SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY in .env.',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.signRequest(
      timestamp,
      method,
      path,
      options.body,
      secretKey,
    );

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'X-App-Token': appToken,
        'X-App-Access-Ts': timestamp,
        'X-App-Access-Sig': signature,
        ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
        ...(options.additionalHeaders || {}),
      },
      body:
        typeof options.body === 'undefined'
          ? undefined
          : (options.body as BodyInit),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const upstreamMessage =
        data?.description ||
        data?.message ||
        data?.error ||
        `Sumsub request failed with status ${response.status}`;

      throw new InternalServerErrorException({
        message: upstreamMessage,
        statusCode: response.status,
        error: data,
      });
    }

    return data as T;
  }

  private signRequest(
    timestamp: string,
    method: string,
    path: string,
    body: string | Buffer | undefined,
    secretKey: string,
  ) {
    const hmac = createHmac('sha256', secretKey);
    hmac.update(`${timestamp}${method}${path}`);

    if (body) {
      hmac.update(body);
    }

    return hmac.digest('hex');
  }

  private buildMultipartBody({
    metadata,
    file,
  }: {
    metadata: Record<string, unknown>;
    file: Express.Multer.File;
  }) {
    const boundary = `----sumsub-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const metadataPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify(
        metadata,
      )}\r\n`,
    );
    const fileHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="content"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`,
    );
    const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([
      metadataPart,
      fileHeader,
      file.buffer,
      fileFooter,
    ]);

    return {
      body,
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  private async duplicateReasonFromApplicant(applicantId: string) {
    const response = await this.sumsubRequest<SumsubDuplicateCheckResponse>(
      'GET',
      `/resources/checks/latest?type=SIMILAR_SEARCH&applicantId=${encodeURIComponent(applicantId)}`,
    ).catch(() => null);

    const latestCheck = response?.checks?.[0];
    const hits = latestCheck?.similarSearchInfo?.duplicateApplicantHits || [];

    if (
      latestCheck?.answer === 'RED' ||
      latestCheck?.similarSearchInfo?.answer === 'RED'
    ) {
      const hasImageDuplicate = hits.some((hit) =>
        (hit.types || []).some((type) => type.toLowerCase() === 'image'),
      );
      const hasTextDuplicate = hits.some((hit) =>
        (hit.types || []).some((type) => type.toLowerCase() === 'text'),
      );

      if (hasImageDuplicate && hasTextDuplicate) {
        return 'Duplicate identity detected. This face and document are already linked to another account.';
      }

      if (hasImageDuplicate) {
        return 'Duplicate face detected. This face is already linked to another account.';
      }

      if (hasTextDuplicate) {
        return 'Duplicate document identity detected. This document is already linked to another account.';
      }

      return 'Duplicate identity detected. This identity is already linked to another account.';
    }

    return null;
  }

  private async syncApplicantDocumentData(userId: string, applicantId: string) {
    const idDocs = await this.sumsubRequest<SumsubIdDocResponse>(
      'GET',
      `/resources/applicants/${encodeURIComponent(applicantId)}/info/idDocs`,
    ).catch(() => null);

    if (!idDocs?.length) {
      return;
    }

    const latestVerification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestVerification) {
      return;
    }

    const extractedDoc = idDocs[0];
    const normalizedExtractedData = {
      idDocType: extractedDoc.idDocType || null,
      country: extractedDoc.country || null,
      number: extractedDoc.number || null,
      firstName: extractedDoc.firstName || null,
      lastName: extractedDoc.lastName || null,
      middleName: extractedDoc.middleName || null,
      dob: extractedDoc.dob || null,
      applicantId,
    };

    await this.prisma.kycVerification.update({
      where: { id: latestVerification.id },
      data: {
        applicantId,
        sumsubIdDocType:
          extractedDoc.idDocType || latestVerification.sumsubIdDocType,
        countryCode: extractedDoc.country || latestVerification.countryCode,
      },
    });

    await this.prisma.kycDocument.updateMany({
      where: { kycVerificationId: latestVerification.id },
      data: {
        extractedData: normalizedExtractedData,
      },
    });
  }

  private verifyWebhookSignature(
    rawBody: Buffer,
    digest?: string,
    digestAlg = 'HMAC_SHA256_HEX',
  ) {
    const secretKey =
      this.configService.get<string>('SUMSUB_WEBHOOK_SECRET') || '';
    const allowUnsignedDevWebhook =
      this.configService.get<string>('NODE_ENV') === 'development' &&
      this.isDummy(secretKey);

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

  private webhookDigestAlgorithm(
    digestAlg: string,
  ): 'sha1' | 'sha256' | 'sha512' {
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

    if (
      payload.type === 'applicantPending' ||
      payload.reviewStatus === 'pending'
    ) {
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

    const rejectLabels = payload.reviewResult.rejectLabels || [];
    const normalizedLabels = rejectLabels.map((label) => label.toLowerCase());
    const moderationComment =
      payload.reviewResult.moderationComment?.toLowerCase() || '';
    const clientComment =
      payload.reviewResult.clientComment?.toLowerCase() || '';
    const combinedText = `${normalizedLabels.join(' ')} ${moderationComment} ${clientComment}`;

    if (
      combinedText.includes('duplicate') ||
      combinedText.includes('already used') ||
      combinedText.includes('already exists')
    ) {
      return 'Duplicate identity detected. This document or face is already associated with another account.';
    }

    if (
      combinedText.includes('face mismatch') ||
      combinedText.includes('facial mismatch') ||
      combinedText.includes('selfie mismatch') ||
      combinedText.includes('different person') ||
      combinedText.includes('look-alike')
    ) {
      return 'Document owner and live face do not match. Verification failed.';
    }

    return (
      payload.reviewResult.moderationComment ||
      payload.reviewResult.rejectLabels?.join(', ') ||
      payload.reviewResult.clientComment ||
      'Sumsub verification rejected'
    );
  }

  private isFinalReview(payload: SumsubWebhookPayload) {
    return (
      payload.type === 'applicantReviewed' ||
      payload.type === 'applicantActionReviewed' ||
      Boolean(payload.reviewResult?.reviewAnswer)
    );
  }

  private userStatusFromWebhook(
    payload: SumsubWebhookPayload,
    status: VerificationStatus,
  ): UserStatus | undefined {
    if (status === VerificationStatus.APPROVED) {
      return UserStatus.ACTIVE;
    }

    if (status === VerificationStatus.REJECTED) {
      return payload.reviewResult?.reviewRejectType === 'RETRY'
        ? UserStatus.PENDING
        : UserStatus.BLOCKED;
    }

    if (
      payload.type === 'applicantCreated' ||
      payload.type === 'applicantPending' ||
      payload.reviewStatus === 'pending'
    ) {
      return UserStatus.PENDING;
    }

    return undefined;
  }

  private async getEligibleUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
        verificationStatus: true,
        vendorApplicantId: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role !== UserRole.PARENT && user.role !== UserRole.NANNY) {
      throw new BadRequestException(
        'Sumsub verification is only available for Parent and Nanny users',
      );
    }

    return user;
  }

  private levelNameForRole(role: UserRole) {
    if (role === UserRole.NANNY) {
      return (
        this.configService.get<string>('SUMSUB_NANNY_LEVEL_NAME') ||
        this.configService.get<string>('SUMSUB_LEVEL_NAME') ||
        'nanny-basic-kyc'
      );
    }

    return (
      this.configService.get<string>('SUMSUB_PARENT_LEVEL_NAME') ||
      this.configService.get<string>('SUMSUB_LEVEL_NAME') ||
      'parent-basic-kyc'
    );
  }

  private actionLevelNameForRole(role: UserRole) {
    if (role === UserRole.NANNY) {
      return (
        this.configService.get<string>('SUMSUB_NANNY_ACTION_LEVEL_NAME') ||
        this.configService.get<string>('SUMSUB_ACTION_LEVEL_NAME') ||
        this.configService.get<string>('SUMSUB_LIVENESS_LEVEL_NAME') ||
        'kyc-liveness-face-match'
      );
    }

    return (
      this.configService.get<string>('SUMSUB_PARENT_ACTION_LEVEL_NAME') ||
      this.configService.get<string>('SUMSUB_ACTION_LEVEL_NAME') ||
      this.configService.get<string>('SUMSUB_LIVENESS_LEVEL_NAME') ||
      'kyc-liveness-face-match'
    );
  }

  private isMissingActionLevelError(error: unknown) {
    const response = (error as any)?.response;
    const payload = response?.error || response || {};
    const message = JSON.stringify(payload).toLowerCase();

    return (
      message.includes('level') &&
      (message.includes('not found') || message.includes('not suitable for actions'))
    );
  }

  private customizationNameForRole(role: UserRole) {
    if (role === UserRole.NANNY) {
      return (
        this.configService.get<string>('SUMSUB_NANNY_CUSTOMIZATION_NAME') || null
      );
    }

    return (
      this.configService.get<string>('SUMSUB_PARENT_CUSTOMIZATION_NAME') || null
    );
  }

  private isDummy(value: string) {
    return !value || value.toLowerCase().startsWith('dummy_');
  }
}
