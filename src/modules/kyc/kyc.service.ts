import {
  BadRequestException,
  Injectable,
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
  constructor(
    private readonly prisma: PrismaService,
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
      const sumsubResponse = await this.sumsubService.uploadVerificationDocument(
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

    const applicantStatus = await this.sumsubService
      .getApplicantStatus(applicantId)
      .catch(() => null);
    const remoteReviewStatus = String(
      applicantStatus?.reviewStatus ||
        applicantStatus?.review?.reviewStatus ||
        '',
    ).toLowerCase();

    if (
      remoteReviewStatus !== 'pending' &&
      remoteReviewStatus !== 'queued' &&
      remoteReviewStatus !== 'prechecked'
    ) {
      try {
        await this.sumsubService.requestApplicantCheck(
          applicantId,
          'custom-ui-document-submission',
        );
      } catch (error) {
        if (!this.isAlreadyPendingSumsubError(error)) {
          throw error;
        }
      }
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
      message: 'Verification review requested from Sumsub',
      data: {
        applicantId,
        verification: updated,
        summary: buildKycSummary(updated),
      },
    };
  }

  async createLivenessAction(
    userId: string,
    dto: CreateLivenessActionDto = {},
  ) {
    const verification = await this.getLatestVerificationOrFail(userId);
    const action = await this.sumsubService.createLivenessAction(userId, {
      lang: dto.lang,
    });

    const updated = await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: {
        applicantId: action.applicantId,
        actionId: action.actionId,
        actionType: 'LIVENESS_FACE_MATCH',
      },
      include: { documents: true },
    });

    return {
      success: true,
      data: {
        actionId: action.actionId,
        actionLevelName: action.actionLevelName,
        applicantId: action.applicantId,
        sdk: action.sdk,
        requiredIdDocs: action.requiredIdDocs,
        summary: buildKycSummary(updated),
      },
    };
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

    return {
      success: true,
      data: {
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

    const sumsubIdDocType = dto.sumsubIdDocType?.trim() || option.sumsubIdDocType;

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
      message.includes('prechecked')
    );
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
