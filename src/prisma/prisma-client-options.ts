import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClientOptions } from '@prisma/client/runtime/client';

function getDatabaseUrl() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL is not set');
  }

  return connectionString;
}

export function createPrismaClientOptions(): PrismaClientOptions {
  const adapter = new PrismaPg(getDatabaseUrl());

  return { adapter };
}
