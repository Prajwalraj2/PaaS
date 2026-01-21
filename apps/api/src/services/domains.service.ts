// ═══════════════════════════════════════════════════════════════════════════
// Domains Service - Database Operations for Custom Domains
// ═══════════════════════════════════════════════════════════════════════════
//
// This service handles:
// - CRUD operations for custom domains
// - DNS verification token generation
// - DNS lookup for domain verification
// - SSL status management
//
// EXPRESS EQUIVALENT:
// This is similar to a Mongoose/Sequelize model service where you'd have
// methods like Domain.create(), Domain.findByProject(), etc.
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { customDomains, projects } from '../db/schema';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import dns from 'dns';
import { promisify } from 'util';

// Promisify DNS functions for async/await usage
const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface DomainRecord {
  id: string;
  projectId: string;
  domain: string;
  verified: boolean;
  sslStatus: string;
  verificationToken: string | null;
  createdAt: Date;
}

export interface CreateDomainInput {
  projectId: string;
  domain: string;
}

export interface DomainWithProject extends DomainRecord {
  project: {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
  };
}

export interface DnsVerificationResult {
  verified: boolean;
  expectedToken: string;
  foundRecords: string[];
  error?: string;
}

export interface DnsInstructions {
  txtRecord: {
    name: string;
    value: string;
    description: string;
  };
  cnameRecord: {
    name: string;
    value: string;
    description: string;
  };
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

// Prefix for verification TXT records
const VERIFICATION_PREFIX = '_paas-verify';

// SSL status values
export const SSL_STATUS = {
  PENDING: 'pending',
  PROVISIONING: 'provisioning',
  ACTIVE: 'active',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;

// ─────────────────────────────────────────────────────────────────
// CREATE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Add a custom domain to a project
 * 
 * Generates a verification token that the user must add as a DNS TXT record
 * to prove they own the domain.
 * 
 * @param input - Domain creation input
 * @returns Created domain record
 */
export async function createDomain(input: CreateDomainInput): Promise<DomainRecord> {
  try {
    // Normalize domain (lowercase, trim whitespace)
    const normalizedDomain = normalizeDomain(input.domain);
    
    // Generate verification token
    // Format: paas_verify_<random-id>
    const verificationToken = `paas_verify_${nanoid(24)}`;
    
    const [domain] = await db
      .insert(customDomains)
      .values({
        projectId: input.projectId,
        domain: normalizedDomain,
        verified: false,
        sslStatus: SSL_STATUS.PENDING,
        verificationToken,
      })
      .returning();
    
    logger.info(
      {
        domainId: domain.id,
        projectId: input.projectId,
        domain: normalizedDomain,
      },
      'Custom domain added'
    );
    
    return domain;
  } catch (error) {
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      logger.warn({ domain: input.domain }, 'Domain already exists');
      throw new Error('Domain is already registered');
    }
    
    logger.error({ err: error, input }, 'Failed to create domain');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// READ OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all domains for a project
 */
export async function getDomainsByProject(projectId: string): Promise<DomainRecord[]> {
  try {
    const domains = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.projectId, projectId))
      .orderBy(desc(customDomains.createdAt));
    
    return domains;
  } catch (error) {
    logger.error({ err: error, projectId }, 'Failed to get domains by project');
    throw error;
  }
}

/**
 * Get a single domain by ID
 */
export async function getDomainById(domainId: string): Promise<DomainRecord | null> {
  try {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, domainId))
      .limit(1);
    
    return domain || null;
  } catch (error) {
    logger.error({ err: error, domainId }, 'Failed to get domain by ID');
    throw error;
  }
}

/**
 * Get a domain by ID with ownership check
 */
export async function getDomainByIdAndProject(
  domainId: string,
  projectId: string
): Promise<DomainRecord | null> {
  try {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(
        and(
          eq(customDomains.id, domainId),
          eq(customDomains.projectId, projectId)
        )
      )
      .limit(1);
    
    return domain || null;
  } catch (error) {
    logger.error({ err: error, domainId, projectId }, 'Failed to get domain');
    throw error;
  }
}

/**
 * Get a domain by domain name
 */
export async function getDomainByName(domain: string): Promise<DomainRecord | null> {
  try {
    const normalizedDomain = normalizeDomain(domain);
    
    const [result] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.domain, normalizedDomain))
      .limit(1);
    
    return result || null;
  } catch (error) {
    logger.error({ err: error, domain }, 'Failed to get domain by name');
    throw error;
  }
}

/**
 * Get domain with project info
 */
export async function getDomainWithProject(domainId: string): Promise<DomainWithProject | null> {
  try {
    const result = await db
      .select({
        id: customDomains.id,
        projectId: customDomains.projectId,
        domain: customDomains.domain,
        verified: customDomains.verified,
        sslStatus: customDomains.sslStatus,
        verificationToken: customDomains.verificationToken,
        createdAt: customDomains.createdAt,
        project: {
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          subdomain: projects.subdomain,
        },
      })
      .from(customDomains)
      .innerJoin(projects, eq(customDomains.projectId, projects.id))
      .where(eq(customDomains.id, domainId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    logger.error({ err: error, domainId }, 'Failed to get domain with project');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Mark a domain as verified
 */
export async function markDomainVerified(domainId: string): Promise<DomainRecord | null> {
  try {
    const [domain] = await db
      .update(customDomains)
      .set({
        verified: true,
        sslStatus: SSL_STATUS.PROVISIONING, // Start SSL provisioning
      })
      .where(eq(customDomains.id, domainId))
      .returning();
    
    logger.info({ domainId }, 'Domain marked as verified');
    
    return domain || null;
  } catch (error) {
    logger.error({ err: error, domainId }, 'Failed to mark domain verified');
    throw error;
  }
}

/**
 * Update SSL status for a domain
 */
export async function updateSslStatus(
  domainId: string,
  status: string
): Promise<DomainRecord | null> {
  try {
    const [domain] = await db
      .update(customDomains)
      .set({ sslStatus: status })
      .where(eq(customDomains.id, domainId))
      .returning();
    
    logger.info({ domainId, status }, 'Domain SSL status updated');
    
    return domain || null;
  } catch (error) {
    logger.error({ err: error, domainId, status }, 'Failed to update SSL status');
    throw error;
  }
}

/**
 * Regenerate verification token
 */
export async function regenerateVerificationToken(
  domainId: string
): Promise<DomainRecord | null> {
  try {
    const newToken = `paas_verify_${nanoid(24)}`;
    
    const [domain] = await db
      .update(customDomains)
      .set({
        verificationToken: newToken,
        verified: false, // Reset verification status
        sslStatus: SSL_STATUS.PENDING,
      })
      .where(eq(customDomains.id, domainId))
      .returning();
    
    logger.info({ domainId }, 'Verification token regenerated');
    
    return domain || null;
  } catch (error) {
    logger.error({ err: error, domainId }, 'Failed to regenerate token');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Delete a custom domain
 */
export async function deleteDomain(domainId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(customDomains)
      .where(eq(customDomains.id, domainId))
      .returning({ id: customDomains.id });
    
    if (result.length > 0) {
      logger.info({ domainId }, 'Custom domain deleted');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error({ err: error, domainId }, 'Failed to delete domain');
    throw error;
  }
}

/**
 * Delete a domain with ownership check
 */
export async function deleteDomainByProject(
  domainId: string,
  projectId: string
): Promise<boolean> {
  try {
    const result = await db
      .delete(customDomains)
      .where(
        and(
          eq(customDomains.id, domainId),
          eq(customDomains.projectId, projectId)
        )
      )
      .returning({ id: customDomains.id });
    
    if (result.length > 0) {
      logger.info({ domainId, projectId }, 'Custom domain deleted');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error({ err: error, domainId, projectId }, 'Failed to delete domain');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// DNS VERIFICATION
// ─────────────────────────────────────────────────────────────────

/**
 * Verify domain ownership via DNS TXT record
 * 
 * User must add a TXT record:
 * _paas-verify.example.com → paas_verify_<token>
 * 
 * @param domain - Domain to verify
 * @param expectedToken - Expected verification token
 * @returns Verification result
 */
export async function verifyDomainDns(
  domain: string,
  expectedToken: string
): Promise<DnsVerificationResult> {
  const verificationHost = `${VERIFICATION_PREFIX}.${domain}`;
  
  try {
    // Look up TXT records for _paas-verify.domain.com
    const records = await resolveTxt(verificationHost);
    
    // Flatten the records (TXT records can be arrays of strings)
    const flatRecords = records.flat();
    
    logger.debug(
      { domain, verificationHost, records: flatRecords },
      'DNS TXT records found'
    );
    
    // Check if expected token is in the records
    const verified = flatRecords.some(
      (record) => record.trim() === expectedToken
    );
    
    return {
      verified,
      expectedToken,
      foundRecords: flatRecords,
    };
  } catch (error) {
    // DNS lookup errors (ENOTFOUND, ENODATA, etc.)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.debug(
      { domain, verificationHost, error: errorMessage },
      'DNS verification failed'
    );
    
    return {
      verified: false,
      expectedToken,
      foundRecords: [],
      error: `Could not find TXT record at ${verificationHost}. Make sure you've added the DNS record and waited for propagation.`,
    };
  }
}

/**
 * Check if CNAME record is properly configured
 * 
 * User must add a CNAME record:
 * example.com → project-slug.paas-platform.com
 */
export async function verifyCnameRecord(
  domain: string,
  expectedTarget: string
): Promise<{ configured: boolean; target: string | null; error?: string }> {
  try {
    const records = await resolveCname(domain);
    
    // CNAME should point to our platform domain
    const configured = records.some(
      (record) => record.toLowerCase() === expectedTarget.toLowerCase()
    );
    
    return {
      configured,
      target: records[0] || null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      configured: false,
      target: null,
      error: `Could not resolve CNAME for ${domain}: ${errorMessage}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// DNS INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Generate DNS setup instructions for a domain
 * 
 * @param domain - The custom domain
 * @param verificationToken - The verification token
 * @param platformDomain - The platform's domain (e.g., paas-platform.com)
 * @param projectSubdomain - The project's subdomain
 */
export function getDnsInstructions(
  domain: string,
  verificationToken: string,
  platformDomain: string,
  projectSubdomain: string
): DnsInstructions {
  return {
    txtRecord: {
      name: `${VERIFICATION_PREFIX}.${domain}`,
      value: verificationToken,
      description: `Add this TXT record to verify domain ownership. This proves you control the domain.`,
    },
    cnameRecord: {
      name: domain,
      value: `${projectSubdomain}.${platformDomain}`,
      description: `Add this CNAME record to point your domain to your project. This routes traffic to your app.`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Normalize domain name
 * - Convert to lowercase
 * - Remove whitespace
 * - Remove trailing dots
 * - Remove protocol if present
 */
export function normalizeDomain(domain: string): string {
  let normalized = domain
    .toLowerCase()
    .trim()
    .replace(/\.$/, ''); // Remove trailing dot
  
  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove path if present
  const slashIndex = normalized.indexOf('/');
  if (slashIndex !== -1) {
    normalized = normalized.substring(0, slashIndex);
  }
  
  // Remove port if present
  const colonIndex = normalized.indexOf(':');
  if (colonIndex !== -1) {
    normalized = normalized.substring(0, colonIndex);
  }
  
  return normalized;
}

/**
 * Validate domain format
 * 
 * Rules:
 * - Must be a valid hostname
 * - Must have at least one dot (TLD required)
 * - Cannot be an IP address
 * - Cannot contain invalid characters
 */
export function isValidDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  
  // Check for empty
  if (!normalized) {
    return false;
  }
  
  // Must have at least one dot
  if (!normalized.includes('.')) {
    return false;
  }
  
  // Cannot be an IP address
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipPattern.test(normalized)) {
    return false;
  }
  
  // Valid hostname pattern
  // - Labels separated by dots
  // - Each label: 1-63 chars, alphanumeric and hyphens
  // - Cannot start or end with hyphen
  const hostnamePattern = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*$/i;
  
  return hostnamePattern.test(normalized);
}

/**
 * Check if domain is a subdomain of the platform
 * (We don't allow users to add platform subdomains as custom domains)
 */
export function isPlatformDomain(domain: string, platformDomain: string): boolean {
  const normalized = normalizeDomain(domain);
  const normalizedPlatform = normalizeDomain(platformDomain);
  
  return (
    normalized === normalizedPlatform ||
    normalized.endsWith(`.${normalizedPlatform}`)
  );
}


