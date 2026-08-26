import { PrismaClient, SubscriptionInterval } from '@prisma/client';

const defaultFeatures = [
  'Customized daily routines for every child—no micromanagement needed.',
  'Nanny insights grounded in real-life experiences.',
  'Unique bedtime stories crafted from their daily adventures.',
  'Personalised daily flow per child (meals, activities, rest)',
  'At-home + local activity suggestions',
  'Care Layers (caregiver training tailored to child age & stage)',
  'Nightly personalised bedtime stories per child',
  'Unlimited Care Assist (real-time support)',
  'Access to Alurei Membership Partner Perks',
];

const defaultPlans = [
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
    additionalChildPrice: 0,
    additionalChildCurrency: 'AED',
    sortOrder: 0,
    features: [
      'Manage 1 child',
      'Manage 1 parent',
      'Manage 1 family member',
      'Manage 1 nanny',
      'Starter planning access',
      'Basic support',
    ],
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
    price: 49.0,
    currency: 'USD',
    interval: SubscriptionInterval.MONTHLY,
    description: 'Flexible monthly billing. Cancel anytime.',
    badgeText: null,
    additionalChildPrice: 10,
    additionalChildCurrency: 'USD',
    sortOrder: 1,
    features: [
      'Up to 2 children',
      'Full AI Daily Planning',
      'Up to 3 carers',
      'Bedtime Stories',
      'Full weekly insights',
      'Caregiver Learning',
      'Priority support',
    ],
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
    price: 399.0,
    currency: 'AED',
    interval: SubscriptionInterval.MONTHLY,
    description: 'The complete Alurei experience for growing families.',
    badgeText: null,
    additionalChildPrice: 35,
    additionalChildCurrency: 'AED',
    sortOrder: 2,
    features: [
      'Up to 2 children',
      'Full AI Daily Planning',
      'Up to 3 carers',
      'Bedtime Stories',
      'Full weekly insights',
      'Unlimited Alurei rewards',
      'Priority support',
    ],
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
    price: 3990.0,
    currency: 'AED',
    interval: SubscriptionInterval.ANNUALLY,
    description: 'Save 2 months with annual billing.',
    badgeText: 'Save 2 Months',
    additionalChildPrice: 35,
    additionalChildCurrency: 'AED',
    sortOrder: 3,
    savingsText: 'Save 2 months with annual billing.',
    features: [
      'Up to 2 children',
      'Full AI Daily Planning',
      'Up to 3 carers',
      'Bedtime Stories',
      'Full weekly insights',
      'Unlimited Alurei rewards',
      'Priority support',
    ],
  },
];

export async function seedSubscriptionPlans(prisma: PrismaClient) {
  await prisma.subscriptionPlan.deleteMany({
    where: {
      name: {
        in: ['4 child Family Membership', '10 child Family Membership'],
      },
      subscriptions: {
        none: {},
      },
    },
  });

  await prisma.subscriptionPlan.updateMany({
    where: {
      name: {
        in: ['4 child Family Membership', '10 child Family Membership'],
      },
    },
    data: {
      isActive: false,
    },
  });

  for (const plan of defaultPlans) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { name: plan.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: { ...plan, isActive: true },
      });
    } else {
      await prisma.subscriptionPlan.create({ data: plan });
    }

    const canonical = await prisma.subscriptionPlan.findFirst({
      where: { name: plan.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (canonical) {
      await prisma.subscriptionPlan.updateMany({
        where: {
          name: plan.name,
          id: { not: canonical.id },
        },
        data: {
          isActive: false,
        },
      });
    }
  }

  console.log('Subscription plans seeded.');
}
