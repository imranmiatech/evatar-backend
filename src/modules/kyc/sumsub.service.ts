import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
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

type NormalizedSumsubIdentityStep = {
  country: string | null;
  idDocType: string | null;
  imageCount: number;
  imageIds: Array<string | number>;
  reviewResult: Record<string, unknown> | null;
};

type NormalizedSumsubSelfieStep = {
  status: string;
  isSubmitted: boolean;
  required: boolean;
  imageIds: Array<string | number>;
  reviewResult: Record<string, unknown> | null;
  livenessResult: string | null;
};

@Injectable()
export class SumsubService implements OnModuleInit {
  private readonly logger = new Logger(SumsubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.validateConfiguredActionLevels();
  }

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

    this.logger.log(
      `[SDK Access Token Created] userId: ${user.id} | applicantId: ${applicantId} | levelName: ${levelName} | ttlInSecs: ${ttlInSecs}`,
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
    const actionLevelConfig = this.actionLevelConfigForRole(user.role);

    if (!actionLevelName) {
      throw new BadRequestException(this.missingActionLevelMessage(user.role));
    }

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
        externalActionId,
        actionLevelName,
        sdk,
        requiredIdDocs: action.requiredIdDocs ?? null,
        mode: 'ACTION',
      };
    } catch (error) {
      if (!this.isMissingActionLevelError(error)) {
        throw error;
      }

      this.logger.warn(
        `[Liveness Action Fallback] applicantId: ${applicantId} | actionLevelName: ${actionLevelName} | configuredSource: ${actionLevelConfig.source || 'N/A'} | configuredValue: ${actionLevelConfig.value || 'N/A'} | reason: Sumsub rejected the configured level for applicant actions, continuing with the applicant standard level WebSDK flow`,
      );

      const sdk = await this.generateSdkAccessToken(userId, {
        lang: options?.lang,
      });

      return {
        applicantId,
        actionId: null,
        externalActionId: null,
        actionLevelName: null,
        sdk,
        requiredIdDocs: null,
        mode: 'APPLICANT_LEVEL_CONTINUATION',
        fallbackReason: `Configured action level "${actionLevelName}" from ${actionLevelConfig.source || 'unknown source'} is not an Applicant actions level. Continuing with the applicant standard level so WebSDK can complete the remaining selfie/liveness step.`,
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
    this.logger.log(
      `[Document Upload Request] applicantId: ${applicantId} | idDocType: ${metadata.idDocType} | country: ${metadata.country} | fileName: ${file.originalname}`,
    );

    const multipart = this.buildMultipartBody({ metadata, file });

    const res = await this.sumsubRequest<SumsubUploadDocumentResponse>(
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

    this.logger.log(
      `[Document Upload Result] applicantId: ${applicantId} | imageId: ${res.imageId || 'N/A'} | warnings: ${res.warnings?.length || 0}`,
    );

    return res;
  }

  async requestApplicantCheck(applicantId: string, reason?: string) {
    const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : '';

    return this.sumsubRequest<Record<string, unknown>>(
      'POST',
      `/resources/applicants/${encodeURIComponent(applicantId)}/status/pending${suffix}`,
    );
  }

  async getApplicantStatus(applicantId: string) {
    const res = await this.sumsubRequest<Record<string, any>>(
      'GET',
      `/resources/applicants/${encodeURIComponent(applicantId)}/status`,
    );

    const safeStatusPayload = {
      reviewStatus: res?.reviewStatus || res?.review?.reviewStatus || 'init',
      reviewResult: res?.reviewResult || res?.review?.reviewResult || null,
      reviewAnswer: res?.reviewResult?.reviewAnswer || 'N/A',
      rejectLabels: res?.reviewResult?.rejectLabels || [],
      moderationComment: res?.reviewResult?.moderationComment || null,
      clientComment: res?.reviewResult?.clientComment || null,
    };

    this.logger.log(
      `[SUMSUB STATUS] applicantId: ${applicantId} | ${JSON.stringify(safeStatusPayload)}`,
    );

    return res;
  }

  async getVerificationStepsStatus(applicantId: string) {
    const res = await this.sumsubRequest<Record<string, any>>(
      'GET',
      `/resources/applicants/${encodeURIComponent(applicantId)}/requiredIdDocsStatus`,
    );

    const identityRaw =
      res?.IDENTITY || res?.IDENTITY_CARD || res?.PASSPORT || null;
    const selfieRaw = res?.SELFIE || null;

    const identityStep = this.normalizeIdentityStep(identityRaw);
    const selfieStep = this.normalizeSelfieStep(selfieRaw);

    const safeDocsPayload = {
      IDENTITY: identityStep,
      SELFIE: selfieStep,
    };

    this.logger.log(
      `[SUMSUB REQUIRED ID DOCS STATUS] applicantId: ${applicantId} | ${JSON.stringify(safeDocsPayload)}`,
    );

    return {
      ...res,
      IDENTITY: identityStep,
      SELFIE: selfieStep,
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
    const isApproved = status === VerificationStatus.APPROVED;
    const reviewAnswer = payload.reviewResult?.reviewAnswer || 'N/A';
    const rejectLabels = payload.reviewResult?.rejectLabels || [];

    this.logger.log(
      `[APPLICANT STATUS] applicantId: ${payload.applicantId} | eventType: ${payload.type} | reviewStatus: ${payload.reviewStatus || 'pending'} | reviewAnswer: ${reviewAnswer}`,
    );

    if (
      payload.type === 'applicantReviewed' ||
      payload.type === 'applicantActionReviewed' ||
      reviewAnswer !== 'N/A'
    ) {
      const isFaceMatchFailed = rejectLabels.some((l) =>
        /face|selfie|match|look-alike|different/i.test(l),
      );

      this.logger.log(
        `[LIVENESS] completed for applicantId: ${payload.applicantId} | livenessAnswer: ${reviewAnswer} | labels: ${
          rejectLabels.join(', ') || 'NONE'
        }`,
      );
      const faceMatchResult = isApproved
        ? 'MATCH'
        : isFaceMatchFailed || reviewAnswer === 'RED'
          ? 'NO_MATCH'
          : 'PENDING';

      this.logger.log(
        `[FACE MATCH] result: ${faceMatchResult} for applicantId: ${payload.applicantId} | labels: ${
          rejectLabels.join(', ') || 'NONE'
        }`,
      );
      this.logger.log(
        `[APPLICANT STATUS] applicantId: ${payload.applicantId} | reviewStatus: ${payload.reviewStatus || 'completed'} | reviewAnswer: ${reviewAnswer}`,
      );
      this.logger.log(
        `[FINAL KYC RESULT] for applicantId: ${payload.applicantId} | status: ${status} | userStatus: ${
          nextUserStatus || 'UNCHANGED'
        } | rejectionReason: "${rejectionReason || 'None'}"`,
      );
    }

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
            actionType: 'UNIFIED_DOC_LIVENESS_FACE_MATCH',
            status,
            reviewStatus:
              payload.reviewStatus ?? latestVerification.reviewStatus,
            reviewAnswer:
              payload.reviewResult?.reviewAnswer ??
              latestVerification.reviewAnswer,
            rejectionReason,
            isLivenessValid: isApproved
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

    this.logger.log(`[Sumsub Request] ${method} ${path}`);

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
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { rawText: text };
    }

    if (!response.ok) {
      const errorCode =
        data?.errorCode || data?.code || data?.errorName || 'SUMSUB_API_ERROR';
      const upstreamMessage =
        data?.description ||
        data?.message ||
        data?.error ||
        `Sumsub request failed with status ${response.status}`;

      this.logger.error(
        `[Sumsub API Error] ${method} ${path} | Status: ${response.status} | Code: ${errorCode} | Message: ${upstreamMessage} | Data: ${JSON.stringify(
          data,
        )}`,
      );

      throw new HttpException(
        {
          statusCode: response.status,
          message: `Sumsub API error (${response.status}): ${upstreamMessage}`,
          error: 'SumsubApiError',
          sumsubErrorCode: errorCode,
          sumsubDescription: upstreamMessage,
          endpoint: path,
          rawSumsubResponse: data,
        },
        response.status >= 400 && response.status < 500
          ? response.status
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(
      `[Sumsub Response OK] ${method} ${path} | Status: ${response.status}`,
    );

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
      throw new UnauthorizedException(
        'Sumsub webhook secret is not configured',
      );
    }

    if (!digest) {
      throw new UnauthorizedException('Missing Sumsub webhook digest');
    }

    const algorithm = this.webhookDigestAlgorithm(digestAlg);
    const expected = createHmac(algorithm, secretKey)
      .update(rawBody)
      .digest('hex');
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
      combinedText.includes('selfie_match_failed') ||
      combinedText.includes('facial_match_failed') ||
      combinedText.includes('different person') ||
      combinedText.includes('look-alike') ||
      combinedText.includes('liveness_failed') ||
      combinedText.includes('face_not_matched')
    ) {
      return 'Live face verification or document face match failed. The person holding the document does not match the photo on the document.';
    }

    if (
      combinedText.includes('invalid') ||
      combinedText.includes('unsupported') ||
      combinedText.includes('bad_quality') ||
      combinedText.includes('illegible') ||
      combinedText.includes('document_page_missing') ||
      combinedText.includes('expired')
    ) {
      return 'Submitted identity document is invalid, illegible, or expired.';
    }

    return (
      payload.reviewResult.moderationComment ||
      payload.reviewResult.rejectLabels?.join(', ') ||
      payload.reviewResult.clientComment ||
      'Sumsub identity verification failed or rejected'
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

  private normalizeIdentityStep(
    identityRaw: Record<string, any> | null,
  ): NormalizedSumsubIdentityStep | null {
    if (!identityRaw) {
      return null;
    }

    const imageIds = Array.isArray(identityRaw.imageIds)
      ? identityRaw.imageIds
      : [];

    return {
      country: identityRaw.country || null,
      idDocType: identityRaw.idDocType || null,
      imageCount: imageIds.length || Number(identityRaw.imageCount || 0),
      imageIds,
      reviewResult:
        identityRaw.reviewResult && typeof identityRaw.reviewResult === 'object'
          ? identityRaw.reviewResult
          : null,
    };
  }

  private normalizeSelfieStep(
    selfieRaw: Record<string, any> | null,
  ): NormalizedSumsubSelfieStep {
    if (!selfieRaw) {
      return {
        status: 'not_submitted',
        isSubmitted: false,
        required: true,
        imageIds: [],
        reviewResult: null,
        livenessResult: null,
      };
    }

    const imageIds = Array.isArray(selfieRaw.imageIds)
      ? selfieRaw.imageIds
      : [];
    const reviewResult =
      selfieRaw.reviewResult && typeof selfieRaw.reviewResult === 'object'
        ? selfieRaw.reviewResult
        : null;
    const rawStatus = String(selfieRaw.status || '').toLowerCase();
    const explicitSubmission =
      selfieRaw.isSubmitted === true ||
      selfieRaw.isAccepted === true ||
      selfieRaw.required === false;
    const statusImpliesSubmission =
      rawStatus !== '' && rawStatus !== 'not_submitted' && rawStatus !== 'init';
    const isSelfieSubmitted = Boolean(
      explicitSubmission ||
      statusImpliesSubmission ||
      imageIds.length > 0 ||
      (reviewResult && Object.keys(reviewResult).length > 0),
    );

    return {
      status: isSelfieSubmitted ? 'provided' : rawStatus || 'not_submitted',
      isSubmitted: isSelfieSubmitted,
      required: selfieRaw.required !== false,
      imageIds,
      reviewResult,
      livenessResult:
        selfieRaw.videoAnswer || selfieRaw.reviewResult?.reviewAnswer || null,
    };
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
    const genericCandidates =
      role === UserRole.NANNY
        ? [
            this.configService.get<string>('SUMSUB_ACTION_LEVEL_NAME'),
            this.configService.get<string>('SUMSUB_NANNY_ACTION_LEVEL_NAME'),
            this.configService.get<string>('SUMSUB_LIVENESS_LEVEL_NAME'),
          ]
        : [
            this.configService.get<string>('SUMSUB_ACTION_LEVEL_NAME'),
            this.configService.get<string>('SUMSUB_PARENT_ACTION_LEVEL_NAME'),
            this.configService.get<string>('SUMSUB_LIVENESS_LEVEL_NAME'),
          ];

    const invalidLevels = new Set(
      [
        this.configService.get<string>('SUMSUB_PARENT_LEVEL_NAME'),
        this.configService.get<string>('SUMSUB_NANNY_LEVEL_NAME'),
        this.configService.get<string>('SUMSUB_LEVEL_NAME'),
        'parent-basic-kyc',
        'nanny-basic-kyc',
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase()),
    );

    for (const candidate of genericCandidates) {
      const normalized = String(candidate || '').trim();
      if (!normalized) {
        continue;
      }

      const candidateLower = normalized.toLowerCase();
      if (
        invalidLevels.has(candidateLower) ||
        candidateLower.includes('basic-kyc')
      ) {
        this.logger.warn(
          `[Sumsub Action Level Ignored] role: ${role} | configuredValue: ${normalized} | reason: applicant/document verification levels cannot be used for liveness actions`,
        );
        continue;
      }

      return normalized;
    }

    return null;
  }

  private actionLevelConfigForRole(role: UserRole) {
    const candidates =
      role === UserRole.NANNY
        ? [
            {
              source: 'SUMSUB_ACTION_LEVEL_NAME',
              value: this.configService.get<string>('SUMSUB_ACTION_LEVEL_NAME'),
            },
            {
              source: 'SUMSUB_NANNY_ACTION_LEVEL_NAME',
              value: this.configService.get<string>(
                'SUMSUB_NANNY_ACTION_LEVEL_NAME',
              ),
            },
            {
              source: 'SUMSUB_LIVENESS_LEVEL_NAME',
              value: this.configService.get<string>(
                'SUMSUB_LIVENESS_LEVEL_NAME',
              ),
            },
          ]
        : [
            {
              source: 'SUMSUB_ACTION_LEVEL_NAME',
              value: this.configService.get<string>('SUMSUB_ACTION_LEVEL_NAME'),
            },
            {
              source: 'SUMSUB_PARENT_ACTION_LEVEL_NAME',
              value: this.configService.get<string>(
                'SUMSUB_PARENT_ACTION_LEVEL_NAME',
              ),
            },
            {
              source: 'SUMSUB_LIVENESS_LEVEL_NAME',
              value: this.configService.get<string>(
                'SUMSUB_LIVENESS_LEVEL_NAME',
              ),
            },
          ];

    for (const candidate of candidates) {
      const normalized = String(candidate.value || '').trim();
      if (!normalized) {
        continue;
      }

      return {
        source: candidate.source,
        value: normalized,
      };
    }

    return {
      source: null,
      value: null,
    };
  }

  private isMissingActionLevelError(error: unknown) {
    const response = (error as any)?.response;
    const payload = response?.error || response || {};
    const message = JSON.stringify(payload).toLowerCase();

    return (
      message.includes('level') &&
      (message.includes('not found') ||
        message.includes('not suitable for actions'))
    );
  }

  private customizationNameForRole(role: UserRole) {
    if (role === UserRole.NANNY) {
      return (
        this.configService.get<string>('SUMSUB_NANNY_CUSTOMIZATION_NAME') ||
        null
      );
    }

    return (
      this.configService.get<string>('SUMSUB_PARENT_CUSTOMIZATION_NAME') || null
    );
  }

  private isDummy(value: string) {
    return !value || value.toLowerCase().startsWith('dummy_');
  }

  private validateConfiguredActionLevels() {
    const parentLevel = this.actionLevelNameForRole(UserRole.PARENT);
    const nannyLevel = this.actionLevelNameForRole(UserRole.NANNY);

    if (!parentLevel) {
      this.logger.warn(
        `[Sumsub Config Warning] No valid parent liveness action level configured. Set SUMSUB_PARENT_ACTION_LEVEL_NAME or SUMSUB_ACTION_LEVEL_NAME to an existing Sumsub action-capable level.`,
      );
    }

    if (!nannyLevel) {
      this.logger.warn(
        `[Sumsub Config Warning] No valid nanny liveness action level configured. Set SUMSUB_NANNY_ACTION_LEVEL_NAME or SUMSUB_ACTION_LEVEL_NAME to an existing Sumsub action-capable level.`,
      );
    }
  }

  private missingActionLevelMessage(role: UserRole) {
    const roleLabel = role === UserRole.NANNY ? 'nanny' : 'parent';
    const roleSpecificEnv =
      role === UserRole.NANNY
        ? 'SUMSUB_NANNY_ACTION_LEVEL_NAME'
        : 'SUMSUB_PARENT_ACTION_LEVEL_NAME';

    return `No valid Sumsub ${roleLabel} liveness action level is configured. Set ${roleSpecificEnv}, SUMSUB_ACTION_LEVEL_NAME, or SUMSUB_LIVENESS_LEVEL_NAME to an existing action-capable Sumsub level. Applicant KYC levels like parent-basic-kyc or nanny-basic-kyc cannot be used for liveness actions.`;
  }
}
