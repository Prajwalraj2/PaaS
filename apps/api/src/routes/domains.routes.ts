// ═══════════════════════════════════════════════════════════════════════════
// Domains Routes - API Endpoints for Custom Domain Management
// ═══════════════════════════════════════════════════════════════════════════
//
// Endpoints for managing custom domains:
// - Add custom domain to project
// - Verify domain ownership via DNS
// - View domain details and DNS instructions
// - Delete custom domain
//
// All routes require authentication.
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.use(authMiddleware);
// router.get('/:projectId/domains', (req, res) => {...});
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import * as DomainsController from '../controllers/domains.controller';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// ROUTER SETUP
// ─────────────────────────────────────────────────────────────────

const domainRoutes = new Hono();

// All domain routes require authentication
domainRoutes.use('*', authMiddleware);

// ─────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────

const addDomainSchema = z.object({
  domain: z
    .string()
    .min(3, 'Domain must be at least 3 characters')
    .max(255, 'Domain must be at most 255 characters')
    .refine(
      (val) => val.includes('.'),
      'Domain must include a TLD (e.g., .com, .io)'
    ),
});

// ─────────────────────────────────────────────────────────────────
// LIST DOMAINS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /:projectId/domains
 * 
 * List all custom domains for a project
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "domain": "app.example.com",
 *       "verified": true,
 *       "sslStatus": "active",
 *       "createdAt": "2024-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 */
domainRoutes.get('/:projectId/domains', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  
  const domains = await DomainsController.listDomains(user.id, projectId);
  
  return c.json({
    success: true,
    data: domains,
  });
});

// ─────────────────────────────────────────────────────────────────
// ADD DOMAIN
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/domains
 * 
 * Add a custom domain to a project
 * 
 * Request body:
 * {
 *   "domain": "app.example.com"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Domain added. Please configure your DNS records.",
 *   "data": {
 *     "domain": { ... },
 *     "dnsInstructions": {
 *       "txtRecord": {
 *         "name": "_paas-verify.app.example.com",
 *         "value": "paas_verify_abc123...",
 *         "description": "..."
 *       },
 *       "cnameRecord": {
 *         "name": "app.example.com",
 *         "value": "my-project.paas-platform.com",
 *         "description": "..."
 *       }
 *     }
 *   }
 * }
 */
domainRoutes.post(
  '/:projectId/domains',
  zValidator('json', addDomainSchema),
  async (c) => {
    const user = c.get('user');
    const projectId = c.req.param('projectId');
    const { domain } = c.req.valid('json');
    
    const result = await DomainsController.addDomain(user.id, projectId, domain);
    
    logger.info(
      {
        userId: user.id,
        projectId,
        domain: result.domain.domain,
      },
      'Domain added via API'
    );
    
    return c.json(
      {
        success: true,
        message: 'Domain added successfully. Please configure your DNS records and then verify.',
        data: result,
      },
      201
    );
  }
);

// ─────────────────────────────────────────────────────────────────
// GET DOMAIN DETAILS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /:projectId/domains/:domainId
 * 
 * Get details of a specific domain including DNS instructions
 */
domainRoutes.get('/:projectId/domains/:domainId', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const domainId = c.req.param('domainId');
  
  const result = await DomainsController.getDomainDetails(
    user.id,
    projectId,
    domainId
  );
  
  return c.json({
    success: true,
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────
// VERIFY DOMAIN
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/domains/:domainId/verify
 * 
 * Verify domain ownership by checking DNS TXT record
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "data": {
 *     "verified": true,
 *     "domain": { ... },
 *     "message": "Domain verified successfully!"
 *   }
 * }
 * 
 * Response (failure):
 * {
 *   "success": true,
 *   "data": {
 *     "verified": false,
 *     "domain": { ... },
 *     "dnsCheck": {
 *       "expectedToken": "paas_verify_...",
 *       "foundRecords": [],
 *       "error": "Could not find TXT record..."
 *     },
 *     "message": "Verification failed. Please check your DNS."
 *   }
 * }
 */
domainRoutes.post('/:projectId/domains/:domainId/verify', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const domainId = c.req.param('domainId');
  
  const result = await DomainsController.verifyDomain(
    user.id,
    projectId,
    domainId
  );
  
  return c.json({
    success: true,
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────
// REFRESH SSL
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/domains/:domainId/refresh-ssl
 * 
 * Trigger SSL certificate refresh/renewal
 * 
 * Domain must be verified first.
 */
domainRoutes.post('/:projectId/domains/:domainId/refresh-ssl', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const domainId = c.req.param('domainId');
  
  const domain = await DomainsController.refreshSsl(
    user.id,
    projectId,
    domainId
  );
  
  return c.json({
    success: true,
    message: 'SSL certificate refresh triggered',
    data: domain,
  });
});

// ─────────────────────────────────────────────────────────────────
// REGENERATE VERIFICATION TOKEN
// ─────────────────────────────────────────────────────────────────

/**
 * POST /:projectId/domains/:domainId/regenerate-token
 * 
 * Regenerate the verification token
 * 
 * This will reset the domain's verification status.
 * Use if the token was compromised or user wants a fresh start.
 */
domainRoutes.post('/:projectId/domains/:domainId/regenerate-token', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const domainId = c.req.param('domainId');
  
  const result = await DomainsController.regenerateToken(
    user.id,
    projectId,
    domainId
  );
  
  return c.json({
    success: true,
    message: 'Verification token regenerated. Please update your DNS TXT record.',
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────
// CHECK CNAME STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /:projectId/domains/:domainId/cname-status
 * 
 * Check if CNAME record is properly configured
 * 
 * This helps users debug their DNS setup.
 */
domainRoutes.get('/:projectId/domains/:domainId/cname-status', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const domainId = c.req.param('domainId');
  
  const result = await DomainsController.checkCnameStatus(
    user.id,
    projectId,
    domainId
  );
  
  return c.json({
    success: true,
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────
// DELETE DOMAIN
// ─────────────────────────────────────────────────────────────────

/**
 * DELETE /:projectId/domains/:domainId
 * 
 * Remove a custom domain from a project
 * 
 * This will also clean up any associated SSL certificates.
 */
domainRoutes.delete('/:projectId/domains/:domainId', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const domainId = c.req.param('domainId');
  
  await DomainsController.deleteDomain(user.id, projectId, domainId);
  
  return c.json({
    success: true,
    message: 'Domain removed successfully',
  });
});

// ─────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────

export { domainRoutes };


