import { Module } from '@nestjs/common';
import { ChildController } from './controllers/child.controller';
import { ChildTimelineController } from './controllers/child-timeline.controller';
import { ChildService } from './services/child.service';
import { ChildTimelineService } from './services/child-timeline.service';

@Module({
  controllers: [ChildController, ChildTimelineController],
  providers: [ChildService, ChildTimelineService],
})
export class ChildModule {}

