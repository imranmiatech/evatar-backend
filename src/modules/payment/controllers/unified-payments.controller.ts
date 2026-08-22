import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
import { UnifiedPaymentCheckoutDto } from '../dto/unified-payment-checkout.dto';
import { UnifiedPaymentService } from '../unified-payment.service';

@ApiTags('Unified Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class UnifiedPaymentsController {
  constructor(
    private readonly unifiedPaymentService: UnifiedPaymentService,
  ) {}

  @Post('checkout')
  @ApiOperation({
    summary:
      'One API route for membership payments, nanny tips, and partner product purchases',
  })
  checkout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnifiedPaymentCheckoutDto,
  ) {
    const userId = user.userId || user.id!;
    return this.unifiedPaymentService.checkout(userId, dto);
  }
}
