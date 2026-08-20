import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionInterval } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMembershipPlanDto } from '../dto/create-plan.dto';

@Injectable()
export class MembershipPlanService {
  private readonly logger = new Logger(MembershipPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedDefaultPlans() {
    const existingPlans = await this.prisma.subscriptionPlan.count();
    if (existingPlans > 0) {
      return;
    }

    const defaultFeatures = [
      'Customized daily routines for every child—no micromanagement needed.',
      'Nanny insights grounded in real-life experiences.',
      'Unique bedtime stories crafted from their daily adventures.',
      'Personalised daily flow per child (meals, activities, rest).',
      'At-home and local activity suggestions.',
      'Care Layers tailored to child age and stage.',
      'Nightly personalised bedtime stories per child.',
      'Unlimited Care Assist (real-time support).',
      'Access to Alurei Membership Partner Perks.',
    ];

    try {
      await this.prisma.subscriptionPlan.createMany({
        data: [
          {
            name: '02 Child Membership',
            maxChildren: 2,
            price: 399,
            currency: 'AED',
            interval: SubscriptionInterval.MONTHLY,
            features: ['Up to 2 children included', ...defaultFeatures],
          },
          {
            name: 'Family Plus',
            maxChildren: 2,
            price: 3900,
            currency: 'AED',
            interval: SubscriptionInterval.ANNUALLY,
            savingsText: 'Save AED 798 by choosing annual billing.',
            features: [
              'Save AED 798 by choosing annual billing.',
              'Priority 24/7 concierge support.',
              'Up to 2 children included',
              ...defaultFeatures,
            ],
          },
        ],
      });
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
      orderBy: [{ interval: 'asc' }, { price: 'asc' }],
    });
  }

  createPlan(dto: CreateMembershipPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        maxChildren: dto.maxChildren,
        price: dto.price,
        currency: dto.currency || 'AED',
        interval: dto.interval || SubscriptionInterval.MONTHLY,
        savingsText: dto.savingsText || null,
        features: dto.features,
      },
    });
  }
}
