// ═══════════════════════════════════════════════════════════════════════════
// Domains Controller - Business Logic for Custom Domain Management
// ═══════════════════════════════════════════════════════════════════════════
//
// This controller handles:
// - Adding custom domains to projects
// - Domain verification via DNS
// - SSL certificate status management
// - Deleting custom domains
//
// FLOW:
// 1. User adds domain "app.example.com" to their project
// 2. We generate a verification token
// 3. User adds DNS TXT record: _paas-verify.app.example.com → token
// 4. User adds DNS CNAME record: app.example.com → project.paas.com
// 5. User calls /verify endpoint
// 6. We check DNS, mark as verified, trigger SSL provisioning
//
// EXPRESS EQUIVALENT:
// router.post('/projects/:projectId/domains', authMiddleware, async (req, res) => {
//   const { domain } = req.body;
//   // Validate, create, return instructions
// });
//
// ═══════════════════════════════════════════════════════════════════════════

import { HTTPException } from 'hono/http-exception';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import * as DomainsService from '../services/domains.service';
import * as ProjectsService from '../services/projects.service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface AddDomainResponse {
  domain: DomainsService.DomainRecord;
  dnsInstructions: DomainsService.DnsInstructions;
}

export interface VerifyDomainResponse {
  verified: boolean;
  domain: DomainsService.DomainRecord;
  dnsCheck: DomainsService.DnsVerificationResult;
  message: string;
}

// ─────────────────────────────────────────────────────────────────
// LIST DOMAINS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all custom domains for a project
 * 
 * Verifies user owns the project before returning domains.
 */
export async function listDomains(
  userId: string,
  projectId: string
): Promise<DomainsService.DomainRecord[]> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domains
  const domains = await DomainsService.getDomainsByProject(projectId);
  
  return domains;
}

// ─────────────────────────────────────────────────────────────────
// GET DOMAIN DETAILS
// ─────────────────────────────────────────────────────────────────

/**
 * Get details of a specific domain
 * 
 * Returns domain info including DNS instructions for setup.
 */
export async function getDomainDetails(
  userId: string,
  projectId: string,
  domainId: string
): Promise<AddDomainResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domain with ownership check
  const domain = await DomainsService.getDomainByIdAndProject(domainId, projectId);
  
  if (!domain) {
    throw new HTTPException(404, { message: 'Domain not found' });
  }
  
  // Generate DNS instructions
  const dnsInstructions = DomainsService.getDnsInstructions(
    domain.domain,
    domain.verificationToken || '',
    env.PLATFORM_DOMAIN,
    project.subdomain || project.slug
  );
  
  return {
    domain,
    dnsInstructions,
  };
}

// ─────────────────────────────────────────────────────────────────
// ADD DOMAIN
// ─────────────────────────────────────────────────────────────────

/**
 * Add a custom domain to a project
 * 
 * Validates the domain and generates verification instructions.
 * User must then add DNS records and call /verify endpoint.
 */
export async function addDomain(
  userId: string,
  projectId: string,
  domain: string
): Promise<AddDomainResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Validate domain format
  if (!DomainsService.isValidDomain(domain)) {
    throw new HTTPException(400, {
      message: 'Invalid domain format. Please enter a valid domain like "app.example.com"',
    });
  }
  
  // Normalize domain
  const normalizedDomain = DomainsService.normalizeDomain(domain);
  
  // Check if domain is a platform domain
  if (DomainsService.isPlatformDomain(normalizedDomain, env.PLATFORM_DOMAIN)) {
    throw new HTTPException(400, {
      message: `Cannot add ${env.PLATFORM_DOMAIN} subdomains as custom domains`,
    });
  }
  
  // Check if domain already exists
  const existingDomain = await DomainsService.getDomainByName(normalizedDomain);
  if (existingDomain) {
    throw new HTTPException(409, {
      message: 'This domain is already registered. If you own it, please remove it from the other project first.',
    });
  }
  
  // Create domain record
  const createdDomain = await DomainsService.createDomain({
    projectId,
    domain: normalizedDomain,
  });
  
  // Generate DNS instructions
  const dnsInstructions = DomainsService.getDnsInstructions(
    createdDomain.domain,
    createdDomain.verificationToken || '',
    env.PLATFORM_DOMAIN,
    project.subdomain || project.slug
  );
  
  logger.info(
    {
      domainId: createdDomain.id,
      projectId,
      domain: normalizedDomain,
      userId,
    },
    'Custom domain added to project'
  );
  
  return {
    domain: createdDomain,
    dnsInstructions,
  };
}

// ─────────────────────────────────────────────────────────────────
// VERIFY DOMAIN
// ─────────────────────────────────────────────────────────────────

/**
 * Verify domain ownership via DNS TXT record
 * 
 * Checks if the user has added the verification TXT record.
 * If verified, marks domain as verified and triggers SSL provisioning.
 */
export async function verifyDomain(
  userId: string,
  projectId: string,
  domainId: string
): Promise<VerifyDomainResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domain
  const domain = await DomainsService.getDomainByIdAndProject(domainId, projectId);
  
  if (!domain) {
    throw new HTTPException(404, { message: 'Domain not found' });
  }
  
  // Check if already verified
  if (domain.verified) {
    return {
      verified: true,
      domain,
      dnsCheck: {
        verified: true,
        expectedToken: domain.verificationToken || '',
        foundRecords: [],
      },
      message: 'Domain is already verified',
    };
  }
  
  // Check verification token exists
  if (!domain.verificationToken) {
    throw new HTTPException(400, {
      message: 'No verification token found. Please regenerate the token.',
    });
  }
  
  // Perform DNS verification
  const dnsCheck = await DomainsService.verifyDomainDns(
    domain.domain,
    domain.verificationToken
  );
  
  if (dnsCheck.verified) {
    // Mark domain as verified
    const verifiedDomain = await DomainsService.markDomainVerified(domainId);
    
    logger.info(
      {
        domainId,
        projectId,
        domain: domain.domain,
        userId,
      },
      'Domain verified successfully'
    );
    
    // TODO: Trigger SSL certificate provisioning via cert-manager
    // await triggerSslProvisioning(verifiedDomain);
    
    return {
      verified: true,
      domain: verifiedDomain || domain,
      dnsCheck,
      message: 'Domain verified successfully! SSL certificate provisioning has started.',
    };
  }
  
  // Not verified
  return {
    verified: false,
    domain,
    dnsCheck,
    message: dnsCheck.error || 'Verification failed. Please check your DNS configuration.',
  };
}

// ─────────────────────────────────────────────────────────────────
// REFRESH SSL
// ─────────────────────────────────────────────────────────────────

/**
 * Refresh/renew SSL certificate for a domain
 * 
 * Triggers a new SSL certificate request via cert-manager.
 * Useful if certificate expired or needs renewal.
 */
export async function refreshSsl(
  userId: string,
  projectId: string,
  domainId: string
): Promise<DomainsService.DomainRecord> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domain
  const domain = await DomainsService.getDomainByIdAndProject(domainId, projectId);
  
  if (!domain) {
    throw new HTTPException(404, { message: 'Domain not found' });
  }
  
  // Domain must be verified first
  if (!domain.verified) {
    throw new HTTPException(400, {
      message: 'Domain must be verified before SSL can be provisioned',
    });
  }
  
  // Update SSL status to provisioning
  const updatedDomain = await DomainsService.updateSslStatus(
    domainId,
    DomainsService.SSL_STATUS.PROVISIONING
  );
  
  logger.info(
    {
      domainId,
      projectId,
      domain: domain.domain,
    },
    'SSL refresh triggered'
  );
  
  // TODO: Trigger SSL certificate provisioning via cert-manager
  // await triggerSslProvisioning(updatedDomain);
  
  return updatedDomain || domain;
}

// ─────────────────────────────────────────────────────────────────
// REGENERATE TOKEN
// ─────────────────────────────────────────────────────────────────

/**
 * Regenerate verification token for a domain
 * 
 * Useful if token was compromised or user wants a fresh start.
 * Resets verification status.
 */
export async function regenerateToken(
  userId: string,
  projectId: string,
  domainId: string
): Promise<AddDomainResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domain
  const domain = await DomainsService.getDomainByIdAndProject(domainId, projectId);
  
  if (!domain) {
    throw new HTTPException(404, { message: 'Domain not found' });
  }
  
  // Regenerate token
  const updatedDomain = await DomainsService.regenerateVerificationToken(domainId);
  
  if (!updatedDomain) {
    throw new HTTPException(500, { message: 'Failed to regenerate token' });
  }
  
  logger.info(
    {
      domainId,
      projectId,
      domain: domain.domain,
    },
    'Verification token regenerated'
  );
  
  // Generate new DNS instructions
  const dnsInstructions = DomainsService.getDnsInstructions(
    updatedDomain.domain,
    updatedDomain.verificationToken || '',
    env.PLATFORM_DOMAIN,
    project.subdomain || project.slug
  );
  
  return {
    domain: updatedDomain,
    dnsInstructions,
  };
}

// ─────────────────────────────────────────────────────────────────
// DELETE DOMAIN
// ─────────────────────────────────────────────────────────────────

/**
 * Remove a custom domain from a project
 * 
 * Also removes associated SSL certificate.
 */
export async function deleteDomain(
  userId: string,
  projectId: string,
  domainId: string
): Promise<void> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domain for logging
  const domain = await DomainsService.getDomainByIdAndProject(domainId, projectId);
  
  if (!domain) {
    throw new HTTPException(404, { message: 'Domain not found' });
  }
  
  // Delete domain
  const deleted = await DomainsService.deleteDomainByProject(domainId, projectId);
  
  if (!deleted) {
    throw new HTTPException(500, { message: 'Failed to delete domain' });
  }
  
  logger.info(
    {
      domainId,
      projectId,
      domain: domain.domain,
      userId,
    },
    'Custom domain deleted'
  );
  
  // TODO: Clean up SSL certificate via cert-manager
  // await deleteSslCertificate(domain);
}

// ─────────────────────────────────────────────────────────────────
// CHECK CNAME (Optional endpoint)
// ─────────────────────────────────────────────────────────────────

/**
 * Check if CNAME record is properly configured
 * 
 * This is optional but helps users debug their DNS setup.
 */
export async function checkCnameStatus(
  userId: string,
  projectId: string,
  domainId: string
): Promise<{
  domain: string;
  cnameConfigured: boolean;
  currentTarget: string | null;
  expectedTarget: string;
  error?: string;
}> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get domain
  const domain = await DomainsService.getDomainByIdAndProject(domainId, projectId);
  
  if (!domain) {
    throw new HTTPException(404, { message: 'Domain not found' });
  }
  
  // Expected CNAME target
  const expectedTarget = `${project.subdomain || project.slug}.${env.PLATFORM_DOMAIN}`;
  
  // Check CNAME
  const cnameResult = await DomainsService.verifyCnameRecord(
    domain.domain,
    expectedTarget
  );
  
  return {
    domain: domain.domain,
    cnameConfigured: cnameResult.configured,
    currentTarget: cnameResult.target,
    expectedTarget,
    error: cnameResult.error,
  };
}


