// ═══════════════════════════════════════════════════════════════════════════
// Build Queue Definition
// ═══════════════════════════════════════════════════════════════════════════
//
// This file defines the build job queue using BullMQ.
// The queue handles:
// - Cloning repositories
// - Building Docker images
// - Pushing to registry
// - Deploying to Kubernetes
//
// EXPRESS EQUIVALENT:
// This is similar to setting up a job processor with libraries like:
// - bull
// - agenda
// - bee-queue
//
// ═══════════════════════════════════════════════════════════════════════════

import { Queue, QueueEvents, type JobsOptions } from 'bullmq';
import { getQueueConnection, getSubscriberConnection } from '../lib/redis';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// QUEUE NAME
// ─────────────────────────────────────────────────────────────────

/**
 * Queue name constant - use this everywhere to avoid typos
 */
export const BUILD_QUEUE_NAME = 'build-jobs';

// ─────────────────────────────────────────────────────────────────
// DEFAULT JOB OPTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Default options for build jobs
 */
export const DEFAULT_BUILD_JOB_OPTIONS: JobsOptions = {
  // Number of retry attempts for failed jobs
  attempts: 3,
  
  // Exponential backoff between retries
  // 1st retry: 5 seconds, 2nd: 10 seconds, 3rd: 20 seconds
  backoff: {
    type: 'exponential',
    delay: 5000, // 5 seconds base delay
  },
  
  // Remove completed jobs after 24 hours
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours in seconds
    count: 100, // Keep last 100 completed jobs
  },
  
  // Keep failed jobs for 7 days for debugging
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days in seconds
    count: 50, // Keep last 50 failed jobs
  },
};

// ─────────────────────────────────────────────────────────────────
// CREATE QUEUE INSTANCE
// ─────────────────────────────────────────────────────────────────

/**
 * Build job queue instance
 * 
 * Use this to:
 * - Add jobs: buildQueue.add('build', jobData)
 * - Get job status: buildQueue.getJob(jobId)
 * - Monitor queue: buildQueue.getJobCounts()
 */
export const buildQueue = new Queue(BUILD_QUEUE_NAME, {
  connection: getQueueConnection(),
  defaultJobOptions: DEFAULT_BUILD_JOB_OPTIONS,
});

// ─────────────────────────────────────────────────────────────────
// QUEUE EVENTS (For monitoring)
// ─────────────────────────────────────────────────────────────────

/**
 * Queue events instance for monitoring job progress
 * 
 * Use this to:
 * - Listen for job completion
 * - Track job progress
 * - Handle job failures
 */
export const buildQueueEvents = new QueueEvents(BUILD_QUEUE_NAME, {
  connection: getSubscriberConnection(),
});

// Set up event logging
buildQueueEvents.on('completed', ({ jobId }) => {
  logger.info({ jobId }, `Build job completed`);
});

buildQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, reason: failedReason }, `Build job failed`);
});

buildQueueEvents.on('progress', ({ jobId, data }) => {
  logger.debug({ jobId, progress: data }, `Build job progress`);
});

buildQueueEvents.on('stalled', ({ jobId }) => {
  logger.warn({ jobId }, `Build job stalled`);
});

// ─────────────────────────────────────────────────────────────────
// QUEUE CLEANUP
// ─────────────────────────────────────────────────────────────────

/**
 * Close the build queue gracefully
 * Call this during application shutdown
 */
export async function closeBuildQueue(): Promise<void> {
  await buildQueueEvents.close();
  await buildQueue.close();
  logger.info('Build queue closed');
}



