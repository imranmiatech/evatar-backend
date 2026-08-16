import 'dotenv/config';
import { Pool, PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClientOptions } from '@prisma/client/runtime/client';

function shouldUseSsl(parsed: URL) {
  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();

  return (
    process.env.DATABASE_SSL === 'true' ||
    process.env.NODE_ENV === 'production' ||
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    parsed.hostname.includes('neon.tech')
  );
}

function createSslConfig(parsed: URL) {
  if (!shouldUseSsl(parsed)) {
    return false;
  }

  return {
    rejectUnauthorized: false,
    servername: parsed.hostname,
  };
}

function createPoolConfig(): PoolConfig {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const parsed = new URL(databaseUrl);
  const host = process.env.DATABASE_HOSTADDR || parsed.hostname;
  const max = Number(process.env.DATABASE_POOL_MAX ?? 3);
  const connectionTimeoutMillis = Number(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 60000,
  );
  const idleTimeoutMillis = Number(
    process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30000,
  );
  const common = {
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: createSslConfig(parsed),
  } satisfies Partial<PoolConfig>;

  if (process.env.DATABASE_HOSTADDR) {
    return {
      ...common,
      host,
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    };
  }

  return {
    ...common,
    connectionString: databaseUrl,
  };
}

export function createPrismaClientOptions(): PrismaClientOptions {
  const adapter = new PrismaPg(new Pool(createPoolConfig()));
  return { adapter } as any;
}
