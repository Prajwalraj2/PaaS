// ═══════════════════════════════════════════════════════════════════════════
// Build Job Producer
// ═══════════════════════════════════════════════════════════════════════════
//
// This file provides functions to add build jobs to the queue.
// "Producer" means this code creates/adds jobs, not processes them.
//
// The actual job processing happens in the Worker service (apps/worker).
//
// EXPRESS EQUIVALENT:
// This is like calling:
// queue.add('build', { deploymentId, projectId, ... });
//
// ═══════════════════════════════════════════════════════════════════════════

import { type Job, type JobsOptions } from 'bullmq';
import { buildQueue, DEFAULT_BUILD_JOB_OPTIONS } from './build.queue';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// JOB DATA TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * Data required to build and deploy an application
 * This is what gets stored in Redis and passed to the worker
 */
export interface BuildJobData {
  // Identifiers
  deploymentId: string; // Unique deployment ID
  projectId: string;    // Project this belongs to
  userId: string;       // User who owns the project
  
  // Git information
  gitRepoUrl: string;   // Repository URL (e.g., https://github.com/user/repo)
  gitBranch: string;    // Branch to deploy (e.g., main)
  gitCommitSha?: string; // Specific commit (optional, uses HEAD if not provided)
  
  // Build configuration
  buildCommand?: string;  // Custom build command (e.g., npm run build)
  startCommand?: string;  // Start command (e.g., npm start)
  dockerfilePath?: string; // Path to Dockerfile if using custom
  rootDirectory?: string;  // Root directory if not repo root
  
  // Runtime configuration
  port?: number;          // Port the app listens on (default: 3000)
  instanceType?: string;  // small, medium, large
  
  // Environment variables (encrypted in DB, decrypted here)
  envVars?: Record<string, string>;
  
  // Registry information
  registryUrl?: string;   // Where to push the image
  imageTag?: string;      // Generated image tag
  
  // Metadata
  triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli';
  projectName: string;    // For generating subdomain
  projectSlug: string;    // URL-safe project identifier
}

/**
 * Result of adding a job to the queue
 */
export interface BuildJobResult {
  jobId: string;
  queueName: string;
  status: 'added' | 'error';
  deploymentId: string;
}

// ─────────────────────────────────────────────────────────────────
// ADD BUILD JOB
// ─────────────────────────────────────────────────────────────────

/**
 * Add a new build job to the queue
 * 
 * This function:
 * 1. Validates the job data
 * 2. Adds the job to the Redis queue
 * 3. Returns the job ID for tracking
 * 
 * EXPRESS EQUIVALENT:
 * const addBuildJob = async (data) => {
 *   const job = await queue.add('build', data);
 *   return { jobId: job.id };
 * };
 * 
 * @param data - Build job data
 * @param options - Optional job options (priority, delay, etc.)
 * @returns Job result with ID
 */
export async function addBuildJob(
  data: BuildJobData,
  options?: Partial<JobsOptions>
): Promise<BuildJobResult> {
  try {
    // Generate a unique job name for easier identification
    const jobName = `deploy-${data.projectSlug}-${data.deploymentId.slice(0, 8)}`;
    
    logger.info({
      deploymentId: data.deploymentId,
      projectId: data.projectId,
      branch: data.gitBranch,
      triggeredBy: data.triggeredBy,
    }, `Adding build job to queue`);

    // Add job to queue
    const job: Job<BuildJobData> = await buildQueue.add(
      jobName,
      data,
      {
        ...DEFAULT_BUILD_JOB_OPTIONS,
        ...options,
        // Use deployment ID as job ID for easy lookup
        jobId: data.deploymentId,
      }
    );

    logger.info({
      jobId: job.id,
      deploymentId: data.deploymentId,
    }, `Build job added to queue`);

    return {
      jobId: job.id!,
      queueName: buildQueue.name,
      status: 'added',
      deploymentId: data.deploymentId,
    };
    
  } catch (error) {
    logger.error({
      err: error,
      deploymentId: data.deploymentId,
    }, `Failed to add build job to queue`);

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// PRIORITY JOBS
// ─────────────────────────────────────────────────────────────────

/**
 * Add a high-priority build job (for paid users, rollbacks, etc.)
 * Lower priority number = higher priority (1 is highest)
 */
export async function addPriorityBuildJob(
  data: BuildJobData,
  priority: number = 1
): Promise<BuildJobResult> {
  return addBuildJob(data, { priority });
}

/**
 * Add a delayed build job (scheduled deployments)
 * 
 * @param data - Build job data
 * @param delayMs - Delay in milliseconds
 */
export async function addDelayedBuildJob(
  data: BuildJobData,
  delayMs: number
): Promise<BuildJobResult> {
  return addBuildJob(data, { delay: delayMs });
}

// ─────────────────────────────────────────────────────────────────
// JOB STATUS HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Get a build job by deployment ID
 */
export async function getBuildJob(deploymentId: string): Promise<Job<BuildJobData> | null> {
  const job = await buildQueue.getJob(deploymentId);
  return job || null;
}

/**
 * Get the current state of a build job
 */
export async function getBuildJobState(deploymentId: string): Promise<string | null> {
  const job = await getBuildJob(deploymentId);
  if (!job) return null;
  return job.getState();
}

/**
 * Check if a deployment has a pending or active job
 */
export async function isDeploymentQueued(deploymentId: string): Promise<boolean> {
  const job = await getBuildJob(deploymentId);
  if (!job) return false;
  
  const state = await job.getState();
  return ['waiting', 'active', 'delayed'].includes(state);
}

/**
 * Remove a build job from the queue (if not yet processed)
 */
export async function removeBuildJob(deploymentId: string): Promise<boolean> {
  const job = await getBuildJob(deploymentId);
  if (!job) return false;
  
  const state = await job.getState();
  
  // Can only remove if not active
  if (state !== 'active') {
    await job.remove();
    logger.info({ deploymentId }, `Build job removed from queue`);
    return true;
  }
  
  return false;
}



