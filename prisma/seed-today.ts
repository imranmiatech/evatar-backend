import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const parentEmail = 'parent.today@evaturner.test';
const nannyEmail = 'nanny.today@evaturner.test';
const password = 'Password123!';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function day(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function timeOnDate(date: Date, hour: number, minute = 0) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      minute,
    ),
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const today = day(new Date());

  const parent = await prisma.user.upsert({
    where: { email: parentEmail },
    create: {
      fullName: 'Monica Steve',
      email: parentEmail,
      phoneNumber: '+15550001001',
      passwordHash,
      preferredLanguage: 'en',
      role: 'PARENT',
      isEmailVerified: true,
      verificationStatus: 'APPROVED',
      parentProfile: {
        create: {
          relationType: 'mother',
          street: '12 Maple Garden',
          city: 'Austin',
          state: 'Texas',
          country: 'United States',
          membershipPlan: 'TRIAL',
        },
      },
    },
    update: {
      fullName: 'Monica Steve',
      passwordHash,
      role: 'PARENT',
      isEmailVerified: true,
      verificationStatus: 'APPROVED',
    },
  });

  const nanny = await prisma.user.upsert({
    where: { email: nannyEmail },
    create: {
      fullName: 'Deepa Sarjana',
      email: nannyEmail,
      phoneNumber: '+15550001002',
      passwordHash,
      preferredLanguage: 'en',
      role: 'NANNY',
      isEmailVerified: true,
      verificationStatus: 'APPROVED',
      profilePictureUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    },
    update: {
      fullName: 'Deepa Sarjana',
      passwordHash,
      role: 'NANNY',
      isEmailVerified: true,
      verificationStatus: 'APPROVED',
    },
  });

  await prisma.nannyProfile.upsert({
    where: { userId: nanny.id },
    create: {
      userId: nanny.id,
      headline: 'Warm early-years nanny with structured care routines',
      bio: 'Deepa supports calm transitions, playful learning, nutritious meals, and bedtime storytelling for young children.',
      hourlyRateCents: 2500,
      completedJobs: 84,
      repeatFamilies: 61,
      skills: ['Meal prep', 'Early childhood play', 'Bedtime support'],
      training: ['First Aid', 'Safe food handling', 'Behavior support'],
      languages: ['English', 'Bengali', 'Hindi'],
      portfolioImageUrls: [
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80',
      ],
      experience: {
        years: 5,
        ageGroups: ['Toddler', 'Preschool'],
        families: 23,
      },
      perks: {
        minimumHours: 2,
        availableToday: true,
        transport: 'Own transport',
      },
    },
    update: {
      headline: 'Warm early-years nanny with structured care routines',
      completedJobs: 84,
      repeatFamilies: 61,
      skills: ['Meal prep', 'Early childhood play', 'Bedtime support'],
      training: ['First Aid', 'Safe food handling', 'Behavior support'],
      portfolioImageUrls: [
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80',
      ],
    },
  });

  const child = await prisma.child.upsert({
    where: {
      id: 'seed-child-eve',
    },
    create: {
      id: 'seed-child-eve',
      parentUserId: parent.id,
      name: 'Eve',
      birthDate: new Date('2021-04-15T00:00:00.000Z'),
      gender: 'GIRL',
      avatarUrl:
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=300&q=80',
      allergies: ['peanuts', 'pollen'],
      dietaryNotes: 'Honey and oat based snacks preferred. Avoid refined sugar.',
      medicalNotes: 'Mild pollen sensitivity. Use calm transitions.',
      personality: 'Curious, gentle, imaginative, loves pretend play.',
      sleepRoutine: 'Dinner, quiet care, forest-green pajamas, story, dim lights.',
      favoriteThings: ['blocks', 'organic toys', 'acoustic lullabies'],
    },
    update: {
      parentUserId: parent.id,
      name: 'Eve',
      allergies: ['peanuts', 'pollen'],
      dietaryNotes: 'Honey and oat based snacks preferred. Avoid refined sugar.',
      medicalNotes: 'Mild pollen sensitivity. Use calm transitions.',
      personality: 'Curious, gentle, imaginative, loves pretend play.',
      sleepRoutine: 'Dinner, quiet care, forest-green pajamas, story, dim lights.',
      favoriteThings: ['blocks', 'organic toys', 'acoustic lullabies'],
    },
  });

  await prisma.nannyChildLink.upsert({
    where: {
      nannyUserId_childId: {
        nannyUserId: nanny.id,
        childId: child.id,
      },
    },
    create: {
      nannyUserId: nanny.id,
      childId: child.id,
      canViewStory: true,
      canUpdateProof: true,
    },
    update: {
      canViewStory: true,
      canUpdateProof: true,
    },
  });

  await prisma.kitchenAccess.upsert({
    where: {
      nannyUserId_childId: {
        nannyUserId: nanny.id,
        childId: child.id,
      },
    },
    create: {
      parentUserId: parent.id,
      nannyUserId: nanny.id,
      childId: child.id,
      canViewInventory: true,
      canManageInventory: true,
      canCreateShoppingList: true,
      canSendVoucher: true,
      canConfirmDelivery: true,
    },
    update: {
      parentUserId: parent.id,
      canViewInventory: true,
      canManageInventory: true,
      canCreateShoppingList: true,
      canSendVoucher: true,
      canConfirmDelivery: true,
    },
  });

  await prisma.groceryOrder.deleteMany({ where: { childId: child.id } });
  await prisma.shoppingVoucher.deleteMany({ where: { childId: child.id } });
  await prisma.shoppingList.deleteMany({ where: { childId: child.id } });
  await prisma.kitchenInventoryItem.deleteMany({ where: { childId: child.id } });
  await prisma.kitchenSchedule.deleteMany({ where: { childId: child.id } });

  const plan = await prisma.dayPlan.upsert({
    where: {
      childId_date: {
        childId: child.id,
        date: today,
      },
    },
    create: {
      childId: child.id,
      date: today,
      mode: 'GUIDED',
      status: 'READY',
      title: "Eve's Magical Forest Day",
      summary:
        'A calm, imaginative day with nourishing meals, outdoor discovery, kindness practice, and bedtime story.',
      createdByUserId: parent.id,
      guidedAnswers: {
        childMood: 'excited',
        meal: 'honey-drizzled banana oat pancakes',
        storyTheme: 'magical forest',
        tone: 'soft bedtime',
        schoolNourish: {
          enabled: true,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          startTime: '08:30',
          endTime: '09:30',
        },
        earlyMorningActivity: {
          enabled: true,
          activityName: 'Story time',
          days: ['Sat', 'Sun'],
          startTime: '08:30',
          endTime: '09:30',
        },
        typicalDailyCycle: [
          { title: 'Wake-up Time', time: '07:00' },
          { title: 'Nap Window', startTime: '12:00', endTime: '15:00' },
          { title: 'Bedtime', time: '19:00' },
        ],
        educationalSupport: 'Reading confidence',
        includeValues: ['kindness', 'sharing', 'calm transitions'],
      },
      aiInput: {
        source: 'seed',
        prompt: 'Create Eve a magical forest day and bedtime story.',
      },
      aiOutput: {
        source: 'seed',
        status: 'ready-plan',
      },
    },
    update: {
      status: 'READY',
      title: "Eve's Magical Forest Day",
      summary:
        'A calm, imaginative day with nourishing meals, outdoor discovery, kindness practice, and bedtime story.',
      guidedAnswers: {
        childMood: 'excited',
        meal: 'honey-drizzled banana oat pancakes',
        storyTheme: 'magical forest',
        tone: 'soft bedtime',
      },
    },
  });

  await prisma.dayActivity.deleteMany({ where: { dayPlanId: plan.id } });

  const activities = await Promise.all([
    prisma.dayActivity.create({
      data: {
        dayPlanId: plan.id,
        category: 'BREAKFAST',
        title: 'Banana oat pancakes',
        description: 'Serve warm with honey drizzle and sliced banana.',
        imageUrl:
          'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=80',
        detail: {
          nutritionalFocus: ['Calm energy', 'Finger food friendly', 'Balanced'],
          ingredients: ['Oats', 'Banana', 'Egg', 'Honey', 'Cinnamon'],
          steps: ['Mash banana', 'Mix with oats and egg', 'Cook small pancakes', 'Cool before serving'],
          safetyNotes: ['Check temperature before serving', 'Avoid honey under age one'],
        },
        startTime: timeOnDate(today, 8, 0),
        endTime: timeOnDate(today, 8, 30),
        status: 'COMPLETED',
        nannyNote: 'Eve enjoyed breakfast and asked for more banana slices.',
        sortOrder: 1,
      },
    }),
    prisma.dayActivity.create({
      data: {
        dayPlanId: plan.id,
        category: 'OUTDOOR_PLAY',
        title: 'Magical forest color hunt',
        description: 'Use an imaginary magnifying glass near the play garden.',
        imageUrl:
          'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
        detail: {
          developmentMoments: ['Observation', 'Language', 'Physical movement'],
          howTo: ['Pick a color', 'Find three matching objects', 'Describe textures', 'Celebrate discoveries'],
          caregiverPrompts: ['What color can you find?', 'What does it feel like?'],
          safetyNotes: ['Stay in shaded area', 'Wash hands after outdoor play'],
        },
        startTime: timeOnDate(today, 10, 0),
        endTime: timeOnDate(today, 10, 45),
        status: 'IN_PROGRESS',
        sortOrder: 2,
      },
    }),
    prisma.dayActivity.create({
      data: {
        dayPlanId: plan.id,
        category: 'STORY_TIME',
        title: 'Kind blocks and organic toys',
        description: 'Practice sharing and naming gentle feelings.',
        imageUrl:
          'https://images.unsplash.com/photo-1564429238817-393bd4286b2d?auto=format&fit=crop&w=900&q=80',
        detail: {
          developmentMoments: ['Social skills', 'Communication', 'Patience'],
          howTo: ['Offer two toy choices', 'Model turn taking', 'Praise sharing'],
        },
        startTime: timeOnDate(today, 16, 0),
        endTime: timeOnDate(today, 16, 30),
        status: 'PLANNED',
        sortOrder: 3,
      },
    }),
    prisma.dayActivity.create({
      data: {
        dayPlanId: plan.id,
        category: 'BEDTIME',
        title: 'Quiet care transition',
        description: 'Forest-green pajamas, soft blankets, moonbeam story.',
        imageUrl:
          'https://images.unsplash.com/photo-1519682577862-22b62b24e493?auto=format&fit=crop&w=900&q=80',
        detail: {
          careFocus: ['Bath', 'Pajamas', 'Story', 'Dim lights'],
          safetyNotes: ['Keep room calm', 'Use soft voice'],
        },
        startTime: timeOnDate(today, 19, 0),
        endTime: timeOnDate(today, 19, 30),
        status: 'PLANNED',
        sortOrder: 4,
      },
    }),
  ]);

  await Promise.all([
    prisma.activityTemplate.upsert({
      where: { slug: 'color-hunt-discovery' },
      create: {
        slug: 'color-hunt-discovery',
        category: 'OUTDOOR_PLAY',
        title: 'Color Hunt Discovery',
        description: 'A gentle outdoor exploration activity for language, movement, and observation.',
        imageUrl:
          'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
        detail: {
          developmentMoments: ['Inspiration', 'Gross motor', 'Cognitive growth', 'Emotional awareness'],
          howTo: ['Pick a color', 'Search safely', 'Name each discovery', 'Draw or describe the favorite find'],
          caregiverPrompts: ['What color is this?', 'Where else can we find it?'],
          progressionLevels: ['Level 1: name colors', 'Level 2: compare shades', 'Level 3: tell a story'],
          safetyNotes: ['Stay within sight', 'Avoid sharp objects'],
        },
      },
      update: {},
    }),
    prisma.activityTemplate.upsert({
      where: { slug: 'blueberry-oat-porridge' },
      create: {
        slug: 'blueberry-oat-porridge',
        category: 'BREAKFAST',
        title: 'Blueberry Oat Porridge',
        description: 'Warm, gentle breakfast with oats, blueberries, banana, and cinnamon.',
        imageUrl:
          'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=900&q=80',
        detail: {
          nutritionalFocus: ['Comfort', 'Finger food friendly', 'Balanced'],
          ingredients: ['Oats', 'Blueberries', 'Banana', 'Milk', 'Cinnamon'],
          optional: ['Chia seeds', 'Plain yogurt'],
          steps: ['Warm oats with milk', 'Fold in blueberries', 'Add banana', 'Cool and serve'],
          safetyNotes: ['Check temperature', 'Confirm allergy notes'],
        },
      },
      update: {},
    }),
    prisma.activityTemplate.upsert({
      where: { slug: 'salmon-sweet-potato' },
      create: {
        slug: 'salmon-sweet-potato',
        category: 'LUNCH',
        title: 'Mashed Sweet Potato & Salmon',
        description: 'Soft lunch with omega-rich salmon and mashed sweet potato.',
        imageUrl:
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
        detail: {
          nutritionalFocus: ['Protein', 'Healthy fats', 'Soft texture'],
          ingredients: ['Salmon', 'Sweet potato', 'Olive oil', 'Peas'],
          steps: ['Bake salmon', 'Mash potato', 'Flake carefully', 'Serve warm'],
          safetyNotes: ['Check bones carefully', 'Serve small portions'],
        },
      },
      update: {},
    }),
  ]);

  async function seedRecipe(input: {
    slug: string;
    title: string;
    category: string;
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER';
    description: string;
    imageUrl: string;
    prepTimeMinutes: number;
    cookTimeMinutes: number;
    servings: number;
    tags: string[];
    nutrition: Record<string, unknown>;
    safetyNotes: string[];
    ingredients: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      isOptional?: boolean;
      inventoryName?: string;
      allergenWarning?: string;
    }>;
    steps: string[];
  }) {
    const recipe = await prisma.recipe.upsert({
      where: { slug: input.slug },
      create: {
        slug: input.slug,
        title: input.title,
        category: input.category,
        mealType: input.mealType,
        description: input.description,
        imageUrl: input.imageUrl,
        prepTimeMinutes: input.prepTimeMinutes,
        cookTimeMinutes: input.cookTimeMinutes,
        servings: input.servings,
        minAgeMonths: 12,
        tags: input.tags,
        nutrition: input.nutrition as any,
        safetyNotes: input.safetyNotes,
      },
      update: {
        title: input.title,
        category: input.category,
        mealType: input.mealType,
        description: input.description,
        imageUrl: input.imageUrl,
        prepTimeMinutes: input.prepTimeMinutes,
        cookTimeMinutes: input.cookTimeMinutes,
        servings: input.servings,
        tags: input.tags,
        nutrition: input.nutrition as any,
        safetyNotes: input.safetyNotes,
      },
    });

    await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    await prisma.recipeStep.deleteMany({ where: { recipeId: recipe.id } });
    await prisma.recipeIngredient.createMany({
      data: input.ingredients.map((ingredient, index) => ({
        recipeId: recipe.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        isOptional: ingredient.isOptional ?? false,
        inventoryName: ingredient.inventoryName,
        allergenWarning: ingredient.allergenWarning,
        sortOrder: index,
      })),
    });
    await prisma.recipeStep.createMany({
      data: input.steps.map((body, index) => ({
        recipeId: recipe.id,
        body,
        sortOrder: index,
      })),
    });

    return recipe;
  }

  const blueberryRecipe = await seedRecipe({
    slug: 'blueberry-oat-porridge-kitchen',
    title: 'Blueberry Oat Porridge',
    category: 'Breakfast',
    mealType: 'BREAKFAST',
    description: 'Warm, soft porridge with oats, blueberries, banana, and cinnamon.',
    imageUrl:
      'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=900&q=80',
    prepTimeMinutes: 5,
    cookTimeMinutes: 8,
    servings: 2,
    tags: ['breakfast', 'soft', 'toddler-friendly'],
    nutrition: {
      protein: '4g',
      calories: '140 kcal',
      carbohydrates: '28g',
      fiber: '4g',
      focus: ['Comfort', 'Balanced', 'Finger food friendly'],
    },
    safetyNotes: ['Check temperature before serving', 'Confirm allergy notes'],
    ingredients: [
      { name: 'Organic Banana', quantity: 1, unit: 'pc', inventoryName: 'Organic Banana' },
      { name: 'Oats', quantity: 1, unit: 'cup', inventoryName: 'Oats' },
      { name: 'Blueberries', quantity: 0.5, unit: 'cup', inventoryName: 'Blueberries' },
      { name: 'Organic Whole Milk', quantity: 1, unit: 'cup', inventoryName: 'Organic Whole Milk' },
      { name: 'Olive oil', quantity: 1, unit: 'tsp', isOptional: true, inventoryName: 'Olive oil' },
    ],
    steps: [
      'Mash banana in a bowl until smooth.',
      'Add oats and milk and stir until a thick batter forms.',
      'Fold in blueberries and cook gently.',
      'Cool for 2-3 minutes before serving.',
    ],
  });

  const salmonRecipe = await seedRecipe({
    slug: 'sweet-potato-salmon-kitchen',
    title: 'Mashed Sweet Potato & Salmon',
    category: 'Lunch',
    mealType: 'LUNCH',
    description: 'Soft lunch with omega-rich salmon and mashed sweet potato.',
    imageUrl:
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
    prepTimeMinutes: 8,
    cookTimeMinutes: 18,
    servings: 2,
    tags: ['lunch', 'protein', 'soft-texture'],
    nutrition: {
      protein: '12g',
      calories: '210 kcal',
      focus: ['Protein', 'Healthy fats', 'Soft texture'],
    },
    safetyNotes: ['Check salmon bones carefully', 'Serve in small portions'],
    ingredients: [
      { name: 'Salmon', quantity: 1, unit: 'fillet', inventoryName: 'Salmon' },
      { name: 'Sweet Potato', quantity: 1, unit: 'pc', inventoryName: 'Sweet Potato' },
      { name: 'Peas', quantity: 0.25, unit: 'cup', inventoryName: 'Peas', isOptional: true },
    ],
    steps: [
      'Bake salmon until fully cooked.',
      'Mash boiled sweet potato until smooth.',
      'Flake salmon carefully and check for bones.',
      'Serve warm in small portions.',
    ],
  });

  await prisma.kitchenInventoryItem.createMany({
    data: [
      {
        childId: child.id,
        parentUserId: parent.id,
        createdByUserId: parent.id,
        lastUpdatedByUserId: nanny.id,
        name: 'Organic Whole Milk',
        unit: 'Liter',
        quantity: 1,
        category: 'DAIRY',
        status: 'LOW',
        currentStockPercent: 10,
        thresholdPercent: 25,
        lastStockedAt: today,
        notes: 'Used 2 for breakfast this morning.',
      },
      {
        childId: child.id,
        parentUserId: parent.id,
        createdByUserId: nanny.id,
        lastUpdatedByUserId: nanny.id,
        name: 'Organic Banana',
        unit: 'pc',
        quantity: 2,
        category: 'PRODUCE',
        status: 'LOW',
        currentStockPercent: 25,
        thresholdPercent: 25,
        lastStockedAt: today,
        notes: 'Good for porridge and pancakes.',
      },
      {
        childId: child.id,
        parentUserId: parent.id,
        createdByUserId: parent.id,
        lastUpdatedByUserId: parent.id,
        name: 'Oats',
        unit: 'cup',
        quantity: 4,
        category: 'PANTRY',
        status: 'IN_STOCK',
        currentStockPercent: 80,
        thresholdPercent: 25,
        lastStockedAt: today,
      },
      {
        childId: child.id,
        parentUserId: parent.id,
        createdByUserId: nanny.id,
        lastUpdatedByUserId: nanny.id,
        name: 'Blueberries',
        unit: 'cup',
        quantity: 0,
        category: 'PRODUCE',
        status: 'MISSING',
        currentStockPercent: 0,
        thresholdPercent: 25,
        notes: 'Need for breakfast recipe.',
      },
    ],
  });

  const shoppingList = await prisma.shoppingList.create({
    data: {
      childId: child.id,
      parentUserId: parent.id,
      createdByUserId: nanny.id,
      title: "Eve's Shopping List",
      items: {
        create: [
          {
            name: 'Organic Whole Milk',
            unit: 'Liter',
            quantity: 1,
            category: 'DAIRY',
            status: 'NEEDED',
            sortOrder: 1,
          },
          {
            name: 'Blueberries',
            unit: 'cup',
            quantity: 1,
            category: 'PRODUCE',
            status: 'NEEDED',
            sortOrder: 2,
          },
          {
            name: 'Organic Banana',
            unit: 'pc',
            quantity: 6,
            category: 'PRODUCE',
            status: 'OPTIONAL',
            sortOrder: 3,
          },
        ],
      },
    },
    include: { items: true },
  });

  let store = await prisma.kitchenStore.findFirst({
    where: { name: 'Carefour Market' },
  });
  if (!store) {
    store = await prisma.kitchenStore.create({
      data: {
        name: 'Carefour Market',
        phoneNumber: '+15550002000',
        address: 'Organic grocery partner',
        deliveryFeeCents: 250,
      },
    });
  }

  await prisma.paymentMethod.deleteMany({
    where: {
      parentUserId: parent.id,
      label: 'Mastercard 4421',
    },
  });

  const paymentMethod = await prisma.paymentMethod.create({
    data: {
      parentUserId: parent.id,
      type: 'CARD',
      label: 'Mastercard 4421',
      brand: 'Mastercard',
      last4: '4421',
      expiryMonth: 1,
      expiryYear: 2029,
      isDefault: true,
    },
  });

  const voucher = await prisma.shoppingVoucher.create({
    data: {
      voucherCode: `KV-SEED-${Date.now().toString(36).toUpperCase()}`,
      childId: child.id,
      parentUserId: parent.id,
      createdByUserId: nanny.id,
      shoppingListId: shoppingList.id,
      storeId: store.id,
      status: 'SENT_TO_PARENT',
      messageToParent: 'Please review missing and low-stock ingredients.',
      messageToStore: 'Avoid peanut cross-contact. Prefer organic produce.',
      allergyWarnings: ['Peanut allergy'],
      substitutionRules: {
        Blueberries: { allowed: ['strawberries'], notAllowed: ['mixed nuts'] },
      },
      sentToParentAt: new Date(),
      items: {
        create: shoppingList.items.map((item, index) => ({
          shoppingListItemId: item.id,
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          estimatedPriceCents: index === 0 ? 1299 : 899,
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });

  const order = await prisma.groceryOrder.create({
    data: {
      orderNumber: `KO-SEED-${Date.now().toString(36).toUpperCase()}`,
      voucherId: voucher.id,
      childId: child.id,
      parentUserId: parent.id,
      createdByUserId: parent.id,
      storeId: store.id,
      paymentMethodId: paymentMethod.id,
      status: 'ORDER_CONFIRMED',
      subtotalCents: 4590,
      deliveryFeeCents: 250,
      discountCents: 150,
      totalCents: 4690,
      confirmedAt: new Date(),
      trackingEvents: [
        { label: 'Voucher Sent', at: new Date().toISOString() },
        { label: 'Store Reviewing', at: new Date().toISOString() },
        { label: 'Order Confirmed', at: new Date().toISOString() },
      ],
      items: {
        create: [
          { recipeId: blueberryRecipe.id, name: 'Organic Whole Milk', unit: 'Liter', quantity: 1, priceCents: 1299 },
          { name: 'Blueberries', unit: 'cup', quantity: 1, priceCents: 899 },
          { recipeId: salmonRecipe.id, name: 'Organic Banana', unit: 'pc', quantity: 6, priceCents: 699 },
        ],
      },
    },
    include: { items: true },
  });

  const story = await prisma.bedtimeStory.upsert({
    where: { dayPlanId: plan.id },
    create: {
      dayPlanId: plan.id,
      title: "Eve's Magical Forest Story",
      storyText:
        'Today Eve awoke excited for a new adventure. After enjoying her delicious honey-drizzled banana oat pancakes, she grabbed her trusty imaginary magnifying glass and discovered a magical forest filled with colorful, glowing treasures just past the play garden. As twilight arrived, Eve shared sweet blocks and organic toys generously, showing wonderful kindness. Now soft silver moonbeams wrap the magical forest in peaceful slumber.',
      imagePrompt:
        'Warm magical forest bedtime illustration with glowing treasures, soft moonbeams, and a kind child.',
      coverImageUrl:
        'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=900&q=80',
      aiProvider: 'builder',
      aiModel: 'seed',
      parentAudioUrl: 'https://cdn.example.com/eve-magical-forest-story.m4a',
      parentAudioKey: 'seed/story-recordings/eve-magical-forest-story.m4a',
      audioDurationSec: 132,
    },
    update: {
      title: "Eve's Magical Forest Story",
      parentAudioUrl: 'https://cdn.example.com/eve-magical-forest-story.m4a',
      parentAudioKey: 'seed/story-recordings/eve-magical-forest-story.m4a',
      audioDurationSec: 132,
    },
  });

  console.log('Seed complete');
  console.log({
    parent: { email: parentEmail, password, id: parent.id },
    nanny: { email: nannyEmail, password, id: nanny.id },
    childId: child.id,
    dayPlanId: plan.id,
    storyId: story.id,
    activityIds: activities.map((activity) => activity.id),
    kitchen: {
      recipeIds: [blueberryRecipe.id, salmonRecipe.id],
      shoppingListId: shoppingList.id,
      voucherId: voucher.id,
      orderId: order.id,
      paymentMethodId: paymentMethod.id,
      storeId: store.id,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
