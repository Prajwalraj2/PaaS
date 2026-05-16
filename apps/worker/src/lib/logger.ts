// ═══════════════════════════════════════════════════════════════════════════
// Worker Logger Configuration
// ═══════════════════════════════════════════════════════════════════════════

import pino from 'pino';
import { env } from './env';

export const logger = pino({

  // Log level: 'debug' in dev, 'info' in production
  name: 'paas-worker',

  // Base fields included in every log
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport: env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});



