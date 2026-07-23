import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LanguageController } from './language.controller';
import { LanguageService } from './language.service';

@Module({
  imports: [PrismaModule],
  controllers: [LanguageController],
  providers: [LanguageService],
  exports: [LanguageService],
})
export class LanguageModule {}
