import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminRewardService } from './admin-reward.service';

@ApiTags('Admin Rewards')
@ApiBearerAuth()
@Controller('admin/rewards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminRewardController {
  constructor(private readonly adminRewardService: AdminRewardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get admin reward overview cards and recent activity',
    description:
      'Returns monthly comparison metrics for Rewards dashboard cards. changeLabel is signed monthly growth, for example +7.1%, -2.3%, or +1 uses.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reward metrics and recent reward activity returned successfully.',
  })
  getOverview() {
    return this.adminRewardService.getOverview();
  }

  @Get('recent-activity')
  @ApiOperation({
    summary: 'Get recent reward activity',
    description:
      'Returns latest earn/spend ledger entries and redemptions for the Recent Reward Activity list.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  getRecentActivity(@Query('limit') limit?: string) {
    return this.adminRewardService.getRecentActivity(Number(limit) || 8);
  }
}
