import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType, IdentityDocType, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

type KycUploadFiles = {
  passport?: Express.Multer.File[];
  nidFront?: Express.Multer.File[];
  nidBack?: Express.Multer.File[];
};

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async submitDocuments(
    userId: string,
    docType: IdentityDocType,
    files: KycUploadFiles,
  ) {
    const documents = this.documentsFromFiles(docType, files);

    const verification = await this.prisma.kycVerification.create({
      data: {
        userId,
        docType,
        status: VerificationStatus.PENDING,
        submittedAt: new Date(),
      },
    });

    const savedDocuments = await Promise.all(
      documents.map(async (document) => {
        const fileUrl = await this.storageService.uploadFile(
          document.file,
          'kyc-documents',
        );

        return this.prisma.kycDocument.create({
          data: {
            kycVerificationId: verification.id,
            type: document.type,
            fileUrl,
            s3Key: fileUrl,
            mimeType: document.file.mimetype,
            fileSize: document.file.size,
          },
        });
      }),
    );

    return {
      success: true,
      message: 'Documents submitted successfully',
      data: {
        ...verification,
        documents: savedDocuments,
      },
    };
  }

  async submitFaceCheck(userId: string, selfie: Express.Multer.File) {
    if (!selfie) {
      throw new BadRequestException('selfie image is required');
    }

    const verification = await this.prisma.kycVerification.findFirst({
      where: {
        userId,
        status: VerificationStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('Submit document images before face check');
    }

    const fileUrl = await this.storageService.uploadFile(
      selfie,
      'kyc-selfies',
    );

    const savedSelfie = await this.prisma.kycDocument.upsert({
      where: {
        kycVerificationId_type: {
          kycVerificationId: verification.id,
          type: DocumentType.SELFIE,
        },
      },
      update: {
        fileUrl,
        s3Key: fileUrl,
        mimeType: selfie.mimetype,
        fileSize: selfie.size,
      },
      create: {
        kycVerificationId: verification.id,
        type: DocumentType.SELFIE,
        fileUrl,
        s3Key: fileUrl,
        mimeType: selfie.mimetype,
        fileSize: selfie.size,
      },
    });

    const updatedVerification = await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: {
        isLivenessValid: true,
        faceMatchScore: 0.99,
        status: VerificationStatus.UNDER_REVIEW,
      },
      include: { documents: true },
    });

    return {
      success: true,
      message: 'Face identity submitted successfully',
      data: {
        verification: updatedVerification,
        selfie: savedSelfie,
      },
    };
  }

  async getMyDocuments(userId: string) {
    const verifications = await this.prisma.kycVerification.findMany({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: verifications,
    };
  }

  private documentsFromFiles(docType: IdentityDocType, files: KycUploadFiles) {
    if (docType === IdentityDocType.PASSPORT) {
      const passport = files.passport?.[0];
      if (!passport) {
        throw new BadRequestException('passport image is required');
      }

      return [{ type: DocumentType.PASSPORT_PAGE, file: passport }];
    }

    const nidFront = files.nidFront?.[0];
    const nidBack = files.nidBack?.[0];

    if (!nidFront || !nidBack) {
      throw new BadRequestException('nidFront and nidBack images are required');
    }

    return [
      { type: DocumentType.NID_FRONT, file: nidFront },
      { type: DocumentType.NID_BACK, file: nidBack },
    ];
  }
}
