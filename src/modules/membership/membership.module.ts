import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { RewardsModule } from '../rewards/rewards.module';
import { MembershipAdminController } from './controllers/admin/membership-admin.controller';
import { MembershipBillingController } from './controllers/billing/membership-billing.controller';
import { MembershipPlansController } from './controllers/plans/membership-plans.controller';
import { MembershipSubscriptionController } from './controllers/subscription/membership-subscription.controller';
import { MembershipBillingService } from './services/membership-billing.service';
import { MembershipPlanService } from './services/membership-plan.service';
import { MembershipPaymentMethodService } from './services/membership-payment-method.service';
import { MembershipStripeService } from './services/membership-stripe.service';
import { MembershipStorageService } from './services/membership-storage.service';
import { MembershipSubscriptionService } from './services/membership-subscription.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => RewardsModule),
  ],
  controllers: [
    MembershipAdminController,
    MembershipBillingController,
    MembershipPlansController,
    MembershipSubscriptionController,
  ],
  providers: [
    MembershipBillingService,
    MembershipPlanService,
    MembershipPaymentMethodService,
    MembershipStripeService,
    MembershipStorageService,
    MembershipSubscriptionService,
  ],
  exports: [
    MembershipBillingService,
    MembershipStorageService,
    MembershipSubscriptionService,
  ],
})
export class MembershipModule {}
