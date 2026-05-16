// ═══════════════════════════════════════════════════════════════════════════
// Docker Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// This module provides utilities for running Docker commands:
// - docker build (with log streaming)
// - docker push (with log streaming)
// - docker inspect (for image size)
//
// All functions stream output to the build context logs for real-time feedback.
//
// ═══════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import type { BuildContext } from '../types';
import { addLog } from './log-helper';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface DockerBuildOptions {
  context: BuildContext;
  workDir: string;
  imageTag: string;
  dockerfilePath?: string;
  buildArgs?: Record<string, string>;
  target?: string;
  platform?: string;
}

export interface DockerPushOptions {
  context: BuildContext;
  imageTag: string;
}

export interface DockerBuildResult {
  success: boolean;
  imageTag: string;
  imageSizeBytes?: number;
  error?: string;
}

export interface DockerPushResult {
  success: boolean;
  imageTag: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// DOCKER BUILD
// ─────────────────────────────────────────────────────────────────

/**
 * Build a Docker image from a Dockerfile.
 * Streams build output to the context logs in real-time.
 */
export async function dockerBuild(options: DockerBuildOptions): Promise<DockerBuildResult> {
  const { context, workDir, imageTag, dockerfilePath, buildArgs, target, platform } = options;

  addLog(context, 'info', `Building Docker image: ${imageTag}`, 'build');
  addLog(context, 'info', `Working directory: ${workDir}`, 'build');

  const args: string[] = ['build'];

  // Add image tag
  args.push('-t', imageTag);

  // Add Dockerfile path if specified
  if (dockerfilePath) {
    args.push('-f', dockerfilePath);
  }

  // Add build arguments (for environment variables)
  if (buildArgs) {
    for (const [key, value] of Object.entries(buildArgs)) {
      args.push('--build-arg', `${key}=${value}`);
    }
  }

  // Add target stage if specified (multi-stage builds)
  if (target) {
    args.push('--target', target);
  }

  // Add platform if specified (cross-platform builds)
  if (platform) {
    args.push('--platform', platform);
  }

  // Add context directory (always last)
  args.push(workDir);

  logger.info({ imageTag, workDir, args: args.join(' ') }, 'Starting Docker build');

  return new Promise((resolve) => {
    const docker = spawn('docker', args, {
      cwd: workDir,
      shell: true,
    });

    let hasError = false;
    let errorMessage = '';

    docker.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        addLog(context, 'info', line, 'build');
      }
    });

    docker.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        // Docker sends progress output to stderr, not all of it is errors
        // Check for actual error patterns
        if (line.toLowerCase().includes('error') || 
            line.toLowerCase().includes('failed') ||
            line.toLowerCase().includes('denied')) {
          addLog(context, 'error', line, 'build');
          hasError = true;
          errorMessage += line + '\n';
        } else {
          // Progress output goes to stderr, log as info
          addLog(context, 'info', line, 'build');
        }
      }
    });

    docker.on('error', (err) => {
      logger.error({ err }, 'Docker process error');
      addLog(context, 'error', `Docker process error: ${err.message}`, 'build');
      hasError = true;
      errorMessage = err.message;
    });

    docker.on('close', async (code) => {
      if (code === 0 && !hasError) {
        addLog(context, 'info', 'Docker build completed successfully ✅', 'build');

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
        const msg = errorMessage || `Docker build failed with exit code ${code}`;
        addLog(context, 'error', `Build failed: ${msg}`, 'build');
        logger.error({ code, errorMessage }, 'Docker build failed');

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
// DOCKER PUSH
// ─────────────────────────────────────────────────────────────────

/**
 * Push a Docker image to a registry.
 * Streams push output to the context logs in real-time.
 */
export async function dockerPush(options: DockerPushOptions): Promise<DockerPushResult> {
  const { context, imageTag } = options;

  addLog(context, 'info', `Pushing image to registry: ${imageTag}`, 'push');

  return new Promise((resolve) => {
    const docker = spawn('docker', ['push', imageTag], {
      shell: true,
    });

    let hasError = false;
    let errorMessage = '';

    docker.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        addLog(context, 'info', line, 'push');
      }
    });

    docker.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        // Check for actual error patterns
        if (line.toLowerCase().includes('error') || 
            line.toLowerCase().includes('denied') ||
            line.toLowerCase().includes('unauthorized') ||
            line.toLowerCase().includes('not found')) {
          addLog(context, 'error', line, 'push');
          hasError = true;
          errorMessage += line + '\n';
        } else {
          addLog(context, 'info', line, 'push');
        }
      }
    });

    docker.on('error', (err) => {
      logger.error({ err }, 'Docker push process error');
      addLog(context, 'error', `Docker process error: ${err.message}`, 'push');
      hasError = true;
      errorMessage = err.message;
    });

    docker.on('close', (code) => {
      if (code === 0 && !hasError) {
        addLog(context, 'info', 'Image pushed successfully ✅', 'push');
        addLog(context, 'info', `Available at: ${imageTag}`, 'push');

        resolve({
          success: true,
          imageTag,
        });
      } else {
        const msg = errorMessage || `Docker push failed with exit code ${code}`;
        addLog(context, 'error', `Push failed: ${msg}`, 'push');
        logger.error({ code, errorMessage }, 'Docker push failed');

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
 * Check if Docker is available on the system.
 */
export async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['--version'], { shell: true });

    docker.on('close', (code) => {
      resolve(code === 0);
    });

    docker.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check if an image exists locally.
 */
export async function imageExists(imageTag: string): Promise<boolean> {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['image', 'inspect', imageTag], { shell: true });

    docker.on('close', (code) => {
      resolve(code === 0);
    });

    docker.on('error', () => {
      resolve(false);
    });
  });
}
