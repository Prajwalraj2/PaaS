// ═══════════════════════════════════════════════════════════════════════════
// Step 3: Build Docker Image
// ═══════════════════════════════════════════════════════════════════════════
//
// This step builds a Docker image from the source code.
//
// In SIMULATION MODE:
// - Simulates the build process with delays
// - Logs mock build output
//
// In REAL MODE:
// - Uses docker build for custom Dockerfiles
// - Uses Nixpacks for automatic builds (if no Dockerfile) - Phase 1b
//
// ═══════════════════════════════════════════════════════════════════════════

import { join } from 'path';
import type { BuildContext, BuildStep } from '../types';
import { env } from '../lib/env';
import { addLog } from '../utils/log-helper';
import { dockerBuild as runDockerBuild } from '../utils/docker';
import { nixpacksBuild as runNixpacksBuild } from '../utils/nixpacks';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// BUILD STEP
// ─────────────────────────────────────────────────────────────────

export const buildStep: BuildStep = {
  name: 'build',
  
  async execute(context: BuildContext): Promise<BuildContext> {
    const { job, appType } = context;
    
    addLog(context, 'info', '🔨 Starting build process...', 'build');
    
    // Generate image tag
    const commitShort = job.gitCommitSha?.slice(0, 8) || 'latest';
    const imageTag = `${env.REGISTRY_URL}/${job.projectSlug}:${commitShort}`;
    context.imageTag = imageTag;
    
    addLog(context, 'info', `Target image: ${imageTag}`, 'build');
    
    if (env.SIMULATION_MODE) {
      return simulateBuild(context);
    }
    
    // Decide build strategy
    if (appType?.hasDockerfile) {
      return dockerBuild(context);
    }
    
    return nixpacksBuild(context);
  },
};

// ─────────────────────────────────────────────────────────────────
// SIMULATION MODE
// ─────────────────────────────────────────────────────────────────

async function simulateBuild(context: BuildContext): Promise<BuildContext> {
  const { appType } = context;
  
  addLog(context, 'info', '[SIMULATION] Building Docker image...', 'build');
  
  // Simulate detecting dependencies
  addLog(context, 'info', '[SIMULATION] Step 1/6: Analyzing dependencies...', 'build');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
  
  // Simulate installing dependencies
  addLog(context, 'info', '[SIMULATION] Step 2/6: Installing dependencies...', 'build');
  await sleep(env.SIMULATION_BUILD_DELAY_MS);
  
  if (appType?.type === 'nodejs') {
    addLog(context, 'info', '[SIMULATION]   npm install', 'build');
    addLog(context, 'info', '[SIMULATION]   added 125 packages in 2.3s', 'build');
  }
  
  // Simulate running build command
  addLog(context, 'info', '[SIMULATION] Step 3/6: Running build command...', 'build');
  await sleep(env.SIMULATION_BUILD_DELAY_MS);
  
  if (appType?.type === 'nodejs') {
    addLog(context, 'info', '[SIMULATION]   npm run build', 'build');
    addLog(context, 'info', '[SIMULATION]   Build completed successfully', 'build');
  }
  
  // Simulate creating image layers
  addLog(context, 'info', '[SIMULATION] Step 4/6: Creating image layers...', 'build');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
  
  addLog(context, 'info', '[SIMULATION]   Layer 1: Base image (node:20-alpine)', 'build');
  addLog(context, 'info', '[SIMULATION]   Layer 2: Dependencies', 'build');
  addLog(context, 'info', '[SIMULATION]   Layer 3: Application code', 'build');
  
  // Simulate optimizing
  addLog(context, 'info', '[SIMULATION] Step 5/6: Optimizing image...', 'build');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
  
  // Simulate finalizing
  addLog(context, 'info', '[SIMULATION] Step 6/6: Finalizing image...', 'build');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
  
  // Simulate image size
  const simulatedSize = Math.floor(Math.random() * 100 + 50) * 1024 * 1024; // 50-150 MB
  addLog(context, 'info', `[SIMULATION] Image size: ${formatBytes(simulatedSize)}`, 'build');
  addLog(context, 'info', `[SIMULATION] Image tag: ${context.imageTag}`, 'build');
  addLog(context, 'info', '[SIMULATION] Build completed successfully! ✅', 'build');
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// DOCKER BUILD (Custom Dockerfile)
// ─────────────────────────────────────────────────────────────────

async function dockerBuild(context: BuildContext): Promise<BuildContext> {
  const { workDir, imageTag, job } = context;
  
  if (!imageTag) {
    throw new Error('Image tag not set in context');
  }
  
  addLog(context, 'info', 'Using custom Dockerfile...', 'build');
  
  // Determine Dockerfile path
  const dockerfilePath = job.dockerfilePath 
    ? join(workDir, job.dockerfilePath) 
    : join(workDir, 'Dockerfile');
  
  addLog(context, 'info', `Dockerfile: ${dockerfilePath}`, 'build');
  
  // Prepare build args from environment variables
  // Note: For security, we pass non-sensitive build-time vars only
  // Runtime env vars will be passed to K8s as secrets
  const buildArgs: Record<string, string> = {};
  
  // Add PORT as a build arg if specified
  if (job.port) {
    buildArgs['PORT'] = String(job.port);
  }
  
  // Run Docker build
  const result = await runDockerBuild({
    context,
    workDir,
    imageTag,
    dockerfilePath: job.dockerfilePath ? dockerfilePath : undefined,
    buildArgs: Object.keys(buildArgs).length > 0 ? buildArgs : undefined,
  });
  
  if (!result.success) {
    logger.error({ error: result.error, imageTag }, 'Docker build failed');
    throw new Error(`Docker build failed: ${result.error}`);
  }
  
  // Store image size if available
  if (result.imageSizeBytes) {
    context.imageSizeBytes = result.imageSizeBytes;
  }
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// NIXPACKS BUILD (Automatic — no Dockerfile required)
// ─────────────────────────────────────────────────────────────────

async function nixpacksBuild(context: BuildContext): Promise<BuildContext> {
  const { workDir, imageTag, appType, job } = context;
  
  if (!imageTag) {
    throw new Error('Image tag not set in context');
  }
  
  addLog(context, 'info', `Using Nixpacks for ${appType?.type || 'unknown'} application...`, 'build');
  addLog(context, 'info', 'Nixpacks will auto-detect language, dependencies, and build steps', 'build');
  
  // Prepare environment variables for build/runtime
  // These will be baked into the image
  const envVars: Record<string, string> = {
    PORT: String(job.port || 3000),
    NODE_ENV: 'production',
    ...job.envVars,
  };
  
  // Run Nixpacks build via Docker (no local CLI needed)
  const result = await runNixpacksBuild({
    context,
    workDir,
    imageTag,
    envVars,
    startCommand: job.startCommand,
    buildCommand: job.buildCommand,
  });
  
  if (!result.success) {
    logger.error({ error: result.error, imageTag }, 'Nixpacks build failed');
    throw new Error(`Nixpacks build failed: ${result.error}`);
  }
  
  // Store image size if available
  if (result.imageSizeBytes) {
    context.imageSizeBytes = result.imageSizeBytes;
  }
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// OLD NIXPACKS STUB (commented out — replaced by real implementation above)
// ─────────────────────────────────────────────────────────────────
// async function nixpacksBuild_OLD(context: BuildContext): Promise<BuildContext> {
//   const { workDir, imageTag, appType } = context;
//   
//   addLog(context, 'info', `Using Nixpacks for ${appType?.type} application...`, 'build');
//   
//   // In a real implementation, we would:
//   // 1. Run `nixpacks build ${workDir} --name ${imageTag}`
//   // 2. Stream the build output to logs
//   // 3. Handle errors
//   
//   // For now, throw an error since we're in simulation-only mode
//   throw new Error(
//     'Real Nixpacks build not implemented yet. ' +
//     'Set SIMULATION_MODE=true for development.'
//   );
// }

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}



