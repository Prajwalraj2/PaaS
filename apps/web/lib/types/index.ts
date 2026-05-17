// API Response Types

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Project Types
export interface Project {
  id: string;
  userId: string;
  teamId: string | null;
  name: string;
  slug: string;
  gitProvider: 'github' | 'gitlab' | 'bitbucket';
  gitRepoUrl: string;
  gitRepoId: string | null;
  gitBranch: string;
  gitRootDir: string;
  buildCommand: string | null;
  startCommand: string | null;
  dockerfilePath: string | null;
  instanceType: 'small' | 'medium' | 'large';
  instanceCount: number;
  port: number;
  status: 'inactive' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  subdomain: string | null;
  k8sNamespace: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  instanceType?: 'small' | 'medium' | 'large';
  instanceCount?: number;
  port?: number;
}

// Environment Variable Types
export interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetEnvVarInput {
  key: string;
  value: string;
  isSecret?: boolean;
}

// Deployment Types
export interface Deployment {
  id: string;
  projectId: string;
  gitCommitSha: string | null;
  gitCommitMessage: string | null;
  gitBranch: string | null;
  gitAuthor: string | null;
  buildStatus: 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
  buildStartedAt: string | null;
  buildFinishedAt: string | null;
  buildDurationMs: number | null;
  imageTag: string | null;
  imageSizeBytes: number | null;
  deployStatus: 'pending' | 'deploying' | 'live' | 'failed' | 'rolled_back';
  deployStartedAt: string | null;
  deployFinishedAt: string | null;
  appUrl: string | null;
  isCurrent: boolean;
  triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli' | null;
  createdAt: string;
}

export interface DeploymentStats {
  total: number;
  successful: number;
  failed: number;
  inProgress: number;
}

export interface BuildLog {
  id: string;
  deploymentId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface BuildLogsResponse {
  logs: BuildLog[];
  pagination: Pagination;
  deployment: {
    id: string;
    buildStatus: string;
    deployStatus: string;
  };
}

// Custom Domain Types
export interface CustomDomain {
  id: string;
  projectId: string;
  domain: string;
  verified: boolean;
  sslStatus: 'pending' | 'active' | 'failed';
  verificationToken: string | null;
  createdAt: string;
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

// Service Types
export interface Service {
  id: string;
  projectId: string;
  name: string;
  type: 'postgres' | 'redis' | 'mysql' | 'mongodb';
  version: string | null;
  status: 'provisioning' | 'running' | 'stopped' | 'failed';
  host: string | null;
  port: number | null;
  storageGb: number;
  createdAt: string;
}

export interface ServiceCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionUrl: string;
}

export interface CreateServiceInput {
  name: string;
  type: 'postgres' | 'redis' | 'mysql' | 'mongodb';
  version?: string;
  storageGb?: number;
}

export interface SupportedService {
  type: string;
  name: string;
  description: string;
  versions: string[];
  defaultVersion: string;
  defaultPort: number;
}
