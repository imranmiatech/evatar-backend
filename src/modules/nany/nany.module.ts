import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManageSystemModule } from '../manageSystem/manage-system.module';
import { NanyController } from './nany.controller';
import { NanyService } from './nany.service';

@Module({
  imports: [PrismaModule, ManageSystemModule],
  controllers: [NanyController],
  providers: [NanyService],
})
export class NanyModule {}
