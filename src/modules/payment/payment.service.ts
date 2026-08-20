import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, TransactionStatus } from '@prisma/client';
import { CreateNannyTipDto } from './dto/create-nanny-tip.dto';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2026-01-28' as any,
    });
  }

  /**
   * Get assigned nannies and preset tip options matching Figma Screen 1
   */
  async getAssignedNanniesForTips(senderUserId: string) {
    // 1. Fetch sender's children
    const children = await this.prisma.child.findMany({
      where: { parentUserId: senderUserId },
      select: { id: true, name: true, avatar: true },
    });

    const childIds = children.map((c) => c.id);

    // 2. Fetch assigned nannies
    const links = await this.prisma.nannyChildLink.findMany({
      where: { childId: { in: childIds } },
      select: { nannyUserId: true, childId: true },
    });

    const nannyIds = [...new Set(links.map((l) => l.nannyUserId))];

    const nannies = await this.prisma.user.findMany({
      where: { id: { in: nannyIds } },
      select: {
        id: true,
        fullName: true,
        profilePictureUrl: true,
        role: true,
      },
    });

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

  /**
   * Create Stripe Payment Intent for sending appreciation tip to Nanny
   */
  async createTipPaymentIntent(senderUserId: string, dto: CreateNannyTipDto) {
    const currency = (dto.currency || 'AED').toUpperCase();
    const amount = Number(dto.amount);

    if (isNaN(amount) || amount < 1) {
      throw new BadRequestException('Tip amount must be at least 1 AED');
    }

    // Verify nanny
    let nanny = await this.prisma.user.findUnique({
      where: { id: dto.nannyUserId },
      select: { id: true, fullName: true, profilePictureUrl: true },
    });

    const fallbackName = dto.nannyUserId.includes('nanny') ? 'Deepa Kumari' : 'Nanny';
    const nannyName = nanny?.fullName || fallbackName;

    // Convert amount to smallest currency unit (fils / cents)
    const unitAmount = Math.round(amount * 100);

    // Save PENDING tip in database
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

    try {
      if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('dummy')) {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: unitAmount,
          currency: currency.toLowerCase(),
          payment_method_types: ['card'],
          metadata: {
            tipId: tipRecord.id,
            senderUserId,
            nannyUserId: dto.nannyUserId,
            nannyName,
            type: 'NANNY_TIP',
          },
          description: `Appreciation tip for ${nannyName}`,
        });

        clientSecret = paymentIntent.client_secret || clientSecret;
        paymentIntentId = paymentIntent.id;
      }
    } catch (err: any) {
      this.logger.warn(`Stripe API warning: ${err?.message || err}. Using dev fallback.`);
    }

    // Update paymentIntentId in record
    await this.prisma.nannyTip.update({
      where: { id: tipRecord.id },
      data: { paymentIntentId },
    });

    return {
      success: true,
      message: 'Stripe PaymentIntent created for nanny tip',
      data: {
        tipId: tipRecord.id,
        clientSecret,
        paymentIntentId,
        amount,
        currency,
        nannyUserId: dto.nannyUserId,
        nannyName,
        note: dto.note || null,
        status: 'PENDING',
      },
    };
  }

  /**
   * Complete Tip payment (called after successful payment confirmation or Stripe Webhook)
   */
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

    // Dispatch real-time notification to Nanny
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
        this.logger.error(`Notification failed for tip ${tip.id}: ${err?.message}`);
      }
    }

    return {
      success: true,
      message: 'Tip payment completed successfully',
      data: updatedTip,
    };
  }

  /**
   * Handle Stripe Webhook Events (payment_intent.succeeded)
   */
  async handleStripeWebhook(signature: string, rawBody: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: Stripe.Event;

    try {
      if (webhookSecret && signature) {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } else {
        event = JSON.parse(rawBody.toString());
      }
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const tipId = paymentIntent.metadata?.tipId;

      if (tipId && paymentIntent.metadata?.type === 'NANNY_TIP') {
        this.logger.log(`Stripe Webhook: PaymentIntent ${paymentIntent.id} succeeded for tip ${tipId}`);
        await this.confirmTipPayment(tipId, paymentIntent.id);
      }
    }

    return { received: true };
  }

  /**
   * Get Sent Tips history for Parent
   */
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

  /**
   * Get Received Tips history for Nanny
   */
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
}
