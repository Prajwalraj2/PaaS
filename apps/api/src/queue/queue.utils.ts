// ═══════════════════════════════════════════════════════════════════════════
// Queue Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// Helper functions for queue management, monitoring, and cleanup.
//
// ═══════════════════════════════════════════════════════════════════════════

import { buildQueue, closeBuildQueue } from './build.queue';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// QUEUE STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * Queue statistics
 */
export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Get the current status of all queues
 */
export async function getQueueStatus(): Promise<QueueStatus[]> {
  const buildCounts = await buildQueue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed'
  );
  
  const isPaused = await buildQueue.isPaused();

  return [
    {
      name: buildQueue.name,
      waiting: buildCounts.waiting || 0,
      active: buildCounts.active || 0,
      completed: buildCounts.completed || 0,
      failed: buildCounts.failed || 0,
      delayed: buildCounts.delayed || 0,
      paused: isPaused,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────
// QUEUE MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Pause all queues (stop processing new jobs)
 */
export async function pauseAllQueues(): Promise<void> {
  await buildQueue.pause();
  logger.info('All queues paused');
}

/**
 * Resume all queues
 */
export async function resumeAllQueues(): Promise<void> {
  await buildQueue.resume();
  logger.info('All queues resumed');
}

/**
 * Drain all queues (remove all waiting jobs)
 */
export async function drainAllQueues(): Promise<void> {
  await buildQueue.drain();
  logger.info('All queues drained');
}

/**
 * Clean old jobs from all queues
 * 
 * @param gracePeriod - Time in milliseconds to keep jobs
 * @param limit - Maximum number of jobs to remove
 * @param status - Job status to clean (completed, failed, etc.)
 */
export async function cleanOldJobs(
  gracePeriod: number = 24 * 60 * 60 * 1000, // 24 hours
  limit: number = 1000,
  status: 'completed' | 'failed' | 'delayed' | 'active' | 'wait' = 'completed'
): Promise<string[]> {
  const cleaned = await buildQueue.clean(gracePeriod, limit, status);
  logger.info({ count: cleaned.length, status }, 'Cleaned old jobs');
  return cleaned;
}

// ─────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────

/**
 * Close all queues gracefully
 * Call this during application shutdown
 */
export async function closeQueues(): Promise<void> {
  logger.info('Closing all queues...');
  
  try {
    await closeBuildQueue();
    logger.info('All queues closed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error closing queues');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// QUEUE HEALTH CHECK
// ─────────────────────────────────────────────────────────────────

/**
 * Check if the queue system is healthy
 */
export async function checkQueueHealth(): Promise<{
  healthy: boolean;
  queues: QueueStatus[];
  error?: string;
}> {
  try {
    const status = await getQueueStatus();
    
    return {
      healthy: true,
      queues: status,
    };
  } catch (error) {
    return {
      healthy: false,
      queues: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}



