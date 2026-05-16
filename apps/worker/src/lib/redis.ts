// ═══════════════════════════════════════════════════════════════════════════
// Worker Redis Connection
// ═══════════════════════════════════════════════════════════════════════════

import Redis, { type RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 5000);
      logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
      return delay;
    },
  };
}

/**
 * Create a new Redis connection
 */
export function createRedisConnection(name: string = 'default'): Redis {
  const options = parseRedisUrl(env.REDIS_URL);
  
  const redis = new Redis({
    ...options,
    connectionName: `paas-worker-${name}`,
  });

  redis.on('connect', () => {
    logger.info(`✅ Redis [${name}] connected`);
  });

  redis.on('error', (error) => {
    logger.error({ err: error }, `❌ Redis [${name}] error`);
  });

  return redis;
}

// Lazy initialization
let workerConnection: Redis | null = null;

export function getWorkerConnection(): Redis {
  if (!workerConnection) {
    workerConnection = createRedisConnection('worker');
  }
  return workerConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
    logger.info('Redis connection closed');
  }
}



