import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [SupportController],
  providers: [SupportService, SupportGateway],
})
export class SupportModule {}
