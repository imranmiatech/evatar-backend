import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SubscriptionInterval } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMembershipPlanDto } from '../dto/create-plan.dto';
import { UpdateMembershipPlanDto } from '../dto/update-plan.dto';
import {
  computeMembershipPricing,
  formatMoneyInline,
} from '../utils/membership-pricing.util';

@Injectable()
export class MembershipPlanService implements OnModuleInit {
  private readonly logger = new Logger(MembershipPlanService.name);
  private static readonly MANAGED_PLAN_KEYS = [
    'free',
    'monthly',
    'yearly',
    'global',
  ] as const;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  async seedDefaultPlans() {
    const complimentaryFeatures = [
      'Manage 1 child',
      'Manage 1 parent',
      'Manage 1 family member',
      'Manage 1 nanny',
      'Starter planning access',
      'Basic support',
    ];
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
          isComplimentary: true,
        },
        {
          name: 'Free',
          isComplimentary: true,
          maxChildren: 1,
          trialDayPeriod: 14,
          maxParents: 1,
          maxFamilyMembers: 1,
          maxNannies: 1,
          photoVideoStorageGb: 5,
          storyStorageCount: 3,
          documentStorageGb: 2,
          price: 0,
          currency: 'AED',
          interval: SubscriptionInterval.MONTHLY,
          description: 'Complimentary family access with starter limits.',
          badgeText: 'Free',
          savingsText: null,
          additionalChildPrice: 0,
          additionalChildCurrency: 'AED',
          sortOrder: 0,
          features: complimentaryFeatures,
          isActive: true,
        },
      );

      await this.ensurePlan(
        {
          name: 'Global',
          interval: SubscriptionInterval.MONTHLY,
        },
        {
          name: 'Global',
          isComplimentary: false,
          maxChildren: 2,
          trialDayPeriod: 14,
          maxParents: 0,
          maxFamilyMembers: 0,
          maxNannies: 0,
          photoVideoStorageGb: 0,
          storyStorageCount: 0,
          documentStorageGb: 0,
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
          isComplimentary: false,
          maxChildren: 2,
          trialDayPeriod: 14,
          maxParents: 2,
          maxFamilyMembers: 3,
          maxNannies: 2,
          photoVideoStorageGb: 0,
          storyStorageCount: 0,
          documentStorageGb: 0,
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
          isComplimentary: false,
          maxChildren: 2,
          trialDayPeriod: 14,
          maxParents: 2,
          maxFamilyMembers: 3,
          maxNannies: 2,
          photoVideoStorageGb: 0,
          storyStorageCount: 0,
          documentStorageGb: 0,
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
      where: { isActive: true, isComplimentary: false },
      orderBy: [{ sortOrder: 'asc' }, { interval: 'asc' }, { price: 'asc' }],
    }).then((plans) =>
      this.deduplicatePlans(plans).map((plan) => {
        const pricing = computeMembershipPricing(plan, 0);

        return this.serializePlan({
          ...plan,
          additionalChildText: pricing.additionalChildText,
          formattedPrice: formatMoneyInline(plan.price, plan.currency),
          periodSuffix:
            plan.interval === SubscriptionInterval.ANNUALLY
              ? '/ per year'
              : '/ per month',
        });
      }),
    );
  }

  async getPlanById(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true },
    });

    return plan ? this.serializePlan(plan) : null;
  }

  getAdminPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: [
        { isActive: 'desc' },
        { sortOrder: 'asc' },
        { interval: 'asc' },
        { price: 'asc' },
        { createdAt: 'desc' },
      ],
    }).then((plans) => plans.map((plan) => this.serializePlan(plan)));
  }

  async getAdminPlanById(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Membership plan not found.');
    }

    return this.serializePlan(plan);
  }

  async getManagedPlanConfigs() {
    const plans = await Promise.all(
      MembershipPlanService.MANAGED_PLAN_KEYS.map((key) =>
        this.resolvePresetPlan(key),
      ),
    );

    return plans.map((plan) => this.serializePlan(plan));
  }

  async getManagedPlanConfig(key: string) {
    const plan = await this.resolvePresetPlan(key);
    return this.serializePlan(plan);
  }

  async createPlan(dto: CreateMembershipPlanDto) {
    await this.validatePlanPayload(dto);

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        isComplimentary: dto.isComplimentary ?? false,
        maxChildren: dto.maxChildren,
        trialDayPeriod: dto.trialDayPeriod ?? 14,
        maxParents: dto.maxParents ?? 1,
        maxFamilyMembers: dto.maxFamilyMembers ?? 1,
        maxNannies: dto.maxNannies ?? 1,
        photoVideoStorageGb: dto.photoVideoStorageGb ?? 0,
        storyStorageCount: dto.storyStorageCount ?? 0,
        documentStorageGb: dto.documentStorageGb ?? 0,
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

    return this.serializePlan(plan);
  }

  async updatePlan(planId: string, dto: UpdateMembershipPlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      throw new NotFoundException('Membership plan not found.');
    }

    await this.validatePlanPayload(dto, existing);

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name: dto.name ?? existing.name,
        isComplimentary: dto.isComplimentary ?? existing.isComplimentary,
        maxChildren: dto.maxChildren ?? existing.maxChildren,
        trialDayPeriod: dto.trialDayPeriod ?? existing.trialDayPeriod,
        maxParents: dto.maxParents ?? existing.maxParents,
        maxFamilyMembers: dto.maxFamilyMembers ?? existing.maxFamilyMembers,
        maxNannies: dto.maxNannies ?? existing.maxNannies,
        photoVideoStorageGb:
          dto.photoVideoStorageGb ?? existing.photoVideoStorageGb,
        storyStorageCount: dto.storyStorageCount ?? existing.storyStorageCount,
        documentStorageGb:
          dto.documentStorageGb ?? existing.documentStorageGb,
        price: dto.price ?? existing.price,
        currency: dto.currency ?? existing.currency,
        description:
          dto.description !== undefined ? dto.description : existing.description,
        badgeText: dto.badgeText !== undefined ? dto.badgeText : existing.badgeText,
        interval: dto.interval ?? existing.interval,
        savingsText:
          dto.savingsText !== undefined
            ? dto.savingsText
            : existing.savingsText,
        additionalChildPrice:
          dto.additionalChildPrice ?? existing.additionalChildPrice,
        additionalChildCurrency:
          dto.additionalChildCurrency ?? dto.currency ?? existing.additionalChildCurrency,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        features: dto.features ?? existing.features,
        isActive: true,
      },
    });

    return this.serializePlan(plan);
  }

  async updateManagedPlanConfig(key: string, dto: UpdateMembershipPlanDto) {
    const plan = await this.resolvePresetPlan(key);
    const enforcedDto =
      this.normalizePresetPlanUpdate(key, dto, plan.isComplimentary);

    return this.updatePlan(plan.id, enforcedDto);
  }

  async deletePlan(planId: string) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      throw new NotFoundException('Membership plan not found.');
    }

    await this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });

    return { message: 'Membership plan deactivated successfully.' };
  }

  private async ensurePlan(
    where: {
      name?: string;
      isComplimentary?: boolean;
      interval?: SubscriptionInterval;
      currency?: string;
    },
    data: {
      name: string;
      isComplimentary: boolean;
      maxChildren: number;
      trialDayPeriod: number;
      maxParents: number;
      maxFamilyMembers: number;
      maxNannies: number;
      photoVideoStorageGb: number;
      storyStorageCount: number;
      documentStorageGb: number;
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

  private async validatePlanPayload(
    dto: Partial<CreateMembershipPlanDto>,
    existing?: {
      id: string;
      name: string;
      isComplimentary: boolean;
      interval: SubscriptionInterval;
      currency: string;
      features: string[];
    },
  ) {
    const features = dto.features ?? existing?.features ?? [];
    if (!features.length) {
      throw new BadRequestException(
        'Membership plan must contain at least one feature.',
      );
    }

    const name = dto.name?.trim() || existing?.name;
    const isComplimentary =
      dto.isComplimentary ?? existing?.isComplimentary ?? false;
    const interval = dto.interval ?? existing?.interval;
    const currency = (dto.currency || existing?.currency || 'AED').toUpperCase();

    if (!name || !interval) {
      return;
    }

    const duplicate = await this.prisma.subscriptionPlan.findFirst({
      where: {
        id: existing ? { not: existing.id } : undefined,
        name,
        isComplimentary,
        interval,
        currency,
        isActive: true,
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        'An active membership plan already exists with the same name, interval, and currency.',
      );
    }
  }

  private async resolvePresetPlan(key: string) {
    const normalizedKey = key.trim().toLowerCase();
    this.ensureManagedPlanKey(normalizedKey);

    const presetWhere =
      normalizedKey === 'free'
        ? {
            isComplimentary: true,
          }
        : normalizedKey === 'monthly'
          ? {
              isComplimentary: false,
              interval: SubscriptionInterval.MONTHLY,
              currency: 'AED',
            }
          : normalizedKey === 'yearly'
            ? {
                isComplimentary: false,
                interval: SubscriptionInterval.ANNUALLY,
                currency: 'AED',
              }
            : {
                isComplimentary: false,
                name: 'Global',
                interval: SubscriptionInterval.MONTHLY,
                currency: 'USD',
              };

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: presetWhere,
      orderBy: { createdAt: 'asc' },
    });

    if (!plan) {
      throw new NotFoundException(`Preset membership plan "${normalizedKey}" not found.`);
    }

    return plan;
  }

  private normalizePresetPlanUpdate(
    key: string,
    dto: UpdateMembershipPlanDto,
    isComplimentary: boolean,
  ): UpdateMembershipPlanDto {
    const normalizedKey = key.trim().toLowerCase();
    const defaultName =
      normalizedKey === 'free'
        ? 'Free'
        : normalizedKey === 'monthly'
          ? 'Monthly'
          : normalizedKey === 'yearly'
            ? 'Yearly'
            : normalizedKey === 'global'
              ? 'Global'
              : dto.name;

    const defaultCurrency =
      normalizedKey === 'global' ? 'USD' : 'AED';
    const defaultInterval =
      normalizedKey === 'yearly'
        ? SubscriptionInterval.ANNUALLY
        : SubscriptionInterval.MONTHLY;

    return {
      ...dto,
      name: defaultName,
      isComplimentary,
      currency: dto.currency ?? defaultCurrency,
      interval: dto.interval ?? defaultInterval,
    };
  }

  private ensureManagedPlanKey(key: string) {
    if (
      !MembershipPlanService.MANAGED_PLAN_KEYS.includes(
        key as (typeof MembershipPlanService.MANAGED_PLAN_KEYS)[number],
      )
    ) {
      throw new NotFoundException(
        `Supported managed plan keys are: ${MembershipPlanService.MANAGED_PLAN_KEYS.join(', ')}.`,
      );
    }
  }

  private serializePlan<T extends Record<string, any>>(plan: T) {
    return {
      ...plan,
      presetKey: this.detectPresetKey(plan),
      limits: {
        trialDayPeriod: plan.trialDayPeriod ?? 14,
        maxChildren: plan.maxChildren ?? 0,
        maxParents: plan.maxParents ?? 1,
        maxFamilyMembers: plan.maxFamilyMembers ?? 1,
        maxNannies: plan.maxNannies ?? 1,
      },
      storage: {
        photoVideoStorageGb: plan.photoVideoStorageGb ?? 0,
        storyStorageCount: plan.storyStorageCount ?? 0,
        documentStorageGb: plan.documentStorageGb ?? 0,
      },
    };
  }

  private detectPresetKey(plan: Record<string, any>) {
    if (plan.isComplimentary) {
      return 'free';
    }

    if (
      plan.name === 'Global' &&
      plan.interval === SubscriptionInterval.MONTHLY &&
      plan.currency === 'USD'
    ) {
      return 'global';
    }

    if (
      plan.interval === SubscriptionInterval.MONTHLY &&
      plan.currency === 'AED'
    ) {
      return 'monthly';
    }

    if (
      plan.interval === SubscriptionInterval.ANNUALLY &&
      plan.currency === 'AED'
    ) {
      return 'yearly';
    }

    return null;
  }
}
