import { Module } from '@nestjs/common';
import { CaregiverModule } from '../../caregiver/caregiver.module';
import { ChildController } from './controllers/child.controller';
import { ChildService } from './services/child.service';

@Module({
  imports: [CaregiverModule],
  controllers: [ChildController],
  providers: [ChildService],
})
export class ChildModule {}
