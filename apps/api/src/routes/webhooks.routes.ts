// ═══════════════════════════════════════════════════════════════════════════
// Webhooks Routes - API Endpoints for External Webhooks
// ═══════════════════════════════════════════════════════════════════════════
//
// Endpoints for receiving webhooks from external services:
// - GitHub webhooks (push events for auto-deploy)
// - Future: GitLab, Bitbucket, etc.
//
// IMPORTANT SECURITY NOTES:
// - These endpoints are PUBLIC (no auth required)
// - Security is provided by webhook signature verification
// - Each provider has their own signature format
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.post('/github', express.raw({ type: 'application/json' }), (req, res) => {...});
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  processGitHubWebhook,
  simulatePushEvent,
} from '../controllers/webhooks.controller';

// ─────────────────────────────────────────────────────────────────
// ROUTER SETUP
// ─────────────────────────────────────────────────────────────────

const webhookRoutes = new Hono();

// ─────────────────────────────────────────────────────────────────
// GITHUB WEBHOOK ENDPOINT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /github
 * 
 * Receives webhooks from GitHub.
 * 
 * GitHub Configuration:
 * - URL: https://your-api.com/api/v1/webhooks/github
 * - Content type: application/json
 * - Secret: Your GITHUB_WEBHOOK_SECRET
 * - Events: Select "Just the push event"
 * 
 * Headers sent by GitHub:
 * - X-GitHub-Event: push, ping, etc.
 * - X-GitHub-Delivery: Unique delivery ID
 * - X-Hub-Signature-256: sha256=<signature>
 * - Content-Type: application/json
 * 
 * SECURITY:
 * - No auth middleware (webhook is public)
 * - Signature verification happens in controller
 * 
 * EXPRESS EQUIVALENT:
 * // Need raw body for signature verification
 * router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
 *   const signature = req.headers['x-hub-signature-256'];
 *   const event = req.headers['x-github-event'];
 *   // Verify and process...
 * });
 */
webhookRoutes.post('/github', async (c) => {
  // ─────────────────────────────────────────────────────────────────
  // Extract Headers
  // ─────────────────────────────────────────────────────────────────
  
  // GitHub sends these headers with every webhook
  const signature = c.req.header('X-Hub-Signature-256');
  const event = c.req.header('X-GitHub-Event');
  const deliveryId = c.req.header('X-GitHub-Delivery');
  
  // Log incoming webhook
  logger.debug({
    event,
    deliveryId,
    hasSignature: !!signature,
    contentType: c.req.header('Content-Type'),
  }, 'GitHub webhook received');
  
  // ─────────────────────────────────────────────────────────────────
  // Get Raw Body for Signature Verification
  // ─────────────────────────────────────────────────────────────────
  
  // IMPORTANT: We need the raw body for signature verification
  // because GitHub signs the exact bytes sent
  const rawBody = await c.req.text();
  
  // Parse JSON payload
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    logger.warn({ error, deliveryId }, 'Failed to parse webhook JSON');
    return c.json({
      success: false,
      error: 'Invalid JSON payload',
    }, 400);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Process Webhook
  // ─────────────────────────────────────────────────────────────────
  
  try {
    const result = await processGitHubWebhook(
      rawBody,
      signature,
      event,
      deliveryId,
      payload
    );
    
    return c.json(result, 200);
  } catch (error) {
    // HTTP exceptions are thrown for invalid signatures, etc.
    if (error instanceof Error && 'status' in error) {
      const status = (error as any).status || 500;
      return c.json({
        success: false,
        error: error.message,
      }, status);
    }
    
    logger.error({ err: error, deliveryId }, 'Webhook processing failed');
    return c.json({
      success: false,
      error: 'Internal server error',
    }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// WEBHOOK INFO ENDPOINT (for debugging)
// ─────────────────────────────────────────────────────────────────

/**
 * GET /github/info
 * 
 * Returns info about the GitHub webhook endpoint.
 * Useful for documentation and debugging.
 */
webhookRoutes.get('/github/info', (c) => {
  return c.json({
    success: true,
    data: {
      endpoint: `${env.API_URL}/api/v1/webhooks/github`,
      contentType: 'application/json',
      events: ['push', 'ping'],
      headers: {
        required: ['X-Hub-Signature-256'],
        recommended: ['X-GitHub-Event', 'X-GitHub-Delivery'],
      },
      setup: {
        step1: 'Go to your GitHub repository settings',
        step2: 'Click "Webhooks" → "Add webhook"',
        step3: `Enter Payload URL: ${env.API_URL}/api/v1/webhooks/github`,
        step4: 'Set Content type to: application/json',
        step5: 'Enter your webhook secret',
        step6: 'Select "Just the push event"',
        step7: 'Click "Add webhook"',
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────
// SIMULATE WEBHOOK (Development Only)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /simulate
 * 
 * Simulates a webhook push event for testing.
 * ONLY available in development mode.
 * 
 * Requires authentication to prevent abuse.
 * 
 * Request body:
 * {
 *   "projectId": "uuid",
 *   "commitSha": "abc123..." (optional, auto-generated if not provided),
 *   "commitMessage": "test commit" (optional),
 *   "branch": "main" (optional, uses project's default branch)
 * }
 */
webhookRoutes.post(
  '/simulate',
  authMiddleware, // Requires auth
  zValidator('json', z.object({
    projectId: z.string().uuid(),
    commitSha: z.string().optional(),
    commitMessage: z.string().optional(),
    branch: z.string().optional(),
  })),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    
    const result = await simulatePushEvent(
      user.id,
      body.projectId,
      body.commitSha || `test-${Date.now()}`,
      body.commitMessage || 'Test deployment from webhook simulation',
      body.branch
    );
    
    return c.json(result, 201);
  }
);

// ─────────────────────────────────────────────────────────────────
// FUTURE: OTHER PROVIDERS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /gitlab
 * 
 * TODO: Implement GitLab webhook handling
 * GitLab uses X-Gitlab-Token header for verification
 */
webhookRoutes.post('/gitlab', async (c) => {
  logger.info('GitLab webhook received (not implemented)');
  return c.json({
    success: false,
    error: 'GitLab webhooks not yet implemented',
  }, 501);
});

/**
 * POST /bitbucket
 * 
 * TODO: Implement Bitbucket webhook handling
 * Bitbucket uses IP whitelisting or shared secret
 */
webhookRoutes.post('/bitbucket', async (c) => {
  logger.info('Bitbucket webhook received (not implemented)');
  return c.json({
    success: false,
    error: 'Bitbucket webhooks not yet implemented',
  }, 501);
});

// ─────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────

export { webhookRoutes };


