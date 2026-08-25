import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AdminMembershipController } from './admin-membership.controller';
import { AdminMembershipService } from './admin-membership.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMembershipController],
  providers: [AdminMembershipService],
})
export class AdminMembershipModule {}
