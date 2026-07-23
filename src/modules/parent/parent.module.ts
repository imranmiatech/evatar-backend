import { Module } from '@nestjs/common';
import { ChildModule } from './child/child.module';


@Module({
  imports: [ChildModule],
})
export class ParentModule { }
