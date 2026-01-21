// ═══════════════════════════════════════════════════════════════════════════
// Services Service - Database Operations for Add-on Services
// ═══════════════════════════════════════════════════════════════════════════
//
// This service handles:
// - CRUD operations for add-on services (Postgres, Redis, MySQL, MongoDB)
// - Credential generation and encryption
// - Connection URL building
// - Service status management
//
// EXPRESS EQUIVALENT:
// This is similar to a Mongoose/Sequelize model service where you'd have
// methods like Service.create(), Service.findByProject(), etc.
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { services, projects } from '../db/schema';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { env } from '../lib/env';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface ServiceRecord {
  id: string;
  projectId: string;
  name: string;
  type: string;
  version: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  databaseName: string | null;
  connectionUrl: string | null;
  k8sServiceName: string | null;
  storageGb: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceInput {
  projectId: string;
  name: string;
  type: ServiceType;
  version?: string;
  storageGb?: number;
}

export interface ServiceCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionUrl: string;
}

export interface ServiceWithCredentials extends ServiceRecord {
  credentials: ServiceCredentials | null;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

// Supported service types
export const SERVICE_TYPES = {
  POSTGRES: 'postgres',
  REDIS: 'redis',
  MYSQL: 'mysql',
  MONGODB: 'mongodb',
} as const;

export type ServiceType = typeof SERVICE_TYPES[keyof typeof SERVICE_TYPES];

// Default versions for each service type
export const DEFAULT_VERSIONS: Record<ServiceType, string> = {
  postgres: '16',
  redis: '7',
  mysql: '8',
  mongodb: '7',
};

// Available versions for each service type
export const AVAILABLE_VERSIONS: Record<ServiceType, string[]> = {
  postgres: ['14', '15', '16'],
  redis: ['6', '7'],
  mysql: ['8'],
  mongodb: ['6', '7'],
};

// Default ports for each service type
export const DEFAULT_PORTS: Record<ServiceType, number> = {
  postgres: 5432,
  redis: 6379,
  mysql: 3306,
  mongodb: 27017,
};

// Service status values
export const SERVICE_STATUS = {
  PROVISIONING: 'provisioning',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed',
  DELETING: 'deleting',
} as const;

// ─────────────────────────────────────────────────────────────────
// CREDENTIAL GENERATION
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a secure random password
 * 
 * Uses crypto.randomBytes for cryptographically secure randomness.
 * Password includes lowercase, uppercase, numbers (no special chars for compatibility).
 */
function generatePassword(length: number = 24): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  
  return password;
}

/**
 * Generate a unique username for a service
 * 
 * Format: paas_<type>_<random>
 * Example: paas_postgres_abc123
 */
function generateUsername(type: ServiceType): string {
  return `paas_${type}_${nanoid(8)}`.toLowerCase();
}

/**
 * Generate a database name from service name
 * 
 * Converts to lowercase, replaces non-alphanumeric with underscore
 * Example: "My Database" → "my_database"
 */
function generateDatabaseName(serviceName: string): string {
  return serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 63); // Database name length limit
}

/**
 * Build connection URL for a service
 * 
 * Formats:
 * - PostgreSQL: postgres://user:pass@host:port/database
 * - MySQL: mysql://user:pass@host:port/database
 * - MongoDB: mongodb://user:pass@host:port/database
 * - Redis: redis://:pass@host:port
 */
function buildConnectionUrl(
  type: ServiceType,
  host: string,
  port: number,
  username: string,
  password: string,
  database: string
): string {
  switch (type) {
    case SERVICE_TYPES.POSTGRES:
      return `postgres://${username}:${password}@${host}:${port}/${database}`;
    
    case SERVICE_TYPES.MYSQL:
      return `mysql://${username}:${password}@${host}:${port}/${database}`;
    
    case SERVICE_TYPES.MONGODB:
      return `mongodb://${username}:${password}@${host}:${port}/${database}`;
    
    case SERVICE_TYPES.REDIS:
      // Redis doesn't use username in standard connection string
      return `redis://:${password}@${host}:${port}`;
    
    default:
      throw new Error(`Unknown service type: ${type}`);
  }
}

/**
 * Generate Kubernetes service hostname
 * 
 * Format: <name>-<type>.<namespace>.svc.cluster.local
 * Example: main-db-postgres.paas-apps.svc.cluster.local
 */
function generateK8sServiceName(name: string, type: ServiceType, namespace: string): string {
  const sanitizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
  
  return `${sanitizedName}-${type}.${namespace}.svc.cluster.local`;
}

// ─────────────────────────────────────────────────────────────────
// ENCRYPTION (Simple for now - use proper encryption in production)
// ─────────────────────────────────────────────────────────────────

/**
 * Encrypt sensitive data
 * 
 * NOTE: This is a simplified encryption for development.
 * In production, use proper encryption with AWS KMS, HashiCorp Vault, etc.
 */
function encryptValue(value: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(env.JWT_SECRET, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
function decryptValue(encryptedValue: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(env.JWT_SECRET, 'salt', 32);
    
    const [ivHex, encrypted] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error({ err: error }, 'Failed to decrypt value');
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────
// CREATE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new add-on service
 * 
 * Generates credentials and creates the database record.
 * In production, this would also trigger Kubernetes provisioning.
 */
export async function createService(input: CreateServiceInput): Promise<ServiceRecord> {
  try {
    // Validate service type
    if (!Object.values(SERVICE_TYPES).includes(input.type)) {
      throw new Error(`Invalid service type: ${input.type}`);
    }
    
    // Use default or provided version
    const version = input.version || DEFAULT_VERSIONS[input.type];
    
    // Validate version
    if (!AVAILABLE_VERSIONS[input.type].includes(version)) {
      throw new Error(
        `Invalid version ${version} for ${input.type}. Available: ${AVAILABLE_VERSIONS[input.type].join(', ')}`
      );
    }
    
    // Generate credentials
    const username = generateUsername(input.type);
    const password = generatePassword();
    const databaseName = generateDatabaseName(input.name);
    const port = DEFAULT_PORTS[input.type];
    
    // Generate K8s service name (for future K8s integration)
    const k8sServiceName = generateK8sServiceName(
      input.name,
      input.type,
      env.K8S_NAMESPACE
    );
    
    // For local development, use localhost
    // In production, this would be the K8s service hostname
    const host = env.NODE_ENV === 'development' ? 'localhost' : k8sServiceName;
    
    // Build connection URL
    const connectionUrl = buildConnectionUrl(
      input.type,
      host,
      port,
      username,
      password,
      databaseName
    );
    
    // Encrypt sensitive data
    const encryptedPassword = encryptValue(password);
    const encryptedConnectionUrl = encryptValue(connectionUrl);
    
    // Create service record
    const [service] = await db
      .insert(services)
      .values({
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        version,
        host,
        port,
        username,
        password: encryptedPassword,
        databaseName,
        connectionUrl: encryptedConnectionUrl,
        k8sServiceName,
        storageGb: input.storageGb || 1,
        status: SERVICE_STATUS.PROVISIONING,
      })
      .returning();
    
    logger.info(
      {
        serviceId: service.id,
        projectId: input.projectId,
        type: input.type,
        name: input.name,
      },
      'Service created'
    );
    
    // TODO: Trigger K8s provisioning
    // await provisionK8sService(service);
    
    // For now, immediately mark as running (simulating instant provisioning)
    // In production, a background worker would update this after K8s confirms
    await updateServiceStatus(service.id, SERVICE_STATUS.RUNNING);
    
    return {
      ...service,
      status: SERVICE_STATUS.RUNNING,
    };
  } catch (error) {
    logger.error({ err: error, input }, 'Failed to create service');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// READ OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all services for a project
 */
export async function getServicesByProject(projectId: string): Promise<ServiceRecord[]> {
  try {
    const result = await db
      .select()
      .from(services)
      .where(eq(services.projectId, projectId))
      .orderBy(desc(services.createdAt));
    
    return result;
  } catch (error) {
    logger.error({ err: error, projectId }, 'Failed to get services by project');
    throw error;
  }
}

/**
 * Get a single service by ID
 */
export async function getServiceById(serviceId: string): Promise<ServiceRecord | null> {
  try {
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, serviceId))
      .limit(1);
    
    return service || null;
  } catch (error) {
    logger.error({ err: error, serviceId }, 'Failed to get service by ID');
    throw error;
  }
}

/**
 * Get a service by ID with project ownership check
 */
export async function getServiceByIdAndProject(
  serviceId: string,
  projectId: string
): Promise<ServiceRecord | null> {
  try {
    const [service] = await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.id, serviceId),
          eq(services.projectId, projectId)
        )
      )
      .limit(1);
    
    return service || null;
  } catch (error) {
    logger.error({ err: error, serviceId, projectId }, 'Failed to get service');
    throw error;
  }
}

/**
 * Get service with decrypted credentials
 */
export async function getServiceWithCredentials(
  serviceId: string,
  projectId: string
): Promise<ServiceWithCredentials | null> {
  try {
    const service = await getServiceByIdAndProject(serviceId, projectId);
    
    if (!service) {
      return null;
    }
    
    // Decrypt credentials
    let credentials: ServiceCredentials | null = null;
    
    if (service.password && service.connectionUrl && service.host && service.port) {
      const decryptedPassword = decryptValue(service.password);
      const decryptedConnectionUrl = decryptValue(service.connectionUrl);
      
      credentials = {
        host: service.host,
        port: service.port,
        username: service.username || '',
        password: decryptedPassword,
        database: service.databaseName || '',
        connectionUrl: decryptedConnectionUrl,
      };
    }
    
    return {
      ...service,
      credentials,
    };
  } catch (error) {
    logger.error({ err: error, serviceId, projectId }, 'Failed to get service with credentials');
    throw error;
  }
}

/**
 * Count services by project
 */
export async function countServicesByProject(projectId: string): Promise<number> {
  try {
    const result = await db
      .select()
      .from(services)
      .where(eq(services.projectId, projectId));
    
    return result.length;
  } catch (error) {
    logger.error({ err: error, projectId }, 'Failed to count services');
    throw error;
  }
}

/**
 * Check if a service name already exists for a project
 */
export async function serviceNameExists(
  projectId: string,
  name: string
): Promise<boolean> {
  try {
    const [existing] = await db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.projectId, projectId),
          eq(services.name, name)
        )
      )
      .limit(1);
    
    return !!existing;
  } catch (error) {
    logger.error({ err: error, projectId, name }, 'Failed to check service name');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Update service status
 */
export async function updateServiceStatus(
  serviceId: string,
  status: string
): Promise<ServiceRecord | null> {
  try {
    const [service] = await db
      .update(services)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceId))
      .returning();
    
    logger.info({ serviceId, status }, 'Service status updated');
    
    return service || null;
  } catch (error) {
    logger.error({ err: error, serviceId, status }, 'Failed to update service status');
    throw error;
  }
}

/**
 * Update service storage size
 */
export async function updateServiceStorage(
  serviceId: string,
  storageGb: number
): Promise<ServiceRecord | null> {
  try {
    const [service] = await db
      .update(services)
      .set({
        storageGb,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceId))
      .returning();
    
    logger.info({ serviceId, storageGb }, 'Service storage updated');
    
    return service || null;
  } catch (error) {
    logger.error({ err: error, serviceId, storageGb }, 'Failed to update service storage');
    throw error;
  }
}

/**
 * Regenerate service credentials
 * 
 * Creates new username/password and updates connection URL.
 * Useful if credentials are compromised.
 */
export async function regenerateCredentials(
  serviceId: string
): Promise<ServiceRecord | null> {
  try {
    const service = await getServiceById(serviceId);
    
    if (!service) {
      return null;
    }
    
    // Generate new credentials
    const newUsername = generateUsername(service.type as ServiceType);
    const newPassword = generatePassword();
    
    // Build new connection URL
    const newConnectionUrl = buildConnectionUrl(
      service.type as ServiceType,
      service.host || 'localhost',
      service.port || DEFAULT_PORTS[service.type as ServiceType],
      newUsername,
      newPassword,
      service.databaseName || ''
    );
    
    // Encrypt new values
    const encryptedPassword = encryptValue(newPassword);
    const encryptedConnectionUrl = encryptValue(newConnectionUrl);
    
    // Update database
    const [updatedService] = await db
      .update(services)
      .set({
        username: newUsername,
        password: encryptedPassword,
        connectionUrl: encryptedConnectionUrl,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceId))
      .returning();
    
    logger.info({ serviceId }, 'Service credentials regenerated');
    
    // TODO: Update actual database user credentials in K8s
    
    return updatedService || null;
  } catch (error) {
    logger.error({ err: error, serviceId }, 'Failed to regenerate credentials');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE OPERATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Delete a service
 */
export async function deleteService(serviceId: string): Promise<boolean> {
  try {
    // First, mark as deleting
    await updateServiceStatus(serviceId, SERVICE_STATUS.DELETING);
    
    // TODO: Trigger K8s deletion
    // await deleteK8sService(serviceId);
    
    // Delete from database
    const result = await db
      .delete(services)
      .where(eq(services.id, serviceId))
      .returning({ id: services.id });
    
    if (result.length > 0) {
      logger.info({ serviceId }, 'Service deleted');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error({ err: error, serviceId }, 'Failed to delete service');
    throw error;
  }
}

/**
 * Delete a service with project ownership check
 */
export async function deleteServiceByProject(
  serviceId: string,
  projectId: string
): Promise<boolean> {
  try {
    // First, mark as deleting
    await db
      .update(services)
      .set({ status: SERVICE_STATUS.DELETING })
      .where(
        and(
          eq(services.id, serviceId),
          eq(services.projectId, projectId)
        )
      );
    
    // TODO: Trigger K8s deletion
    
    // Delete from database
    const result = await db
      .delete(services)
      .where(
        and(
          eq(services.id, serviceId),
          eq(services.projectId, projectId)
        )
      )
      .returning({ id: services.id });
    
    if (result.length > 0) {
      logger.info({ serviceId, projectId }, 'Service deleted');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error({ err: error, serviceId, projectId }, 'Failed to delete service');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get supported service types with their details
 */
export function getSupportedServices(): Array<{
  type: ServiceType;
  name: string;
  description: string;
  versions: string[];
  defaultVersion: string;
  defaultPort: number;
}> {
  return [
    {
      type: SERVICE_TYPES.POSTGRES,
      name: 'PostgreSQL',
      description: 'Powerful, open-source relational database',
      versions: AVAILABLE_VERSIONS.postgres,
      defaultVersion: DEFAULT_VERSIONS.postgres,
      defaultPort: DEFAULT_PORTS.postgres,
    },
    {
      type: SERVICE_TYPES.REDIS,
      name: 'Redis',
      description: 'In-memory data store for caching and sessions',
      versions: AVAILABLE_VERSIONS.redis,
      defaultVersion: DEFAULT_VERSIONS.redis,
      defaultPort: DEFAULT_PORTS.redis,
    },
    {
      type: SERVICE_TYPES.MYSQL,
      name: 'MySQL',
      description: 'Popular open-source relational database',
      versions: AVAILABLE_VERSIONS.mysql,
      defaultVersion: DEFAULT_VERSIONS.mysql,
      defaultPort: DEFAULT_PORTS.mysql,
    },
    {
      type: SERVICE_TYPES.MONGODB,
      name: 'MongoDB',
      description: 'Document-oriented NoSQL database',
      versions: AVAILABLE_VERSIONS.mongodb,
      defaultVersion: DEFAULT_VERSIONS.mongodb,
      defaultPort: DEFAULT_PORTS.mongodb,
    },
  ];
}

/**
 * Validate service type
 */
export function isValidServiceType(type: string): type is ServiceType {
  return Object.values(SERVICE_TYPES).includes(type as ServiceType);
}

/**
 * Validate version for a service type
 */
export function isValidVersion(type: ServiceType, version: string): boolean {
  return AVAILABLE_VERSIONS[type].includes(version);
}

/**
 * Get environment variable name for a service
 * 
 * Example: "main-db" + "postgres" → "MAIN_DB_DATABASE_URL"
 */
export function getEnvVarName(serviceName: string, type: ServiceType): string {
  const prefix = serviceName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  
  switch (type) {
    case SERVICE_TYPES.POSTGRES:
    case SERVICE_TYPES.MYSQL:
    case SERVICE_TYPES.MONGODB:
      return `${prefix}_DATABASE_URL`;
    case SERVICE_TYPES.REDIS:
      return `${prefix}_REDIS_URL`;
    default:
      return `${prefix}_URL`;
  }
}


