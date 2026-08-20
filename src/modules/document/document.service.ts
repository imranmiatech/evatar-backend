import { Injectable } from '@nestjs/common';
import { IdentityDocType } from '@prisma/client';
import { MyDocumentService } from './my/my-document.service';
import { NannyDocumentService } from './nanny/nanny-document.service';

@Injectable()
export class DocumentService {
  constructor(
    private readonly myDocumentService: MyDocumentService,
    private readonly nannyDocumentService: NannyDocumentService,
  ) {}

  getMyDocuments(userId: string) {
    return this.myDocumentService.getMyDocuments(userId);
  }

  getMyDocumentById(userId: string, documentId: string) {
    return this.myDocumentService.getMyDocumentById(userId, documentId);
  }

  uploadMyDocument(
    userId: string,
    docType: IdentityDocType,
    files: {
      passport?: Express.Multer.File[];
      nidFront?: Express.Multer.File[];
      nidBack?: Express.Multer.File[];
    },
  ) {
    return this.myDocumentService.uploadMyDocument(userId, docType, files);
  }

  getAssignedNanniesDocuments(parentUserId: string) {
    return this.nannyDocumentService.getAssignedNanniesDocuments(parentUserId);
  }

  getNannyDocumentsById(parentUserId: string, nannyUserId: string) {
    return this.nannyDocumentService.getNannyDocumentsById(
      parentUserId,
      nannyUserId,
    );
  }
}
