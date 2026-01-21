// ═══════════════════════════════════════════════════════════════════════════
// Logger Configuration (Pino)
// ═══════════════════════════════════════════════════════════════════════════
//
// Pino is a very fast, low-overhead logger for Node.js.
// It outputs JSON logs in production for easy parsing by log aggregators.
// In development, we use pino-pretty for human-readable output.
//
// ═══════════════════════════════════════════════════════════════════════════

import pino from 'pino';

// Determine if we're in development
const isDevelopment = process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────────────────────────
// CREATE LOGGER
// ─────────────────────────────────────────────────────────────────

export const logger = pino({
  // Log level: 'debug' in dev, 'info' in production
  level: isDevelopment ? 'debug' : 'info',

  // In development, use pino-pretty for readable logs
  // In production, output raw JSON for log aggregators (Loki, etc.)
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Base fields included in every log
  base: {
    service: 'paas-api',
    version: '0.0.1',
  },
});

// ─────────────────────────────────────────────────────────────────
// USAGE EXAMPLES
// ─────────────────────────────────────────────────────────────────
//
// logger.info('Server started');
// logger.info({ port: 8080 }, 'Server started on port');
// logger.error({ err: error }, 'Failed to connect to database');
// logger.debug({ user: userId }, 'User authenticated');
// logger.warn('Deprecated API endpoint used');
//
// ═══════════════════════════════════════════════════════════════════════════



