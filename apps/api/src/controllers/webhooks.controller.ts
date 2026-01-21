// ═══════════════════════════════════════════════════════════════════════════
// Webhooks Controller - Business Logic for Webhook Processing
// ═══════════════════════════════════════════════════════════════════════════
//
// This controller handles:
// - GitHub webhook verification and processing
// - Triggering deployments from push events
// - Handling ping events (webhook setup verification)
//
// FLOW:
// 1. GitHub sends webhook to /api/v1/webhooks/github
// 2. We verify the signature (HMAC-SHA256)
// 3. Parse the payload to get commit/branch info
// 4. Find projects matching this repo + branch
// 5. Create a deployment for each matching project
// 6. Queue the build job (Build Worker picks it up)
//
// EXPRESS EQUIVALENT:
// router.post('/github', async (req, res) => {
//   // Verify signature
//   // Parse payload
//   // Trigger deployment
// });
//
// ═══════════════════════════════════════════════════════════════════════════

import { HTTPException } from 'hono/http-exception';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import {
  verifyGitHubSignature,
  parsePushEvent,
  shouldTriggerDeployment,
  type GitHubPushPayload,
  type GitHubPingPayload,
} from '../lib/github';
import {
  findProjectsByWebhook,
  createDeploymentFromWebhook,
  deploymentExistsForCommit,
  updateProjectRepoId,
  queueDeploymentBuild,
} from '../services/webhooks.service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface WebhookResponse {
  success: boolean;
  message: string;
  deployments?: Array<{
    id: string;
    projectId: string;
    projectSlug: string;
    commitSha: string;
    branch: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────
// CONTROLLER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Process GitHub webhook
 * 
 * This is the main entry point for GitHub webhooks.
 * Handles both ping and push events.
 * 
 * SECURITY:
 * - Always verify webhook signature before processing
 * - Never trust payload data without signature verification
 * 
 * @param rawBody - Raw request body (needed for signature verification)
 * @param signature - X-Hub-Signature-256 header
 * @param event - X-GitHub-Event header
 * @param deliveryId - X-GitHub-Delivery header (unique ID for this delivery)
 * @param payload - Parsed JSON payload
 */
export async function processGitHubWebhook(
  rawBody: string,
  signature: string | undefined,
  event: string | undefined,
  deliveryId: string | undefined,
  payload: unknown
): Promise<WebhookResponse> {
  // Log incoming webhook
  logger.info(
    {
      event,
      deliveryId,
      hasSignature: !!signature,
    },
    'Received GitHub webhook'
  );
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Verify Signature
  // ─────────────────────────────────────────────────────────────────
  
  // IMPORTANT: Always verify webhook signatures!
  // This ensures the request actually came from GitHub
  const isValid = verifyGitHubSignature(
    rawBody,
    signature,
    env.GITHUB_WEBHOOK_SECRET
  );
  
  if (!isValid) {
    logger.warn({ deliveryId, event }, 'GitHub webhook signature verification failed');
    throw new HTTPException(401, {
      message: 'Invalid webhook signature',
    });
  }
  
  logger.debug({ deliveryId }, 'GitHub webhook signature verified');
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Handle by Event Type
  // ─────────────────────────────────────────────────────────────────
  
  switch (event) {
    case 'ping':
      return handlePingEvent(payload as GitHubPingPayload);
    
    case 'push':
      return handlePushEvent(payload as GitHubPushPayload);
    
    default:
      // We only care about push events for now
      logger.debug({ event, deliveryId }, 'Ignoring GitHub event');
      return {
        success: true,
        message: `Event '${event}' acknowledged but not processed`,
      };
  }
}

/**
 * Handle GitHub ping event
 * 
 * GitHub sends a ping event when you first create a webhook.
 * This helps verify the webhook is set up correctly.
 */
function handlePingEvent(payload: GitHubPingPayload): WebhookResponse {
  logger.info(
    {
      zen: payload.zen,
      hookId: payload.hook_id,
      repo: payload.repository?.full_name,
      events: payload.hook?.events,
    },
    'GitHub webhook ping received'
  );
  
  return {
    success: true,
    message: `Pong! Webhook configured for ${payload.repository?.full_name || 'unknown repo'}. Zen: ${payload.zen}`,
  };
}

/**
 * Handle GitHub push event
 * 
 * This is the main event - triggered when code is pushed.
 * We use this to auto-deploy projects.
 */
async function handlePushEvent(payload: GitHubPushPayload): Promise<WebhookResponse> {
  // Parse the push event
  const parsedEvent = parsePushEvent(payload);
  
  // Not a branch push (could be a tag)
  if (!parsedEvent) {
    logger.debug(
      { ref: payload.ref },
      'Push event is not for a branch, ignoring'
    );
    return {
      success: true,
      message: 'Not a branch push, ignored',
    };
  }
  
  logger.info(
    {
      repo: parsedEvent.repoFullName,
      branch: parsedEvent.branch,
      commit: parsedEvent.commitSha.substring(0, 7),
      author: parsedEvent.author,
      message: parsedEvent.commitMessage.substring(0, 100),
    },
    'Processing GitHub push event'
  );
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Find Matching Projects
  // ─────────────────────────────────────────────────────────────────
  
  const matchingProjects = await findProjectsByWebhook(
    parsedEvent.repoId,
    parsedEvent.repoUrl,
    parsedEvent.branch
  );
  
  if (matchingProjects.length === 0) {
    logger.info(
      {
        repo: parsedEvent.repoFullName,
        branch: parsedEvent.branch,
      },
      'No projects found matching this webhook'
    );
    return {
      success: true,
      message: `No projects configured for ${parsedEvent.repoFullName}:${parsedEvent.branch}`,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 4: Create Deployments
  // ─────────────────────────────────────────────────────────────────
  
  const createdDeployments: Array<{
    id: string;
    projectId: string;
    projectSlug: string;
    commitSha: string;
    branch: string;
  }> = [];
  
  for (const project of matchingProjects) {
    // Check if deployment should be triggered
    if (!shouldTriggerDeployment(parsedEvent, project.gitBranch)) {
      logger.debug(
        { projectSlug: project.slug, branch: parsedEvent.branch },
        'Skipping deployment - conditions not met'
      );
      continue;
    }
    
    // Check for duplicate deployment
    const alreadyExists = await deploymentExistsForCommit(
      project.id,
      parsedEvent.commitSha
    );
    
    if (alreadyExists) {
      logger.info(
        {
          projectSlug: project.slug,
          commitSha: parsedEvent.commitSha.substring(0, 7),
        },
        'Deployment already exists for this commit, skipping'
      );
      continue;
    }
    
    // Update project's gitRepoId if not set
    if (!project.gitRepoId) {
      await updateProjectRepoId(project.id, parsedEvent.repoId);
    }
    
    // Create the deployment
    const deployment = await createDeploymentFromWebhook(project, parsedEvent);
    
    createdDeployments.push({
      id: deployment.id,
      projectId: project.id,
      projectSlug: project.slug,
      commitSha: parsedEvent.commitSha.substring(0, 7),
      branch: parsedEvent.branch,
    });
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 5: Queue the Build
    // ─────────────────────────────────────────────────────────────────
    
    // Add to build queue (Build Worker will pick this up)
    await queueDeploymentBuild(deployment);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 6: Return Response
  // ─────────────────────────────────────────────────────────────────
  
  if (createdDeployments.length === 0) {
    return {
      success: true,
      message: 'No new deployments created (might be duplicates or conditions not met)',
    };
  }
  
  logger.info(
    {
      deploymentsCount: createdDeployments.length,
      deployments: createdDeployments.map(d => ({
        id: d.id,
        project: d.projectSlug,
      })),
    },
    'Deployments created from webhook'
  );
  
  return {
    success: true,
    message: `Created ${createdDeployments.length} deployment(s)`,
    deployments: createdDeployments,
  };
}

// ─────────────────────────────────────────────────────────────────
// MANUAL WEBHOOK TESTING (Development Only)
// ─────────────────────────────────────────────────────────────────

/**
 * Simulate a GitHub push event (for testing)
 * 
 * Use this endpoint to test webhook handling without setting up
 * a real GitHub webhook. Only available in development.
 * 
 * @param projectId - Project to trigger deployment for
 * @param commitSha - Fake commit SHA
 * @param commitMessage - Fake commit message
 * @param branch - Branch name
 */
export async function simulatePushEvent(
  userId: string,
  projectId: string,
  commitSha: string,
  commitMessage: string,
  branch?: string
): Promise<WebhookResponse> {
  // Only allow in development
  if (env.NODE_ENV !== 'development') {
    throw new HTTPException(403, {
      message: 'Webhook simulation only available in development',
    });
  }
  
  // Import projects service to get project details
  const { db } = await import('../db');
  const { projects } = await import('../db/schema');
  const { eq, and } = await import('drizzle-orm');
  
  // Find the project
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
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.userId, userId)
      )
    )
    .limit(1);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  const effectiveBranch = branch || project.gitBranch;
  
  // Create fake parsed event
  const fakeEvent = {
    branch: effectiveBranch,
    commitSha: commitSha || `test${Date.now()}`,
    commitMessage: commitMessage || 'Test deployment from webhook simulation',
    author: 'Test User',
    repoUrl: project.gitRepoUrl,
    repoFullName: 'test/repo',
    repoId: project.gitRepoId || 'test-repo-id',
    isDeleted: false,
  };
  
  // Check for duplicate
  const alreadyExists = await deploymentExistsForCommit(project.id, fakeEvent.commitSha);
  if (alreadyExists) {
    throw new HTTPException(409, {
      message: 'Deployment already exists for this commit',
    });
  }
  
  // Create deployment
  const deployment = await createDeploymentFromWebhook(
    {
      id: project.id,
      name: project.name,
      slug: project.slug,
      gitBranch: project.gitBranch,
      gitRepoUrl: project.gitRepoUrl,
      gitRepoId: project.gitRepoId,
      userId: project.userId,
      status: project.status,
    },
    fakeEvent
  );
  
  // Queue build
  await queueDeploymentBuild(deployment);
  
  return {
    success: true,
    message: 'Test deployment created',
    deployments: [
      {
        id: deployment.id,
        projectId: project.id,
        projectSlug: project.slug,
        commitSha: fakeEvent.commitSha.substring(0, 7),
        branch: effectiveBranch,
      },
    ],
  };
}


