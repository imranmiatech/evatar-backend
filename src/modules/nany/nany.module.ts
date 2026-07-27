import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CaregiverModule } from '../caregiver/caregiver.module';
import { NanyController } from './nany.controller';
import { NanyService } from './nany.service';

@Module({
  imports: [PrismaModule, CaregiverModule],
  controllers: [NanyController],
  providers: [NanyService],
})
export class NanyModule {}
