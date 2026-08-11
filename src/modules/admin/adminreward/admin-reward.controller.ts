import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminRewardService } from './admin-reward.service';
import {
  CreateRewardRuleDto,
  UpdateRewardRuleDto,
} from './dto/reward-rule.dto';

@ApiTags('Admin Rewards')
@ApiBearerAuth()
@Controller('admin/rewards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminRewardController {
  constructor(private readonly adminRewardService: AdminRewardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get admin reward overview cards',
    description:
      'Returns monthly comparison metrics for Rewards dashboard cards. changeLabel is signed monthly growth, for example +7.1%, -2.3%, or +1 uses.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reward metrics returned successfully.',
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

  @Get('rules')
  @ApiOperation({
    summary: 'Get reward rules for care activities',
    description:
      'Returns the Reward Management table rows. These rules control how many Alurei users earn after completing supported tasks.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'care module' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'DISABLED'] })
  getRewardRules(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminRewardService.getRewardRules({ search, status });
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create a reward rule' })
  @ApiBody({ type: CreateRewardRuleDto })
  createRewardRule(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRewardRuleDto,
  ) {
    return this.adminRewardService.createRewardRule(user, dto);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update a reward rule' })
  @ApiParam({ name: 'id', description: 'Reward rule ID' })
  @ApiBody({ type: UpdateRewardRuleDto })
  updateRewardRule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRewardRuleDto,
  ) {
    return this.adminRewardService.updateRewardRule(user, id, dto);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete a reward rule' })
  @ApiParam({ name: 'id', description: 'Reward rule ID' })
  deleteRewardRule(@Param('id') id: string) {
    return this.adminRewardService.deleteRewardRule(id);
  }
}
