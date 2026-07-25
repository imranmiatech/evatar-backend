import { Module } from '@nestjs/common';
import { ChildModule } from './child/child.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [ChildModule, KitchenModule, ScheduleModule],
})
export class ParentModule { }
