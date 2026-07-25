import { Module } from '@nestjs/common';
import { ChildModule } from './child/child.module';
import { KitchenModule } from './kitchen/kitchen.module';

@Module({
  imports: [ChildModule, KitchenModule],
})
export class ParentModule { }
