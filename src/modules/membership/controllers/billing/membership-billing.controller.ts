import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { AddMembershipPaymentMethodDto } from '../../dto/add-payment-method.dto';
import { CreateMembershipStripePaymentIntentDto } from '../../dto/stripe-payment.dto';
import { MembershipPaymentMethodService } from '../../services/membership-payment-method.service';
import { MembershipBillingService } from '../../services/membership-billing.service';
import { extractMembershipUserId } from '../../utils/extract-user-id.util';

@ApiTags('Membership Billing')
@Controller('membership')
export class MembershipBillingController {
  constructor(
    private readonly membershipPaymentMethodService: MembershipPaymentMethodService,
    private readonly membershipBillingService: MembershipBillingService,
  ) {}

  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get saved payment methods for membership billing' })
  getPaymentMethods(@CurrentUser() user: any) {
    return this.membershipPaymentMethodService.getPaymentMethods(
      extractMembershipUserId(user),
    );
  }

  @Post('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new saved membership payment method' })
  addPaymentMethod(
    @CurrentUser() user: any,
    @Body() dto: AddMembershipPaymentMethodDto,
  ) {
    return this.membershipPaymentMethodService.addPaymentMethod(
      extractMembershipUserId(user),
      dto,
    );
  }

  @Patch('payment-methods/:id/default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a saved payment method as default' })
  setDefaultPaymentMethod(
    @CurrentUser() user: any,
    @Param('id') paymentMethodId: string,
  ) {
    return this.membershipPaymentMethodService.setDefaultPaymentMethod(
      extractMembershipUserId(user),
      paymentMethodId,
    );
  }

  @Patch('payment-methods/:id/remove-default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove default marker from a saved payment method' })
  removeDefaultPaymentMethod(
    @CurrentUser() user: any,
    @Param('id') paymentMethodId: string,
  ) {
    return this.membershipPaymentMethodService.removeDefaultPaymentMethod(
      extractMembershipUserId(user),
      paymentMethodId,
    );
  }

  @Delete('payment-methods/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a saved payment method' })
  deletePaymentMethod(
    @CurrentUser() user: any,
    @Param('id') paymentMethodId: string,
  ) {
    return this.membershipPaymentMethodService.deletePaymentMethod(
      extractMembershipUserId(user),
      paymentMethodId,
    );
  }

  @Post('stripe/create-payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stripe: create PaymentIntent for membership purchase' })
  createStripePaymentIntent(
    @CurrentUser() user: any,
    @Body() dto: CreateMembershipStripePaymentIntentDto,
  ) {
    return this.membershipBillingService.createStripePaymentIntent(user, dto);
  }

  @Post('stripe/create-checkout-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stripe: create hosted checkout session' })
  createStripeCheckoutSession(
    @CurrentUser() user: any,
    @Body('planId') planId: string,
  ) {
    return this.membershipBillingService.createStripeCheckoutSession(
      user,
      planId,
    );
  }

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint for membership billing' })
  handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    const rawBody =
      req.body instanceof Buffer
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}));

    return this.membershipBillingService.handleStripeWebhook(
      signature,
      rawBody,
    );
  }
}
