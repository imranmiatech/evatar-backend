import { Module } from '@nestjs/common';

import { todayModule } from './today/today.module';
import { KitchanModule } from './kitchan/kitchan.module';

@Module({
  imports: [todayModule, KitchanModule],
})
export class ParentModule {}
