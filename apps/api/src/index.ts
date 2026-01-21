// ═══════════════════════════════════════════════════════════════════════════
// PaaS API Server - Entry Point
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the main entry point for the API server.
// It initializes all services and starts the HTTP server.
//
// EXPRESS EQUIVALENT:
// const express = require('express');
// const app = express();
// app.listen(PORT, () => console.log(`Server running on ${PORT}`));
//
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { connectDatabase, disconnectDatabase } from './db';

// ─────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────

async function main() {
  try {
    // Log startup info
    logger.info('Starting PaaS API Server...');
    logger.info(`Environment: ${env.NODE_ENV}`);

    // ─────────────────────────────────────────────────────────────
    // CONNECT TO DATABASE
    // ─────────────────────────────────────────────────────────────
    // This verifies the database connection is working
    // If it fails, the server won't start
    await connectDatabase();

    // TODO: Connect to Redis
    // await connectRedis();
    // logger.info('✅ Redis connected');

    // TODO: Start background workers
    // await startWorkers();
    // logger.info('✅ Workers started');

    // ─────────────────────────────────────────────────────────────
    // START HTTP SERVER
    // ─────────────────────────────────────────────────────────────
    // Gets PORT from .env file (default: 8082)
    // EXPRESS EQUIVALENT: const port = process.env.PORT || 8082;
    const port = env.PORT;

    serve({
      fetch: app.fetch,
      port,
    });

    logger.info(`✅ Server running on http://localhost:${port}`);
    logger.info(`📋 Health check: http://localhost:${port}/health`);
    logger.info(`📋 API Base: http://localhost:${port}/api/v1`);

  } catch (error) {
    // Pino uses { err: error } format for logging errors
    // EXPRESS EQUIVALENT: console.error('Failed to start server:', error);
    logger.error({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────
// Handle process termination signals to clean up resources
// This is important for:
// - Closing database connections
// - Finishing pending jobs
// - Cleaning up temporary files

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  try {
    // Close database connection
    await disconnectDatabase();
    logger.info('✅ Database disconnected');
    
    // TODO: Close Redis connection
    // await disconnectRedis();
    // logger.info('✅ Redis disconnected');
    
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Listen for termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
  process.exit(1);
});

// Run the server
main();


