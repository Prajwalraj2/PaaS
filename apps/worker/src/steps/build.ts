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
// - Uses Nixpacks for automatic builds (if no Dockerfile)
// - Uses docker build for custom Dockerfiles
//
// ═══════════════════════════════════════════════════════════════════════════

import type { BuildContext, BuildStep } from '../types';
import { env } from '../lib/env';
import { addLog } from '../utils/log-helper';

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
  
  addLog(context, 'info', 'Using custom Dockerfile...', 'build');
  
  // In a real implementation, we would:
  // 1. Run `docker build -t ${imageTag} ${workDir}`
  // 2. Stream the build output to logs
  // 3. Handle errors
  
  // For now, throw an error since we're in simulation-only mode
  throw new Error(
    'Real Docker build not implemented yet. ' +
    'Set SIMULATION_MODE=true for development.'
  );
}

// ─────────────────────────────────────────────────────────────────
// NIXPACKS BUILD (Automatic)
// ─────────────────────────────────────────────────────────────────

async function nixpacksBuild(context: BuildContext): Promise<BuildContext> {
  const { workDir, imageTag, appType } = context;
  
  addLog(context, 'info', `Using Nixpacks for ${appType?.type} application...`, 'build');
  
  // In a real implementation, we would:
  // 1. Run `nixpacks build ${workDir} --name ${imageTag}`
  // 2. Stream the build output to logs
  // 3. Handle errors
  
  // For now, throw an error since we're in simulation-only mode
  throw new Error(
    'Real Nixpacks build not implemented yet. ' +
    'Set SIMULATION_MODE=true for development.'
  );
}

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



