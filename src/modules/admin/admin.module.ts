import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AdminRecipeModule } from './recipe/admin-recipe.module';
import { AdminActivityModule } from './activity/admin-activity.module';
import { AdminPartnerModule } from './adminPartner/admin-partner.module';
import { AdminRewardModule } from './adminreward/admin-reward.module';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { CareManageModule } from './care-manage/care-manage.module';

@Module({
  imports: [
    PrismaModule,
    AdminRecipeModule,
    AdminActivityModule,
    AdminPartnerModule,
    AdminRewardModule,
    CareManageModule,
  ],
  controllers: [DashboardController, AdminUsersController],
  providers: [DashboardService, AdminUsersService],
})
export class AdminModule { }
