// ═══════════════════════════════════════════════════════════════════════════
// Shared Types
// ═══════════════════════════════════════════════════════════════════════════
//
// TypeScript interfaces and types shared between frontend and backend.
//
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// PROJECT
// ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 
  | 'inactive'    // Not deployed yet
  | 'building'    // Build in progress
  | 'deploying'   // Deployment in progress
  | 'running'     // Successfully running
  | 'failed'      // Deployment failed
  | 'stopped';    // Manually stopped

export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  
  // Git configuration
  gitProvider: 'github' | 'gitlab' | 'bitbucket';
  gitRepoUrl: string;
  gitRepoId?: string;
  gitBranch: string;
  gitRootDir: string;
  
  // Build configuration
  buildCommand?: string;
  startCommand?: string;
  dockerfilePath?: string;
  
  // Runtime configuration
  instanceType: 'small' | 'medium' | 'large';
  instanceCount: number;
  port: number;
  
  // Status
  status: ProjectStatus;
  
  // URLs
  subdomain: string;
  url: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// DEPLOYMENT
// ─────────────────────────────────────────────────────────────────

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed';
export type DeployStatus = 'pending' | 'deploying' | 'live' | 'failed' | 'rolled_back';

export interface Deployment {
  id: string;
  projectId: string;
  
  // Git info
  gitCommitSha: string;
  gitCommitMessage: string;
  gitBranch: string;
  gitAuthor: string;
  
  // Build info
  buildStatus: BuildStatus;
  buildStartedAt?: Date;
  buildFinishedAt?: Date;
  buildDurationMs?: number;
  imageTag?: string;
  imageSizeBytes?: number;
  
  // Deploy info
  deployStatus: DeployStatus;
  deployStartedAt?: Date;
  deployFinishedAt?: Date;
  
  // Meta
  isCurrent: boolean;
  triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli';
  
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE
// ─────────────────────────────────────────────────────────────────

export interface EnvironmentVariable {
  id: string;
  projectId: string;
  key: string;
  value: string;  // Only visible when created, masked after
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// SERVICE (Databases)
// ─────────────────────────────────────────────────────────────────

export type ServiceType = 'postgres' | 'redis' | 'mysql' | 'mongodb';
export type ServiceStatus = 'provisioning' | 'running' | 'stopped' | 'failed';

export interface Service {
  id: string;
  projectId: string;
  name: string;
  type: ServiceType;
  version: string;
  status: ServiceStatus;
  connectionUrl: string;  // Only visible to owner
  storageGb: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}



