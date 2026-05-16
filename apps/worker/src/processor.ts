// ═══════════════════════════════════════════════════════════════════════════
// Build Job Processor
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the main processor that handles build jobs.
// It orchestrates the build pipeline:
// 1. Clone repository
// 2. Detect application type
// 3. Build Docker image
// 4. Push to registry
// 5. Deploy to Kubernetes
//
// ═══════════════════════════════════════════════════════════════════════════

import { Worker, type Job } from 'bullmq'; // BullMQ is a job queue for Node.js
import { join } from 'path'; // join is a function that joins two paths together
import { rm } from 'fs/promises'; // rm is a function that removes a file or directory
import { nanoid } from 'nanoid'; // nanoid is a function that generates a unique id
import { getWorkerConnection } from './lib/redis'; // getWorkerConnection is a function that returns a Redis connection, it is imported from the redis.ts file
import { env } from './lib/env'; // env is the environment variables, it is imported from the env.ts file
import { logger } from './lib/logger'; // logger is the logger, it is imported from the logger.ts file
import type { BuildContext, BuildJobData, BuildResult, BuildStep } from './types'; // types is the types, it is imported from the types.ts file

// Import build steps
import { cloneStep } from './steps/clone';
import { detectStep } from './steps/detect';
import { buildStep } from './steps/build';
import { pushStep } from './steps/push';
import { deployStep } from './steps/deploy';

// Import database updaters
import {
  updateBuildStatus,
  updateDeployStatus,
  markDeploymentAsCurrent,
  updateProjectStatus,
  saveBuildLogs,
} from './utils/db-updater';
import { addLog, formatDuration } from './utils/log-helper';

// ─────────────────────────────────────────────────────────────────
// QUEUE NAME (must match API)
// ─────────────────────────────────────────────────────────────────

const BUILD_QUEUE_NAME = 'build-jobs';

// ─────────────────────────────────────────────────────────────────
// BUILD PIPELINE
// ─────────────────────────────────────────────────────────────────

/**
 * The ordered list of build steps
 */
const BUILD_PIPELINE: BuildStep[] = [
  cloneStep,
  detectStep,
  buildStep,
  pushStep,
  deployStep,
];

// ─────────────────────────────────────────────────────────────────
// MAIN PROCESSOR
// ─────────────────────────────────────────────────────────────────

/**
 * Process a build job
 * This is called by BullMQ for each job in the queue
 */
async function processJob(job: Job<BuildJobData>): Promise<BuildResult> {

  // Get the start time of the build
  const startTime = Date.now();

  // Get the data from the job 
  const { data } = job;
  
  // Log the start of the build job
  logger.info({
    jobId: job.id,
    deploymentId: data.deploymentId,
    projectId: data.projectId,
    triggeredBy: data.triggeredBy,
  }, '🚀 Starting build job');

  
  // Create work directory for the build, it is a unique directory for the build job, it is used to store the source code and build artifacts
  const workDir = join(
    env.BUILD_WORKSPACE,
    `${data.projectSlug}-${nanoid(8)}`
  );

  // Initialize build context, it is a context that is passed through each build step
  const context: BuildContext = {
    job: data, // The job data
    workDir, // The working directory for the build
    startTime, // The start time of the build
    logs: [], // The logs for the build
  };


  // The main try catch block for the build job, it is used to catch any errors that occur during the build process
  try {
    // Update status to "building", it is used to update the status of the build in the database
    await updateBuildStatus(data.deploymentId, 'building', {
      buildStartedAt: new Date(),
    });
    await updateProjectStatus(data.projectId, 'building'); // Update the status of the project in the database

    addLog(context, 'info', '════════════════════════════════════════════'); // Add a log entry to the build context
    addLog(context, 'info', '🏗️  PaaS BUILD STARTED'); // Add a log entry to the build context
    addLog(context, 'info', '════════════════════════════════════════════'); // Add a log entry to the build context
    addLog(context, 'info', ''); // Add a log entry to the build context
    addLog(context, 'info', `Project: ${data.projectName}`); // Add a log entry to the build context
    addLog(context, 'info', `Branch: ${data.gitBranch}`); // Add a log entry to the build context
    addLog(context, 'info', `Triggered by: ${data.triggeredBy}`); // Add a log entry to the build context
    addLog(context, 'info', ''); // Add a log entry to the build context

    // Run each step in the pipeline
    let currentContext = context; // The current context for the build
    
    // Run each step in the pipeline
    for (const step of BUILD_PIPELINE) {
      // Get the start time of the step
      const stepStartTime = Date.now();
      
      logger.info({ step: step.name, deploymentId: data.deploymentId }, `Starting step: ${step.name}`); // Log the start of the step
      
      // Update job progress, it is used to update the progress of the job in the database
      await job.updateProgress({
        step: step.name,
        message: `Running ${step.name}...`,
      });

      // Execute the step
      currentContext = await step.execute(currentContext);
      
      const stepDuration = Date.now() - stepStartTime;
      logger.info({ 
        step: step.name, 
        deploymentId: data.deploymentId,
        duration: stepDuration,
      }, `Completed step: ${step.name}`);
    }

    // Calculate build duration
    const buildDuration = Date.now() - startTime;

    // Update deployment as successful
    await updateBuildStatus(data.deploymentId, 'success', {
      buildFinishedAt: new Date(),
      buildDurationMs: buildDuration,
      imageTag: currentContext.imageTag,
      imageSizeBytes: currentContext.imageSizeBytes,
    });
    
    await updateDeployStatus(data.deploymentId, 'deploying', {
      deployStartedAt: new Date(),
    });

    // Mark as current deployment
    await markDeploymentAsCurrent(data.deploymentId, data.projectId);
    
    // Update project status to running
    await updateProjectStatus(data.projectId, 'running');

    // Save build logs to database
    await saveBuildLogs(data.deploymentId, currentContext.logs);

    addLog(currentContext, 'info', '');
    addLog(currentContext, 'info', `Total build time: ${formatDuration(buildDuration)}`);

    logger.info({
      deploymentId: data.deploymentId,
      duration: buildDuration,
      imageTag: currentContext.imageTag,
    }, '✅ Build completed successfully');

    return {
      success: true,
      imageTag: currentContext.imageTag,
      buildDurationMs: buildDuration,
      logs: currentContext.logs,
    };

  } catch (error) {
    const buildDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error({
      err: error,
      deploymentId: data.deploymentId,
      duration: buildDuration,
    }, '❌ Build failed');

    addLog(context, 'error', '');
    addLog(context, 'error', '════════════════════════════════════════════');
    addLog(context, 'error', '❌ BUILD FAILED');
    addLog(context, 'error', '════════════════════════════════════════════');
    addLog(context, 'error', '');
    addLog(context, 'error', `Error: ${errorMessage}`);
    addLog(context, 'error', `Build time: ${formatDuration(buildDuration)}`);

    // Update deployment as failed
    await updateBuildStatus(data.deploymentId, 'failed', {
      buildFinishedAt: new Date(),
      buildDurationMs: buildDuration,
    });
    
    await updateProjectStatus(data.projectId, 'failed');

    // Save build logs even on failure
    await saveBuildLogs(data.deploymentId, context.logs);

    return {
      success: false,
      buildDurationMs: buildDuration,
      error: errorMessage,
      logs: context.logs,
    };

  } finally {
    // Cleanup: Remove working directory
    try {
      await rm(workDir, { recursive: true, force: true });
      logger.debug({ workDir }, 'Cleaned up working directory');
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, workDir }, 'Failed to cleanup working directory');
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// WORKER INSTANCE
// ─────────────────────────────────────────────────────────────────

let worker: Worker<BuildJobData, BuildResult> | null = null;

/**
 * Start the build worker
 */
export function startWorker(): Worker<BuildJobData, BuildResult> {
  if (worker) {
    logger.warn('Worker already started');
    return worker;
  }

  // Create a new worker
  worker = new Worker<BuildJobData, BuildResult>(
    BUILD_QUEUE_NAME,
    processJob,
    {
      connection: getWorkerConnection(), // The Redis connection to use
      concurrency: env.WORKER_CONCURRENCY, // The number of jobs to process concurrently
      name: env.WORKER_NAME, // The name of the worker
    }
  );

  // Event handlers
  worker.on('ready', () => {
    logger.info({
      queueName: BUILD_QUEUE_NAME,
      concurrency: env.WORKER_CONCURRENCY,
      workerName: env.WORKER_NAME,
    }, '🔧 Worker is ready and listening for jobs');
  });

  worker.on('completed', (job, result) => {
    logger.info({
      jobId: job.id,
      deploymentId: job.data.deploymentId,
      success: result.success,
      duration: result.buildDurationMs,
    }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({
      jobId: job?.id,
      deploymentId: job?.data.deploymentId,
      error: error.message,
    }, 'Job failed');
  });

  worker.on('error', (error) => {
    logger.error({ err: error }, 'Worker error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled');
  });

  return worker;
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    logger.info('Stopping worker...');
    await worker.close();
    worker = null;
    logger.info('Worker stopped');
  }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return worker !== null && worker.isRunning();
}



