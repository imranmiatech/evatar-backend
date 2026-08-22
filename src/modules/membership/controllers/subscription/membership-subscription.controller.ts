import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CancelMembershipDto } from '../../dto/cancel-membership.dto';
import { PauseMembershipDto } from '../../dto/pause-membership.dto';
import { SimulateMembershipPaymentFailureDto } from '../../dto/simulate-payment-failure.dto';
import { SubscribeMembershipPlanDto } from '../../dto/subscribe-plan.dto';
import { MembershipSubscriptionService } from '../../services/membership-subscription.service';
import { extractMembershipUserId } from '../../utils/extract-user-id.util';

@ApiTags('Membership Subscription')
@Controller('membership')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MembershipSubscriptionController {
  constructor(
    private readonly membershipSubscriptionService: MembershipSubscriptionService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user membership summary' })
  getMyMembership(@CurrentUser() user: any) {
    return this.membershipSubscriptionService.getMyMembership(
      extractMembershipUserId(user),
    );
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe or change membership plan' })
  @ApiResponse({ status: 201, description: 'Membership updated successfully.' })
  subscribePlan(@CurrentUser() user: any, @Body() dto: SubscribeMembershipPlanDto) {
    return this.membershipSubscriptionService.subscribePlan(
      extractMembershipUserId(user),
      dto,
    );
  }

  @Post('claim-trial')
  @ApiOperation({ summary: 'Claim complimentary membership trial' })
  claimComplimentaryTrial(
    @CurrentUser() user: any,
    @Body('planId') planId?: string,
  ) {
    return this.membershipSubscriptionService.claimComplimentaryTrial(
      extractMembershipUserId(user),
      planId,
    );
  }

  @Post('pause')
  @ApiOperation({ summary: 'Pause membership for fixed weeks or custom date' })
  pauseMembership(@CurrentUser() user: any, @Body() dto: PauseMembershipDto) {
    return this.membershipSubscriptionService.pauseMembership(
      extractMembershipUserId(user),
      dto,
    );
  }

  @Post('resume')
  @ApiOperation({ summary: 'Resume a paused membership' })
  resumeMembership(@CurrentUser() user: any) {
    return this.membershipSubscriptionService.resumeMembership(
      extractMembershipUserId(user),
    );
  }

  @Post('cancel')
  @ApiOperation({
    summary:
      'Cancel membership in one step, with optional cancellation feedback',
  })
  cancelMembership(
    @CurrentUser() user: any,
    @Body() dto: CancelMembershipDto,
  ) {
    return this.membershipSubscriptionService.cancelMembership(
      extractMembershipUserId(user),
      dto,
    );
  }

  @Post('reactivate')
  @ApiOperation({ summary: 'Reactivate a cancelled or paused membership' })
  reactivateMembership(@CurrentUser() user: any) {
    return this.membershipSubscriptionService.reactivateMembership(
      extractMembershipUserId(user),
    );
  }

  @Get('billing-history')
  @ApiOperation({ summary: 'Get billing history for the last 3 months' })
  getBillingHistory(@CurrentUser() user: any) {
    return this.membershipSubscriptionService.getBillingHistory(
      extractMembershipUserId(user),
    );
  }

  @Post('simulate-payment-failure')
  @ApiOperation({ summary: 'Simulate payment failure for membership access flow' })
  simulatePaymentFailure(
    @CurrentUser() user: any,
    @Body() dto: SimulateMembershipPaymentFailureDto,
  ) {
    return this.membershipSubscriptionService.simulatePaymentFailure(
      extractMembershipUserId(user),
      dto,
    );
  }
}
