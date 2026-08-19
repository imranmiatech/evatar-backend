"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSubscriptionPlans = seedSubscriptionPlans;
const client_1 = require("@prisma/client");
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
        name: '2 child Family Membership',
        maxChildren: 2,
        price: 60.0,
        currency: 'AED',
        interval: client_1.SubscriptionInterval.MONTHLY,
        features: ['Manage 2 child maximum at a time', ...defaultFeatures],
    },
    {
        name: '4 child Family Membership',
        maxChildren: 4,
        price: 120.0,
        currency: 'AED',
        interval: client_1.SubscriptionInterval.MONTHLY,
        features: ['Manage 4 child maximum at a time', ...defaultFeatures],
    },
    {
        name: '10 child Family Membership',
        maxChildren: 10,
        price: 300.0,
        currency: 'AED',
        interval: client_1.SubscriptionInterval.MONTHLY,
        features: ['Manage 10 child maximum at a time', ...defaultFeatures],
    },
    {
        name: 'Family Plus',
        maxChildren: 10,
        price: 499.0,
        currency: 'AED',
        interval: client_1.SubscriptionInterval.ANNUALLY,
        savingsText: 'Save AUD 19 by choosing annual billing.',
        features: [
            'Save AUD 19 by choosing annual billing.',
            'Priority 24/7 Concierge Support',
            'Manage up to 10 children',
            ...defaultFeatures,
        ],
    },
];
async function seedSubscriptionPlans(prisma) {
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
        }
        else {
            await prisma.subscriptionPlan.create({ data: plan });
        }
    }
    console.log('Subscription plans seeded.');
}
//# sourceMappingURL=subscriptionSeed.js.map