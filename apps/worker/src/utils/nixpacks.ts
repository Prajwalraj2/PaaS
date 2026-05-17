// ═══════════════════════════════════════════════════════════════════════════
// Nixpacks Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// Nixpacks automatically detects application type and builds Docker images
// without requiring a Dockerfile. Similar to Heroku/Railway buildpacks.
//
// Supports: Node.js, Python, Go, Rust, Ruby, PHP, Java, and more.
//
// IMPORTANT: Requires nixpacks CLI to be installed locally.
// Install on Windows: Download from https://github.com/railwayapp/nixpacks/releases
// Install on Linux/Mac: curl -sSL https://nixpacks.com/install.sh | bash
//
// Usage: nixpacks build <path> --name <image-tag>
//
// ═══════════════════════════════════════════════════════════════════════════

import { spawn, exec } from 'child_process';
import type { BuildContext } from '../types';
import { addLog } from './log-helper';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface NixpacksBuildOptions {
  context: BuildContext;
  workDir: string;
  imageTag: string;
  envVars?: Record<string, string>;
  startCommand?: string;
  buildCommand?: string;
}

export interface NixpacksBuildResult {
  success: boolean;
  imageTag: string;
  imageSizeBytes?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// NIXPACKS BUILD (CLI-based)
// ─────────────────────────────────────────────────────────────────

/**
 * Build a Docker image using Nixpacks CLI (auto-detect language/framework).
 * Requires nixpacks to be installed and available in PATH.
 *
 * Streams build output to the context logs in real-time.
 */
export async function nixpacksBuild(options: NixpacksBuildOptions): Promise<NixpacksBuildResult> {
  const { context, workDir, imageTag, envVars, startCommand, buildCommand } = options;

  addLog(context, 'info', 'Building with Nixpacks (auto-detect)...', 'build');
  addLog(context, 'info', `Source: ${workDir}`, 'build');
  addLog(context, 'info', `Target image: ${imageTag}`, 'build');

  // Build the nixpacks command
  // nixpacks build <path> --name <image-tag> [options]
  const cmdParts: string[] = [
    'nixpacks',
    'build',
    `"${workDir}"`,
    '--name', `"${imageTag}"`,
  ];

  // Add environment variables for build/runtime
  if (envVars && Object.keys(envVars).length > 0) {
    for (const [key, value] of Object.entries(envVars)) {
      // --env KEY=VALUE sets runtime env vars in the built image
      cmdParts.push('--env', `"${key}=${value}"`);
    }
  }

  // Custom start command (overrides auto-detected)
  if (startCommand) {
    cmdParts.push('--start-cmd', `"${startCommand}"`);
  }

  // Custom build command (overrides auto-detected)
  if (buildCommand) {
    cmdParts.push('--build-cmd', `"${buildCommand}"`);
  }

  const fullCommand = cmdParts.join(' ');
  
  logger.info({ 
    imageTag, 
    workDir, 
    envCount: Object.keys(envVars || {}).length,
    command: fullCommand,
  }, 'Starting Nixpacks build');
  
  addLog(context, 'info', `Command: ${fullCommand}`, 'build');

  return new Promise((resolve) => {
    // Use exec with a single command string
    const nixpacks = exec(fullCommand, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for build output
    });

    let hasError = false;
    let errorMessage = '';

    nixpacks.stdout?.on('data', (data: string | Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        addLog(context, 'info', line, 'build');
      }
    });

    nixpacks.stderr?.on('data', (data: string | Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        // Nixpacks outputs progress to stderr (not always errors)
        // Check for actual error indicators
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('error:') ||
            lowerLine.includes('failed to') ||
            lowerLine.includes('cannot find')) {
          addLog(context, 'error', line, 'build');
          hasError = true;
          errorMessage += line + '\n';
        } else {
          // Progress output (Nixpacks logs to stderr)
          addLog(context, 'info', line, 'build');
        }
      }
    });

    nixpacks.on('error', (err) => {
      logger.error({ err }, 'Nixpacks process error');
      
      // Check if nixpacks is not installed
      if (err.message.includes('ENOENT') || err.message.includes('not found')) {
        const installMsg = 'Nixpacks CLI not found. Please install it from https://github.com/railwayapp/nixpacks/releases';
        addLog(context, 'error', installMsg, 'build');
        errorMessage = installMsg;
      } else {
        addLog(context, 'error', `Nixpacks process error: ${err.message}`, 'build');
        errorMessage = err.message;
      }
      hasError = true;
    });

    nixpacks.on('close', async (code) => {
      if (code === 0 && !hasError) {
        addLog(context, 'info', 'Nixpacks build completed successfully ✅', 'build');

        // Get image size
        const sizeBytes = await getImageSize(imageTag);
        if (sizeBytes) {
          addLog(context, 'info', `Image size: ${formatBytes(sizeBytes)}`, 'build');
        }

        resolve({
          success: true,
          imageTag,
          imageSizeBytes: sizeBytes,
        });
      } else {
        const msg = errorMessage || `Nixpacks build failed with exit code ${code}`;
        addLog(context, 'error', `Build failed: ${msg}`, 'build');
        logger.error({ code, errorMessage }, 'Nixpacks build failed');

        resolve({
          success: false,
          imageTag,
          error: msg,
        });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Get the size of a Docker image in bytes.
 */
async function getImageSize(imageTag: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['image', 'inspect', imageTag, '--format', '{{.Size}}'], {
      shell: true,
    });

    let output = '';

    docker.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    docker.on('close', (code) => {
      if (code === 0) {
        const size = parseInt(output.trim(), 10);
        resolve(isNaN(size) ? undefined : size);
      } else {
        resolve(undefined);
      }
    });

    docker.on('error', () => {
      resolve(undefined);
    });
  });
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if Nixpacks CLI is available.
 */
export async function checkNixpacksAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('nixpacks --version', (error) => {
      resolve(!error);
    });
  });
}
