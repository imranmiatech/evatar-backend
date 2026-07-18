const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/evaturner" })
const adapter = new PrismaPg(pool)
try {
  const p = new PrismaClient({ adapter });
  console.log("Success with adapter!");
} catch(e) {
  console.error("Error with adapter:", e.message);
}
