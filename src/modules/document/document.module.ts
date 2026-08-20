import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';
import { KycModule } from '../kyc/kyc.module';
import { MyDocumentController } from './my/my-document.controller';
import { MyDocumentService } from './my/my-document.service';
import { NannyDocumentController } from './nanny/nanny-document.controller';
import { NannyDocumentService } from './nanny/nanny-document.service';
import { DocumentService } from './document.service';

@Module({
  imports: [PrismaModule, StorageModule, KycModule],
  controllers: [MyDocumentController, NannyDocumentController],
  providers: [MyDocumentService, NannyDocumentService, DocumentService],
  exports: [DocumentService, MyDocumentService, NannyDocumentService],
})
export class DocumentModule {}
