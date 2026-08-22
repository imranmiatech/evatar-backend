import { DocumentType, IdentityDocType, VerificationStatus } from '@prisma/client';

type KycDocumentLike = {
  id?: string;
  type: DocumentType | string;
  fileUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: Date;
};

type KycVerificationLike = {
  id?: string;
  docType: IdentityDocType;
  status: VerificationStatus;
  rejectionReason?: string | null;
  faceMatchScore?: number | null;
  isLivenessValid?: boolean | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  documents?: KycDocumentLike[];
};

function hasDocumentFiles(
  docType: IdentityDocType,
  documents: KycDocumentLike[],
) {
  if (docType === IdentityDocType.PASSPORT) {
    const passportDocumentTypes: DocumentType[] = [
      DocumentType.PASSPORT_PAGE,
      DocumentType.DOCUMENT_FILE,
    ];
    return documents.some((doc) =>
      passportDocumentTypes.includes(doc.type as DocumentType),
    );
  }

  const singleFileTypes: DocumentType[] = [
    DocumentType.PASSPORT,
    DocumentType.DOCUMENT_FILE,
  ];
  const frontTypes: DocumentType[] = [
    DocumentType.NID_FRONT,
    DocumentType.DOCUMENT_FRONT,
  ];
  const backTypes: DocumentType[] = [
    DocumentType.NID_BACK,
    DocumentType.DOCUMENT_BACK,
  ];

  const hasSingleFile = documents.some((doc) =>
    singleFileTypes.includes(doc.type as DocumentType),
  );
  const hasFront = documents.some((doc) =>
    frontTypes.includes(doc.type as DocumentType),
  );
  const hasBack = documents.some((doc) =>
    backTypes.includes(doc.type as DocumentType),
  );

  return hasSingleFile || hasFront || hasBack;
}

function hasSelfie(documents: KycDocumentLike[]) {
  return documents.some((doc) => doc.type === DocumentType.SELFIE);
}

function stageStatus(
  submitted: boolean,
  overallStatus: VerificationStatus,
  approvedCondition = false,
) {
  if (!submitted) {
    return 'NOT_SUBMITTED';
  }

  if (overallStatus === VerificationStatus.REJECTED) {
    return 'REJECTED';
  }

  if (approvedCondition || overallStatus === VerificationStatus.APPROVED) {
    return 'APPROVED';
  }

  if (
    overallStatus === VerificationStatus.UNDER_REVIEW ||
    overallStatus === VerificationStatus.DOCUMENTS_SUBMITTED
  ) {
    return 'UNDER_REVIEW';
  }

  return 'SUBMITTED';
}

export function buildKycSummary(verification?: KycVerificationLike | null) {
  const documents = verification?.documents ?? [];
  const docType = verification?.docType ?? IdentityDocType.PASSPORT;
  const overallStatus = verification?.status ?? VerificationStatus.PENDING;
  const documentSubmitted = hasDocumentFiles(docType, documents);
  const selfieSubmitted = hasSelfie(documents);
  const faceApproved =
    Boolean(verification?.isLivenessValid) &&
    typeof verification?.faceMatchScore === 'number' &&
    verification.faceMatchScore > 0;

  return {
    overall: {
      status: overallStatus,
      isVerified: overallStatus === VerificationStatus.APPROVED,
      rejectionReason: verification?.rejectionReason ?? null,
      submittedAt: verification?.submittedAt ?? verification?.createdAt ?? null,
      reviewedAt: verification?.reviewedAt ?? null,
    },
    document: {
      docType,
      status: stageStatus(documentSubmitted, overallStatus),
      isSubmitted: documentSubmitted,
      isVerified:
        documentSubmitted && overallStatus === VerificationStatus.APPROVED,
      submittedAt: verification?.submittedAt ?? verification?.createdAt ?? null,
    },
    face: {
      status: stageStatus(selfieSubmitted, overallStatus, faceApproved),
      isSubmitted: selfieSubmitted,
      isVerified:
        selfieSubmitted && overallStatus === VerificationStatus.APPROVED,
      isLivenessValid: Boolean(verification?.isLivenessValid),
      faceMatchScore: verification?.faceMatchScore ?? null,
    },
  };
}
