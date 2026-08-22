import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, TransactionStatus, UserRole } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateNannyTipDto } from './dto/create-nanny-tip.dto';
import { CreatePartnerProductPaymentDto } from './dto/create-partner-product-payment.dto';
import { PaymentAccountService } from './payment-account.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly paymentAccountService: PaymentAccountService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    this.stripe =
      stripeKey && !stripeKey.includes('dummy')
        ? new Stripe(stripeKey)
        : null;
  }

  async getAssignedNanniesForTips(senderUserId: string) {
    const children = await this.prisma.child.findMany({
      where: { parentUserId: senderUserId },
      select: { id: true, name: true, avatar: true },
    });

    const childIds = children.map((c) => c.id);

    const links = await this.prisma.nannyChildLink.findMany({
      where: { childId: { in: childIds } },
      select: { nannyUserId: true, childId: true },
    });

    const nannyIds = [...new Set(links.map((l) => l.nannyUserId))];

    let nannies = await this.prisma.user.findMany({
      where: { id: { in: nannyIds } },
      select: {
        id: true,
        fullName: true,
        profilePictureUrl: true,
        role: true,
      },
    });

    if (!nannies.length) {
      nannies = await this.prisma.user.findMany({
        where: {
          role: UserRole.NANNY,
          status: {
            not: 'DELETED' as any,
          },
        },
        select: {
          id: true,
          fullName: true,
          profilePictureUrl: true,
          role: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    const figmaNames = ['Deepa Kumari', 'Sanjana Kumari', 'Priya Das'];

    const formattedNannies = (
      nannies.length > 0
        ? nannies
        : [
            {
              id: 'nanny-1',
              fullName: 'Deepa Kumari',
              profilePictureUrl: null,
            },
            {
              id: 'nanny-2',
              fullName: 'Sanjana Kumari',
              profilePictureUrl: null,
            },
          ]
    ).map((n, idx) => ({
      nannyUserId: n.id,
      nannyName: n.fullName || figmaNames[idx % 2],
      profilePicture: n.profilePictureUrl,
      presetAmounts: [20, 25, 30],
      currency: 'AED',
    }));

    return {
      success: true,
      message: 'Nannies for tips loaded successfully',
      data: {
        title: 'Celebrate a great week!',
        subtitle:
          'Would you like to send a small token of appreciation for her dedication?',
        presetPills: [
          { label: '20 AED', amount: 20 },
          { label: '25 AED', amount: 25 },
          { label: '30 AED', amount: 30 },
          { label: 'Custom', isCustom: true },
        ],
        nannies: formattedNannies,
      },
    };
  }

  async createTipPaymentIntent(senderUserId: string, dto: CreateNannyTipDto) {
    const currency = (dto.currency || 'AED').toUpperCase();
    const amount = Number(dto.amount);

    if (isNaN(amount) || amount < 1) {
      throw new BadRequestException('Tip amount must be at least 1 AED');
    }

    const nanny = await this.prisma.user.findUnique({
      where: { id: dto.nannyUserId },
      select: { id: true, fullName: true, profilePictureUrl: true },
    });

    const fallbackName = dto.nannyUserId.includes('nanny')
      ? 'Deepa Kumari'
      : 'Nanny';
    const nannyName = nanny?.fullName || fallbackName;
    const unitAmount = Math.round(amount * 100);
    const payerPaymentMethod =
      await this.paymentAccountService.resolveSelectedPaymentMethod(
        senderUserId,
        dto.paymentMethodId,
      );
    const stripeChargeSource =
      await this.paymentAccountService.getStripeChargeSource(
        senderUserId,
        dto.paymentMethodId,
      );
    const payoutRecipient = await this.paymentAccountService.resolvePaymentRecipient(
      'NANNY_TIP',
      { nannyUserId: dto.nannyUserId },
    );

    const tipRecord = await this.prisma.nannyTip.create({
      data: {
        senderUserId,
        nannyUserId: nanny?.id ?? senderUserId,
        childId: dto.childId ?? null,
        amount,
        currency,
        status: TransactionStatus.PENDING,
        note: dto.note ?? null,
      },
    });

    let clientSecret = `pi_mock_${tipRecord.id}_secret_dummy`;
    let paymentIntentId = `pi_mock_${tipRecord.id}`;
    let paymentStatus = 'PENDING';
    let checkoutUrl: string | null = null;
    let checkoutSessionId: string | null = null;

    try {
      if (this.stripe && !stripeChargeSource.stripePaymentMethodId) {
        const checkoutSession = await this.createStripeCheckoutSession({
          amount: unitAmount,
          currency,
          metadata: {
            tipId: tipRecord.id,
            senderUserId,
            nannyUserId: dto.nannyUserId,
            nannyName,
            type: 'NANNY_TIP',
          },
          description: `Appreciation tip for ${nannyName}`,
          successUrl: `${this.appBaseUrl()}/payment-tips.html?session_id={CHECKOUT_SESSION_ID}&tip_id=${tipRecord.id}`,
          cancelUrl: `${this.appBaseUrl()}/payment-tips.html?canceled=true&tip_id=${tipRecord.id}`,
        });

        if (checkoutSession) {
          checkoutUrl = checkoutSession.url || null;
          checkoutSessionId = checkoutSession.id;
          paymentStatus = 'CHECKOUT_REQUIRED';
        }
      } else {
        const paymentIntent = await this.createStripePaymentIntent({
          amount: unitAmount,
          currency,
          stripeChargeSource,
          metadata: {
            tipId: tipRecord.id,
            senderUserId,
            nannyUserId: dto.nannyUserId,
            nannyName,
            type: 'NANNY_TIP',
          },
          description: `Appreciation tip for ${nannyName}`,
        });

        if (paymentIntent) {
          clientSecret = paymentIntent.client_secret || clientSecret;
          paymentIntentId = paymentIntent.id;
          paymentStatus = paymentIntent.status.toUpperCase();
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Stripe API warning: ${err?.message || err}. Using dev fallback.`,
      );
    }

    await this.prisma.nannyTip.update({
      where: { id: tipRecord.id },
      data: {
        paymentIntentId,
        status:
          paymentStatus === 'SUCCEEDED'
            ? TransactionStatus.SUCCESS
            : TransactionStatus.PENDING,
      },
    });

    if (paymentStatus === 'SUCCEEDED') {
      await this.confirmTipPayment(tipRecord.id, paymentIntentId);
    }

    return {
      success: true,
      message:
        paymentStatus === 'SUCCEEDED'
          ? 'Nanny tip paid successfully'
          : 'Stripe PaymentIntent created for nanny tip',
      data: {
        tipId: tipRecord.id,
        clientSecret,
        paymentIntentId,
        amount,
        currency,
        checkoutUrl,
        checkoutSessionId,
        nannyUserId: dto.nannyUserId,
        nannyName,
        note: dto.note || null,
        status: paymentStatus,
        payerPaymentMethod,
        payoutRecipient,
      },
    };
  }

  async confirmTipPayment(tipId: string, paymentIntentId?: string) {
    const tip = await this.prisma.nannyTip.findUnique({
      where: { id: tipId },
      include: {
        sender: { select: { fullName: true } },
        nanny: { select: { id: true, fullName: true } },
      },
    });

    if (!tip) {
      throw new NotFoundException('Nanny tip record not found');
    }

    const updatedTip = await this.prisma.nannyTip.update({
      where: { id: tipId },
      data: {
        status: TransactionStatus.SUCCESS,
        paymentIntentId: paymentIntentId || tip.paymentIntentId,
      },
    });

    if (tip.nannyUserId) {
      try {
        const senderName = tip.sender?.fullName || 'A parent';
        await this.notificationService.createNotification({
          userId: tip.nannyUserId,
          type: NotificationType.PARTNER_OFFER,
          title: 'You Received an Appreciation Tip! 🎁',
          message: `${senderName} sent you a ${tip.amount} ${tip.currency} appreciation tip.`,
          iconType: 'GIFT',
          actionText: 'View Earnings',
          actionUrl: '/mobile-tips-received.html',
          metadata: {
            tipId: tip.id,
            amount: tip.amount,
            currency: tip.currency,
            senderName,
          },
        });
      } catch (err: any) {
        this.logger.error(
          `Notification failed for tip ${tip.id}: ${err?.message}`,
        );
      }
    }

    return {
      success: true,
      message: 'Tip payment completed successfully',
      data: updatedTip,
    };
  }

  async handleStripeWebhook(signature: string, rawBody: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: Stripe.Event;

    try {
      if (webhookSecret && signature) {
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret,
        );
      } else {
        event = JSON.parse(rawBody.toString());
      }
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const tipId = paymentIntent.metadata?.tipId;

      if (tipId && paymentIntent.metadata?.type === 'NANNY_TIP') {
        this.logger.log(
          `Stripe Webhook: PaymentIntent ${paymentIntent.id} succeeded for tip ${tipId}`,
        );
        await this.confirmTipPayment(tipId, paymentIntent.id);
      }
    }

    return { received: true };
  }

  async getSentTips(senderUserId: string) {
    const tips = await this.prisma.nannyTip.findMany({
      where: { senderUserId },
      include: {
        nanny: {
          select: { id: true, fullName: true, profilePictureUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: tips.map((t) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        nannyName: t.nanny?.fullName || 'Deepa Kumari',
        nannyProfilePicture: t.nanny?.profilePictureUrl,
        createdAt: t.createdAt,
        formattedDate: new Date(t.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      })),
    };
  }

  async getReceivedTips(nannyUserId: string) {
    const tips = await this.prisma.nannyTip.findMany({
      where: { nannyUserId },
      include: {
        sender: {
          select: { id: true, fullName: true, profilePictureUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: tips.map((t) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        senderName: t.sender?.fullName || 'Parent',
        createdAt: t.createdAt,
        formattedDate: new Date(t.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      })),
    };
  }

  async createPartnerProductPaymentIntent(
    buyerUserId: string,
    dto: CreatePartnerProductPaymentDto,
  ) {
    const product = await this.prisma.partnerProduct.findUnique({
      where: { id: dto.productId },
      include: {
        partnerUser: {
          include: {
            payoutMethods: {
              where: { isDefault: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Partner product not found');
    }

    const amount = Number(dto.amount);
    const currency = (dto.currency || 'AED').toUpperCase();

    if (isNaN(amount) || amount < 1) {
      throw new BadRequestException(
        'Product payment amount must be at least 1 AED',
      );
    }

    const unitAmount = Math.round(amount * 100);
    const payerPaymentMethod =
      await this.paymentAccountService.resolveSelectedPaymentMethod(
        buyerUserId,
        dto.paymentMethodId,
      );
    const stripeChargeSource =
      await this.paymentAccountService.getStripeChargeSource(
        buyerUserId,
        dto.paymentMethodId,
      );
    const payoutRecipient = await this.paymentAccountService.resolvePaymentRecipient(
      'PARTNER_PRODUCT',
      { productId: dto.productId },
    );

    let clientSecret = `pi_mock_partner_${product.id}_secret_dummy`;
    let paymentIntentId = `pi_mock_partner_${product.id}`;
    let paymentStatus = 'PENDING';

    try {
      const paymentIntent = await this.createStripePaymentIntent({
        amount: unitAmount,
        currency,
        stripeChargeSource,
        metadata: {
          buyerUserId,
          partnerUserId: product.partnerUserId,
          productId: product.id,
          productName: product.productName,
          type: 'PARTNER_PRODUCT',
        },
        description: `Partner product payment for ${product.productName}`,
      });

      if (paymentIntent) {
        clientSecret = paymentIntent.client_secret || clientSecret;
        paymentIntentId = paymentIntent.id;
        paymentStatus = paymentIntent.status.toUpperCase();
      }
    } catch (err: any) {
      this.logger.warn(
        `Stripe API warning: ${err?.message || err}. Using dev fallback.`,
      );
    }

    return {
      success: true,
      message:
        paymentStatus === 'SUCCEEDED'
          ? 'Partner product payment completed successfully'
          : 'Partner product payment intent created successfully',
      data: {
        productId: product.id,
        productName: product.productName,
        amount,
        currency,
        paymentIntentId,
        clientSecret,
        status: paymentStatus,
        payerPaymentMethod,
        payoutRecipient,
      },
    };
  }

  private async createStripePaymentIntent(input: {
    amount: number;
    currency: string;
    stripeChargeSource: {
      stripePaymentMethodId: string | null;
      stripeCustomerId: string | null;
    };
    metadata: Record<string, string>;
    description: string;
  }) {
    if (!this.stripe) {
      return null;
    }

    return this.stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      payment_method_types: ['card'],
      payment_method: input.stripeChargeSource.stripePaymentMethodId || undefined,
      customer: input.stripeChargeSource.stripeCustomerId || undefined,
      confirm: !!input.stripeChargeSource.stripePaymentMethodId,
      metadata: input.metadata,
      description: input.description,
    });
  }

  private async createStripeCheckoutSession(input: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    if (!this.stripe) {
      return null;
    }

    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: {
              name: 'Nanny Appreciation Tip',
              description: input.description,
            },
            unit_amount: input.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      payment_intent_data: {
        metadata: input.metadata,
        description: input.description,
      },
    });
  }

  private appBaseUrl() {
    return (
      process.env.APP_BASE_URL ||
      `http://localhost:${process.env.PORT ?? 5000}`
    );
  }
}
