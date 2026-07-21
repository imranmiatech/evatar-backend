import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding dummy users (Admin, Parent, Nanny)...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@evaturner.com' },
    update: {},
    create: {
      email: 'admin@evaturner.com',
      fullName: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });
  console.log(`Created admin: ${admin.email}`);

  // Parent
  const parent = await prisma.user.upsert({
    where: { email: 'parent@evaturner.com' },
    update: {},
    create: {
      email: 'parent@evaturner.com',
      fullName: 'John Parent',
      passwordHash,
      role: 'PARENT',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      parentProfile: {
        create: {
          relationType: 'Father',
          city: 'London',
          country: 'UK',
        }
      }
    },
  });
  console.log(`Created parent: ${parent.email}`);

  // Nanny
  const nanny = await prisma.user.upsert({
    where: { email: 'nanny@evaturner.com' },
    update: {},
    create: {
      email: 'nanny@evaturner.com',
      fullName: 'Mary Nanny',
      passwordHash,
      role: 'NANNY',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      nannyProfile: {
        create: {
          headline: 'Experienced Nanny',
          hourlyRateCents: 1500,
          completedJobs: 10,
        }
      }
    },
  });
  console.log(`Created nanny: ${nanny.email}`);

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
