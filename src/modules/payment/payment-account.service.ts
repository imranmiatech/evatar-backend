import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
import {
  SavePayoutMethodDto,
  UpdateMembershipRoutingDto,
} from '../setting/dto/setting.dto';

type PaymentRecipientOptions = {
  nannyUserId?: string;
  productId?: string;
  storeId?: string;
};

type StripeChargeSource = {
  storedPaymentMethod: any | null;
  stripePaymentMethodId: string | null;
  stripeCustomerId: string | null;
};

type PaymentRecipient = {
  context: string;
  targetUserId: string;
  targetRole: string;
  targetName: string;
  targetEmail?: string | null;
  payoutMethod: {
    id: string;
    label: string | null;
    methodType: string;
    providerName: string;
    stripeConnectedAccountId: string | null;
    accountHolderName: string | null;
    cardLast4: string | null;
    accountNumberMasked: string | null;
    routingNumberMasked: string | null;
    ibanMasked: string | null;
    expiryMonth: number | null;
    expiryYear: number | null;
    isDefault: boolean;
    isActive: boolean;
    displayValue: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

type StripeConnectStatus = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  requirementsCurrentlyDue: string[];
  requirementsEventuallyDue: string[];
};

@Injectable()
export class PaymentAccountService {
  private readonly stripe: Stripe | null;

  constructor(private readonly prisma: PrismaService) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.stripe =
      secretKey && !secretKey.includes('dummy')
        ? new Stripe(secretKey)
        : null;
  }

  async getPaymentMethods(userId: string) {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((method) => this.serializePaymentMethod(method));
  }

  async addPaymentMethod(userId: string, dto: SavePaymentMethodDto) {
    const normalizedCardNumber = this.normalizeDigits(dto.cardNumber);
    const trimmedCvv = dto.cvv?.trim();
    let last4 = dto.last4 || normalizedCardNumber?.slice(-4);

    if (!last4) {
      throw new BadRequestException('Card number or last4 is required.');
    }

    const existingCount = await this.prisma.paymentMethod.count({
      where: { userId },
    });
    const shouldBeDefault = dto.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    let stripePaymentMethodId: string | null = null;
    let brand = dto.brand || this.detectCardBrand(normalizedCardNumber);
    let expMonth = dto.expMonth;
    let expYear = dto.expYear;
    let cardholderName = dto.cardholderName || null;

    if (this.shouldPersistInStripe(normalizedCardNumber, trimmedCvv)) {
      const stripeCard = await this.createStripePaymentMethodForUser(userId, {
        cardNumber: normalizedCardNumber!,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        cvv: trimmedCvv!,
        cardholderName: cardholderName || undefined,
      });

      stripePaymentMethodId = stripeCard.stripePaymentMethodId;
      brand = stripeCard.brand;
      last4 = stripeCard.last4;
      expMonth = stripeCard.expMonth;
      expYear = stripeCard.expYear;
      cardholderName = stripeCard.cardholderName;

      const duplicate = await this.prisma.paymentMethod.findFirst({
        where: {
          userId,
          stripePaymentMethodId: stripeCard.stripePaymentMethodId,
        },
      });

      if (duplicate) {
        return this.serializePaymentMethod(duplicate);
      }
    }

    const created = await this.prisma.paymentMethod.create({
      data: {
        userId,
        stripePaymentMethodId,
        brand,
        last4,
        expMonth,
        expYear,
        cardholderName,
        isDefault: shouldBeDefault,
      },
    });

    if (shouldBeDefault && stripePaymentMethodId) {
      await this.syncStripeDefaultPaymentMethod(userId, stripePaymentMethodId);
    }

    return this.serializePaymentMethod(created);
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found.');
    }

    await this.prisma.paymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    });

    if (updated.stripePaymentMethodId) {
      await this.syncStripeDefaultPaymentMethod(
        userId,
        updated.stripePaymentMethodId,
      );
    }

    return this.serializePaymentMethod(updated);
  }

  async removeDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found.');
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: false },
    });

    if (updated.stripePaymentMethodId) {
      await this.syncStripeDefaultPaymentMethod(userId, null);
    }

    return this.serializePaymentMethod(updated);
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found.');
    }

    if (method.stripePaymentMethodId && this.stripe) {
      try {
        const stripeMethod = await this.stripe.paymentMethods.retrieve(
          method.stripePaymentMethodId,
        );

        if (typeof stripeMethod.customer === 'string' && stripeMethod.customer) {
          await this.stripe.paymentMethods.detach(method.stripePaymentMethodId);
        }
      } catch {
        // Keep DB cleanup resilient even if Stripe side was already removed.
      }
    }

    await this.prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    if (method.isDefault) {
      await this.syncStripeDefaultPaymentMethod(userId, null);
    }

    return { message: 'Payment method removed successfully.' };
  }

  async resolveSelectedPaymentMethod(
    userId: string,
    paymentMethodId?: string | null,
    useDefaultFallback = true,
  ) {
    let method: any = null;

    if (paymentMethodId) {
      method = await this.prisma.paymentMethod.findFirst({
        where: { id: paymentMethodId, userId },
      });
    }

    if (!method && useDefaultFallback) {
      method = await this.prisma.paymentMethod.findFirst({
        where: { userId, isDefault: true },
      });
    }

    return method ? this.serializePaymentMethod(method) : null;
  }

  async getStripeChargeSource(
    userId: string,
    paymentMethodId?: string | null,
    useDefaultFallback = true,
  ): Promise<StripeChargeSource> {
    const storedPaymentMethod = await this.resolveSelectedPaymentMethod(
      userId,
      paymentMethodId,
      useDefaultFallback,
    );

    if (!storedPaymentMethod?.stripePaymentMethodId) {
      return {
        storedPaymentMethod,
        stripePaymentMethodId: null,
        stripeCustomerId: null,
      };
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const stripeMethod = await this.stripe.paymentMethods.retrieve(
      storedPaymentMethod.stripePaymentMethodId,
    );

    let stripeCustomerId =
      typeof stripeMethod.customer === 'string' ? stripeMethod.customer : null;

    if (!stripeCustomerId) {
      stripeCustomerId = await this.findStripeCustomerIdForUser(userId, true);
      await this.stripe.paymentMethods.attach(storedPaymentMethod.stripePaymentMethodId, {
        customer: stripeCustomerId || undefined,
      });
    }

    return {
      storedPaymentMethod,
      stripePaymentMethodId: storedPaymentMethod.stripePaymentMethodId,
      stripeCustomerId,
    };
  }

  async getPayoutMethods(userId: string) {
    const methods = await this.prisma.payoutMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((method) => this.serializePayoutMethod(method));
  }

  async savePayoutMethod(userId: string, dto: SavePayoutMethodDto) {
    const cardNumber = this.normalizeDigits(dto.cardNumber);
    const accountNumber = this.normalizeDigits(dto.accountNumber);
    const routingNumber = this.normalizeDigits(dto.routingNumber);
    const iban = dto.iban?.replace(/\s+/g, '').trim();
    const cardLast4 = dto.cardLast4 || cardNumber?.slice(-4);
    const stripeConnectedAccountId =
      dto.stripeConnectedAccountId?.trim() || null;

    if (!cardLast4 && !accountNumber && !iban && !stripeConnectedAccountId) {
      throw new BadRequestException(
        'Provide cardNumber/cardLast4, accountNumber/iban, or stripeConnectedAccountId to save a payout method.',
      );
    }

    const existingCount = await this.prisma.payoutMethod.count({
      where: { userId },
    });
    const shouldBeDefault = dto.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await this.prisma.payoutMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.payoutMethod.create({
      data: {
        userId,
        label: dto.label || null,
        methodType:
          dto.methodType || (iban || accountNumber ? 'BANK_ACCOUNT' : 'CARD'),
        providerName: dto.providerName || this.detectCardBrand(cardNumber),
        stripeConnectedAccountId,
        accountHolderName: dto.accountHolderName || null,
        cardBrand: this.detectCardBrand(cardNumber),
        cardLast4: cardLast4 || null,
        accountNumberMasked: this.maskDigits(accountNumber),
        routingNumberMasked: this.maskDigits(routingNumber),
        ibanMasked: this.maskIban(iban),
        expiryMonth: dto.expiryMonth || null,
        expiryYear: dto.expiryYear || null,
        isDefault: shouldBeDefault,
      },
    });

    return this.serializePayoutMethod(created);
  }

  async createStripeOnboardingLink(
    userId: string,
    input: {
      returnUrl?: string;
      refreshUrl?: string;
    } = {},
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.PARTNER) {
      throw new BadRequestException(
        'Only partner accounts can start Stripe onboarding.',
      );
    }

    let payoutMethod = await this.prisma.payoutMethod.findFirst({
      where: {
        userId,
        stripeConnectedAccountId: { not: null },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    let accountId = payoutMethod?.stripeConnectedAccountId || null;

    if (accountId) {
      try {
        await this.stripe.accounts.retrieve(accountId);
      } catch {
        accountId = null;
      }
    }

    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email: user.email || undefined,
        business_type: 'individual',
        business_profile: {
          name: user.fullName,
          product_description: 'Partner store payouts for grocery orders',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          userId: user.id,
          role: user.role,
        },
      });

      accountId = account.id;

      if (payoutMethod) {
        payoutMethod = await this.prisma.payoutMethod.update({
          where: { id: payoutMethod.id },
          data: {
            label: payoutMethod.label || 'Stripe Connect Onboarding',
            providerName: 'Stripe Connect',
            methodType: 'BANK_ACCOUNT',
            stripeConnectedAccountId: accountId,
            accountHolderName: user.fullName,
            isDefault: true,
          },
        });
      } else {
        await this.prisma.payoutMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });

        payoutMethod = await this.prisma.payoutMethod.create({
          data: {
            userId,
            label: 'Stripe Connect Onboarding',
            methodType: 'BANK_ACCOUNT',
            providerName: 'Stripe Connect',
            stripeConnectedAccountId: accountId,
            accountHolderName: user.fullName,
            isDefault: true,
          },
        });
      }
    }

    const baseUrl =
      process.env.APP_BASE_URL ||
      `http://localhost:${process.env.PORT ?? 5000}`;

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url:
        input.refreshUrl?.trim() ||
        `${baseUrl}/grocery-order-ui.html?partner_onboarding=refresh`,
      return_url:
        input.returnUrl?.trim() ||
        `${baseUrl}/grocery-order-ui.html?partner_onboarding=done`,
      type: 'account_onboarding',
    });

    return {
      accountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
      payoutMethod: payoutMethod
        ? this.serializePayoutMethod(payoutMethod)
        : null,
    };
  }

  async getStripeConnectStatus(userId: string): Promise<StripeConnectStatus> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const payoutMethod = await this.prisma.payoutMethod.findFirst({
      where: {
        userId,
        stripeConnectedAccountId: { not: null },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (!payoutMethod?.stripeConnectedAccountId) {
      throw new NotFoundException(
        'No Stripe connected account found for this partner.',
      );
    }

    const account = await this.stripe.accounts.retrieve(
      payoutMethod.stripeConnectedAccountId,
    );

    return {
      accountId: account.id,
      chargesEnabled: !!account.charges_enabled,
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      onboardingComplete:
        !!account.details_submitted &&
        !!account.charges_enabled &&
        !!account.payouts_enabled,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      requirementsEventuallyDue: account.requirements?.eventually_due || [],
    };
  }

  async setDefaultPayoutMethod(userId: string, payoutMethodId: string) {
    const method = await this.prisma.payoutMethod.findFirst({
      where: { id: payoutMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    await this.prisma.payoutMethod.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    const updated = await this.prisma.payoutMethod.update({
      where: { id: payoutMethodId },
      data: { isDefault: true },
    });

    return this.serializePayoutMethod(updated);
  }

  async removeDefaultPayoutMethod(userId: string, payoutMethodId: string) {
    const method = await this.prisma.payoutMethod.findFirst({
      where: { id: payoutMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payout method not found');
    }

    const updated = await this.prisma.payoutMethod.update({
      where: { id: payoutMethodId },
      data: { isDefault: false },
    });

    return this.serializePayoutMethod(updated);
  }

  async getPaymentRoutingOverview() {
    const [membershipRouting, admins] = await Promise.all([
      this.prisma.paymentRoutingSetting.findUnique({
        where: { paymentContext: 'MEMBERSHIP_SUBSCRIPTION' },
        include: {
          targetUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              payoutMethods: {
                where: { isDefault: true },
                take: 1,
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          payoutMethods: {
            where: { isDefault: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      membershipSubscription: membershipRouting
        ? {
            targetUserId: membershipRouting.targetUserId,
            notes: membershipRouting.notes,
            recipient: membershipRouting.targetUser
              ? this.serializeRecipient(
                  membershipRouting.targetUser,
                  membershipRouting.targetUser.payoutMethods?.[0],
                  'MEMBERSHIP_SUBSCRIPTION',
                )
              : null,
          }
        : null,
      admins: admins.map((admin) =>
        this.serializeRecipient(admin, admin.payoutMethods?.[0], 'ADMIN'),
      ),
      contexts: ['NANNY_TIP', 'MEMBERSHIP_SUBSCRIPTION', 'PARTNER_PRODUCT'],
    };
  }

  async updateMembershipRouting(dto: UpdateMembershipRoutingDto) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      include: {
        payoutMethods: {
          where: { isDefault: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new BadRequestException('Target user must be an admin.');
    }

    const updated = await this.prisma.paymentRoutingSetting.upsert({
      where: { paymentContext: 'MEMBERSHIP_SUBSCRIPTION' },
      update: {
        targetUserId: dto.targetUserId,
        notes: dto.notes || null,
      },
      create: {
        paymentContext: 'MEMBERSHIP_SUBSCRIPTION',
        targetUserId: dto.targetUserId,
        notes: dto.notes || null,
      },
    });

    return {
      ...updated,
      recipient: this.serializeRecipient(
        adminUser,
        adminUser.payoutMethods?.[0],
        'MEMBERSHIP_SUBSCRIPTION',
      ),
    };
  }

  async resolvePaymentRecipient(
    context: string,
    options: PaymentRecipientOptions = {},
  ): Promise<PaymentRecipient | (PaymentRecipient & Record<string, any>)> {
    switch (context) {
      case 'NANNY_TIP': {
        if (!options.nannyUserId) {
          throw new BadRequestException(
            'nannyUserId is required for NANNY_TIP routing.',
          );
        }

        const nanny = await this.prisma.user.findUnique({
          where: { id: options.nannyUserId },
          include: {
            payoutMethods: {
              where: { isDefault: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!nanny) {
          throw new NotFoundException('Nanny not found.');
        }

        return this.serializeRecipient(nanny, nanny.payoutMethods?.[0], context);
      }
      case 'PARTNER_PRODUCT': {
        if (!options.productId) {
          throw new BadRequestException(
            'productId is required for PARTNER_PRODUCT routing.',
          );
        }

        const product = await this.prisma.partnerProduct.findUnique({
          where: { id: options.productId },
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
          throw new NotFoundException('Partner product not found.');
        }

        return {
          ...this.serializeRecipient(
            product.partnerUser,
            product.partnerUser.payoutMethods?.[0],
            context,
          ),
          productId: product.id,
          productName: product.productName,
        };
      }
      case 'GROCERY_ORDER': {
        if (!options.storeId) {
          throw new BadRequestException(
            'storeId is required for GROCERY_ORDER routing.',
          );
        }

        const store = await this.prisma.store.findUnique({
          where: { id: options.storeId },
          include: {
            user: {
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

        if (!store) {
          throw new NotFoundException('Store not found.');
        }

        return {
          ...this.serializeRecipient(
            store.user,
            store.user.payoutMethods?.[0],
            context,
          ),
          storeId: store.id,
          storeName: store.name,
        };
      }
      case 'MEMBERSHIP_SUBSCRIPTION': {
        const routing = await this.prisma.paymentRoutingSetting.findUnique({
          where: { paymentContext: 'MEMBERSHIP_SUBSCRIPTION' },
          include: {
            targetUser: {
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

        if (routing?.targetUser) {
          return this.serializeRecipient(
            routing.targetUser,
            routing.targetUser.payoutMethods?.[0],
            context,
          );
        }

        const fallbackAdmin = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          include: {
            payoutMethods: {
              where: { isDefault: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!fallbackAdmin) {
          throw new NotFoundException('No admin found for membership routing.');
        }

        return this.serializeRecipient(
          fallbackAdmin,
          fallbackAdmin.payoutMethods?.[0],
          context,
        );
      }
      default:
        throw new BadRequestException(
          'Unsupported context. Use NANNY_TIP, MEMBERSHIP_SUBSCRIPTION, PARTNER_PRODUCT, or GROCERY_ORDER.',
        );
    }
  }

  private serializePaymentMethod(method: any) {
    return {
      id: method.id,
      brand: method.brand || 'Card',
      last4: method.last4,
      expMonth: method.expMonth,
      expYear: method.expYear,
      cardholderName: method.cardholderName,
      stripePaymentMethodId: method.stripePaymentMethodId,
      paymentToken: method.stripePaymentMethodId,
      isDefault: method.isDefault,
      maskedNumber: `**** **** **** ${method.last4 || '0000'}`,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private serializePayoutMethod(method: any) {
    return {
      id: method.id,
      label: method.label,
      methodType: method.methodType,
      providerName: method.providerName || method.cardBrand || 'Account',
      stripeConnectedAccountId: method.stripeConnectedAccountId || null,
      accountHolderName: method.accountHolderName,
      cardLast4: method.cardLast4,
      accountNumberMasked: method.accountNumberMasked,
      routingNumberMasked: method.routingNumberMasked,
      ibanMasked: method.ibanMasked,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      isDefault: method.isDefault,
      isActive: method.isActive,
      displayValue: method.cardLast4
        ? `**** ${method.cardLast4}`
        : method.ibanMasked || method.accountNumberMasked || null,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private serializeRecipient(user: any, payoutMethod: any, context: string) {
    return {
      context,
      targetUserId: user.id,
      targetRole: user.role,
      targetName: user.fullName,
      targetEmail: user.email,
      payoutMethod: payoutMethod ? this.serializePayoutMethod(payoutMethod) : null,
    };
  }

  private shouldPersistInStripe(
    normalizedCardNumber?: string,
    trimmedCvv?: string,
  ) {
    return !!(this.stripe && normalizedCardNumber && trimmedCvv);
  }

  private async createStripePaymentMethodForUser(
    userId: string,
    input: {
      cardNumber: string;
      expMonth: number;
      expYear: number;
      cvv: string;
      cardholderName?: string;
    },
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const customerId = await this.findStripeCustomerIdForUser(userId, true);
    const stripeTestToken = this.resolveStripeTestToken(input.cardNumber);

    if (!stripeTestToken) {
      throw new BadRequestException(
        'This test payment page supports Stripe test cards only. Use 4242 4242 4242 4242, 5555 5555 5555 4444, 3782 822463 10005, or 6011 1111 1111 1117.',
      );
    }

    const paymentMethod = await this.stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: stripeTestToken,
      },
      billing_details: {
        name: input.cardholderName,
      },
      metadata: {
        userId,
      },
    });

    await this.stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customerId || undefined,
    });

    return {
      stripePaymentMethodId: paymentMethod.id,
      brand: this.normalizeStripeBrand(paymentMethod.card?.brand),
      last4: paymentMethod.card?.last4 || input.cardNumber.slice(-4),
      expMonth: paymentMethod.card?.exp_month || input.expMonth,
      expYear: paymentMethod.card?.exp_year || input.expYear,
      cardholderName: paymentMethod.billing_details?.name || input.cardholderName || null,
    };
  }

  private async syncStripeDefaultPaymentMethod(
    userId: string,
    stripePaymentMethodId: string | null,
  ) {
    if (!this.stripe) {
      return;
    }

    const customerId = await this.findStripeCustomerIdForUser(userId, false);
    if (!customerId) {
      return;
    }

    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: stripePaymentMethodId ?? (null as any),
      },
    });
  }

  private async findStripeCustomerIdForUser(
    userId: string,
    createIfMissing: boolean,
  ) {
    if (!this.stripe) {
      return null;
    }

    const savedStripeMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        userId,
        stripePaymentMethodId: {
          not: null,
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (savedStripeMethod?.stripePaymentMethodId) {
      try {
        const stripeMethod = await this.stripe.paymentMethods.retrieve(
          savedStripeMethod.stripePaymentMethodId,
        );

        if (typeof stripeMethod.customer === 'string' && stripeMethod.customer) {
          return stripeMethod.customer;
        }
      } catch {
        // Fall through to customer lookup/create.
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    if (user?.email) {
      const customers = await this.stripe.customers.list({
        email: user.email,
        limit: 10,
      });
      const matchedCustomer =
        customers.data.find((customer) => customer.metadata?.userId === userId) ||
        customers.data[0];

      if (matchedCustomer) {
        return matchedCustomer.id;
      }
    }

    if (!createIfMissing) {
      return null;
    }

    const customer = await this.stripe.customers.create({
      email: user?.email || undefined,
      name: user?.fullName || undefined,
      metadata: {
        userId,
      },
    });

    return customer.id;
  }

  private normalizeStripeBrand(brand?: string | null) {
    if (!brand) return 'Card';
    return brand
      .split(/[_\s-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private resolveStripeTestToken(cardNumber: string) {
    const normalized = this.normalizeDigits(cardNumber);

    const tokenMap: Record<string, string> = {
      '4242424242424242': 'tok_visa',
      '4000056655665556': 'tok_visa_debit',
      '5555555555554444': 'tok_mastercard',
      '5200828282828210': 'tok_mastercard_debit',
      '378282246310005': 'tok_amex',
      '6011111111111117': 'tok_discover',
    };

    return tokenMap[normalized || ''] || null;
  }

  private normalizeDigits(value?: string) {
    return value?.replace(/\s+/g, '').trim();
  }

  private maskDigits(value?: string) {
    if (!value) return null;
    const visible = value.slice(-4);
    return `${'*'.repeat(Math.max(0, value.length - 4))}${visible}`;
  }

  private maskIban(value?: string) {
    if (!value) return null;
    if (value.length <= 8) return value;
    return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;
  }

  private detectCardBrand(cardNumber?: string) {
    if (!cardNumber) return null;
    if (/^4/.test(cardNumber)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return 'Mastercard';
    if (/^3[47]/.test(cardNumber)) return 'American Express';
    if (/^6(?:011|5)/.test(cardNumber)) return 'Discover';
    return 'Card';
  }
}
