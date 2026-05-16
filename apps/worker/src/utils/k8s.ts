// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// This module provides utilities for Kubernetes operations:
// - Apply manifests using kubectl
// - Wait for deployment rollout
// - Check pod status
// - Load images into Minikube
//
// ═══════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import type { BuildContext } from '../types';
import { addLog } from './log-helper';
import { logger } from '../lib/logger';
import { env } from '../lib/env';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface K8sDeployOptions {
  context: BuildContext;
  projectSlug: string;
  imageTag: string;
  port: number;
  envVars: Record<string, string>;
  namespace?: string;
  replicas?: number;
}

export interface K8sDeployResult {
  success: boolean;
  appUrl?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// MAIN DEPLOY FUNCTION
// ─────────────────────────────────────────────────────────────────

/**
 * Deploy an application to Kubernetes.
 * Creates Deployment, Service, and optionally Ingress.
 */
export async function deployToK8s(options: K8sDeployOptions): Promise<K8sDeployResult> {
  const {
    context,
    projectSlug,
    imageTag,
    port,
    envVars,
    namespace = env.K8S_NAMESPACE || 'paas-apps',
    replicas = 1,
  } = options;

  try {
    addLog(context, 'info', 'Generating Kubernetes manifests...', 'deploy');

    // For Minikube with Docker driver, we need to load the image first
    // because Minikube can't pull from localhost:5001 directly
    addLog(context, 'info', 'Loading image into Minikube...', 'deploy');
    const loadResult = await loadImageToMinikube(context, imageTag);
    if (!loadResult.success) {
      // If minikube image load fails, try to continue anyway
      // The image might be accessible via different means
      addLog(context, 'warn', `Image load warning: ${loadResult.error}`, 'deploy');
      addLog(context, 'info', 'Continuing with deployment...', 'deploy');
    }

    // Generate manifests
    const deploymentManifest = generateDeploymentManifest(
      projectSlug,
      imageTag,
      port,
      envVars,
      namespace,
      replicas
    );
    
    const serviceManifest = generateServiceManifest(projectSlug, port, namespace);

    // Apply deployment
    addLog(context, 'info', 'Applying Deployment...', 'deploy');
    const deployResult = await applyManifest(context, deploymentManifest);
    if (!deployResult.success) {
      return { success: false, error: `Deployment failed: ${deployResult.error}` };
    }
    addLog(context, 'info', `  deployment.apps/${projectSlug} applied`, 'deploy');

    // Apply service
    addLog(context, 'info', 'Applying Service...', 'deploy');
    const serviceResult = await applyManifest(context, serviceManifest);
    if (!serviceResult.success) {
      return { success: false, error: `Service failed: ${serviceResult.error}` };
    }
    addLog(context, 'info', `  service/${projectSlug} applied`, 'deploy');

    // Wait for rollout
    addLog(context, 'info', 'Waiting for deployment rollout...', 'deploy');
    const rolloutResult = await waitForRollout(context, projectSlug, namespace);
    if (!rolloutResult.success) {
      return { success: false, error: `Rollout failed: ${rolloutResult.error}` };
    }

    // Get pod status
    addLog(context, 'info', 'Checking pod status...', 'deploy');
    const podStatus = await getPodStatus(context, projectSlug, namespace);
    addLog(context, 'info', `  Pods ready: ${podStatus}`, 'deploy');

    // Generate app URL (for local dev, use NodePort or port-forward instruction)
    const appUrl = `http://${projectSlug}.localhost`;

    addLog(context, 'info', '', 'deploy');
    addLog(context, 'info', '════════════════════════════════════════════', 'deploy');
    addLog(context, 'info', '🎉 DEPLOYMENT SUCCESSFUL!', 'deploy');
    addLog(context, 'info', '════════════════════════════════════════════', 'deploy');
    addLog(context, 'info', '', 'deploy');
    addLog(context, 'info', `Namespace: ${namespace}`, 'deploy');
    addLog(context, 'info', `Deployment: ${projectSlug}`, 'deploy');
    addLog(context, 'info', `Service: ${projectSlug}`, 'deploy');
    addLog(context, 'info', '', 'deploy');
    addLog(context, 'info', 'To access your app locally:', 'deploy');
    addLog(context, 'info', `  kubectl port-forward -n ${namespace} svc/${projectSlug} ${port}:${port}`, 'deploy');
    addLog(context, 'info', `  Then visit: http://localhost:${port}`, 'deploy');
    addLog(context, 'info', '', 'deploy');

    return { success: true, appUrl };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error }, 'Kubernetes deployment failed');
    return { success: false, error: errorMessage };
  }
}

// ─────────────────────────────────────────────────────────────────
// LOAD IMAGE TO MINIKUBE
// ─────────────────────────────────────────────────────────────────

/**
 * Load a Docker image into Minikube's container runtime.
 * This is needed because Minikube can't pull from localhost:5001 directly.
 */
async function loadImageToMinikube(
  context: BuildContext,
  imageTag: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const minikube = spawn('minikube', ['image', 'load', imageTag], {
      shell: true,
    });

    let errorOutput = '';

    minikube.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        addLog(context, 'info', `  ${line}`, 'deploy');
      }
    });

    minikube.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    minikube.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    minikube.on('close', (code) => {
      if (code === 0) {
        addLog(context, 'info', 'Image loaded into Minikube ✅', 'deploy');
        resolve({ success: true });
      } else {
        resolve({ success: false, error: errorOutput || `Exit code ${code}` });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// APPLY MANIFEST
// ─────────────────────────────────────────────────────────────────

/**
 * Apply a Kubernetes manifest using kubectl.
 */
async function applyManifest(
  context: BuildContext,
  manifest: object
): Promise<{ success: boolean; error?: string }> {
  // Write manifest to temp file as JSON (kubectl accepts JSON)
  const tempFile = join(tmpdir(), `k8s-manifest-${nanoid(8)}.json`);
  
  try {
    const json = JSON.stringify(manifest, null, 2);
    await writeFile(tempFile, json);

    return new Promise((resolve) => {
      const kubectl = spawn('kubectl', ['apply', '-f', tempFile], {
        shell: true,
      });

      let errorOutput = '';

      kubectl.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter((line) => line.trim());
        for (const line of lines) {
          addLog(context, 'info', `  ${line}`, 'deploy');
        }
      });

      kubectl.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        errorOutput += output;
        // kubectl often writes warnings to stderr, not always errors
        if (!output.toLowerCase().includes('error')) {
          addLog(context, 'info', `  ${output.trim()}`, 'deploy');
        }
      });

      kubectl.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      kubectl.on('close', async (code) => {
        // Clean up temp file
        try {
          await unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }

        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: errorOutput || `Exit code ${code}` });
        }
      });
    });
  } catch (error) {
    // Clean up on error
    try {
      await unlink(tempFile);
    } catch {
      // Ignore
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ─────────────────────────────────────────────────────────────────
// WAIT FOR ROLLOUT
// ─────────────────────────────────────────────────────────────────

/**
 * Wait for a deployment rollout to complete.
 */
async function waitForRollout(
  context: BuildContext,
  deploymentName: string,
  namespace: string,
  timeoutSeconds: number = 120
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const kubectl = spawn(
      'kubectl',
      [
        'rollout', 'status',
        `deployment/${deploymentName}`,
        '-n', namespace,
        '--timeout', `${timeoutSeconds}s`,
      ],
      { shell: true }
    );

    let errorOutput = '';

    kubectl.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        addLog(context, 'info', `  ${line}`, 'deploy');
      }
    });

    kubectl.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    kubectl.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    kubectl.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: errorOutput || `Rollout timed out` });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// GET POD STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * Get the status of pods for a deployment.
 */
async function getPodStatus(
  context: BuildContext,
  deploymentName: string,
  namespace: string
): Promise<string> {
  return new Promise((resolve) => {
    const kubectl = spawn(
      'kubectl',
      [
        'get', 'pods',
        '-n', namespace,
        '-l', `app=${deploymentName}`,
        '-o', 'jsonpath={.items[*].status.phase}',
      ],
      { shell: true }
    );

    let output = '';

    kubectl.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    kubectl.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve('Unknown');
      }
    });

    kubectl.on('error', () => {
      resolve('Error');
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// MANIFEST GENERATORS
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a Kubernetes Deployment manifest.
 */
function generateDeploymentManifest(
  projectSlug: string,
  imageTag: string,
  port: number,
  envVars: Record<string, string>,
  namespace: string,
  replicas: number
): object {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: projectSlug,
      namespace: namespace,
      labels: {
        app: projectSlug,
        'managed-by': 'paas-platform',
      },
    },
    spec: {
      replicas: replicas,
      selector: {
        matchLabels: {
          app: projectSlug,
        },
      },
      template: {
        metadata: {
          labels: {
            app: projectSlug,
          },
        },
        spec: {
          containers: [
            {
              name: 'app',
              image: imageTag,
              imagePullPolicy: 'Never', // Use local image loaded via minikube image load
              ports: [
                {
                  containerPort: port,
                  protocol: 'TCP',
                },
              ],
              env: [
                { name: 'PORT', value: String(port) },
                ...Object.entries(envVars).map(([name, value]) => ({
                  name,
                  value,
                })),
              ],
              resources: {
                requests: {
                  memory: '128Mi',
                  cpu: '100m',
                },
                limits: {
                  memory: '512Mi',
                  cpu: '500m',
                },
              },
              readinessProbe: {
                httpGet: {
                  path: '/api/health',
                  port: port,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              livenessProbe: {
                httpGet: {
                  path: '/api/health',
                  port: port,
                },
                initialDelaySeconds: 15,
                periodSeconds: 20,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
            },
          ],
        },
      },
    },
  };
}

/**
 * Generate a Kubernetes Service manifest.
 */
function generateServiceManifest(
  projectSlug: string,
  port: number,
  namespace: string
): object {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: projectSlug,
      namespace: namespace,
      labels: {
        app: projectSlug,
        'managed-by': 'paas-platform',
      },
    },
    spec: {
      type: 'ClusterIP',
      selector: {
        app: projectSlug,
      },
      ports: [
        {
          name: 'http',
          port: port,
          targetPort: port,
          protocol: 'TCP',
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a JavaScript object to YAML format.
 * Simple implementation for Kubernetes manifests.
 */
function objectToYaml(obj: object, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const itemYaml = objectToYaml(item, indent + 2);
          const lines = itemYaml.split('\n').filter((l) => l.trim());
          if (lines.length > 0) {
            yaml += `${spaces}- ${lines[0].trim()}\n`;
            for (let i = 1; i < lines.length; i++) {
              yaml += `${spaces}  ${lines[i].trim()}\n`;
            }
          }
        } else {
          yaml += `${spaces}- ${item}\n`;
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n`;
      yaml += objectToYaml(value, indent + 1);
    } else if (typeof value === 'string') {
      // Quote strings that might be interpreted as other types
      if (value.includes(':') || value.includes('#') || value.includes('\n') || 
          value === 'true' || value === 'false' || !isNaN(Number(value))) {
        yaml += `${spaces}${key}: "${value}"\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

/**
 * Check if kubectl is available.
 */
export async function checkKubectlAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const kubectl = spawn('kubectl', ['version', '--client'], { shell: true });

    kubectl.on('close', (code) => {
      resolve(code === 0);
    });

    kubectl.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check if minikube is available.
 */
export async function checkMinikubeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const minikube = spawn('minikube', ['status'], { shell: true });

    minikube.on('close', (code) => {
      resolve(code === 0);
    });

    minikube.on('error', () => {
      resolve(false);
    });
  });
}
