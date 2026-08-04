import { Module } from '@nestjs/common';
import { AdminActivityController } from './controllers/admin-activity.controller';
import { AdminActivityService } from './services/admin-activity.service';
import { StorageModule } from '../../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AdminActivityController],
  providers: [AdminActivityService],
})
export class AdminActivityModule {}
