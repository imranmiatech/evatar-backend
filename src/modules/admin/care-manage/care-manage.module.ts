import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CareManageController } from './controllers/care-manage.controller';
import { CareManageService } from './services/care-manage.service';
import { StorageModule } from '../../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [CareManageController],
  providers: [CareManageService],
  exports: [CareManageService],
})
export class CareManageModule {}
