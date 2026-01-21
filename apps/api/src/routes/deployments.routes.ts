// ═══════════════════════════════════════════════════════════════════════════
// Deployments Routes
// ═══════════════════════════════════════════════════════════════════════════
//
// Handles deployment management for projects.
// Deployments are nested under projects since they always belong to a project.
//
// EXPRESS EQUIVALENT:
// const router = express.Router({ mergeParams: true }); // Access :projectId
// router.get('/', authMiddleware, deploymentController.list);
// router.get('/:deployId', authMiddleware, deploymentController.get);
// module.exports = router;
//
// ENDPOINTS:
// GET    /projects/:projectId/deployments                    - List deployments
// POST   /projects/:projectId/deployments                    - Trigger new deployment
// GET    /projects/:projectId/deployments/stats              - Get deployment stats
// GET    /projects/:projectId/deployments/:deployId          - Get deployment details
// GET    /projects/:projectId/deployments/:deployId/logs     - Get build logs
// POST   /projects/:projectId/deployments/:deployId/rollback - Rollback to deployment
// POST   /projects/:projectId/deployments/:deployId/cancel   - Cancel deployment
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as deploymentController from '../controllers/deployments.controller';
import { authMiddleware } from '../middleware/auth.middleware';

// Create router
// EXPRESS: const router = express.Router({ mergeParams: true });
const deploymentRoutes = new Hono();

// ─────────────────────────────────────────────────────────────────
// APPLY AUTH MIDDLEWARE TO ALL ROUTES
// ─────────────────────────────────────────────────────────────────
deploymentRoutes.use('*', authMiddleware);

// ─────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const listDeploymentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  buildStatus: z.enum(['queued', 'building', 'success', 'failed', 'cancelled']).optional(),
  deployStatus: z.enum(['pending', 'deploying', 'live', 'failed', 'rolled_back']).optional(),
  gitBranch: z.string().optional(),
});

const triggerDeploymentSchema = z.object({
  // Optional: allow specifying git info for manual deploys
  gitCommitSha: z.string().optional(),
  gitCommitMessage: z.string().optional(),
  gitBranch: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// GET /projects/:projectId/deployments - List deployments
// ─────────────────────────────────────────────────────────────────
//
// Query params:
//   page: number (default: 1)
//   limit: number (default: 20, max: 100)
//   buildStatus: 'queued' | 'building' | 'success' | 'failed' | 'cancelled'
//   deployStatus: 'pending' | 'deploying' | 'live' | 'failed' | 'rolled_back'
//   gitBranch: string
//
// Response:
// {
//   "success": true,
//   "data": [{ deployment1 }, { deployment2 }, ...],
//   "pagination": { page, perPage, total, totalPages }
// }

deploymentRoutes.get(
  '/:projectId/deployments',
  zValidator('query', listDeploymentsSchema),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId');
    const query = c.req.valid('query');

    const result = await deploymentController.listDeployments(
      projectId,
      user.id,
      query
    );

    return c.json({
      success: true,
      data: result.deployments,
      pagination: result.pagination,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /projects/:projectId/deployments - Trigger new deployment
// ─────────────────────────────────────────────────────────────────
//
// Request body (optional):
// {
//   "gitBranch": "develop" // Override branch
// }
//
// Response (201):
// {
//   "success": true,
//   "data": { deployment record }
// }

deploymentRoutes.post(
  '/:projectId/deployments',
  zValidator('json', triggerDeploymentSchema.optional()),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId');

    const deployment = await deploymentController.triggerDeployment(
      projectId,
      user.id,
      'manual'
    );

    return c.json({
      success: true,
      data: deployment,
    }, 201);
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /projects/:projectId/deployments/stats - Get deployment stats
// ─────────────────────────────────────────────────────────────────
//
// Response:
// {
//   "success": true,
//   "data": {
//     "total": 25,
//     "successful": 20,
//     "failed": 3,
//     "inProgress": 2
//   }
// }

deploymentRoutes.get('/:projectId/deployments/stats', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const stats = await deploymentController.getDeploymentStats(projectId, user.id);

  return c.json({
    success: true,
    data: stats,
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /projects/:projectId/deployments/:deployId - Get deployment
// ─────────────────────────────────────────────────────────────────
//
// Response:
// {
//   "success": true,
//   "data": {
//     "id": "...",
//     "projectId": "...",
//     "gitCommitSha": "abc123",
//     "buildStatus": "success",
//     "deployStatus": "live",
//     "isCurrent": true,
//     ...
//   }
// }

deploymentRoutes.get('/:projectId/deployments/:deployId', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const deployId = c.req.param('deployId');

  const deployment = await deploymentController.getDeployment(
    projectId,
    deployId,
    user.id
  );

  return c.json({
    success: true,
    data: deployment,
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /projects/:projectId/deployments/:deployId/logs - Get build logs
// ─────────────────────────────────────────────────────────────────
//
// Query params:
//   page: number (default: 1)
//   limit: number (default: 500)
//
// Response:
// {
//   "success": true,
//   "data": {
//     "logs": [
//       { "timestamp": "...", "level": "info", "message": "Building..." },
//       ...
//     ],
//     "pagination": { ... },
//     "deployment": { "id": "...", "buildStatus": "...", "deployStatus": "..." }
//   }
// }

deploymentRoutes.get(
  '/:projectId/deployments/:deployId/logs',
  zValidator('query', paginationSchema),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId');
    const deployId = c.req.param('deployId');
    const { page, limit } = c.req.valid('query');

    const result = await deploymentController.getBuildLogs(
      projectId,
      deployId,
      user.id,
      { page, limit }
    );

    return c.json({
      success: true,
      data: result,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /projects/:projectId/deployments/:deployId/rollback - Rollback
// ─────────────────────────────────────────────────────────────────
//
// Rollback to a previous successful deployment.
// This creates a new deployment that uses the same image as the target.
//
// Response (201):
// {
//   "success": true,
//   "data": { new deployment record },
//   "message": "Rolled back successfully"
// }

deploymentRoutes.post('/:projectId/deployments/:deployId/rollback', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const deployId = c.req.param('deployId');

  const deployment = await deploymentController.rollbackDeployment(
    projectId,
    deployId,
    user.id
  );

  return c.json({
    success: true,
    data: deployment,
    message: 'Rolled back successfully',
  }, 201);
});

// ─────────────────────────────────────────────────────────────────
// POST /projects/:projectId/deployments/:deployId/cancel - Cancel
// ─────────────────────────────────────────────────────────────────
//
// Cancel a running deployment (queued or building only).
//
// Response:
// {
//   "success": true,
//   "data": { cancelled deployment },
//   "message": "Deployment cancelled"
// }

deploymentRoutes.post('/:projectId/deployments/:deployId/cancel', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const deployId = c.req.param('deployId');

  const deployment = await deploymentController.cancelDeployment(
    projectId,
    deployId,
    user.id
  );

  return c.json({
    success: true,
    data: deployment,
    message: 'Deployment cancelled',
  });
});

export { deploymentRoutes };


