import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { SumsubService } from './sumsub.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [KycController],
  providers: [KycService, SumsubService],
  exports: [KycService, SumsubService],
})
export class KycModule {}
