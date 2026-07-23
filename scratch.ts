import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            fullName: "John Doe Test",
            email: "johntest" + Date.now() + "@example.com",
            phoneNumber: "+12345678" + Date.now(),
            passwordHash: "hash",
            preferredLanguage: "en",
            role: "PARENT",
          },
        });

        await tx.parentProfile.create({
          data: {
            userId: createdUser.id,
            relationship: "FATHER",
            address: "Test address",
            street: "Test street",
            postalCode: "12345",
            city: "Test city",
            state: "Test state",
          },
        });
        
        await tx.otpCode.create({
          data: {
            userId: createdUser.id,
            code: "1234",
            purpose: "SIGNUP_VERIFICATION",
            expiresAt: new Date(),
          },
        });

        return createdUser;
      });
      console.log("Success", user.id);
  } catch (e) {
      console.error("Error creating user:", e)
  } finally {
      await prisma.$disconnect();
      await pool.end();
  }
}
run();
