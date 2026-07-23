import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
