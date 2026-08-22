import { DocumentType, IdentityDocType } from '@prisma/client';

export const SUMSUB_KYC_MAX_FILE_BYTES = 50 * 1024 * 1024;

export const SUMSUB_KYC_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const SUMSUB_KYC_DOCUMENT_OPTIONS = [
  {
    docType: IdentityDocType.PASSPORT,
    label: 'Passport',
    sumsubIdDocType: 'PASSPORT',
    defaultDocumentRecordType: DocumentType.DOCUMENT_FILE,
    supportsBackSide: false,
  },
  {
    docType: IdentityDocType.NATIONAL_ID,
    label: 'National ID',
    sumsubIdDocType: 'ID_CARD',
    defaultDocumentRecordType: DocumentType.DOCUMENT_FRONT,
    supportsBackSide: true,
  },
  {
    docType: IdentityDocType.ID_CARD,
    label: 'ID Card',
    sumsubIdDocType: 'ID_CARD',
    defaultDocumentRecordType: DocumentType.DOCUMENT_FRONT,
    supportsBackSide: true,
  },
  {
    docType: IdentityDocType.DRIVERS_LICENSE,
    label: "Driver's License",
    sumsubIdDocType: 'DRIVERS',
    defaultDocumentRecordType: DocumentType.DOCUMENT_FRONT,
    supportsBackSide: true,
  },
  {
    docType: IdentityDocType.RESIDENCE_PERMIT,
    label: 'Residence Permit',
    sumsubIdDocType: 'RESIDENCE_PERMIT',
    defaultDocumentRecordType: DocumentType.DOCUMENT_FRONT,
    supportsBackSide: true,
  },
  {
    docType: IdentityDocType.OTHER,
    label: 'Other Supported Identity Document',
    sumsubIdDocType: null,
    defaultDocumentRecordType: DocumentType.DOCUMENT_FILE,
    supportsBackSide: true,
  },
] as const;

export function getDocumentOption(docType: IdentityDocType) {
  return SUMSUB_KYC_DOCUMENT_OPTIONS.find((option) => option.docType === docType);
}
