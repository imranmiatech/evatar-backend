import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AdminRecipeModule } from './recipe/admin-recipe.module';
import { AdminActivityModule } from './activity/admin-activity.module';

@Module({
  imports: [PrismaModule, AdminRecipeModule, AdminActivityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class AdminModule {}
