import { Module } from '@nestjs/common';

import { todayModule } from './today/today.module';
import { KitchanModule } from './kitchan/kitchan.module';
import { MyChildModule } from './myChild/myChild.module';

@Module({
  imports: [todayModule, KitchanModule, MyChildModule],
})
export class ParentModule {}
