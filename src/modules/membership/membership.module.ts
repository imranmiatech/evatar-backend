import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MembershipAdminController } from './controllers/admin/membership-admin.controller';
import { MembershipBillingController } from './controllers/billing/membership-billing.controller';
import { MembershipPlansController } from './controllers/plans/membership-plans.controller';
import { MembershipSubscriptionController } from './controllers/subscription/membership-subscription.controller';
import { MembershipBillingService } from './services/membership-billing.service';
import { MembershipPlanService } from './services/membership-plan.service';
import { MembershipPaymentMethodService } from './services/membership-payment-method.service';
import { MembershipStripeService } from './services/membership-stripe.service';
import { MembershipSubscriptionService } from './services/membership-subscription.service';

@Module({
  imports: [PrismaModule],
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
    MembershipSubscriptionService,
  ],
})
export class MembershipModule {}
