// ═══════════════════════════════════════════════════════════════════════════
// Webhooks Service - Database Operations for Webhooks
// ═══════════════════════════════════════════════════════════════════════════
//
// This service handles:
// - Looking up projects by GitHub repo ID or URL
// - Creating deployments from webhook events
// - Coordinating with the deployment pipeline
//
// EXPRESS EQUIVALENT:
// This is similar to a Mongoose/Sequelize model service where you'd have
// methods like Project.findByRepoId() and Deployment.createFromWebhook()
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, or } from 'drizzle-orm';
import { db } from '../db';
import { projects, deployments } from '../db/schema';
import { logger } from '../lib/logger';
import type { ParsedPushEvent } from '../lib/github';
import { normalizeGitHubUrl } from '../lib/github';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface WebhookProject {
  id: string;
  name: string;
  slug: string;
  gitBranch: string;
  gitRepoUrl: string;
  gitRepoId: string | null;
  userId: string;
  status: string;
}

export interface WebhookDeployment {
  id: string;
  projectId: string;
  gitCommitSha: string | null;
  gitCommitMessage: string | null;
  gitBranch: string | null;
  gitAuthor: string | null;
  buildStatus: string;
  deployStatus: string;
  triggeredBy: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// PROJECT LOOKUP FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Find projects that should be deployed based on GitHub push event
 * 
 * We match projects by:
 * 1. GitHub repo ID (most reliable - unique identifier from GitHub)
 * 2. Normalized repo URL (fallback - handle URL variations)
 * 
 * Multiple projects can deploy from the same repo but different branches.
 * 
 * @param repoId - GitHub repository ID from webhook payload
 * @param repoUrl - Repository URL from webhook payload
 * @param branch - Branch that was pushed to
 * @returns Array of matching projects
 */
export async function findProjectsByWebhook(
  repoId: string,
  repoUrl: string,
  branch: string
): Promise<WebhookProject[]> {
  try {
    // Normalize the URL for comparison
    const normalizedUrl = normalizeGitHubUrl(repoUrl);
    
    // Find all projects that:
    // 1. Match either the repo ID or normalized URL
    // 2. AND are configured to deploy from this branch
    // 3. AND are using 'github' as their git provider
    const matchingProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        gitBranch: projects.gitBranch,
        gitRepoUrl: projects.gitRepoUrl,
        gitRepoId: projects.gitRepoId,
        userId: projects.userId,
        status: projects.status,
      })
      .from(projects)
      .where(
        and(
          // Match by repo ID or URL
          or(
            eq(projects.gitRepoId, repoId),
            eq(projects.gitRepoUrl, normalizedUrl),
            eq(projects.gitRepoUrl, repoUrl) // Also check original URL
          ),
          // Match the branch
          eq(projects.gitBranch, branch),
          // Only GitHub projects
          eq(projects.gitProvider, 'github')
        )
      );
    
    logger.debug(
      {
        repoId,
        repoUrl: normalizedUrl,
        branch,
        matchCount: matchingProjects.length,
        projectIds: matchingProjects.map(p => p.id),
      },
      'Found projects matching webhook'
    );
    
    return matchingProjects;
  } catch (error) {
    logger.error({ err: error, repoId, repoUrl, branch }, 'Failed to find projects by webhook');
    throw error;
  }
}

/**
 * Find a single project by GitHub repo ID
 * Useful for updating git repo ID when webhook first arrives
 */
export async function findProjectByRepoId(repoId: string): Promise<WebhookProject | null> {
  try {
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        gitBranch: projects.gitBranch,
        gitRepoUrl: projects.gitRepoUrl,
        gitRepoId: projects.gitRepoId,
        userId: projects.userId,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.gitRepoId, repoId))
      .limit(1);
    
    return project || null;
  } catch (error) {
    logger.error({ err: error, repoId }, 'Failed to find project by repo ID');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Update project's gitRepoId if not already set
 * 
 * This is called on first webhook to store the GitHub repo ID
 * for more reliable matching in the future.
 */
export async function updateProjectRepoId(
  projectId: string,
  repoId: string
): Promise<void> {
  try {
    await db
      .update(projects)
      .set({
        gitRepoId: repoId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, projectId),
          // Only update if not already set (prevent overwriting)
          or(
            eq(projects.gitRepoId, ''),
            // Check for null by comparing with a string we know won't match
            eq(projects.gitRepoId, null as any)
          )
        )
      );
    
    logger.debug({ projectId, repoId }, 'Updated project gitRepoId');
  } catch (error) {
    logger.error({ err: error, projectId, repoId }, 'Failed to update project repo ID');
    // Don't throw - this is not critical
  }
}

// ─────────────────────────────────────────────────────────────────
// DEPLOYMENT CREATION
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new deployment from a webhook event
 * 
 * This creates a deployment record with 'queued' status.
 * The Build Worker will pick it up and process it.
 * 
 * EXPRESS EQUIVALENT:
 * const deployment = await Deployment.create({
 *   projectId: project.id,
 *   gitCommitSha: event.commitSha,
 *   ...
 * });
 */
export async function createDeploymentFromWebhook(
  project: WebhookProject,
  event: ParsedPushEvent
): Promise<WebhookDeployment> {
  try {
    // Truncate commit message if too long (database column limit)
    const truncatedMessage = event.commitMessage.length > 490
      ? event.commitMessage.substring(0, 487) + '...'
      : event.commitMessage;
    
    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        gitCommitSha: event.commitSha,
        gitCommitMessage: truncatedMessage,
        gitBranch: event.branch,
        gitAuthor: event.author,
        buildStatus: 'queued',
        deployStatus: 'pending',
        triggeredBy: 'webhook',
      })
      .returning();
    
    logger.info(
      {
        deploymentId: deployment.id,
        projectId: project.id,
        projectSlug: project.slug,
        commitSha: event.commitSha.substring(0, 7),
        branch: event.branch,
        author: event.author,
      },
      'Created deployment from webhook'
    );
    
    // Update project status to 'building'
    await db
      .update(projects)
      .set({
        status: 'building',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));
    
    return {
      id: deployment.id,
      projectId: deployment.projectId,
      gitCommitSha: deployment.gitCommitSha,
      gitCommitMessage: deployment.gitCommitMessage,
      gitBranch: deployment.gitBranch,
      gitAuthor: deployment.gitAuthor,
      buildStatus: deployment.buildStatus,
      deployStatus: deployment.deployStatus,
      triggeredBy: deployment.triggeredBy,
      createdAt: deployment.createdAt,
    };
  } catch (error) {
    logger.error(
      { err: error, projectId: project.id, commitSha: event.commitSha },
      'Failed to create deployment from webhook'
    );
    throw error;
  }
}

/**
 * Check if a deployment already exists for this commit
 * 
 * Prevents duplicate deployments if webhook is sent multiple times.
 */
export async function deploymentExistsForCommit(
  projectId: string,
  commitSha: string
): Promise<boolean> {
  try {
    const [existing] = await db
      .select({ id: deployments.id })
      .from(deployments)
      .where(
        and(
          eq(deployments.projectId, projectId),
          eq(deployments.gitCommitSha, commitSha)
        )
      )
      .limit(1);
    
    return !!existing;
  } catch (error) {
    logger.error(
      { err: error, projectId, commitSha },
      'Failed to check for existing deployment'
    );
    return false; // Default to allowing creation if check fails
  }
}

// ─────────────────────────────────────────────────────────────────
// WEBHOOK LOGGING (Future: Store webhook events for debugging)
// ─────────────────────────────────────────────────────────────────

// TODO: Add webhook_events table to store all webhook payloads
// This is useful for:
// - Debugging webhook issues
// - Replaying failed webhooks
// - Audit trail

export interface WebhookEventLog {
  id: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  event: string;
  payload: unknown;
  signature: string;
  deliveryId: string;
  processedAt: Date | null;
  status: 'pending' | 'success' | 'failed' | 'ignored';
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────────
// QUEUE INTEGRATION (Future: Add to BullMQ)
// ─────────────────────────────────────────────────────────────────

/**
 * Add deployment to the build queue
 * 
 * TODO: Implement when BullMQ is set up
 * For now, just logs that deployment should be queued
 */
export async function queueDeploymentBuild(deployment: WebhookDeployment): Promise<void> {
  // TODO: Add to BullMQ queue
  // await buildQueue.add('build', {
  //   deploymentId: deployment.id,
  //   projectId: deployment.projectId,
  // });
  
  logger.info(
    {
      deploymentId: deployment.id,
      projectId: deployment.projectId,
    },
    'TODO: Deployment should be added to build queue'
  );
}


