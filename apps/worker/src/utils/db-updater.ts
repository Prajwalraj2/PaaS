// ═══════════════════════════════════════════════════════════════════════════
// Database Updater
// ═══════════════════════════════════════════════════════════════════════════
//
// Functions to update deployment status in the database.
// This allows the worker to report progress back to the API.
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../lib/logger';
import type { BuildLogEntry, BuildStatus, DeployStatus } from '../types';

// Import schema types - we'll inline the table definitions since we're in a separate package
// In production, you'd share this through a shared package
import { pgTable, uuid, varchar, text, timestamp, boolean, integer, bigint } from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────
// SCHEMA DEFINITIONS (duplicated from API for now)
// ─────────────────────────────────────────────────────────────────

const deployments = pgTable('deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull(),
  gitCommitSha: varchar('git_commit_sha', { length: 100 }),
  gitCommitMessage: varchar('git_commit_message', { length: 500 }),
  gitBranch: varchar('git_branch', { length: 255 }),
  gitAuthor: varchar('git_author', { length: 255 }),
  buildStatus: varchar('build_status', { length: 50 }).default('queued'),
  buildStartedAt: timestamp('build_started_at'),
  buildFinishedAt: timestamp('build_finished_at'),
  buildDurationMs: integer('build_duration_ms'),
  imageTag: varchar('image_tag', { length: 255 }),
  imageSizeBytes: bigint('image_size_bytes', { mode: 'number' }),
  deployStatus: varchar('deploy_status', { length: 50 }).default('pending'),
  deployStartedAt: timestamp('deploy_started_at'),
  deployFinishedAt: timestamp('deploy_finished_at'),
  appUrl: varchar('app_url', { length: 500 }),
  isCurrent: boolean('is_current').default(false),
  triggeredBy: varchar('triggered_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

const buildLogs = pgTable('build_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deploymentId: uuid('deployment_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  level: varchar('level', { length: 20 }).default('info'),
  message: text('message').notNull(),
});

const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: varchar('status', { length: 50 }).default('inactive'),
});

// ─────────────────────────────────────────────────────────────────
// UPDATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Update deployment build status
 */
export async function updateBuildStatus(
  deploymentId: string,
  status: BuildStatus,
  additionalData?: {
    buildStartedAt?: Date;
    buildFinishedAt?: Date;
    buildDurationMs?: number;
    imageTag?: string;
    imageSizeBytes?: number;
  }
): Promise<void> {
  try {
    await db
      .update(deployments)
      .set({
        buildStatus: status,
        ...additionalData,
      })
      .where(eq(deployments.id, deploymentId));
    
    logger.debug({ deploymentId, status }, 'Updated build status');
  } catch (error) {
    logger.error({ err: error, deploymentId }, 'Failed to update build status');
    throw error;
  }
}

/**
 * Update deployment deploy status
 */
export async function updateDeployStatus(
  deploymentId: string,
  status: DeployStatus,
  additionalData?: {
    deployStartedAt?: Date;
    deployFinishedAt?: Date;
  }
): Promise<void> {
  try {
    await db
      .update(deployments)
      .set({
        deployStatus: status,
        ...additionalData,
      })
      .where(eq(deployments.id, deploymentId));
    
    logger.debug({ deploymentId, status }, 'Updated deploy status');
  } catch (error) {
    logger.error({ err: error, deploymentId }, 'Failed to update deploy status');
    throw error;
  }
}

/**
 * Mark a deployment as current (live) and store the app URL
 */
export async function markDeploymentAsCurrent(
  deploymentId: string,
  projectId: string,
  appUrl?: string
): Promise<void> {
  try {
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
    
    // Then mark the specified deployment as current and store the app URL
    await db
      .update(deployments)
      .set({
        isCurrent: true,
        deployStatus: 'live',
        deployFinishedAt: new Date(),
        appUrl: appUrl || null,
      })
      .where(eq(deployments.id, deploymentId));
    
    logger.info({ deploymentId, projectId, appUrl }, 'Marked deployment as current');
  } catch (error) {
    logger.error({ err: error, deploymentId }, 'Failed to mark deployment as current');
    throw error;
  }
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  projectId: string,
  status: string
): Promise<void> {
  try {
    await db
      .update(projects)
      .set({ status })
      .where(eq(projects.id, projectId));
    
    logger.debug({ projectId, status }, 'Updated project status');
  } catch (error) {
    logger.error({ err: error, projectId }, 'Failed to update project status');
    throw error;
  }
}

/**
 * Add build logs to the database
 */
export async function saveBuildLogs(
  deploymentId: string,
  logs: BuildLogEntry[]
): Promise<void> {
  if (logs.length === 0) return;
  
  try {
    const values = logs.map((log) => ({
      deploymentId,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
    }));
    
    await db.insert(buildLogs).values(values);
    
    logger.debug({ deploymentId, count: logs.length }, 'Saved build logs');
  } catch (error) {
    logger.error({ err: error, deploymentId }, 'Failed to save build logs');
    // Don't throw - logging failures shouldn't stop the build
  }
}

/**
 * Add a single build log entry
 */
export async function addBuildLog(
  deploymentId: string,
  message: string,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info'
): Promise<void> {
  try {
    await db.insert(buildLogs).values({
      deploymentId,
      message,
      level,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ err: error, deploymentId }, 'Failed to add build log');
    // Don't throw - logging failures shouldn't stop the build
  }
}



