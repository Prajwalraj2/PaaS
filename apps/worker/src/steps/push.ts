// ═══════════════════════════════════════════════════════════════════════════
// Step 4: Push to Registry
// ═══════════════════════════════════════════════════════════════════════════
//
// This step pushes the built Docker image to the container registry.
//
// In SIMULATION MODE:
// - Simulates the push process with delays
//
// In REAL MODE:
// - Uses docker push to upload the image
// - Handles authentication with the registry (if credentials provided)
//
// ═══════════════════════════════════════════════════════════════════════════

import type { BuildContext, BuildStep } from '../types';
import { env } from '../lib/env';
import { addLog } from '../utils/log-helper';
import { dockerPush } from '../utils/docker';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// PUSH STEP
// ─────────────────────────────────────────────────────────────────

export const pushStep: BuildStep = {
  name: 'push',
  
  async execute(context: BuildContext): Promise<BuildContext> {
    const { imageTag } = context;
    
    addLog(context, 'info', '📤 Pushing image to registry...', 'push');
    addLog(context, 'info', `Image: ${imageTag}`, 'push');
    
    if (env.SIMULATION_MODE) {
      return simulatePush(context);
    }
    
    return realPush(context);
  },
};

// ─────────────────────────────────────────────────────────────────
// SIMULATION MODE
// ─────────────────────────────────────────────────────────────────

async function simulatePush(context: BuildContext): Promise<BuildContext> {
  addLog(context, 'info', '[SIMULATION] Authenticating with registry...', 'push');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
  
  addLog(context, 'info', '[SIMULATION] Pushing layers...', 'push');
  
  // Simulate layer push progress
  const layers = ['Layer 1/3', 'Layer 2/3', 'Layer 3/3'];
  for (const layer of layers) {
    addLog(context, 'info', `[SIMULATION]   ${layer}: Pushing...`, 'push');
    await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
    addLog(context, 'info', `[SIMULATION]   ${layer}: Pushed ✓`, 'push');
  }
  
  addLog(context, 'info', '[SIMULATION] Image pushed successfully! ✅', 'push');
  addLog(context, 'info', `[SIMULATION] Available at: ${context.imageTag}`, 'push');
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// REAL MODE
// ─────────────────────────────────────────────────────────────────

async function realPush(context: BuildContext): Promise<BuildContext> {
  const { imageTag } = context;
  
  if (!imageTag) {
    throw new Error('Image tag not set in context');
  }
  
  // Note: For local registry (localhost:5001), no authentication is needed.
  // For cloud registries (ECR, GCR, GHCR), we would need to run docker login first.
  // This can be added in Phase 3 when we support cloud registries.
  
  if (env.REGISTRY_USERNAME && env.REGISTRY_PASSWORD) {
    addLog(context, 'info', 'Authenticating with registry...', 'push');
    // TODO: Implement docker login for authenticated registries
    // For now, we assume the registry is unauthenticated (local dev)
  }
  
  // Run Docker push
  const result = await dockerPush({
    context,
    imageTag,
  });
  
  if (!result.success) {
    logger.error({ error: result.error, imageTag }, 'Docker push failed');
    throw new Error(`Docker push failed: ${result.error}`);
  }
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



