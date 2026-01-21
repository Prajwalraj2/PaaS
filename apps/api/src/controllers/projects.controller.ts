// ═══════════════════════════════════════════════════════════════════════════
// Projects Controller - Business Logic for Projects
// ═══════════════════════════════════════════════════════════════════════════
//
// This controller handles the business logic for project management:
// - Input validation
// - Authorization checks
// - Calling services
// - Formatting responses
//
// EXPRESS EQUIVALENT:
// exports.list = async (req, res, next) => {
//   try {
//     const projects = await projectService.listByUserId(req.user.id);
//     res.json({ data: projects });
//   } catch (error) {
//     next(error);
//   }
// };
//
// ═══════════════════════════════════════════════════════════════════════════

import { HTTPException } from 'hono/http-exception';
import * as projectService from '../services/projects.service';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  gitRepoUrl: string;
  gitBranch?: string;
  gitRootDir?: string;
  buildCommand?: string;
  startCommand?: string;
}

export interface UpdateProjectInput {
  name?: string;
  gitBranch?: string;
  gitRootDir?: string;
  buildCommand?: string;
  startCommand?: string;
  instanceType?: string;
  instanceCount?: number;
  port?: number;
}

export interface ListProjectsOptions {
  page?: number;
  limit?: number;
}

export interface EnvVarInput {
  key: string;
  value: string;
  isSecret?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// LIST PROJECTS
// ─────────────────────────────────────────────────────────────────

/**
 * List all projects for a user
 * 
 * EXPRESS EQUIVALENT:
 * exports.list = async (req, res) => {
 *   const { page = 1, limit = 20 } = req.query;
 *   const projects = await Project.findAll({
 *     where: { userId: req.user.id },
 *     offset: (page - 1) * limit,
 *     limit,
 *   });
 *   res.json({ data: projects });
 * };
 */
export async function listProjects(
  userId: string,
  options: ListProjectsOptions = {}
) {
  const { page = 1, limit = 20 } = options;
  
  const { projects, total } = await projectService.listProjectsByUserId(userId, {
    page,
    limit,
  });
  
  return {
    projects,
    pagination: {
      page,
      perPage: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// GET PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Get a single project by ID
 * Ensures the project belongs to the requesting user
 * 
 * EXPRESS EQUIVALENT:
 * exports.get = async (req, res) => {
 *   const project = await Project.findOne({
 *     where: { id: req.params.id, userId: req.user.id },
 *   });
 *   if (!project) return res.status(404).json({ error: 'Not found' });
 *   res.json({ data: project });
 * };
 */
export async function getProject(projectId: string, userId: string) {
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  // Get recent deployments for this project
  const recentDeployments = await projectService.getRecentDeployments(projectId, 5);
  
  return {
    ...project,
    recentDeployments,
  };
}

// ─────────────────────────────────────────────────────────────────
// CREATE PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new project
 * 
 * Flow:
 * 1. Check if project name is already taken
 * 2. Create project in database
 * 3. Return created project
 * 
 * Note: GitHub webhook setup and Kubernetes namespace creation
 * will be handled by background workers in the future.
 */
export async function createProject(
  userId: string,
  input: CreateProjectInput
) {
  // ─────────────────────────────────────────────────────────────
  // STEP 1: Check if project name is already taken by this user
  // ─────────────────────────────────────────────────────────────
  
  const nameTaken = await projectService.isProjectNameTaken(userId, input.name);
  
  if (nameTaken) {
    throw new HTTPException(409, {
      message: `You already have a project named "${input.name}"`,
    });
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 2: Create project in database
  // ─────────────────────────────────────────────────────────────
  
  const project = await projectService.createProject({
    userId,
    name: input.name,
    gitProvider: 'github', // Will be auto-detected by service
    gitRepoUrl: input.gitRepoUrl,
    gitBranch: input.gitBranch,
    gitRootDir: input.gitRootDir,
    buildCommand: input.buildCommand,
    startCommand: input.startCommand,
  });
  
  logger.info(
    { userId, projectId: project.id, projectName: project.name },
    'Project created'
  );
  
  // ─────────────────────────────────────────────────────────────
  // STEP 3: Return created project
  // ─────────────────────────────────────────────────────────────
  
  // TODO: In the future, also:
  // - Set up GitHub webhook
  // - Create Kubernetes namespace
  // - Queue initial deployment
  
  return project;
}

// ─────────────────────────────────────────────────────────────────
// UPDATE PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Update project settings
 * 
 * EXPRESS EQUIVALENT:
 * exports.update = async (req, res) => {
 *   const [updated] = await Project.update(req.body, {
 *     where: { id: req.params.id, userId: req.user.id },
 *     returning: true,
 *   });
 *   if (!updated) return res.status(404).json({ error: 'Not found' });
 *   res.json({ data: updated });
 * };
 */
export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
) {
  // Check if project name is being changed and if it's already taken
  if (input.name) {
    const existingProject = await projectService.getProjectByIdAndUserId(projectId, userId);
    
    if (!existingProject) {
      throw new HTTPException(404, {
        message: 'Project not found',
      });
    }
    
    // Only check if name is actually different
    if (existingProject.name !== input.name) {
      const nameTaken = await projectService.isProjectNameTaken(userId, input.name);
      
      if (nameTaken) {
        throw new HTTPException(409, {
          message: `You already have a project named "${input.name}"`,
        });
      }
    }
  }
  
  const project = await projectService.updateProject(projectId, userId, input);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  logger.info(
    { userId, projectId, changes: Object.keys(input) },
    'Project updated'
  );
  
  return project;
}

// ─────────────────────────────────────────────────────────────────
// DELETE PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Delete a project
 * 
 * Note: This deletes the database record. Related records (env vars,
 * deployments) are deleted automatically via CASCADE.
 * 
 * TODO: In the future, also:
 * - Delete Kubernetes resources (Deployment, Service, Ingress)
 * - Delete container images from registry
 * - Remove GitHub webhook
 */
export async function deleteProject(projectId: string, userId: string) {
  // Get project first for logging
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  const deleted = await projectService.deleteProject(projectId, userId);
  
  if (!deleted) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  logger.info(
    { userId, projectId, projectName: project.name },
    'Project deleted'
  );
  
  // TODO: Queue cleanup jobs:
  // - Delete K8s resources
  // - Delete container images
  // - Remove GitHub webhook
}

// ─────────────────────────────────────────────────────────────────
// TRIGGER DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Trigger a new deployment for a project
 * 
 * This creates a deployment record and (in the future) adds
 * a job to the build queue.
 */
export async function triggerDeployment(
  projectId: string,
  userId: string,
  triggeredBy: string = 'manual'
) {
  // Verify project exists and belongs to user
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  // Create deployment record
  const deployment = await projectService.createDeployment(projectId, {
    gitBranch: project.gitBranch,
    triggeredBy,
  });
  
  // Update project status
  await projectService.updateProjectStatus(projectId, 'building');
  
  logger.info(
    { userId, projectId, deploymentId: deployment.id },
    'Deployment triggered'
  );
  
  // TODO: Add job to build queue
  // await buildQueue.add('build', { deploymentId: deployment.id, projectId });
  
  return deployment;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// LIST ENV VARS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all environment variables for a project (values masked)
 */
export async function listEnvVars(projectId: string, userId: string) {
  // Verify project exists and belongs to user
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  return projectService.listEnvVars(projectId);
}

// ─────────────────────────────────────────────────────────────────
// CREATE/UPDATE ENV VAR
// ─────────────────────────────────────────────────────────────────

/**
 * Create or update an environment variable
 */
export async function upsertEnvVar(
  projectId: string,
  userId: string,
  input: EnvVarInput
) {
  // Verify project exists and belongs to user
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  // Validate key format (uppercase letters, numbers, underscores)
  if (!/^[A-Z][A-Z0-9_]*$/.test(input.key)) {
    throw new HTTPException(400, {
      message: 'Environment variable key must start with an uppercase letter and contain only uppercase letters, numbers, and underscores',
    });
  }
  
  const envVar = await projectService.upsertEnvVar(
    projectId,
    input.key,
    input.value,
    input.isSecret ?? true
  );
  
  logger.info(
    { userId, projectId, key: input.key },
    'Environment variable set'
  );
  
  return envVar;
}

// ─────────────────────────────────────────────────────────────────
// DELETE ENV VAR
// ─────────────────────────────────────────────────────────────────

/**
 * Delete an environment variable
 */
export async function deleteEnvVar(
  projectId: string,
  userId: string,
  key: string
) {
  // Verify project exists and belongs to user
  const project = await projectService.getProjectByIdAndUserId(projectId, userId);
  
  if (!project) {
    throw new HTTPException(404, {
      message: 'Project not found',
    });
  }
  
  const deleted = await projectService.deleteEnvVar(projectId, key);
  
  if (!deleted) {
    throw new HTTPException(404, {
      message: `Environment variable "${key}" not found`,
    });
  }
  
  logger.info(
    { userId, projectId, key },
    'Environment variable deleted'
  );
}


