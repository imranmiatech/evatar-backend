import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('hub')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get mobile reward hub data in one response',
    description:
      'Returns balance, earn/spend tab data, recent weekly activity, and care moment recognition. Well-being offers are intentionally excluded.',
  })
  getRewardHub(@CurrentUser() user: CurrentUserPayload) {
    return this.rewardsService.getRewardHub(user);
  }

  @Get('redemptions')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get my redeemed reward offers' })
  getMyRedemptions(@CurrentUser() user: CurrentUserPayload) {
    return this.rewardsService.getMyRedemptions(user);
  }

  @Post('tasks/:dayActivityId/complete')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Mark a Today task complete and award 2 points once',
  })
  @ApiParam({ name: 'dayActivityId' })
  completeTaskForReward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayActivityId') dayActivityId: string,
  ) {
    return this.rewardsService.completeTaskForReward(user, dayActivityId);
  }
}
