import {
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaymentService } from '../payment.service';

@ApiTags('Nanny Tips')
@Controller('payment/tips')
export class PaymentTipsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('nannies')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Screen 1: Get assigned nannies and preset tip options (20 AED, 25 AED, 30 AED)',
    description:
      'Fetches assigned nannies for parent children with preset appreciation tip options matching Figma Screen 1.',
  })
  getAssignedNanniesForTips(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentService.getAssignedNanniesForTips(userId);
  }

  @Get('sent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get tips sent history by logged-in Parent' })
  getSentTips(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentService.getSentTips(userId);
  }

  @Get('received')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get tips received history by logged-in Nanny' })
  getReceivedTips(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentService.getReceivedTips(userId);
  }

  @Post('stripe-webhook')
  @ApiOperation({
    summary:
      'Stripe Webhook handler for automated payment_intent.succeeded events',
  })
  handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    return this.paymentService.handleStripeWebhook(signature, rawBody);
  }
}
