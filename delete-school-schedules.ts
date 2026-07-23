import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.schoolSchedule.deleteMany({});
  console.log('School schedules deleted.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
