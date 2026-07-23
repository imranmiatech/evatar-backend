import { Module } from '@nestjs/common';
import { LibraryController } from './controllers/library.controller';
import { LibraryService } from './services/library.service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
