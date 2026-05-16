// ═══════════════════════════════════════════════════════════════════════════
// Redis Connection Configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// This file sets up the Redis connection for:
// - BullMQ job queue
// - Caching (future)
// - Session storage (future)
//
// ═══════════════════════════════════════════════════════════════════════════

import Redis, { type RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// ─────────────────────────────────────────────────────────────────
// REDIS CONNECTION OPTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Parse Redis URL into connection options
 * 
 * Supports formats:
 * - redis://localhost:6379
 * - redis://:password@localhost:6379
 * - redis://user:password@localhost:6379/0
 */
function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    // Connection settings
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false, // Required for BullMQ
    // Reconnection settings
    retryStrategy: (times: number) => {
      // Reconnect after 50ms, 100ms, 200ms, ..., max 5000ms
      const delay = Math.min(times * 50, 5000);
      logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
      return delay;
    },
  };
}

// parse redis url and return sample example of the return object
// 
//  * Sample example of the return object
//  * {
//  *   host: 'localhost',
//  *   port: 6379,
//  *   password: undefined,
//  *   username: undefined,
//  *   db: 0,
//  *   maxRetriesPerRequest: null,
//  *   enableReadyCheck: false,
//  *   retryStrategy: (times: number) => {
//  *     const delay = Math.min(times * 50, 5000);
//  *     logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
//  *     return delay;
//  *   },
//  * }
//  */
// console.log(parseRedisUrl('redis://localhost:6379'));


// ─────────────────────────────────────────────────────────────────
// CREATE REDIS CONNECTION
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new Redis connection
 * Each connection should be used for a specific purpose (queue, cache, etc.)
 */
export function createRedisConnection(name: string = 'default'): Redis {
  const options = parseRedisUrl(env.REDIS_URL);
  
  const redis = new Redis({
    ...options,
    // Add a name for debugging
    connectionName: `paas-api-${name}`,
  });

  // Event handlers for logging
  redis.on('connect', () => {
    logger.info(`✅ Redis [${name}] connected to ${options.host}:${options.port}`);
  });

  redis.on('error', (error) => {
    logger.error({ err: error }, `❌ Redis [${name}] error`);
  });

  redis.on('close', () => {
    logger.warn(`Redis [${name}] connection closed`);
  });

  redis.on('reconnecting', () => {
    logger.info(`Redis [${name}] reconnecting...`);
  });

  return redis;
}

// ─────────────────────────────────────────────────────────────────
// SHARED REDIS INSTANCES
// ─────────────────────────────────────────────────────────────────

// Lazy initialization - connections created on first use
let queueConnection: Redis | null = null;
let subscriberConnection: Redis | null = null;

/**
 * Get Redis connection for BullMQ queue operations
 * BullMQ requires a dedicated connection for queue operations
 */
export function getQueueConnection(): Redis {
  if (!queueConnection) {
    queueConnection = createRedisConnection('queue');
  }
  return queueConnection;
}

/**
 * Get Redis connection for BullMQ event subscriptions
 * BullMQ requires a separate connection for event listening
 */
export function getSubscriberConnection(): Redis {
  if (!subscriberConnection) {
    subscriberConnection = createRedisConnection('subscriber');
  }
  return subscriberConnection;
}

// ─────────────────────────────────────────────────────────────────
// CONNECTION CLEANUP
// ─────────────────────────────────────────────────────────────────

/**
 * Close all Redis connections
 * Call this during graceful shutdown
 */
export async function closeAllRedisConnections(): Promise<void> {
  const connections: Promise<void>[] = [];

  if (queueConnection) {
    connections.push(
      queueConnection.quit().then(() => {
        queueConnection = null;
        logger.info('Redis [queue] connection closed');
      })
    );
  }

  if (subscriberConnection) {
    connections.push(
      subscriberConnection.quit().then(() => {
        subscriberConnection = null;
        logger.info('Redis [subscriber] connection closed');
      })
    );
  }

  await Promise.all(connections);
}

// ─────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────

/**
 * Check if Redis is connected and responding
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const redis = getQueueConnection();
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return { connected: true, latency };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

