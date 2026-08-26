import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  IdentityDocType,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import type {} from 'multer';
import {
  SUMSUB_KYC_ALLOWED_MIME_TYPES,
  SUMSUB_KYC_DOCUMENT_OPTIONS,
  getDocumentOption,
} from './constants/sumsub-kyc.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKycSessionDto } from './dto/create-kyc-session.dto';
import { CreateLivenessActionDto } from './dto/create-liveness-action.dto';
import { SubmitDocumentsDto } from './dto/submit-documents.dto';
import { MembershipStorageService } from '../membership/services/membership-storage.service';
import { SumsubService } from './sumsub.service';
import { buildKycSummary } from './utils/kyc-summary.util';

type CustomUploadFiles = {
  document?: Express.Multer.File[];
  front?: Express.Multer.File[];
  back?: Express.Multer.File[];
};

type LegacyUploadFiles = {
  passport?: Express.Multer.File[];
  nidFront?: Express.Multer.File[];
  nidBack?: Express.Multer.File[];
};

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipStorageService: MembershipStorageService,
    private readonly sumsubService: SumsubService,
  ) {}

  getFlowConfiguration() {
    return {
      success: true,
      data: {
        provider: 'sumsub',
        supportedCountries: {
          mode: 'global',
          format: 'ISO_3166_1_ALPHA3',
          note: 'Use any issuing country allowed by your Sumsub verification level and supported-documents configuration.',
        },
        documents: SUMSUB_KYC_DOCUMENT_OPTIONS,
        biometricCapabilities: {
          selfieVerification: {
            customUiPossible: false,
            requiresOfficialSdk: true,
          },
          liveness: {
            customUiPossible: false,
            requiresOfficialSdk: true,
          },
          faceMatch: {
            customUiPossible: false,
            requiresOfficialSdk: true,
          },
        },
      },
    };
  }

  async createVerificationSession(
    userId: string,
    dto: CreateKycSessionDto = {},
  ) {
    const sdk = await this.sumsubService.generateSdkAccessToken(userId, {
      lang: dto.lang,
    });
    const verification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        applicantId: sdk.applicantId,
        levelName: sdk.levelName,
        accessToken: sdk.token,
        tokenUserId: sdk.userId,
        ttlInSecs: sdk.ttlInSecs,
        verificationStatus: sdk.verificationStatus,
        customizationName: sdk.customizationName,
        summary: buildKycSummary(verification),
      },
    };
  }

  async submitDocumentsWithCustomUi(
    userId: string,
    dto: SubmitDocumentsDto,
    files: CustomUploadFiles,
  ) {
    const applicantId = await this.sumsubService.ensureApplicantProfile(userId);
    const normalized = this.normalizeDocumentSubmission(dto, files);

    await this.membershipStorageService.assertCanUploadDocuments(
      userId,
      normalized.documents.map((document) => document.file.size),
    );

    const verification = await this.prisma.kycVerification.create({
      data: {
        userId,
        applicantId,
        levelName: await this.resolveLevelName(userId),
        docType: dto.docType,
        countryCode: normalized.countryCode,
        sumsubIdDocType: normalized.sumsubIdDocType,
        status: VerificationStatus.DOCUMENTS_SUBMITTED,
        reviewStatus: 'init',
        submittedAt: new Date(),
      },
    });

    const uploadedDocuments: Array<Record<string, unknown>> = [];

    for (const document of normalized.documents) {
      const sumsubResponse =
        await this.sumsubService.uploadVerificationDocument(
          applicantId,
          {
            idDocType: normalized.sumsubIdDocType,
            country: normalized.countryCode,
            ...(document.idDocSubType
              ? { idDocSubType: document.idDocSubType }
              : {}),
          },
          document.file,
        );

      const isFront =
        !document.idDocSubType || document.idDocSubType === 'FRONT_SIDE';
      const sideTag = isFront ? '[DOCUMENT FRONT]' : '[DOCUMENT BACK]';
      this.logger.log(
        `${sideTag} completed for applicantId: ${applicantId} | docType: ${normalized.sumsubIdDocType} | imageId: ${sumsubResponse.imageId || 'N/A'}`,
      );

      const savedDocument = await this.prisma.kycDocument.create({
        data: {
          kycVerificationId: verification.id,
          type: document.type,
          side: document.idDocSubType ?? null,
          s3Key: `sumsub:${String(sumsubResponse.imageId || document.file.originalname)}`,
          vendorImageId:
            typeof sumsubResponse.imageId === 'undefined'
              ? null
              : String(sumsubResponse.imageId),
          mimeType: document.file.mimetype,
          fileSize: document.file.size,
          extractedData: sumsubResponse as Prisma.InputJsonValue,
        },
      });

      uploadedDocuments.push({
        ...savedDocument,
        uploadWarnings: sumsubResponse.warnings || [],
        uploadErrors: sumsubResponse.errors || [],
      });
    }

    const updatedVerification =
      await this.prisma.kycVerification.findUniqueOrThrow({
        where: { id: verification.id },
        include: { documents: true },
      });

    return {
      success: true,
      message: 'Documents submitted to Sumsub successfully',
      data: {
        applicantId,
        verification: updatedVerification,
        documents: uploadedDocuments,
        summary: buildKycSummary(updatedVerification),
      },
    };
  }

  async requestVerificationReview(userId: string) {
    const verification = await this.getLatestVerificationOrFail(userId);
    const applicantId = verification.applicantId;

    if (!applicantId) {
      throw new BadRequestException(
        'Missing Sumsub applicant. Start a KYC session before requesting review.',
      );
    }

    this.logger.log(
      `[KYC Review Request] userId: ${userId} | applicantId: ${applicantId} | docType: ${verification.docType} | levelName: ${verification.levelName}`,
    );

    const applicantStatus = await this.sumsubService
      .getApplicantStatus(applicantId)
      .catch((err) => {
        this.logger.warn(
          `[KYC Review Status Check Error] applicantId: ${applicantId} | message: ${err?.message}`,
        );
        return null;
      });

    const remoteReviewStatus = String(
      applicantStatus?.reviewStatus ||
        applicantStatus?.review?.reviewStatus ||
        '',
    ).toLowerCase();

    const remoteStepsStatus = await this.sumsubService
      .getVerificationStepsStatus(applicantId)
      .catch((err) => {
        this.logger.warn(
          `[KYC Review Steps Check Error] applicantId: ${applicantId} | message: ${err?.message}`,
        );
        return null;
      });

    const selfieData = remoteStepsStatus?.SELFIE;
    const isSelfieSubmitted = this.isSelfieStepSubmitted(selfieData);
    const nextRequiredStep = this.getNextRequiredStep(
      remoteStepsStatus,
      remoteReviewStatus,
    );

    let stateStr = 'A. SELFIE not submitted';
    const reviewResult = applicantStatus?.reviewResult || {};
    const reviewAnswer = String(reviewResult.reviewAnswer || '').toUpperCase();
    const rejectLabels = Array.isArray(reviewResult.rejectLabels)
      ? reviewResult.rejectLabels
      : [];
    const isFaceMismatch = rejectLabels.some((l: string) =>
      /face|selfie|match|look-alike|different/i.test(l),
    );

    if (remoteReviewStatus === 'completed') {
      stateStr =
        reviewAnswer === 'GREEN'
          ? 'G. Applicant approved'
          : isFaceMismatch
            ? 'D. Liveness passed, Face Match failed'
            : 'F. Applicant rejected';
    } else if (isSelfieSubmitted) {
      stateStr =
        remoteReviewStatus === 'pending' || remoteReviewStatus === 'queued'
          ? 'E. Liveness + Face Match passed, applicant review pending'
          : 'B. SELFIE submitted but Liveness pending';
    }

    this.logger.log(
      `[APPLICANT STATE] for applicantId: ${applicantId} | State: ${stateStr}`,
    );

    // If review is already pending, queued, prechecked, completed, or onhold on Sumsub, update local DB status cleanly.
    if (
      remoteReviewStatus === 'pending' ||
      remoteReviewStatus === 'queued' ||
      remoteReviewStatus === 'prechecked' ||
      remoteReviewStatus === 'completed' ||
      remoteReviewStatus === 'onhold'
    ) {
      const isApproved =
        remoteReviewStatus === 'completed' &&
        applicantStatus?.reviewResult?.reviewAnswer === 'GREEN';
      const isRejected =
        remoteReviewStatus === 'completed' &&
        applicantStatus?.reviewResult?.reviewAnswer === 'RED';

      const statusToSet = isApproved
        ? VerificationStatus.APPROVED
        : isRejected
          ? VerificationStatus.REJECTED
          : VerificationStatus.UNDER_REVIEW;

      const faceMatchResult = isApproved
        ? 'MATCH'
        : isFaceMismatch || isRejected
          ? 'NO_MATCH'
          : 'PENDING';

      this.logger.log(
        `[FACE MATCH] result: ${faceMatchResult} for applicantId: ${applicantId}`,
      );
      this.logger.log(
        `[APPLICANT STATUS] applicantId: ${applicantId} | reviewStatus: ${remoteReviewStatus} | reviewAnswer: ${applicantStatus?.reviewResult?.reviewAnswer || 'N/A'}`,
      );
      this.logger.log(
        `[FINAL KYC RESULT] for applicantId: ${applicantId} | status: ${statusToSet}`,
      );

      const updated = await this.prisma.kycVerification.update({
        where: { id: verification.id },
        data: {
          status: statusToSet,
          reviewStatus: remoteReviewStatus,
          reviewAnswer:
            applicantStatus?.reviewResult?.reviewAnswer ??
            verification.reviewAnswer,
          rejectionReason: isRejected
            ? applicantStatus?.reviewResult?.moderationComment ||
              'Verification rejected by Sumsub'
            : verification.rejectionReason,
        },
        include: { documents: true },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          verificationStatus: statusToSet,
        },
      });

      return {
        success: true,
        message: `Applicant review status is currently ${remoteReviewStatus}`,
        data: {
          applicantId,
          verification: updated,
          summary: buildKycSummary(updated),
          nextRequiredStep,
          sumsubState: {
            applicantId,
            levelName: verification.levelName,
            remoteReviewStatus,
            reviewResult: applicantStatus?.reviewResult || null,
            stepsStatus: remoteStepsStatus,
          },
        },
      };
    }

    if (!isSelfieSubmitted) {
      this.logger.log(
        `[KYC Review Guard] Skipping manual status/pending review call for applicantId: ${applicantId} because SELFIE has not been submitted yet.`,
      );
      return {
        success: true,
        message: 'Please complete the selfie/liveness verification first.',
        data: {
          applicantId,
          verification,
          summary: buildKycSummary(verification),
          nextRequiredStep,
          sumsubState: {
            applicantId,
            levelName: verification.levelName,
            remoteReviewStatus: 'init',
            stepsStatus: remoteStepsStatus,
          },
        },
      };
    }

    // Try requesting review from Sumsub
    try {
      this.logger.log(
        `[KYC Review] Requesting pending status check for applicant ${applicantId}...`,
      );
      await this.sumsubService.requestApplicantCheck(
        applicantId,
        'custom-ui-document-submission',
      );
    } catch (error: any) {
      this.logger.error(
        `[KYC Review API Error] applicantId: ${applicantId} | remoteReviewStatus: "${remoteReviewStatus}" | stepsStatus: ${JSON.stringify(
          remoteStepsStatus,
        )} | error: ${JSON.stringify(error?.response || error?.message || {})}`,
      );

      // Preserve and rethrow structured HttpExceptions so controllers expose full Sumsub error details
      throw error;
    }

    const updated = await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: {
        status: VerificationStatus.UNDER_REVIEW,
        reviewStatus: 'pending',
      },
      include: { documents: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: VerificationStatus.UNDER_REVIEW,
      },
    });

    return {
      success: true,
      message: 'Verification review requested from Sumsub successfully',
      data: {
        applicantId,
        verification: updated,
        summary: buildKycSummary(updated),
        nextRequiredStep,
        sumsubState: {
          applicantId,
          levelName: verification.levelName,
          remoteReviewStatus: 'pending',
          stepsStatus: remoteStepsStatus,
        },
      },
    };
  }

  async createLivenessAction(
    userId: string,
    dto: CreateLivenessActionDto = {},
  ) {
    this.logger.log(
      `[KYC Liveness Action Request] userId: ${userId} | lang: ${dto.lang || 'en'}`,
    );

    const action = await this.sumsubService.createLivenessAction(userId, {
      lang: dto.lang,
    });
    const verification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(
      `[KYC Liveness Action Ready] userId: ${userId} | applicantId: ${action.applicantId} | actionId: ${action.actionId || 'N/A'} | externalActionId: ${action.externalActionId || 'N/A'} | mode: ${action.mode} | actionLevelName: ${action.actionLevelName || 'N/A'} | sdkLevelName: ${action.sdk.levelName}`,
    );

    return {
      success: true,
      data: {
        actionId: action.actionId,
        externalActionId: action.externalActionId,
        actionLevelName: action.actionLevelName,
        applicantId: action.applicantId,
        sdk: action.sdk,
        requiredIdDocs: action.requiredIdDocs,
        mode: action.mode,
        fallbackReason:
          'fallbackReason' in action ? action.fallbackReason : null,
        summary: buildKycSummary(verification),
      },
    };
  }

  async logSdkEvent(
    userId: string,
    dto: { event: string; tag?: string; message?: string; data?: any },
  ) {
    const verification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const applicantId = verification?.applicantId || 'N/A';
    const tag = dto.tag || dto.event || '[WEBSDK]';
    const message = dto.message || dto.event || 'SDK event';
    const rawPayload = dto.data
      ? ` | rawPayload: ${JSON.stringify(dto.data)}`
      : '';

    this.logger.log(
      `${tag} for applicantId: ${applicantId} | ${message}${rawPayload}`,
    );

    return { success: true };
  }

  async getMyVerificationStatus(userId: string) {
    const verification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return {
        success: true,
        data: {
          status: 'PENDING',
          documentStatus: 'NOT_SUBMITTED',
          selfieStatus: 'NOT_SUBMITTED',
          livenessStatus: 'NOT_SUBMITTED',
          faceMatchStatus: 'PENDING',
          rejectLabels: [],
          message: 'No verification record found.',
          verification: null,
          summary: buildKycSummary(null),
        },
      };
    }

    const remoteStatus = verification.applicantId
      ? await this.sumsubService
          .getApplicantStatus(verification.applicantId)
          .catch(() => null)
      : null;
    const remoteSteps = verification.applicantId
      ? await this.sumsubService
          .getVerificationStepsStatus(verification.applicantId)
          .catch(() => null)
      : null;

    const overallStatus: 'PENDING' | 'APPROVED' | 'REJECTED' =
      verification.status === VerificationStatus.APPROVED
        ? 'APPROVED'
        : verification.status === VerificationStatus.REJECTED
          ? 'REJECTED'
          : 'PENDING';

    const identityStep = remoteSteps?.IDENTITY;
    const selfieStep = remoteSteps?.SELFIE;
    const isSelfieSubmitted = this.isSelfieStepSubmitted(selfieStep);
    const nextRequiredStep = this.getNextRequiredStep(
      remoteSteps,
      String(
        remoteStatus?.reviewStatus || remoteStatus?.review?.reviewStatus || '',
      ).toLowerCase(),
    );

    const isDocSubmitted =
      verification.documents.length > 0 ||
      Boolean(identityStep?.imageIds?.length || identityStep?.imageCount);

    const docStatus =
      overallStatus === 'APPROVED'
        ? 'APPROVED'
        : overallStatus === 'REJECTED' && !verification.isLivenessValid
          ? 'REJECTED'
          : isDocSubmitted
            ? 'SUBMITTED'
            : 'PENDING';

    const selfieStatus =
      overallStatus === 'APPROVED'
        ? 'APPROVED'
        : overallStatus === 'REJECTED' &&
            Boolean(
              verification.rejectionReason?.toLowerCase().includes('face'),
            )
          ? 'REJECTED'
          : isSelfieSubmitted
            ? 'SUBMITTED'
            : 'NOT_SUBMITTED';

    const livenessStatus =
      overallStatus === 'APPROVED' || verification.isLivenessValid
        ? 'PASSED'
        : overallStatus === 'REJECTED' &&
            Boolean(
              verification.rejectionReason?.toLowerCase().includes('liveness'),
            )
          ? 'FAILED'
          : isSelfieSubmitted
            ? 'PASSED'
            : 'NOT_SUBMITTED';

    const rejectLabels: string[] = Array.isArray(
      remoteStatus?.reviewResult?.rejectLabels,
    )
      ? remoteStatus.reviewResult.rejectLabels
      : [];

    const isFaceMatchFailed =
      rejectLabels.some((l: string) =>
        /face|selfie|match|look-alike|different/i.test(l),
      ) ||
      (overallStatus === 'REJECTED' &&
        Boolean(verification.rejectionReason?.toLowerCase().includes('face')));

    const faceMatchStatus =
      overallStatus === 'APPROVED'
        ? 'MATCH'
        : isFaceMatchFailed
          ? 'NO_MATCH'
          : 'PENDING';

    let message = 'Verification in progress.';
    if (overallStatus === 'APPROVED') {
      message = 'Identity verification successful.';
    } else if (overallStatus === 'REJECTED') {
      message = verification.rejectionReason || 'Identity verification failed.';
    } else if (!isSelfieSubmitted) {
      message = 'Please complete the selfie/liveness verification step.';
    } else {
      message = 'Verification is being processed.';
    }

    return {
      success: true,
      data: {
        status: overallStatus,
        documentStatus: docStatus,
        selfieStatus,
        livenessStatus,
        faceMatchStatus,
        rejectLabels,
        message,
        nextRequiredStep,
        verification,
        summary: buildKycSummary(verification),
        sumsub: {
          applicantStatus: remoteStatus,
          stepsStatus: remoteSteps,
        },
      },
    };
  }

  async submitDocuments(
    userId: string,
    docType: IdentityDocType,
    files: LegacyUploadFiles,
  ) {
    const dto: SubmitDocumentsDto = {
      docType,
      countryCode: 'BGD',
      sumsubIdDocType:
        docType === IdentityDocType.PASSPORT ? 'PASSPORT' : 'ID_CARD',
    };

    const normalizedFiles: CustomUploadFiles =
      docType === IdentityDocType.PASSPORT
        ? { document: files.passport }
        : { front: files.nidFront, back: files.nidBack };

    return this.submitDocumentsWithCustomUi(userId, dto, normalizedFiles);
  }

  private normalizeDocumentSubmission(
    dto: SubmitDocumentsDto,
    files: CustomUploadFiles,
  ) {
    const option = getDocumentOption(dto.docType);
    if (!option) {
      throw new BadRequestException('Unsupported identity document type');
    }

    const sumsubIdDocType =
      dto.sumsubIdDocType?.trim() || option.sumsubIdDocType;

    if (!sumsubIdDocType) {
      throw new BadRequestException(
        'sumsubIdDocType is required when docType is OTHER',
      );
    }

    const document = files.document?.[0];
    const front = files.front?.[0];
    const back = files.back?.[0];

    if (!document && !front) {
      throw new BadRequestException(
        'Either a single document file or a front-side file is required',
      );
    }

    const normalizedDocuments: Array<{
      type: DocumentType;
      file: Express.Multer.File;
      idDocSubType?: string;
    }> = [];

    if (document) {
      this.ensureMimeType(document.mimetype);
      normalizedDocuments.push({
        type:
          dto.docType === IdentityDocType.PASSPORT
            ? DocumentType.PASSPORT_PAGE
            : DocumentType.DOCUMENT_FILE,
        file: document,
      });
    } else if (front) {
      this.ensureMimeType(front.mimetype);
      normalizedDocuments.push({
        type:
          dto.docType === IdentityDocType.NATIONAL_ID
            ? DocumentType.NID_FRONT
            : DocumentType.DOCUMENT_FRONT,
        file: front,
        idDocSubType: 'FRONT_SIDE',
      });

      if (back) {
        this.ensureMimeType(back.mimetype);
        normalizedDocuments.push({
          type:
            dto.docType === IdentityDocType.NATIONAL_ID
              ? DocumentType.NID_BACK
              : DocumentType.DOCUMENT_BACK,
          file: back,
          idDocSubType: 'BACK_SIDE',
        });
      }
    }

    return {
      countryCode: dto.countryCode.toUpperCase(),
      sumsubIdDocType,
      documents: normalizedDocuments,
    };
  }

  private async getLatestVerificationOrFail(userId: string) {
    const verification = await this.prisma.kycVerification.findFirst({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    return verification;
  }

  private isAlreadyPendingSumsubError(error: unknown) {
    const response = (error as any)?.response;
    const payload = response?.error || response || {};
    const message = JSON.stringify(payload).toLowerCase();

    return (
      message.includes('cannot use this method') ||
      message.includes('pending') ||
      message.includes('queued') ||
      message.includes('prechecked') ||
      message.includes('completed') ||
      message.includes('onhold') ||
      message.includes('selfie') ||
      message.includes('not all required documents')
    );
  }

  private isSelfieStepSubmitted(selfieStep: any): boolean {
    if (!selfieStep) {
      return false;
    }

    if (typeof selfieStep.isSubmitted === 'boolean') {
      return selfieStep.isSubmitted;
    }

    const status = String(selfieStep.status || '').toLowerCase();
    return Boolean(
      status !== '' && status !== 'not_submitted' && status !== 'init',
    );
  }

  private getNextRequiredStep(
    remoteSteps: any,
    remoteReviewStatus: string,
  ): 'DOCUMENT' | 'SELFIE' | 'REVIEW' | 'COMPLETE' {
    const identityStep = remoteSteps?.IDENTITY;
    const selfieStep = remoteSteps?.SELFIE;
    const hasIdentity =
      Boolean(identityStep?.imageCount) ||
      Boolean(identityStep?.imageIds?.length);
    const hasSelfie = this.isSelfieStepSubmitted(selfieStep);

    if (
      remoteReviewStatus === 'completed' ||
      remoteReviewStatus === 'approved'
    ) {
      return 'COMPLETE';
    }

    if (!hasIdentity) {
      return 'DOCUMENT';
    }

    if (!hasSelfie) {
      return 'SELFIE';
    }

    return 'REVIEW';
  }

  private async resolveLevelName(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.role === 'NANNY'
      ? process.env.SUMSUB_NANNY_LEVEL_NAME ||
          process.env.SUMSUB_LEVEL_NAME ||
          'nanny-basic-kyc'
      : process.env.SUMSUB_PARENT_LEVEL_NAME ||
          process.env.SUMSUB_LEVEL_NAME ||
          'parent-basic-kyc';
  }

  private ensureMimeType(mimeType: string) {
    if (!SUMSUB_KYC_ALLOWED_MIME_TYPES.includes(mimeType as never)) {
      throw new BadRequestException(
        `Unsupported KYC document format. Allowed formats: ${SUMSUB_KYC_ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
  }
}
