import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './adminSeed';
import { seedRecipes } from './recipeSeed';
import { seedActivities } from './activitySeed';
import { seedPartnerRewards } from './partnerSeed';
import { seedCareModules } from './careSeed';
import { seedSubscriptionPlans } from './subscriptionSeed';
import { createPrismaClientOptions } from '../../src/prisma/prisma-client-options';

const prisma = new PrismaClient(createPrismaClientOptions() as any);

async function main() {
  console.log('Seeding database...');

  await seedAdmin(prisma);
  await seedRecipes(prisma);
  await seedActivities(prisma);
  await seedPartnerRewards(prisma);
  await seedCareModules(prisma);
  await seedSubscriptionPlans(prisma);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
