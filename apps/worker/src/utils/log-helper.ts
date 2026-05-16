// ═══════════════════════════════════════════════════════════════════════════
// Log Helper Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// Helper functions for adding logs to the build context and database.
//
// ═══════════════════════════════════════════════════════════════════════════

import type { BuildContext, BuildLogEntry } from '../types';
import { logger } from '../lib/logger';

/**
 * Add a log entry to the build context
 * Also logs to the worker's logger for debugging
 * 
 * @param context - Build context
 * @param level - Log level
 * @param message - Log message
 * @param step - Current build step name
 */
export function addLog(
  context: BuildContext,
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  step?: string
): void {
  const entry: BuildLogEntry = {
    timestamp: new Date(),
    level,
    message,
    step,
  };
  
  context.logs.push(entry);
  
  // Also log to the worker logger for visibility
  const logData = {
    deploymentId: context.job.deploymentId,
    step,
  };
  
  switch (level) {
    case 'error':
      logger.error(logData, message);
      break;
    case 'warn':
      logger.warn(logData, message);
      break;
    case 'debug':
      logger.debug(logData, message);
      break;
    default:
      logger.info(logData, message);
  }
}

/**
 * Format duration in a human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Create a formatted log prefix with timestamp
 */
export function formatLogPrefix(step: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${step.toUpperCase()}]`;
}



