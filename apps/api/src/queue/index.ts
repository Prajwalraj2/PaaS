// ═══════════════════════════════════════════════════════════════════════════
// Queue System - Main Export
// ═══════════════════════════════════════════════════════════════════════════
//
// This module provides the job queue infrastructure using BullMQ.
// 
// BullMQ is a Redis-based queue for Node.js that provides:
// - Reliable job processing with retries
// - Delayed jobs
// - Job prioritization
// - Real-time events
//
// ═══════════════════════════════════════════════════════════════════════════

// Export queue definitions
export { buildQueue, BUILD_QUEUE_NAME } from './build.queue';

// Export producers (functions to add jobs)
export { 
  addBuildJob, 
  removeBuildJob,
  getBuildJob,
  getBuildJobState,
  isDeploymentQueued,
  addPriorityBuildJob,
  addDelayedBuildJob,
  type BuildJobData 
} from './build.producer';

// Export queue management utilities
export { getQueueStatus, closeQueues } from './queue.utils';



