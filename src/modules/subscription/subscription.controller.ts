import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import { join } from 'path';

import { CreateSubscriptionPlanDto } from './dto/create-plan.dto';
import { SubscribePlanDto } from './dto/subscribe-plan.dto';
import { PauseSubscriptionDto } from './dto/pause-subscription.dto';
import { CancelFeedbackDto } from './dto/cancel-feedback.dto';
import { AddSubscriptionPaymentMethodDto } from './dto/add-payment-method.dto';
import { SimulatePaymentFailureDto } from './dto/simulate-payment-failure.dto';
import { CreateStripePaymentIntentDto } from './dto/stripe-payment.dto';


@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('test-ui')
  @Get('subscription-flow-test.html')
  @ApiOperation({ summary: 'Serve the testing HTML interface for subscription flows' })
  async serveTestUI(@Res() res: Response) {
    const filePath = join(process.cwd(), 'subscription-flow-test.html');
    return res.sendFile(filePath);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans (2, 4, 10 child & Annual)' })
  @ApiResponse({ status: 200, description: 'Returns list of subscription plans.' })
  async getAllPlans() {
    return this.subscriptionService.getAllPlans();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user active subscription, free trial status, countdown & billing info' })
  @ApiResponse({ status: 200, description: 'Returns subscription and free trial details.' })
  async getMySubscription(@CurrentUser() user: any) {
    return this.subscriptionService.getMySubscription(user);
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe or change membership plan' })
  @ApiResponse({ status: 201, description: 'Subscribed successfully.' })
  async subscribePlan(@CurrentUser() user: any, @Body() dto: SubscribePlanDto) {
    return this.subscriptionService.subscribePlan(user, dto);
  }

  @Post('claim-trial')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim 7-day Complimentary Family Membership Trial' })
  @ApiResponse({ status: 201, description: '7-Day Free Trial claimed successfully.' })
  async claimComplimentaryTrial(
    @CurrentUser() user: any,
    @Body('planId') planId?: string,
  ) {
    return this.subscriptionService.claimComplimentaryTrial(user, planId);
  }

  @Post('pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pause subscription for 2 weeks, 4 weeks, or custom date' })
  @ApiResponse({ status: 200, description: 'Subscription paused successfully.' })
  async pauseSubscription(@CurrentUser() user: any, @Body() dto: PauseSubscriptionDto) {
    return this.subscriptionService.pauseSubscription(user, dto);
  }

  @Post('resume')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resume a paused subscription' })
  @ApiResponse({ status: 200, description: 'Subscription resumed successfully.' })
  async resumeSubscription(@CurrentUser() user: any) {
    return this.subscriptionService.resumeSubscription(user);
  }

  @Post('cancel/feedback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Step 1: Submit cancellation survey/feedback before cancelling' })
  @ApiResponse({ status: 201, description: 'Cancellation feedback recorded.' })
  async submitCancelFeedback(@CurrentUser() user: any, @Body() dto: CancelFeedbackDto) {
    return this.subscriptionService.submitCancelFeedback(user, dto);
  }

  @Post('cancel/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Step 2 & 3: Confirm cancellation of membership' })
  @ApiResponse({ status: 200, description: 'Membership cancelled successfully.' })
  async confirmCancelSubscription(@CurrentUser() user: any) {
    return this.subscriptionService.confirmCancelSubscription(user);
  }

  @Post('reactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a cancelled or paused membership' })
  @ApiResponse({ status: 200, description: 'Membership reactivated.' })
  async reactivateSubscription(@CurrentUser() user: any) {
    return this.subscriptionService.reactivateSubscription(user);
  }

  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all saved payment cards for user' })
  @ApiResponse({ status: 200, description: 'Returns saved payment methods.' })
  async getPaymentMethods(@CurrentUser() user: any) {
    return this.subscriptionService.getPaymentMethods(user);
  }

  @Post('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new saved payment card' })
  @ApiResponse({ status: 201, description: 'Payment method saved.' })
  async addPaymentMethod(
    @CurrentUser() user: any,
    @Body() dto: AddSubscriptionPaymentMethodDto,
  ) {
    return this.subscriptionService.addPaymentMethod(user, dto);
  }

  @Patch('payment-methods/:id/default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a saved payment card as default' })
  @ApiResponse({ status: 200, description: 'Default payment method updated.' })
  async setDefaultPaymentMethod(
    @CurrentUser() user: any,
    @Param('id') paymentMethodId: string,
  ) {
    return this.subscriptionService.setDefaultPaymentMethod(user, paymentMethodId);
  }

  @Delete('payment-methods/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a saved payment card' })
  @ApiResponse({ status: 200, description: 'Payment method deleted.' })
  async deletePaymentMethod(
    @CurrentUser() user: any,
    @Param('id') paymentMethodId: string,
  ) {
    return this.subscriptionService.deletePaymentMethod(user, paymentMethodId);
  }

  @Get('billing-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user billing history for last 3 months (Paid & Failed status)' })
  @ApiResponse({ status: 200, description: 'Returns billing transaction history.' })
  async getBillingHistory(@CurrentUser() user: any) {
    return this.subscriptionService.getBillingHistory(user);
  }

  @Post('simulate-payment-failure')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate a failed payment (triggers orange access paused alert)' })
  @ApiResponse({ status: 200, description: 'Payment failure simulated.' })
  async simulatePaymentFailure(
    @CurrentUser() user: any,
    @Body() dto: SimulatePaymentFailureDto,
  ) {
    return this.subscriptionService.simulatePaymentFailure(user, dto);
  }

  @Post('stripe/create-payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stripe: Create PaymentIntent for plan purchase (returns clientSecret for Stripe PaymentSheet)' })
  @ApiResponse({ status: 201, description: 'PaymentIntent created.' })
  async createStripePaymentIntent(
    @CurrentUser() user: any,
    @Body() dto: CreateStripePaymentIntentDto,
  ) {
    return this.subscriptionService.createStripePaymentIntent(user, dto);
  }

  @Post('stripe/create-checkout-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stripe: Create hosted Stripe Checkout Session for live credit card payment' })
  @ApiResponse({ status: 201, description: 'Checkout session created with redirect URL.' })
  async createStripeCheckoutSession(
    @CurrentUser() user: any,
    @Body('planId') planId: string,
  ) {
    return this.subscriptionService.createStripeCheckoutSession(user, planId);
  }

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Stripe: Webhook endpoint for live Stripe events (payment_intent.succeeded, etc.)' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    return this.subscriptionService.handleStripeWebhook(signature, rawBody);
  }

  @Post('admin/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a new custom subscription plan' })
  @ApiResponse({ status: 201, description: 'Plan created.' })
  async createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionService.createPlan(dto);
  }
}

