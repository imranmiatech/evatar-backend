import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SubscriptionInterval } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMembershipPlanDto } from '../dto/create-plan.dto';
import {
  computeMembershipPricing,
  formatMoneyInline,
} from '../utils/membership-pricing.util';

@Injectable()
export class MembershipPlanService implements OnModuleInit {
  private readonly logger = new Logger(MembershipPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  async seedDefaultPlans() {
    const globalFeatures = [
      'Up to 2 children',
      'Full AI Daily Planning',
      'Up to 3 carers',
      'Bedtime Stories',
      'Full weekly insights',
      'Caregiver Learning',
      'Priority support',
    ];
    const premiumFeatures = [
      'Up to 2 children',
      'Full AI Daily Planning',
      'Up to 3 carers',
      'Bedtime Stories',
      'Full weekly insights',
      'Unlimited Alurei rewards',
      'Priority support',
    ];

    try {
      await this.ensurePlan(
        {
          name: 'Global',
          interval: SubscriptionInterval.MONTHLY,
        },
        {
          name: 'Global',
          maxChildren: 2,
          price: 49,
          currency: 'USD',
          interval: SubscriptionInterval.MONTHLY,
          description: 'Flexible monthly billing. Cancel anytime.',
          badgeText: null,
          savingsText: null,
          additionalChildPrice: 10,
          additionalChildCurrency: 'USD',
          sortOrder: 1,
          features: globalFeatures,
          isActive: true,
        },
      );

      await this.ensurePlan(
        {
          interval: SubscriptionInterval.MONTHLY,
          currency: 'AED',
        },
        {
          name: 'Monthly',
          maxChildren: 2,
          price: 399,
          currency: 'AED',
          interval: SubscriptionInterval.MONTHLY,
          description: 'The complete Alurei experience for growing families.',
          badgeText: null,
          savingsText: null,
          additionalChildPrice: 35,
          additionalChildCurrency: 'AED',
          sortOrder: 2,
          features: premiumFeatures,
          isActive: true,
        },
      );

      await this.ensurePlan(
        {
          interval: SubscriptionInterval.ANNUALLY,
          currency: 'AED',
        },
        {
          name: 'Yearly',
          maxChildren: 2,
          price: 3990,
          currency: 'AED',
          interval: SubscriptionInterval.ANNUALLY,
          description: 'Save 2 months with annual billing.',
          badgeText: 'Save 2 Months',
          savingsText: 'Save 2 months with annual billing.',
          additionalChildPrice: 35,
          additionalChildCurrency: 'AED',
          sortOrder: 3,
          features: premiumFeatures,
          isActive: true,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Skipping membership plan auto-seed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { interval: 'asc' }, { price: 'asc' }],
    }).then((plans) =>
      this.deduplicatePlans(plans).map((plan) => {
        const pricing = computeMembershipPricing(plan, 0);

        return {
          ...plan,
          additionalChildText: pricing.additionalChildText,
          formattedPrice: formatMoneyInline(plan.price, plan.currency),
          periodSuffix:
            plan.interval === SubscriptionInterval.ANNUALLY
              ? '/ per year'
              : '/ per month',
        };
      }),
    );
  }

  async getPlanById(planId: string) {
    return this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
  }

  createPlan(dto: CreateMembershipPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        maxChildren: dto.maxChildren,
        price: dto.price,
        currency: dto.currency || 'AED',
        description: dto.description || null,
        badgeText: dto.badgeText || null,
        interval: dto.interval || SubscriptionInterval.MONTHLY,
        savingsText: dto.savingsText || null,
        additionalChildPrice: dto.additionalChildPrice ?? 35,
        additionalChildCurrency: dto.additionalChildCurrency || dto.currency || 'AED',
        sortOrder: dto.sortOrder ?? 99,
        features: dto.features,
      },
    });
  }

  private async ensurePlan(
    where: {
      name?: string;
      interval?: SubscriptionInterval;
      currency?: string;
    },
    data: {
      name: string;
      maxChildren: number;
      price: number;
      currency: string;
      interval: SubscriptionInterval;
      description: string | null;
      badgeText: string | null;
      savingsText: string | null;
      additionalChildPrice: number;
      additionalChildCurrency: string;
      sortOrder: number;
      features: string[];
      isActive: boolean;
    },
  ) {
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      await this.prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data,
      });
      await this.deactivateDuplicatePlans(existing.id, data.name);
      return existing.id;
    }

    const created = await this.prisma.subscriptionPlan.create({ data });
    await this.deactivateDuplicatePlans(created.id, data.name);
    return created.id;
  }

  private deduplicatePlans<T extends { name: string; currency: string; interval: SubscriptionInterval }>(
    plans: T[],
  ) {
    const seen = new Set<string>();
    return plans.filter((plan) => {
      const key = `${plan.name}::${plan.currency}::${plan.interval}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async deactivateDuplicatePlans(keepId: string, name: string) {
    await this.prisma.subscriptionPlan.updateMany({
      where: {
        name,
        id: { not: keepId },
      },
      data: {
        isActive: false,
      },
    });
  }
}
