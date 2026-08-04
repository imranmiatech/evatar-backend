import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AdminRecipeModule } from './recipe/admin-recipe.module';
import { AdminActivityModule } from './activity/admin-activity.module';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [PrismaModule, AdminRecipeModule, AdminActivityModule],
  controllers: [DashboardController, AdminUsersController],
  providers: [DashboardService, AdminUsersService],
})
export class AdminModule { }
