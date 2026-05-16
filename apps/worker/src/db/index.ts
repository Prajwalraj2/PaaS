// ═══════════════════════════════════════════════════════════════════════════
// Worker Database Connection
// ═══════════════════════════════════════════════════════════════════════════
//
// The worker needs database access to:
// - Update deployment status
// - Add build logs
// - Update project status
//
// ═══════════════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

// Create PostgreSQL connection
const connectionString = env.DATABASE_URL;

// Create postgres client
const client = postgres(connectionString, {
  max: 5, // Worker needs fewer connections than API
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client);

// Connection test
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error({ err: error }, '❌ Database connection failed');
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await client.end();
  logger.info('Database connection closed');
}



