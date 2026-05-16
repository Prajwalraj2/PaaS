// ═══════════════════════════════════════════════════════════════════════════
// PaaS Build Worker - Entry Point
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the main entry point for the Build Worker service.
// The worker:
// - Connects to Redis to listen for build jobs
// - Processes jobs through the build pipeline
// - Updates the database with build status and logs
//
// ═══════════════════════════════════════════════════════════════════════════

import { env } from './lib/env';
import { logger } from './lib/logger';
import { testDatabaseConnection, closeDatabaseConnection } from './db';
import { closeRedisConnection } from './lib/redis';
import { startWorker, stopWorker } from './processor';

// ─────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────

async function main() {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('🏗️  PaaS Build Worker Starting...');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('');

  // Log configuration
  logger.info({
    nodeEnv: env.NODE_ENV,
    simulationMode: env.SIMULATION_MODE,
    concurrency: env.WORKER_CONCURRENCY,
    workerName: env.WORKER_NAME,
    buildTimeout: `${env.BUILD_TIMEOUT_MS / 1000}s`,
    buildWorkspace: env.BUILD_WORKSPACE,
  }, 'Worker configuration');

  // Test database connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Start the worker
  const worker = startWorker();

  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('✅ Worker is running and waiting for jobs!');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('');

  if (env.SIMULATION_MODE) {
    logger.warn('🧪 SIMULATION MODE is enabled - builds will be simulated');
    logger.warn('   Set SIMULATION_MODE=false to enable real Docker builds');
  }
}

// ─────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new jobs and wait for current jobs to finish
    await stopWorker();
    
    // Close database connection
    await closeDatabaseConnection();
    
    // Close Redis connection
    await closeRedisConnection();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start worker');
  process.exit(1);
});



