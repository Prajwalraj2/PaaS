// ═══════════════════════════════════════════════════════════════════════════
// Deployments Controller - Business Logic for Deployments
// ═══════════════════════════════════════════════════════════════════════════
//
// This controller handles the business logic for deployment management:
// - Authorization checks
// - Status validation
// - Calling services
// - Formatting responses
//
// EXPRESS EQUIVALENT:
// exports.list = async (req, res, next) => {
//   try {
//     const deployments = await deploymentService.listByProjectId(req.params.projectId);
//     res.json({ data: deployments });
//   } catch (error) {
//     next(error);
//   }
// };
//
// ═══════════════════════════════════════════════════════════════════════════

import { HTTPException } from 'hono/http-exception';
import * as deploymentService from '../services/deployments.service';
import * as projectService from '../services/projects.service';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface ListDeploymentsOptions {
  page?: number;
  limit?: number;
  buildStatus?: string;
  deployStatus?: string;
  gitBranch?: string;
}

// ─────────────────────────────────────────────────────────────────
// AUTHORIZATION HELPER
// ─────────────────────────────────────────────────────────────────

/**
 * Verify that the user owns the project
 * Throws 404 if project not found or doesn't belong to user
 */
async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);

  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// LIST DEPLOYMENTS
// ─────────────────────────────────────────────────────────────────

/**
 * List all deployments for a project
 * 
 * EXPRESS EQUIVALENT:
 * exports.list = async (req, res) => {
 *   const deployments = await Deployment.findAll({
 *     where: { projectId: req.params.projectId },
 *     order: [['createdAt', 'DESC']],
 *   });
 *   res.json({ data: deployments });
 * };
 */
export async function listDeployments(
  projectId: string,
  userId: string,
  options: ListDeploymentsOptions = {}
) {
  // Verify user owns the project
  await verifyProjectOwnership(projectId, userId);

  const { page = 1, limit = 20, ...filters } = options;

  const { deployments, total } = await deploymentService.listDeploymentsByProjectId(
    projectId,
    { page, limit, ...filters }
  );

  return {
    deployments,
    pagination: {
      page,
      perPage: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// GET DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Get a single deployment with details
 */
export async function getDeployment(
  projectId: string,
  deploymentId: string,
  userId: string
) {
  // Verify user owns the project
  await verifyProjectOwnership(projectId, userId);

  const deployment = await deploymentService.getDeploymentByIdAndProjectId(
    deploymentId,
    projectId
  );

  if (!deployment) {
    throw new HTTPException(404, {
      message: 'Deployment not found',
    });
  }

  return deployment;
}

// ─────────────────────────────────────────────────────────────────
// GET BUILD LOGS
// ─────────────────────────────────────────────────────────────────

/**
 * Get build logs for a deployment
 */
export async function getBuildLogs(
  projectId: string,
  deploymentId: string,
  userId: string,
  options: { page?: number; limit?: number } = {}
) {
  // Verify user owns the project
  await verifyProjectOwnership(projectId, userId);

  // Verify deployment belongs to project
  const deployment = await deploymentService.getDeploymentByIdAndProjectId(
    deploymentId,
    projectId
  );

  if (!deployment) {
    throw new HTTPException(404, {
      message: 'Deployment not found',
    });
  }

  const { page = 1, limit = 500 } = options;

  const { logs, total } = await deploymentService.getBuildLogsPaginated(
    deploymentId,
    { page, limit }
  );

  return {
    logs,
    pagination: {
      page,
      perPage: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    deployment: {
      id: deployment.id,
      buildStatus: deployment.buildStatus,
      deployStatus: deployment.deployStatus,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// TRIGGER DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Trigger a new deployment for a project
 * This creates a deployment record and updates project status
 */
export async function triggerDeployment(
  projectId: string,
  userId: string,
  triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli' = 'manual'
) {
  // Verify user owns the project
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);

  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }

  // Check if there's already a deployment in progress
  const currentDeployment = await deploymentService.getCurrentDeployment(projectId);
  
  // We allow new deployments even if one is in progress
  // The build worker will handle queuing

  // Create deployment record
  const deployment = await deploymentService.createDeployment({
    projectId,
    gitBranch: project.gitBranch,
    triggeredBy,
  });

  // Update project status to building
  await projectService.updateProjectStatus(projectId, 'building');

  logger.info(
    { userId, projectId, deploymentId: deployment.id, triggeredBy },
    'Deployment triggered'
  );

  // TODO: Add job to build queue
  // await buildQueue.add('build', { deploymentId: deployment.id, projectId });

  // Add initial log entry
  await deploymentService.addBuildLog(
    deployment.id,
    `Deployment triggered by ${triggeredBy}`,
    'info'
  );

  return deployment;
}

// ─────────────────────────────────────────────────────────────────
// ROLLBACK DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Rollback to a previous deployment
 * 
 * This marks the target deployment as current and creates a new
 * deployment record for tracking purposes.
 */
export async function rollbackDeployment(
  projectId: string,
  deploymentId: string,
  userId: string
) {
  // Verify user owns the project
  await verifyProjectOwnership(projectId, userId);

  // Get the deployment to rollback to
  const targetDeployment = await deploymentService.getDeploymentByIdAndProjectId(
    deploymentId,
    projectId
  );

  if (!targetDeployment) {
    throw new HTTPException(404, {
      message: 'Deployment not found',
    });
  }

  // Check if deployment can be rolled back to
  if (!deploymentService.canRollbackTo(targetDeployment)) {
    throw new HTTPException(400, {
      message: 'Cannot rollback to this deployment. Deployment must have a successful build with an image.',
    });
  }

  // Get current deployment (if any)
  const currentDeployment = await deploymentService.getCurrentDeployment(projectId);

  // Create a new deployment record for the rollback
  const rollbackDeployment = await deploymentService.createDeployment({
    projectId,
    gitCommitSha: targetDeployment.gitCommitSha || undefined,
    gitCommitMessage: `Rollback to deployment ${targetDeployment.id.slice(0, 8)}`,
    gitBranch: targetDeployment.gitBranch || undefined,
    triggeredBy: 'rollback',
  });

  // Update the rollback deployment with the same image as target
  await deploymentService.updateBuildStatus(rollbackDeployment.id, 'success', {
    buildStartedAt: new Date(),
    buildFinishedAt: new Date(),
    buildDurationMs: 0,
    imageTag: targetDeployment.imageTag || undefined,
    imageSizeBytes: targetDeployment.imageSizeBytes || undefined,
  });

  // Mark the rollback deployment as current
  await deploymentService.markDeploymentAsCurrent(rollbackDeployment.id, projectId);

  // Update project status
  await projectService.updateProjectStatus(projectId, 'running');

  logger.info(
    {
      userId,
      projectId,
      rollbackDeploymentId: rollbackDeployment.id,
      targetDeploymentId: deploymentId,
      previousDeploymentId: currentDeployment?.id,
    },
    'Deployment rolled back'
  );

  // Add log entry
  await deploymentService.addBuildLog(
    rollbackDeployment.id,
    `Rolled back to deployment ${targetDeployment.id.slice(0, 8)}`,
    'info'
  );

  return rollbackDeployment;
}

// ─────────────────────────────────────────────────────────────────
// CANCEL DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Cancel a running deployment
 */
export async function cancelDeployment(
  projectId: string,
  deploymentId: string,
  userId: string
) {
  // Verify user owns the project
  await verifyProjectOwnership(projectId, userId);

  // Get the deployment
  const deployment = await deploymentService.getDeploymentByIdAndProjectId(
    deploymentId,
    projectId
  );

  if (!deployment) {
    throw new HTTPException(404, {
      message: 'Deployment not found',
    });
  }

  // Check if deployment can be cancelled
  if (!deploymentService.canCancelDeployment(deployment)) {
    throw new HTTPException(400, {
      message: 'Cannot cancel this deployment. Only queued or building deployments can be cancelled.',
    });
  }

  // Cancel the deployment
  const cancelled = await deploymentService.cancelDeployment(deploymentId);

  if (!cancelled) {
    throw new HTTPException(400, {
      message: 'Failed to cancel deployment',
    });
  }

  // Update project status back to previous state
  const currentDeployment = await deploymentService.getCurrentDeployment(projectId);
  const newStatus = currentDeployment ? 'running' : 'inactive';
  await projectService.updateProjectStatus(projectId, newStatus);

  logger.info(
    { userId, projectId, deploymentId },
    'Deployment cancelled'
  );

  // Add log entry
  await deploymentService.addBuildLog(
    deploymentId,
    'Deployment cancelled by user',
    'warn'
  );

  return cancelled;
}

// ─────────────────────────────────────────────────────────────────
// GET DEPLOYMENT STATS
// ─────────────────────────────────────────────────────────────────

/**
 * Get deployment statistics for a project
 */
export async function getDeploymentStats(projectId: string, userId: string) {
  // Verify user owns the project
  await verifyProjectOwnership(projectId, userId);

  const stats = await deploymentService.getDeploymentStats(projectId);

  return stats;
}


