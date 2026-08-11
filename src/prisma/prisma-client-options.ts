import 'dotenv/config';
import { Pool, PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClientOptions } from '@prisma/client/runtime/client';

function createPoolConfig(): PoolConfig {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const parsed = new URL(databaseUrl);
  const host = process.env.DATABASE_HOSTADDR || parsed.hostname;

  if (process.env.DATABASE_HOSTADDR) {
    return {
      host,
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      connectionTimeoutMillis: Number(
        process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 30000,
      ),
      idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 10000),
      ssl: {
        rejectUnauthorized: false,
        servername: parsed.hostname,
      },
    };
  }

  return {
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    connectionTimeoutMillis: Number(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 30000,
    ),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 10000),
    ssl: { rejectUnauthorized: false },
  };
}

export function createPrismaClientOptions(): PrismaClientOptions {
  const adapter = new PrismaPg(new Pool(createPoolConfig()));
  return { adapter } as any;
}
