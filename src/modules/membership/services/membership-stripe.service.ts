import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { SubscriptionPlan } from '@prisma/client';

type StripeSavedChargeSource = {
  stripePaymentMethodId?: string | null;
  stripeCustomerId?: string | null;
};

type MembershipChargeOverride = {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
};

@Injectable()
export class MembershipStripeService {
  private readonly stripe: Stripe | null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.stripe =
      secretKey && !secretKey.includes('dummy')
        ? new Stripe(secretKey)
        : null;
  }

  isConfigured() {
    return !!this.stripe;
  }

  async ensureSucceededPaymentForPlan(
    userId: string,
    plan: SubscriptionPlan,
    paymentIntentId?: string | null,
    savedChargeSource?: StripeSavedChargeSource,
    recipientMetadata?: Record<string, string>,
    chargeOverride?: MembershipChargeOverride,
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    if (paymentIntentId) {
      const retrieved = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (retrieved.status !== 'succeeded') {
        throw new Error(`Stripe payment intent status is ${retrieved.status}`);
      }

      return retrieved.id;
    }

    if (!savedChargeSource?.stripePaymentMethodId) {
      throw new BadRequestException(
        'A saved Stripe payment method is required for direct membership charging.',
      );
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round((chargeOverride?.amount ?? plan.price) * 100),
      currency: (chargeOverride?.currency || plan.currency || 'aed').toLowerCase(),
      payment_method_types: ['card'],
      payment_method: savedChargeSource.stripePaymentMethodId,
      customer: savedChargeSource.stripeCustomerId || undefined,
      confirm: true,
      description:
        chargeOverride?.description || `Membership - ${plan.name} (${userId})`,
      metadata: {
        userId,
        planId: plan.id,
        planName: plan.name,
        ...(recipientMetadata || {}),
        ...(chargeOverride?.metadata || {}),
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Stripe payment intent status is ${paymentIntent.status}`);
    }

    return paymentIntent.id;
  }

  async createPaymentIntentForPlan(
    userId: string,
    email: string | null | undefined,
    plan: SubscriptionPlan,
    recipientMetadata?: Record<string, string>,
    payoutRecipient?: any,
    savedChargeSource?: StripeSavedChargeSource,
    chargeOverride?: MembershipChargeOverride,
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round((chargeOverride?.amount ?? plan.price) * 100),
      currency: (chargeOverride?.currency || plan.currency).toLowerCase(),
      payment_method_types: ['card'],
      payment_method: savedChargeSource?.stripePaymentMethodId || undefined,
      customer: savedChargeSource?.stripeCustomerId || undefined,
      confirm: !!savedChargeSource?.stripePaymentMethodId,
      metadata: {
        userId,
        planId: plan.id,
        planName: plan.name,
        ...(recipientMetadata || {}),
        ...(chargeOverride?.metadata || {}),
      },
      description: chargeOverride?.description || `Membership - ${plan.name}`,
      receipt_email: email || undefined,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: chargeOverride?.amount ?? plan.price,
      currency: chargeOverride?.currency || plan.currency,
      planName: plan.name,
      status: paymentIntent.status,
      payoutRecipient: payoutRecipient || null,
    };
  }

  async createCheckoutSession(
    userId: string,
    plan: SubscriptionPlan,
    appBaseUrl: string,
    successUrl?: string,
    cancelUrl?: string,
    recipientMetadata?: Record<string, string>,
    payoutRecipient?: any,
    chargeOverride?: MembershipChargeOverride,
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (
              chargeOverride?.currency ||
              plan.currency ||
              'aed'
            ).toLowerCase(),
            product_data: {
              name: `Membership - ${plan.name}`,
              description:
                chargeOverride?.description ||
                `Family care plan (${plan.maxChildren} children)`,
            },
            unit_amount: Math.round((chargeOverride?.amount ?? plan.price) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url:
        successUrl ||
        `${appBaseUrl}/api/v1/membership/membership-flow-test.html?session_id={CHECKOUT_SESSION_ID}&plan_id=${plan.id}`,
      cancel_url:
        cancelUrl ||
        `${appBaseUrl}/api/v1/membership/membership-flow-test.html?canceled=true`,
      metadata: {
        userId,
        planId: plan.id,
        ...(recipientMetadata || {}),
        ...(chargeOverride?.metadata || {}),
      },
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      payoutRecipient: payoutRecipient || null,
    };
  }

  constructWebhookEvent(signature: string, rawBody: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    }

    return JSON.parse(rawBody.toString()) as Stripe.Event;
  }
}
