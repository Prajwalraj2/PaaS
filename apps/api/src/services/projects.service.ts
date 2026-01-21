// ═══════════════════════════════════════════════════════════════════════════
// Projects Service - Database Operations for Projects
// ═══════════════════════════════════════════════════════════════════════════
//
// This service handles all database operations related to projects:
// - CRUD operations for projects
// - Environment variables management
// - Deployment queries
//
// EXPRESS EQUIVALENT:
// This is like having a separate file for database queries:
// const Project = require('../models/Project');
// exports.findByUserId = (userId) => Project.findAll({ where: { userId } });
// exports.create = (data) => Project.create(data);
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
  projects, 
  environmentVariables,
  deployments,
  type Project, 
  type EnvironmentVariable,
  type Deployment,
} from '../db/schema';
import { nanoid } from 'nanoid';
import { env } from '../lib/env';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * Data required to create a new project
 */
export interface CreateProjectData {
  userId: string;
  name: string;
  gitProvider: string;
  gitRepoUrl: string;
  gitBranch?: string;
  gitRootDir?: string;
  buildCommand?: string;
  startCommand?: string;
}

/**
 * Data for updating a project
 */
export interface UpdateProjectData {
  name?: string;
  gitBranch?: string;
  gitRootDir?: string;
  buildCommand?: string;
  startCommand?: string;
  instanceType?: string;
  instanceCount?: number;
  port?: number;
}

/**
 * Project with URL computed
 */
export interface ProjectWithUrl extends Project {
  url: string;
}

/**
 * Environment variable with value masked
 */
export interface MaskedEnvVar {
  id: string;
  key: string;
  value: string; // Masked value like "***" or actual value if not secret
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a unique slug for a project
 * Format: {name}-{random6chars}
 * Example: my-app-abc123
 */
function generateSlug(name: string): string {
  const randomSuffix = nanoid(6).toLowerCase();
  return `${name}-${randomSuffix}`;
}

/**
 * Generate subdomain for a project
 * This will be the URL where the app is accessible
 */
function generateSubdomain(slug: string): string {
  return slug;
}

/**
 * Get the full URL for a project
 */
export function getProjectUrl(subdomain: string): string {
  const domain = env.PLATFORM_DOMAIN;
  const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
  
  if (domain === 'localhost') {
    return `${protocol}://${subdomain}.${domain}:${env.PORT}`;
  }
  
  return `${protocol}://${subdomain}.${domain}`;
}

/**
 * Add URL to project
 */
export function withUrl(project: Project): ProjectWithUrl {
  return {
    ...project,
    url: project.subdomain ? getProjectUrl(project.subdomain) : '',
  };
}

/**
 * Detect git provider from URL
 */
function detectGitProvider(url: string): string {
  if (url.includes('github.com')) return 'github';
  if (url.includes('gitlab.com')) return 'gitlab';
  if (url.includes('bitbucket.org')) return 'bitbucket';
  return 'github'; // Default
}

/**
 * Mask sensitive values in environment variables
 */
export function maskEnvVar(envVar: EnvironmentVariable): MaskedEnvVar {
  return {
    id: envVar.id,
    key: envVar.key,
    value: envVar.isSecret ? '••••••••' : envVar.value,
    isSecret: envVar.isSecret,
    createdAt: envVar.createdAt,
    updatedAt: envVar.updatedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT CRUD
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// LIST PROJECTS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all projects for a user
 * 
 * EXPRESS/SEQUELIZE EQUIVALENT:
 * const listByUserId = async (userId, { page, limit }) => {
 *   return Project.findAndCountAll({
 *     where: { userId },
 *     order: [['createdAt', 'DESC']],
 *     offset: (page - 1) * limit,
 *     limit,
 *   });
 * };
 * 
 * @param userId - User ID
 * @param options - Pagination options
 * @returns Array of projects with total count
 */
export async function listProjectsByUserId(
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ projects: ProjectWithUrl[]; total: number }> {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;
  
  // Get projects with pagination
  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset);
  
  // Get total count (using simple count for now)
  // Note: For large datasets, consider using SQL count()
  const allProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));
  
  const total = allProjects.length;
  
  return {
    projects: projectList.map(withUrl),
    total,
  };
}

// ─────────────────────────────────────────────────────────────────
// GET PROJECT BY ID
// ─────────────────────────────────────────────────────────────────

/**
 * Get a single project by ID
 * 
 * @param id - Project ID
 * @returns Project or null if not found
 */
export async function getProjectById(id: string): Promise<ProjectWithUrl | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  
  return project ? withUrl(project) : null;
}

/**
 * Get project by ID, ensuring it belongs to the user
 * 
 * @param id - Project ID
 * @param userId - User ID (for authorization)
 * @returns Project or null
 */
export async function getProjectByIdAndUserId(
  id: string,
  userId: string
): Promise<ProjectWithUrl | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  
  return project ? withUrl(project) : null;
}

/**
 * Get project by slug
 */
export async function getProjectBySlug(slug: string): Promise<ProjectWithUrl | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  
  return project ? withUrl(project) : null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new project
 * 
 * EXPRESS/SEQUELIZE EQUIVALENT:
 * const create = async (data) => {
 *   return Project.create(data);
 * };
 * 
 * @param data - Project creation data
 * @returns Created project
 */
export async function createProject(data: CreateProjectData): Promise<ProjectWithUrl> {
  const slug = generateSlug(data.name);
  const subdomain = generateSubdomain(slug);
  const gitProvider = detectGitProvider(data.gitRepoUrl);
  
  const [project] = await db
    .insert(projects)
    .values({
      userId: data.userId,
      name: data.name,
      slug,
      subdomain,
      gitProvider,
      gitRepoUrl: data.gitRepoUrl,
      gitBranch: data.gitBranch || 'main',
      gitRootDir: data.gitRootDir || '/',
      buildCommand: data.buildCommand,
      startCommand: data.startCommand,
      status: 'inactive',
      instanceType: 'small',
      instanceCount: 1,
      port: 3000,
    })
    .returning();
  
  return withUrl(project);
}

// ─────────────────────────────────────────────────────────────────
// UPDATE PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Update a project
 * 
 * @param id - Project ID
 * @param userId - User ID (for authorization)
 * @param data - Fields to update
 * @returns Updated project or null
 */
export async function updateProject(
  id: string,
  userId: string,
  data: UpdateProjectData
): Promise<ProjectWithUrl | null> {
  const [project] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  
  return project ? withUrl(project) : null;
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  id: string,
  status: string
): Promise<Project | null> {
  const [project] = await db
    .update(projects)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();
  
  return project || null;
}

// ─────────────────────────────────────────────────────────────────
// DELETE PROJECT
// ─────────────────────────────────────────────────────────────────

/**
 * Delete a project
 * 
 * Note: Related records (env vars, deployments, etc.) are deleted
 * automatically due to ON DELETE CASCADE in the schema.
 * 
 * @param id - Project ID
 * @param userId - User ID (for authorization)
 * @returns true if deleted, false if not found
 */
export async function deleteProject(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  
  // Check if any rows were deleted
  return (result as unknown as { rowCount: number }).rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// CHECK PROJECT NAME
// ─────────────────────────────────────────────────────────────────

/**
 * Check if a project name is already taken by this user
 */
export async function isProjectNameTaken(
  userId: string,
  name: string
): Promise<boolean> {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.name, name)))
    .limit(1);
  
  return !!existing;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// LIST ENV VARS
// ─────────────────────────────────────────────────────────────────

/**
 * Get all environment variables for a project (masked)
 */
export async function listEnvVars(projectId: string): Promise<MaskedEnvVar[]> {
  const envVars = await db
    .select()
    .from(environmentVariables)
    .where(eq(environmentVariables.projectId, projectId))
    .orderBy(environmentVariables.key);
  
  return envVars.map(maskEnvVar);
}

/**
 * Get all environment variables for a project (unmasked - for internal use)
 */
export async function listEnvVarsUnmasked(projectId: string): Promise<EnvironmentVariable[]> {
  return db
    .select()
    .from(environmentVariables)
    .where(eq(environmentVariables.projectId, projectId))
    .orderBy(environmentVariables.key);
}

// ─────────────────────────────────────────────────────────────────
// GET SINGLE ENV VAR
// ─────────────────────────────────────────────────────────────────

/**
 * Get a single environment variable by key
 */
export async function getEnvVar(
  projectId: string,
  key: string
): Promise<EnvironmentVariable | null> {
  const [envVar] = await db
    .select()
    .from(environmentVariables)
    .where(
      and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.key, key)
      )
    )
    .limit(1);
  
  return envVar || null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE ENV VAR
// ─────────────────────────────────────────────────────────────────

/**
 * Create or update an environment variable
 */
export async function upsertEnvVar(
  projectId: string,
  key: string,
  value: string,
  isSecret = true
): Promise<MaskedEnvVar> {
  // Check if exists
  const existing = await getEnvVar(projectId, key);
  
  if (existing) {
    // Update existing
    const [updated] = await db
      .update(environmentVariables)
      .set({
        value,
        isSecret,
        updatedAt: new Date(),
      })
      .where(eq(environmentVariables.id, existing.id))
      .returning();
    
    return maskEnvVar(updated);
  }
  
  // Create new
  const [created] = await db
    .insert(environmentVariables)
    .values({
      projectId,
      key,
      value,
      isSecret,
    })
    .returning();
  
  return maskEnvVar(created);
}

// ─────────────────────────────────────────────────────────────────
// DELETE ENV VAR
// ─────────────────────────────────────────────────────────────────

/**
 * Delete an environment variable
 */
export async function deleteEnvVar(
  projectId: string,
  key: string
): Promise<boolean> {
  const result = await db
    .delete(environmentVariables)
    .where(
      and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.key, key)
      )
    );
  
  return (result as unknown as { rowCount: number }).rowCount > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get recent deployments for a project
 */
export async function getRecentDeployments(
  projectId: string,
  limit = 10
): Promise<Deployment[]> {
  return db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .orderBy(desc(deployments.createdAt))
    .limit(limit);
}

/**
 * Get current (live) deployment
 */
export async function getCurrentDeployment(
  projectId: string
): Promise<Deployment | null> {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.projectId, projectId),
        eq(deployments.isCurrent, true)
      )
    )
    .limit(1);
  
  return deployment || null;
}

/**
 * Create a new deployment record
 */
export async function createDeployment(
  projectId: string,
  data: {
    gitCommitSha?: string;
    gitCommitMessage?: string;
    gitBranch?: string;
    gitAuthor?: string;
    triggeredBy: string;
  }
): Promise<Deployment> {
  const [deployment] = await db
    .insert(deployments)
    .values({
      projectId,
      gitCommitSha: data.gitCommitSha,
      gitCommitMessage: data.gitCommitMessage,
      gitBranch: data.gitBranch,
      gitAuthor: data.gitAuthor,
      triggeredBy: data.triggeredBy,
      buildStatus: 'queued',
      deployStatus: 'pending',
    })
    .returning();
  
  return deployment;
}


