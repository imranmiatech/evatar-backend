import { forwardRef, Module } from '@nestjs/common';
import { PaymentAccountService } from './payment-account.service';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentMethodsController } from './controllers/payment-methods.controller';
import { PaymentTipsController } from './controllers/payment-tips.controller';
import { UnifiedPaymentsController } from './controllers/unified-payments.controller';
import { MembershipModule } from '../membership/membership.module';
import { UnifiedPaymentService } from './unified-payment.service';

@Module({
  imports: [PrismaModule, NotificationModule, forwardRef(() => MembershipModule)],
  controllers: [
    PaymentMethodsController,
    PaymentTipsController,
    UnifiedPaymentsController,
  ],
  providers: [PaymentService, PaymentAccountService, UnifiedPaymentService],
  exports: [PaymentService, PaymentAccountService, UnifiedPaymentService],
})
export class PaymentModule {}
