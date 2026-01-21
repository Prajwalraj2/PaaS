// ═══════════════════════════════════════════════════════════════════════════
// Project Routes
// ═══════════════════════════════════════════════════════════════════════════
//
// Handles CRUD operations for projects (user's deployed applications).
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.get('/', authMiddleware, projectController.list);
// router.post('/', authMiddleware, projectController.create);
// router.get('/:id', authMiddleware, projectController.get);
// module.exports = router;
//
// ENDPOINTS:
// GET    /projects              - List all user's projects
// POST   /projects              - Create new project
// GET    /projects/:id          - Get single project
// PATCH  /projects/:id          - Update project
// DELETE /projects/:id          - Delete project
// POST   /projects/:id/deploy   - Trigger deployment
//
// ENV VARS (nested):
// GET    /projects/:id/env         - List env vars
// POST   /projects/:id/env         - Create/update env var
// DELETE /projects/:id/env/:key    - Delete env var
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as projectController from '../controllers/projects.controller';
import { authMiddleware } from '../middleware/auth.middleware';

// Create router
// EXPRESS: const router = express.Router();
const projectRoutes = new Hono();

// ─────────────────────────────────────────────────────────────────
// APPLY AUTH MIDDLEWARE TO ALL ROUTES
// ─────────────────────────────────────────────────────────────────
// All project routes require authentication
// EXPRESS: router.use(authMiddleware);
projectRoutes.use('*', authMiddleware);

// ─────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Name can only contain lowercase letters, numbers, and hyphens'),
  gitRepoUrl: z.string().url('Invalid repository URL'),
  gitBranch: z.string().default('main'),
  gitRootDir: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Name can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  gitBranch: z.string().optional(),
  gitRootDir: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  instanceType: z.enum(['small', 'medium', 'large']).optional(),
  instanceCount: z.number().min(1).max(10).optional(),
  port: z.number().min(1).max(65535).optional(),
});

const envVarSchema = z.object({
  key: z.string()
    .min(1, 'Key is required')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Key must start with uppercase letter and contain only uppercase letters, numbers, underscores'),
  value: z.string().min(1, 'Value is required'),
  isSecret: z.boolean().optional().default(true),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT CRUD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// GET /projects - List all user's projects
// ─────────────────────────────────────────────────────────────────
//
// Query params:
//   page: number (default: 1)
//   limit: number (default: 20, max: 100)
//
// Response:
// {
//   "success": true,
//   "data": [{ project1 }, { project2 }, ...],
//   "pagination": { page, perPage, total, totalPages }
// }
//
// EXPRESS EQUIVALENT:
// router.get('/', authMiddleware, async (req, res) => {
//   const projects = await Project.findAll({ where: { userId: req.user.id } });
//   res.json({ data: projects });
// });

projectRoutes.get(
  '/',
  zValidator('query', paginationSchema),
  async (c) => {
    const user = c.get('user');
    const { page, limit } = c.req.valid('query');

    const result = await projectController.listProjects(user.id, { page, limit });

    return c.json({
      success: true,
      data: result.projects,
      pagination: result.pagination,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /projects - Create new project
// ─────────────────────────────────────────────────────────────────
//
// Request body:
// {
//   "name": "my-app",
//   "gitRepoUrl": "https://github.com/user/repo",
//   "gitBranch": "main"
// }
//
// Response (201):
// {
//   "success": true,
//   "data": { created project with url }
// }

projectRoutes.post(
  '/',
  zValidator('json', createProjectSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    const project = await projectController.createProject(user.id, body);

    return c.json({
      success: true,
      data: project,
    }, 201);
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /projects/:id - Get single project
// ─────────────────────────────────────────────────────────────────
//
// Response:
// {
//   "success": true,
//   "data": { project with recentDeployments }
// }

projectRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');

  const project = await projectController.getProject(projectId, user.id);

  return c.json({
    success: true,
    data: project,
  });
});

// ─────────────────────────────────────────────────────────────────
// PATCH /projects/:id - Update project
// ─────────────────────────────────────────────────────────────────
//
// Request body (all optional):
// {
//   "name": "new-name",
//   "gitBranch": "develop",
//   "buildCommand": "npm run build",
//   "instanceCount": 2
// }
//
// Response:
// {
//   "success": true,
//   "data": { updated project }
// }

projectRoutes.patch(
  '/:id',
  zValidator('json', updateProjectSchema),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('id');
    const body = c.req.valid('json');

    const project = await projectController.updateProject(projectId, user.id, body);

    return c.json({
      success: true,
      data: project,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// DELETE /projects/:id - Delete project
// ─────────────────────────────────────────────────────────────────
//
// Response:
// {
//   "success": true,
//   "message": "Project deleted successfully"
// }

projectRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');

  await projectController.deleteProject(projectId, user.id);

  return c.json({
    success: true,
    message: 'Project deleted successfully',
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /projects/:id/deploy - Trigger deployment
// ─────────────────────────────────────────────────────────────────
//
// Response (201):
// {
//   "success": true,
//   "data": { deployment record }
// }

projectRoutes.post('/:id/deploy', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');

  const deployment = await projectController.triggerDeployment(
    projectId,
    user.id,
    'manual'
  );

  return c.json({
    success: true,
    data: deployment,
  }, 201);
});

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// GET /projects/:id/env - List environment variables
// ─────────────────────────────────────────────────────────────────
//
// Response:
// {
//   "success": true,
//   "data": [
//     { "key": "DATABASE_URL", "value": "••••••••", "isSecret": true },
//     { "key": "NODE_ENV", "value": "production", "isSecret": false }
//   ]
// }
//
// Note: Secret values are masked for security

projectRoutes.get('/:id/env', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');

  const envVars = await projectController.listEnvVars(projectId, user.id);

  return c.json({
    success: true,
    data: envVars,
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /projects/:id/env - Create or update environment variable
// ─────────────────────────────────────────────────────────────────
//
// Request body:
// {
//   "key": "DATABASE_URL",
//   "value": "postgres://...",
//   "isSecret": true
// }
//
// Response:
// {
//   "success": true,
//   "data": { masked env var }
// }

projectRoutes.post(
  '/:id/env',
  zValidator('json', envVarSchema),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('id');
    const body = c.req.valid('json');

    const envVar = await projectController.upsertEnvVar(projectId, user.id, body);

    return c.json({
      success: true,
      data: envVar,
    }, 201);
  }
);

// ─────────────────────────────────────────────────────────────────
// DELETE /projects/:id/env/:key - Delete environment variable
// ─────────────────────────────────────────────────────────────────
//
// Response:
// {
//   "success": true,
//   "message": "Environment variable deleted"
// }

projectRoutes.delete('/:id/env/:key', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');
  const key = c.req.param('key');

  await projectController.deleteEnvVar(projectId, user.id, key);

  return c.json({
    success: true,
    message: 'Environment variable deleted',
  });
});

export { projectRoutes };

