import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
import { SavePaymentMethodDto } from '../dto/save-payment-method.dto';
import { PaymentAccountService } from '../payment-account.service';

@ApiTags('Payment Methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment/payment-methods')
export class PaymentMethodsController {
  constructor(
    private readonly paymentAccountService: PaymentAccountService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get saved payer payment methods for subscriptions, nanny tips, and partner product purchases',
  })
  getPaymentMethods(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.paymentAccountService.getPaymentMethods(userId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Save a payer card for future subscription, nanny tip, or partner product payments',
  })
  addPaymentMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SavePaymentMethodDto,
  ) {
    const userId = user.userId || user.id!;
    return this.paymentAccountService.addPaymentMethod(userId, dto);
  }

  @Post(':id/default')
  @ApiOperation({ summary: 'Set one saved payer card as default' })
  setDefaultPaymentMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') paymentMethodId: string,
  ) {
    const userId = user.userId || user.id!;
    return this.paymentAccountService.setDefaultPaymentMethod(
      userId,
      paymentMethodId,
    );
  }

  @Post(':id/remove-default')
  @ApiOperation({ summary: 'Remove default marker from a saved payer card' })
  removeDefaultPaymentMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') paymentMethodId: string,
  ) {
    const userId = user.userId || user.id!;
    return this.paymentAccountService.removeDefaultPaymentMethod(
      userId,
      paymentMethodId,
    );
  }
}
