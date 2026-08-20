import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateNannyTipDto } from './dto/create-nanny-tip.dto';
import { PaymentService } from './payment.service';

@ApiTags('Payments & Nanny Tips')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('tips/nannies')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Screen 1: Get assigned nannies and preset tip options (20 AED, 25 AED, 30 AED)',
    description:
      'Fetches assigned nannies for parent children with preset appreciation tip options matching Figma Screen 1.',
  })
  getAssignedNanniesForTips(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentService.getAssignedNanniesForTips(userId);
  }

  @Post('tips/create-intent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Screen 1 & 2: Create Stripe PaymentIntent for sending Nanny Appreciation Tip',
    description:
      'Creates a Stripe PaymentIntent for specified tip amount in AED (e.g. 20, 25, 30, or custom amount e.g. 50 AED).',
  })
  createTipPaymentIntent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateNannyTipDto,
  ) {
    const userId = user.userId || user.id!;
    return this.paymentService.createTipPaymentIntent(userId, dto);
  }

  @Post('tips/:tipId/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Confirm completed tip payment and dispatch real-time notification to Nanny',
    description: 'Marks tip transaction as COMPLETED and notifies the nanny.',
  })
  @ApiParam({ name: 'tipId', description: 'Nanny Tip Record ID' })
  confirmTipPayment(
    @Param('tipId') tipId: string,
    @Body('paymentIntentId') paymentIntentId?: string,
  ) {
    return this.paymentService.confirmTipPayment(tipId, paymentIntentId);
  }

  @Get('tips/sent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get tips sent history by logged-in Parent' })
  getSentTips(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentService.getSentTips(userId);
  }

  @Get('tips/received')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get tips received history by logged-in Nanny' })
  getReceivedTips(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentService.getReceivedTips(userId);
  }

  @Post('tips/stripe-webhook')
  @ApiOperation({ summary: 'Stripe Webhook handler for automated payment_intent.succeeded events' })
  handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    return this.paymentService.handleStripeWebhook(signature, rawBody);
  }
}
