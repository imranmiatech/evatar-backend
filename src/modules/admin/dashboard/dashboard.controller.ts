import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { UserGrowthQueryDto } from './dto/user-growth-query.dto';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get platform overview dashboard metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns platform overview metrics for admin dashboard cards.',
  })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('rewards-overview')
  @ApiOperation({ summary: 'Get admin rewards overview metrics for this month' })
  @ApiResponse({
    status: 200,
    description:
      'Returns rewards overview metrics including Aureis issued, redeemed, top partner, most popular offer, and redemption rate.',
  })
  getRewardsOverview() {
    return this.dashboardService.getRewardsOverview();
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'Get user growth chart analytics with period filtering (7D, 30D, 90D, 12M)' })
  @ApiResponse({
    status: 200,
    description:
      'Returns user growth cumulative & new user time-series chart data.',
  })
  getUserGrowth(@Query() query: UserGrowthQueryDto) {
    return this.dashboardService.getUserGrowth(query);
  }

  @Get('recent-activities')
  @ApiOperation({ summary: 'Get recent admin dashboard activities stream' })
  @ApiResponse({
    status: 200,
    description:
      'Returns recent system activities such as new family registrations, nanny verifications, support tickets, etc.',
  })
  getRecentActivities(@Query() query: RecentActivityQueryDto) {
    return this.dashboardService.getRecentActivities(query);
  }
}
