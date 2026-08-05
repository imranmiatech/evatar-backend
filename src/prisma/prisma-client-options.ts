import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClientOptions } from '@prisma/client/runtime/client';

export function createPrismaClientOptions(): PrismaClientOptions {
  const pool = new Pool({
    host: '18.226.144.228',
    port: 5432,
    user: 'neondb_owner',
    password: 'npg_shIWBJx9dUb3',
    database: 'neondb',
    ssl: {
      rejectUnauthorized: false,
      servername: 'ep-dawn-unit-ay8weiq0-pooler.c-5.us-east-2.aws.neon.tech',
    },
  });

  const adapter = new PrismaPg(pool);

  return { adapter } as any;
}
