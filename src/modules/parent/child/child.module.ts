import { Module } from '@nestjs/common';
import { ChildController } from './controllers/child.controller';
import { ChildService } from './services/child.service';

@Module({
  controllers: [ChildController],
  providers: [ChildService],
})
export class ChildModule {}
