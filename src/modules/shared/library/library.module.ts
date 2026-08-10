import { Module } from '@nestjs/common';
import { LibraryController } from './controllers/library.controller';
import { LibraryService } from './services/library.service';
import { KitchenAccessService } from '../../parent/kitchen/services/kitchen-access.service';

@Module({
  controllers: [LibraryController],
  providers: [KitchenAccessService, LibraryService],
})
export class LibraryModule {}
