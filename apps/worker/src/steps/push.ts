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
// - Handles authentication with the registry
//
// ═══════════════════════════════════════════════════════════════════════════

import type { BuildContext, BuildStep } from '../types';
import { env } from '../lib/env';
import { addLog } from '../utils/log-helper';

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
  // In a real implementation, we would:
  // 1. Authenticate with the registry (docker login)
  // 2. Run `docker push ${imageTag}`
  // 3. Stream the push output to logs
  // 4. Handle errors
  
  throw new Error(
    'Real Docker push not implemented yet. ' +
    'Set SIMULATION_MODE=true for development.'
  );
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



