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
    name: 'Global',
    maxChildren: 2,
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
    maxChildren: 2,
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
    maxChildren: 2,
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
