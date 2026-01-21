// ═══════════════════════════════════════════════════════════════════════════
// Deployments Service - Database Operations for Deployments
// ═══════════════════════════════════════════════════════════════════════════
//
// This service handles all database operations related to deployments:
// - CRUD operations for deployments
// - Build logs management
// - Deployment status updates
//
// EXPRESS EQUIVALENT:
// const Deployment = require('../models/Deployment');
// exports.findByProjectId = (projectId) => Deployment.findAll({ where: { projectId } });
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  deployments,
  buildLogs,
  projects,
  type Deployment,
  type NewDeployment,
  type BuildLog,
  type NewBuildLog,
} from '../db/schema';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * Deployment with computed fields
 */
export interface DeploymentWithDetails extends Deployment {
  duration?: number; // Total duration in ms
  logsCount?: number;
}

/**
 * Data for creating a new deployment
 */
export interface CreateDeploymentData {
  projectId: string;
  gitCommitSha?: string;
  gitCommitMessage?: string;
  gitBranch?: string;
  gitAuthor?: string;
  triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli';
}

/**
 * Filters for listing deployments
 */
export interface DeploymentFilters {
  buildStatus?: string;
  deployStatus?: string;
  gitBranch?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT CRUD
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// LIST DEPLOYMENTS
// ─────────────────────────────────────────────────────────────────

/**
 * List all deployments for a project
 * 
 * EXPRESS/SEQUELIZE EQUIVALENT:
 * const listByProjectId = async (projectId, { page, limit }) => {
 *   return Deployment.findAndCountAll({
 *     where: { projectId },
 *     order: [['createdAt', 'DESC']],
 *     offset: (page - 1) * limit,
 *     limit,
 *   });
 * };
 * 
 * @param projectId - Project ID
 * @param options - Pagination and filter options
 * @returns Array of deployments with total count
 */
export async function listDeploymentsByProjectId(
  projectId: string,
  options: PaginationOptions & DeploymentFilters = {}
): Promise<{ deployments: Deployment[]; total: number }> {
  const { page = 1, limit = 20, buildStatus, deployStatus, gitBranch } = options;
  const offset = (page - 1) * limit;

  // Build conditions array
  const conditions = [eq(deployments.projectId, projectId)];

  if (buildStatus) {
    conditions.push(eq(deployments.buildStatus, buildStatus));
  }
  if (deployStatus) {
    conditions.push(eq(deployments.deployStatus, deployStatus));
  }
  if (gitBranch) {
    conditions.push(eq(deployments.gitBranch, gitBranch));
  }

  // Get deployments with pagination
  const deploymentList = await db
    .select()
    .from(deployments)
    .where(and(...conditions))
    .orderBy(desc(deployments.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const allDeployments = await db
    .select({ id: deployments.id })
    .from(deployments)
    .where(and(...conditions));

  return {
    deployments: deploymentList,
    total: allDeployments.length,
  };
}

// ─────────────────────────────────────────────────────────────────
// GET DEPLOYMENT BY ID
// ─────────────────────────────────────────────────────────────────

/**
 * Get a single deployment by ID
 * 
 * @param id - Deployment ID
 * @returns Deployment or null if not found
 */
export async function getDeploymentById(id: string): Promise<Deployment | null> {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, id))
    .limit(1);

  return deployment || null;
}

/**
 * Get deployment by ID with project ownership check
 * Ensures the deployment belongs to the specified project
 * 
 * @param deploymentId - Deployment ID
 * @param projectId - Project ID
 * @returns Deployment or null
 */
export async function getDeploymentByIdAndProjectId(
  deploymentId: string,
  projectId: string
): Promise<Deployment | null> {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.id, deploymentId),
        eq(deployments.projectId, projectId)
      )
    )
    .limit(1);

  return deployment || null;
}

// ─────────────────────────────────────────────────────────────────
// GET CURRENT DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Get the current live deployment for a project
 * 
 * @param projectId - Project ID
 * @returns Current deployment or null
 */
export async function getCurrentDeployment(
  projectId: string
): Promise<Deployment | null> {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.projectId, projectId),
        eq(deployments.isCurrent, true)
      )
    )
    .limit(1);

  return deployment || null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new deployment
 * 
 * @param data - Deployment data
 * @returns Created deployment
 */
export async function createDeployment(
  data: CreateDeploymentData
): Promise<Deployment> {
  const [deployment] = await db
    .insert(deployments)
    .values({
      projectId: data.projectId,
      gitCommitSha: data.gitCommitSha,
      gitCommitMessage: data.gitCommitMessage,
      gitBranch: data.gitBranch,
      gitAuthor: data.gitAuthor,
      triggeredBy: data.triggeredBy,
      buildStatus: 'queued',
      deployStatus: 'pending',
      isCurrent: false,
    })
    .returning();

  return deployment;
}

// ─────────────────────────────────────────────────────────────────
// UPDATE DEPLOYMENT STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * Update deployment build status
 */
export async function updateBuildStatus(
  id: string,
  status: string,
  additionalData?: {
    buildStartedAt?: Date;
    buildFinishedAt?: Date;
    buildDurationMs?: number;
    imageTag?: string;
    imageSizeBytes?: number;
  }
): Promise<Deployment | null> {
  const [deployment] = await db
    .update(deployments)
    .set({
      buildStatus: status,
      ...additionalData,
    })
    .where(eq(deployments.id, id))
    .returning();

  return deployment || null;
}

/**
 * Update deployment deploy status
 */
export async function updateDeployStatus(
  id: string,
  status: string,
  additionalData?: {
    deployStartedAt?: Date;
    deployFinishedAt?: Date;
  }
): Promise<Deployment | null> {
  const [deployment] = await db
    .update(deployments)
    .set({
      deployStatus: status,
      ...additionalData,
    })
    .where(eq(deployments.id, id))
    .returning();

  return deployment || null;
}

// ─────────────────────────────────────────────────────────────────
// MARK DEPLOYMENT AS CURRENT
// ─────────────────────────────────────────────────────────────────

/**
 * Mark a deployment as current (live) and unmark previous
 * 
 * @param deploymentId - Deployment to mark as current
 * @param projectId - Project ID
 */
export async function markDeploymentAsCurrent(
  deploymentId: string,
  projectId: string
): Promise<void> {
  // First, unmark all current deployments for this project
  await db
    .update(deployments)
    .set({ isCurrent: false })
    .where(
      and(
        eq(deployments.projectId, projectId),
        eq(deployments.isCurrent, true)
      )
    );

  // Then mark the specified deployment as current
  await db
    .update(deployments)
    .set({
      isCurrent: true,
      deployStatus: 'live',
      deployFinishedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));
}

// ─────────────────────────────────────────────────────────────────
// CANCEL DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Cancel a running deployment
 * Only queued or building deployments can be cancelled
 * 
 * @param id - Deployment ID
 * @returns Updated deployment or null
 */
export async function cancelDeployment(id: string): Promise<Deployment | null> {
  const [deployment] = await db
    .update(deployments)
    .set({
      buildStatus: 'cancelled',
      deployStatus: 'pending',
      buildFinishedAt: new Date(),
    })
    .where(
      and(
        eq(deployments.id, id),
        // Can only cancel queued or building deployments
        sql`${deployments.buildStatus} IN ('queued', 'building')`
      )
    )
    .returning();

  return deployment || null;
}

// ─────────────────────────────────────────────────────────────────
// GET DEPLOYMENT COUNTS
// ─────────────────────────────────────────────────────────────────

/**
 * Get deployment statistics for a project
 */
export async function getDeploymentStats(projectId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  inProgress: number;
}> {
  const allDeployments = await db
    .select({
      buildStatus: deployments.buildStatus,
      deployStatus: deployments.deployStatus,
    })
    .from(deployments)
    .where(eq(deployments.projectId, projectId));

  const stats = {
    total: allDeployments.length,
    successful: 0,
    failed: 0,
    inProgress: 0,
  };

  for (const d of allDeployments) {
    if (d.deployStatus === 'live') {
      stats.successful++;
    } else if (d.buildStatus === 'failed' || d.deployStatus === 'failed') {
      stats.failed++;
    } else if (d.buildStatus === 'queued' || d.buildStatus === 'building' || d.deployStatus === 'deploying') {
      stats.inProgress++;
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD LOGS
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// GET BUILD LOGS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all build logs for a deployment
 * 
 * @param deploymentId - Deployment ID
 * @returns Array of log entries
 */
export async function getBuildLogs(deploymentId: string): Promise<BuildLog[]> {
  return db
    .select()
    .from(buildLogs)
    .where(eq(buildLogs.deploymentId, deploymentId))
    .orderBy(asc(buildLogs.timestamp));
}

/**
 * Get build logs with pagination (for large logs)
 * 
 * @param deploymentId - Deployment ID
 * @param options - Pagination options
 * @returns Array of log entries with total count
 */
export async function getBuildLogsPaginated(
  deploymentId: string,
  options: PaginationOptions = {}
): Promise<{ logs: BuildLog[]; total: number }> {
  const { page = 1, limit = 100 } = options;
  const offset = (page - 1) * limit;

  const logs = await db
    .select()
    .from(buildLogs)
    .where(eq(buildLogs.deploymentId, deploymentId))
    .orderBy(asc(buildLogs.timestamp))
    .limit(limit)
    .offset(offset);

  // Get total count
  const allLogs = await db
    .select({ id: buildLogs.id })
    .from(buildLogs)
    .where(eq(buildLogs.deploymentId, deploymentId));

  return {
    logs,
    total: allLogs.length,
  };
}

// ─────────────────────────────────────────────────────────────────
// ADD BUILD LOG
// ─────────────────────────────────────────────────────────────────

/**
 * Add a single log entry to a deployment
 * 
 * @param deploymentId - Deployment ID
 * @param message - Log message
 * @param level - Log level (info, warn, error, debug)
 * @returns Created log entry
 */
export async function addBuildLog(
  deploymentId: string,
  message: string,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info'
): Promise<BuildLog> {
  const [log] = await db
    .insert(buildLogs)
    .values({
      deploymentId,
      message,
      level,
      timestamp: new Date(),
    })
    .returning();

  return log;
}

/**
 * Add multiple log entries at once
 * More efficient for batch logging
 * 
 * @param deploymentId - Deployment ID
 * @param logs - Array of log messages with levels
 */
export async function addBuildLogsBatch(
  deploymentId: string,
  logs: Array<{ message: string; level?: string; timestamp?: Date }>
): Promise<void> {
  if (logs.length === 0) return;

  const values = logs.map((log) => ({
    deploymentId,
    message: log.message,
    level: log.level || 'info',
    timestamp: log.timestamp || new Date(),
  }));

  await db.insert(buildLogs).values(values);
}

// ─────────────────────────────────────────────────────────────────
// CLEAR BUILD LOGS
// ─────────────────────────────────────────────────────────────────

/**
 * Delete all build logs for a deployment
 * Useful for re-running a deployment
 */
export async function clearBuildLogs(deploymentId: string): Promise<void> {
  await db
    .delete(buildLogs)
    .where(eq(buildLogs.deploymentId, deploymentId));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a project exists and get its user ID
 * Used for authorization checks
 */
export async function getProjectOwner(projectId: string): Promise<string | null> {
  const [project] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return project?.userId || null;
}

/**
 * Get the previous successful deployment (for rollback)
 */
export async function getPreviousSuccessfulDeployment(
  projectId: string,
  excludeDeploymentId?: string
): Promise<Deployment | null> {
  const conditions = [
    eq(deployments.projectId, projectId),
    eq(deployments.deployStatus, 'live'),
  ];

  // If we want to exclude a specific deployment (e.g., the current one)
  if (excludeDeploymentId) {
    conditions.push(sql`${deployments.id} != ${excludeDeploymentId}`);
  }

  const [deployment] = await db
    .select()
    .from(deployments)
    .where(and(...conditions))
    .orderBy(desc(deployments.createdAt))
    .limit(1);

  return deployment || null;
}

/**
 * Check if a deployment can be cancelled
 */
export function canCancelDeployment(deployment: Deployment): boolean {
  return deployment.buildStatus === 'queued' || deployment.buildStatus === 'building';
}

/**
 * Check if a deployment can be rolled back to
 */
export function canRollbackTo(deployment: Deployment): boolean {
  return deployment.buildStatus === 'success' && deployment.imageTag !== null;
}


