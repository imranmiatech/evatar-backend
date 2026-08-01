import { Module } from '@nestjs/common';
import { CaregiverModule } from '../../caregiver/caregiver.module';
import { ChildController } from './controllers/child.controller';
import { ChildTimelineController } from './controllers/child-timeline.controller';
import { ChildService } from './services/child.service';
import { ChildTimelineService } from './services/child-timeline.service';

@Module({
  imports: [CaregiverModule],
  controllers: [ChildController, ChildTimelineController],
  providers: [ChildService, ChildTimelineService],
})
export class ChildModule {}

