// ═══════════════════════════════════════════════════════════════════════════
// Services Routes - API Endpoints for Add-on Services
// ═══════════════════════════════════════════════════════════════════════════
//
// Endpoints for managing add-on services (databases):
// - Provision new services (PostgreSQL, Redis, MySQL, MongoDB)
// - Get service details and credentials
// - Restart, delete services
//
// All routes require authentication.
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.use(authMiddleware);
// router.post('/:projectId/services', (req, res) => {...});
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ServicesController from '../controllers/services.controller';
import { SERVICE_TYPES, AVAILABLE_VERSIONS } from '../services/services.service';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// ROUTER SETUP
// ─────────────────────────────────────────────────────────────────

const serviceRoutes = new Hono();

// All service routes require authentication
serviceRoutes.use('*', authMiddleware);

// ─────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────

const createServiceSchema = z.object({
  name: z
    .string()
    .min(1, 'Service name is required')
    .max(63, 'Service name must be at most 63 characters')
    .regex(
      /^[a-zA-Z][a-zA-Z0-9-]*$/,
      'Service name must start with a letter and contain only letters, numbers, and hyphens'
    ),
  type: z.enum(['postgres', 'redis', 'mysql', 'mongodb'], {
    errorMap: () => ({ message: 'Type must be: postgres, redis, mysql, or mongodb' }),
  }),
  version: z.string().optional(),
  storageGb: z
    .number()
    .min(1, 'Storage must be at least 1 GB')
    .max(100, 'Storage must be at most 100 GB')
    .optional(),
});

// ─────────────────────────────────────────────────────────────────
// GET SUPPORTED SERVICES
// ─────────────────────────────────────────────────────────────────

/**
 * GET /supported
 * 
 * Get list of supported service types
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "type": "postgres",
 *       "name": "PostgreSQL",
 *       "description": "Powerful, open-source relational database",
 *       "versions": ["14", "15", "16"],
 *       "defaultVersion": "16",
 *       "defaultPort": 5432
 *     },
 *     ...
 *   ]
 * }
 */
serviceRoutes.get('/supported', (c) => {
  const services = ServicesController.getSupportedServices();
  
  return c.json({
    success: true,
    data: services,
  });
});

// ─────────────────────────────────────────────────────────────────
// LIST SERVICES
// ─────────────────────────────────────────────────────────────────

/**
 * GET /:projectId/services
 * 
 * List all services for a project
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "main-db",
 *       "type": "postgres",
 *       "version": "16",
 *       "status": "running",
 *       "storageGb": 1,
 *       "host": "localhost",
 *       "port": 5432
 *     }
 *   ]
 * }
 */
serviceRoutes.get('/:projectId/services', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  
  const services = await ServicesController.listServices(user.id, projectId);
  
  return c.json({
    success: true,
    data: services,
  });
});

// ─────────────────────────────────────────────────────────────────
// CREATE SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/services
 * 
 * Provision a new add-on service
 * 
 * Request body:
 * {
 *   "name": "main-db",
 *   "type": "postgres",
 *   "version": "16",      // optional, defaults to latest
 *   "storageGb": 1        // optional, defaults to 1
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Service provisioned successfully",
 *   "data": {
 *     "id": "uuid",
 *     "name": "main-db",
 *     "type": "postgres",
 *     "version": "16",
 *     "status": "running",
 *     "storageGb": 1,
 *     "credentials": {
 *       "host": "localhost",
 *       "port": 5432,
 *       "username": "paas_postgres_abc123",
 *       "password": "generated-password",
 *       "database": "main_db",
 *       "connectionUrl": "postgres://..."
 *     },
 *     "envVarName": "MAIN_DB_DATABASE_URL"
 *   }
 * }
 */
serviceRoutes.post(
  '/:projectId/services',
  zValidator('json', createServiceSchema),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId');
    const input = c.req.valid('json');
    
    const service = await ServicesController.createService(
      user.id,
      user.plan,
      projectId,
      input
    );
    
    logger.info(
      {
        userId: user.id,
        projectId,
        serviceId: service.id,
        type: input.type,
        name: input.name,
      },
      'Service created via API'
    );
    
    return c.json(
      {
        success: true,
        message: `${input.type} service "${input.name}" provisioned successfully`,
        data: service,
      },
      201
    );
  }
);

// ─────────────────────────────────────────────────────────────────
// GET SERVICE DETAILS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /:projectId/services/:serviceId
 * 
 * Get service details (without credentials)
 */
serviceRoutes.get('/:projectId/services/:serviceId', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const serviceId = c.req.param('serviceId');
  
  const service = await ServicesController.getServiceDetails(
    user.id,
    projectId,
    serviceId
  );
  
  return c.json({
    success: true,
    data: service,
  });
});

// ─────────────────────────────────────────────────────────────────
// GET SERVICE CREDENTIALS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /:projectId/services/:serviceId/credentials
 * 
 * Get service connection credentials
 * 
 * NOTE: This endpoint returns sensitive data.
 * Access is logged for security auditing.
 */
serviceRoutes.get('/:projectId/services/:serviceId/credentials', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const serviceId = c.req.param('serviceId');
  
  const service = await ServicesController.getServiceCredentials(
    user.id,
    projectId,
    serviceId
  );
  
  return c.json({
    success: true,
    data: service,
  });
});

// ─────────────────────────────────────────────────────────────────
// RESTART SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/services/:serviceId/restart
 * 
 * Restart a service
 * 
 * Useful for:
 * - Applying configuration changes
 * - Recovering from issues
 * - Clearing memory/cache
 */
serviceRoutes.post('/:projectId/services/:serviceId/restart', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const serviceId = c.req.param('serviceId');
  
  const service = await ServicesController.restartService(
    user.id,
    projectId,
    serviceId
  );
  
  return c.json({
    success: true,
    message: 'Service restart initiated',
    data: service,
  });
});

// ─────────────────────────────────────────────────────────────────
// REGENERATE CREDENTIALS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/services/:serviceId/regenerate-credentials
 * 
 * Regenerate service credentials
 * 
 * Use if:
 * - Credentials were compromised
 * - Security rotation policy
 * - Revoking access from someone
 * 
 * WARNING: This will break existing connections using old credentials.
 * Update your application's environment variables after regenerating.
 */
serviceRoutes.post(
  '/:projectId/services/:serviceId/regenerate-credentials',
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId');
    const serviceId = c.req.param('serviceId');
    
    const service = await ServicesController.regenerateCredentials(
      user.id,
      projectId,
      serviceId
    );
    
    return c.json({
      success: true,
      message: 'Credentials regenerated. Update your application environment variables.',
      data: service,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// DELETE SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * DELETE /:projectId/services/:serviceId
 * 
 * Delete a service
 * 
 * WARNING: This is destructive and CANNOT be undone.
 * All data stored in the service will be permanently lost.
 */
serviceRoutes.delete('/:projectId/services/:serviceId', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const serviceId = c.req.param('serviceId');
  
  await ServicesController.deleteService(user.id, projectId, serviceId);
  
  return c.json({
    success: true,
    message: 'Service deleted successfully. All data has been permanently removed.',
  });
});

// ─────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────

export { serviceRoutes };


