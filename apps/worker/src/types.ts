// ═══════════════════════════════════════════════════════════════════════════
// Worker Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// BUILD JOB DATA (Must match API's BuildJobData)
// ─────────────────────────────────────────────────────────────────

/**
 * Data passed to the worker for each build job
 */
export interface BuildJobData {
  // Identifiers
  deploymentId: string;
  projectId: string;
  userId: string;
  
  // Git information
  gitRepoUrl: string;
  gitBranch: string;
  gitCommitSha?: string;
  
  // Build configuration
  buildCommand?: string;
  startCommand?: string;
  dockerfilePath?: string;
  rootDirectory?: string;
  
  // Runtime configuration
  port?: number;
  instanceType?: string;
  
  // Environment variables
  envVars?: Record<string, string>;
  
  // Registry information
  registryUrl?: string;
  imageTag?: string;
  
  // Metadata
  triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli';
  projectName: string;
  projectSlug: string;
}

// ─────────────────────────────────────────────────────────────────
// BUILD CONTEXT
// ─────────────────────────────────────────────────────────────────

/**
 * Context passed through each build step
 * Accumulates data as the build progresses
 */
export interface BuildContext {
  // Job data
  job: BuildJobData;
  
  // Working directory (where source code is cloned)
  workDir: string;
  
  // Detected application type
  appType?: DetectedAppType;
  
  // Generated image tag
  imageTag?: string;
  
  // Build start time
  startTime: number;
  
  // Build logs
  logs: BuildLogEntry[];
}

/**
 * Detected application type
 */
export interface DetectedAppType {
  type: 'nodejs' | 'python' | 'go' | 'rust' | 'ruby' | 'php' | 'java' | 'static' | 'docker' | 'unknown';
  version?: string;
  framework?: string; // next, nuxt, express, django, flask, etc.
  buildTool?: string; // npm, yarn, pnpm, pip, cargo, etc.
  hasDockerfile: boolean;
}

/**
 * Build log entry
 */
export interface BuildLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  step?: string;
}

// ─────────────────────────────────────────────────────────────────
// BUILD RESULT
// ─────────────────────────────────────────────────────────────────

/**
 * Result of the build process
 */
export interface BuildResult {
  success: boolean;
  imageTag?: string;
  imageSizeBytes?: number;
  buildDurationMs: number;
  error?: string;
  logs: BuildLogEntry[];
}

// ─────────────────────────────────────────────────────────────────
// BUILD STEP
// ─────────────────────────────────────────────────────────────────

/**
 * A single step in the build pipeline
 */
export interface BuildStep {
  name: string;
  execute: (context: BuildContext) => Promise<BuildContext>;
}

// ─────────────────────────────────────────────────────────────────
// DEPLOYMENT STATUS UPDATES
// ─────────────────────────────────────────────────────────────────

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
export type DeployStatus = 'pending' | 'deploying' | 'live' | 'failed' | 'rolled_back';



