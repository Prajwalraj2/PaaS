// ═══════════════════════════════════════════════════════════════════════════
// Services Controller - Business Logic for Add-on Services
// ═══════════════════════════════════════════════════════════════════════════
//
// This controller handles:
// - Provisioning new services (Postgres, Redis, MySQL, MongoDB)
// - Retrieving service details and credentials
// - Managing service lifecycle (restart, delete)
// - Service limits based on user plan
//
// FLOW:
// 1. User requests a new PostgreSQL database
// 2. We validate their plan limits
// 3. Generate credentials and create service record
// 4. [Future] Provision via Kubernetes
// 5. Return connection info to user
//
// EXPRESS EQUIVALENT:
// router.post('/projects/:projectId/services', authMiddleware, async (req, res) => {
//   const { type, name } = req.body;
//   // Validate, provision, return
// });
//
// ═══════════════════════════════════════════════════════════════════════════

import { HTTPException } from 'hono/http-exception';
import { logger } from '../lib/logger';
import * as ServicesService from '../services/services.service';
import * as ProjectsService from '../services/projects.service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface CreateServiceInput {
  type: ServicesService.ServiceType;
  name: string;
  version?: string;
  storageGb?: number;
}

export interface ServiceResponse {
  id: string;
  name: string;
  type: string;
  version: string | null;
  status: string;
  storageGb: number;
  createdAt: Date;
  // Masked credentials for listing
  host?: string;
  port?: number;
}

export interface ServiceWithCredentialsResponse extends ServiceResponse {
  credentials: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    connectionUrl: string;
  } | null;
  envVarName: string;
}

// ─────────────────────────────────────────────────────────────────
// PLAN LIMITS
// ─────────────────────────────────────────────────────────────────

// Service limits by plan
const PLAN_LIMITS: Record<string, { maxServices: number; maxStorageGb: number }> = {
  free: { maxServices: 1, maxStorageGb: 1 },
  pro: { maxServices: 10, maxStorageGb: 50 },
  enterprise: { maxServices: 100, maxStorageGb: 500 },
};

/**
 * Get service limits for a user's plan
 */
function getPlanLimits(plan: string): { maxServices: number; maxStorageGb: number } {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

// ─────────────────────────────────────────────────────────────────
// LIST SERVICES
// ─────────────────────────────────────────────────────────────────

/**
 * List all services for a project
 * 
 * Returns services without sensitive credentials.
 */
export async function listServices(
  userId: string,
  projectId: string
): Promise<ServiceResponse[]> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get services
  const services = await ServicesService.getServicesByProject(projectId);
  
  // Return without sensitive data
  return services.map((service) => ({
    id: service.id,
    name: service.name,
    type: service.type,
    version: service.version,
    status: service.status,
    storageGb: service.storageGb,
    createdAt: service.createdAt,
    host: service.host || undefined,
    port: service.port || undefined,
  }));
}

// ─────────────────────────────────────────────────────────────────
// GET SERVICE DETAILS
// ─────────────────────────────────────────────────────────────────

/**
 * Get service details without credentials
 */
export async function getServiceDetails(
  userId: string,
  projectId: string,
  serviceId: string
): Promise<ServiceResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get service
  const service = await ServicesService.getServiceByIdAndProject(serviceId, projectId);
  
  if (!service) {
    throw new HTTPException(404, { message: 'Service not found' });
  }
  
  return {
    id: service.id,
    name: service.name,
    type: service.type,
    version: service.version,
    status: service.status,
    storageGb: service.storageGb,
    createdAt: service.createdAt,
    host: service.host || undefined,
    port: service.port || undefined,
  };
}

/**
 * Get service credentials
 * 
 * Returns full connection details including password.
 * Should be called sparingly and logged for security.
 */
export async function getServiceCredentials(
  userId: string,
  projectId: string,
  serviceId: string
): Promise<ServiceWithCredentialsResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get service with credentials
  const service = await ServicesService.getServiceWithCredentials(serviceId, projectId);
  
  if (!service) {
    throw new HTTPException(404, { message: 'Service not found' });
  }
  
  // Log credential access for security audit
  logger.info(
    {
      userId,
      projectId,
      serviceId,
      serviceName: service.name,
    },
    'Service credentials accessed'
  );
  
  // Get suggested env var name
  const envVarName = ServicesService.getEnvVarName(
    service.name,
    service.type as ServicesService.ServiceType
  );
  
  return {
    id: service.id,
    name: service.name,
    type: service.type,
    version: service.version,
    status: service.status,
    storageGb: service.storageGb,
    createdAt: service.createdAt,
    credentials: service.credentials,
    envVarName,
  };
}

// ─────────────────────────────────────────────────────────────────
// CREATE SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * Provision a new add-on service
 * 
 * Validates plan limits, creates credentials, provisions service.
 */
export async function createService(
  userId: string,
  userPlan: string,
  projectId: string,
  input: CreateServiceInput
): Promise<ServiceWithCredentialsResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Validate service type
  if (!ServicesService.isValidServiceType(input.type)) {
    const supported = ServicesService.getSupportedServices()
      .map(s => s.type)
      .join(', ');
    throw new HTTPException(400, {
      message: `Invalid service type: ${input.type}. Supported: ${supported}`,
    });
  }
  
  // Validate version if provided
  if (input.version && !ServicesService.isValidVersion(input.type, input.version)) {
    const available = ServicesService.AVAILABLE_VERSIONS[input.type].join(', ');
    throw new HTTPException(400, {
      message: `Invalid version ${input.version} for ${input.type}. Available: ${available}`,
    });
  }
  
  // Check plan limits
  const limits = getPlanLimits(userPlan);
  const currentCount = await ServicesService.countServicesByProject(projectId);
  
  if (currentCount >= limits.maxServices) {
    throw new HTTPException(403, {
      message: `Service limit reached. Your ${userPlan} plan allows ${limits.maxServices} service(s). Upgrade to add more.`,
    });
  }
  
  // Validate storage
  const storageGb = input.storageGb || 1;
  if (storageGb > limits.maxStorageGb) {
    throw new HTTPException(403, {
      message: `Storage limit exceeded. Your ${userPlan} plan allows up to ${limits.maxStorageGb}GB per service.`,
    });
  }
  
  // Check for duplicate name
  const nameExists = await ServicesService.serviceNameExists(projectId, input.name);
  if (nameExists) {
    throw new HTTPException(409, {
      message: `A service named "${input.name}" already exists in this project.`,
    });
  }
  
  // Create the service
  const service = await ServicesService.createService({
    projectId,
    name: input.name,
    type: input.type,
    version: input.version,
    storageGb,
  });
  
  logger.info(
    {
      userId,
      projectId,
      serviceId: service.id,
      type: input.type,
      name: input.name,
    },
    'Service provisioned'
  );
  
  // Get service with credentials to return
  const serviceWithCreds = await ServicesService.getServiceWithCredentials(
    service.id,
    projectId
  );
  
  if (!serviceWithCreds) {
    throw new HTTPException(500, { message: 'Failed to retrieve created service' });
  }
  
  const envVarName = ServicesService.getEnvVarName(
    service.name,
    service.type as ServicesService.ServiceType
  );
  
  return {
    id: serviceWithCreds.id,
    name: serviceWithCreds.name,
    type: serviceWithCreds.type,
    version: serviceWithCreds.version,
    status: serviceWithCreds.status,
    storageGb: serviceWithCreds.storageGb,
    createdAt: serviceWithCreds.createdAt,
    credentials: serviceWithCreds.credentials,
    envVarName,
  };
}

// ─────────────────────────────────────────────────────────────────
// RESTART SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * Restart a service
 * 
 * Useful for applying configuration changes or recovering from issues.
 */
export async function restartService(
  userId: string,
  projectId: string,
  serviceId: string
): Promise<ServiceResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get service
  const service = await ServicesService.getServiceByIdAndProject(serviceId, projectId);
  
  if (!service) {
    throw new HTTPException(404, { message: 'Service not found' });
  }
  
  // Can't restart if already in a transition state
  if (service.status === ServicesService.SERVICE_STATUS.PROVISIONING ||
      service.status === ServicesService.SERVICE_STATUS.DELETING) {
    throw new HTTPException(400, {
      message: `Cannot restart service in ${service.status} state`,
    });
  }
  
  logger.info(
    {
      userId,
      projectId,
      serviceId,
      serviceName: service.name,
    },
    'Service restart requested'
  );
  
  // TODO: Trigger K8s restart
  // await restartK8sService(service);
  
  // For now, just return current status
  // In production, this would be set to 'restarting' and then updated by a worker
  
  return {
    id: service.id,
    name: service.name,
    type: service.type,
    version: service.version,
    status: service.status,
    storageGb: service.storageGb,
    createdAt: service.createdAt,
    host: service.host || undefined,
    port: service.port || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// REGENERATE CREDENTIALS
// ─────────────────────────────────────────────────────────────────

/**
 * Regenerate service credentials
 * 
 * Use if credentials are compromised or for security rotation.
 */
export async function regenerateCredentials(
  userId: string,
  projectId: string,
  serviceId: string
): Promise<ServiceWithCredentialsResponse> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get service to verify it exists
  const service = await ServicesService.getServiceByIdAndProject(serviceId, projectId);
  
  if (!service) {
    throw new HTTPException(404, { message: 'Service not found' });
  }
  
  // Regenerate credentials
  const updatedService = await ServicesService.regenerateCredentials(serviceId);
  
  if (!updatedService) {
    throw new HTTPException(500, { message: 'Failed to regenerate credentials' });
  }
  
  logger.info(
    {
      userId,
      projectId,
      serviceId,
      serviceName: service.name,
    },
    'Service credentials regenerated'
  );
  
  // Get service with new credentials
  const serviceWithCreds = await ServicesService.getServiceWithCredentials(
    serviceId,
    projectId
  );
  
  if (!serviceWithCreds) {
    throw new HTTPException(500, { message: 'Failed to retrieve updated service' });
  }
  
  const envVarName = ServicesService.getEnvVarName(
    service.name,
    service.type as ServicesService.ServiceType
  );
  
  return {
    id: serviceWithCreds.id,
    name: serviceWithCreds.name,
    type: serviceWithCreds.type,
    version: serviceWithCreds.version,
    status: serviceWithCreds.status,
    storageGb: serviceWithCreds.storageGb,
    createdAt: serviceWithCreds.createdAt,
    credentials: serviceWithCreds.credentials,
    envVarName,
  };
}

// ─────────────────────────────────────────────────────────────────
// DELETE SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * Delete a service
 * 
 * WARNING: This is destructive and cannot be undone.
 * All data in the service will be lost.
 */
export async function deleteService(
  userId: string,
  projectId: string,
  serviceId: string
): Promise<void> {
  // Verify project ownership
  const project = await ProjectsService.getProjectById(projectId);
  
  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' });
  }
  
  if (project.userId !== userId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }
  
  // Get service for logging
  const service = await ServicesService.getServiceByIdAndProject(serviceId, projectId);
  
  if (!service) {
    throw new HTTPException(404, { message: 'Service not found' });
  }
  
  // Delete service
  const deleted = await ServicesService.deleteServiceByProject(serviceId, projectId);
  
  if (!deleted) {
    throw new HTTPException(500, { message: 'Failed to delete service' });
  }
  
  logger.info(
    {
      userId,
      projectId,
      serviceId,
      serviceName: service.name,
      serviceType: service.type,
    },
    'Service deleted'
  );
}

// ─────────────────────────────────────────────────────────────────
// GET SUPPORTED SERVICES
// ─────────────────────────────────────────────────────────────────

/**
 * Get list of supported service types
 * 
 * Returns available services with their versions and descriptions.
 */
export function getSupportedServices(): Array<{
  type: string;
  name: string;
  description: string;
  versions: string[];
  defaultVersion: string;
  defaultPort: number;
}> {
  return ServicesService.getSupportedServices();
}


