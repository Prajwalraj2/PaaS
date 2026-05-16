// ═══════════════════════════════════════════════════════════════════════════
// Step 5: Deploy to Kubernetes
// ═══════════════════════════════════════════════════════════════════════════
//
// This step deploys the built image to Kubernetes.
//
// In SIMULATION MODE:
// - Simulates the deployment process with delays
// - Updates database status
//
// In REAL MODE:
// - Generates Kubernetes manifests (Deployment, Service, Ingress)
// - Loads image into Minikube (for local development)
// - Applies manifests to the cluster
// - Waits for rollout to complete
//
// ═══════════════════════════════════════════════════════════════════════════

import type { BuildContext, BuildStep } from '../types';
import { env } from '../lib/env';
import { addLog } from '../utils/log-helper';
import { deployToK8s } from '../utils/k8s';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// DEPLOY STEP
// ─────────────────────────────────────────────────────────────────

export const deployStep: BuildStep = {
  name: 'deploy',
  
  async execute(context: BuildContext): Promise<BuildContext> {
    const { job, imageTag } = context;
    
    addLog(context, 'info', '🚀 Deploying to cluster...', 'deploy');
    addLog(context, 'info', `Project: ${job.projectName}`, 'deploy');
    addLog(context, 'info', `Image: ${imageTag}`, 'deploy');
    
    if (env.SIMULATION_MODE) {
      return simulateDeploy(context);
    }
    
    return realDeploy(context);
  },
};

// ─────────────────────────────────────────────────────────────────
// SIMULATION MODE
// ─────────────────────────────────────────────────────────────────

async function simulateDeploy(context: BuildContext): Promise<BuildContext> {
  const { job } = context;
  
  addLog(context, 'info', '[SIMULATION] Generating Kubernetes manifests...', 'deploy');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
  
  // Simulate manifest generation
  addLog(context, 'info', '[SIMULATION]   ✓ Deployment manifest', 'deploy');
  addLog(context, 'info', '[SIMULATION]   ✓ Service manifest', 'deploy');
  addLog(context, 'info', '[SIMULATION]   ✓ Ingress manifest', 'deploy');
  addLog(context, 'info', '[SIMULATION]   ✓ Secret manifest (env vars)', 'deploy');
  
  addLog(context, 'info', '[SIMULATION] Applying manifests to cluster...', 'deploy');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
  
  addLog(context, 'info', '[SIMULATION]   kubectl apply -f deployment.yaml', 'deploy');
  addLog(context, 'info', '[SIMULATION]   deployment.apps/project created', 'deploy');
  addLog(context, 'info', '[SIMULATION]   service/project created', 'deploy');
  addLog(context, 'info', '[SIMULATION]   ingress.networking.k8s.io/project created', 'deploy');
  
  addLog(context, 'info', '[SIMULATION] Waiting for rollout...', 'deploy');
  await sleep(env.SIMULATION_BUILD_DELAY_MS);
  
  addLog(context, 'info', '[SIMULATION]   Waiting for deployment to be ready...', 'deploy');
  addLog(context, 'info', '[SIMULATION]   0/1 pods ready', 'deploy');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
  addLog(context, 'info', '[SIMULATION]   1/1 pods ready', 'deploy');
  
  addLog(context, 'info', '[SIMULATION] Running health checks...', 'deploy');
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
  addLog(context, 'info', '[SIMULATION]   Health check passed! ✅', 'deploy');
  
  // Generate the app URL
  const appUrl = `https://${job.projectSlug}.${env.REGISTRY_URL.replace('localhost:', 'localhost.')}`;
  
  addLog(context, 'info', '', 'deploy');
  addLog(context, 'info', '════════════════════════════════════════════', 'deploy');
  addLog(context, 'info', '🎉 DEPLOYMENT SUCCESSFUL!', 'deploy');
  addLog(context, 'info', '════════════════════════════════════════════', 'deploy');
  addLog(context, 'info', '', 'deploy');
  addLog(context, 'info', `[SIMULATION] Your app is live at: ${appUrl}`, 'deploy');
  addLog(context, 'info', '', 'deploy');
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// REAL MODE
// ─────────────────────────────────────────────────────────────────

async function realDeploy(context: BuildContext): Promise<BuildContext> {
  const { job, imageTag } = context;
  
  if (!imageTag) {
    throw new Error('Image tag not set in context');
  }
  
  // Prepare environment variables for the deployment
  const envVars: Record<string, string> = {
    NODE_ENV: 'production',
    ...job.envVars,
  };
  
  // Deploy to Kubernetes
  const result = await deployToK8s({
    context,
    projectSlug: job.projectSlug,
    imageTag,
    port: job.port || 3000,
    envVars,
    namespace: env.K8S_NAMESPACE,
    replicas: 1,
  });
  
  if (!result.success) {
    logger.error({ error: result.error, projectSlug: job.projectSlug }, 'Kubernetes deployment failed');
    throw new Error(`Kubernetes deployment failed: ${result.error}`);
  }
  
  if (result.appUrl) {
    context.appUrl = result.appUrl;
  }
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// MANIFEST TEMPLATES (for future use)
// ─────────────────────────────────────────────────────────────────

/**
 * Generate Kubernetes Deployment manifest
 */
export function generateDeploymentManifest(
  projectSlug: string,
  imageTag: string,
  port: number,
  envVars: Record<string, string>
): object {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: projectSlug,
      labels: {
        app: projectSlug,
        'managed-by': 'paas-platform',
      },
    },
    spec: {
      replicas: 1,
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
              ports: [
                {
                  containerPort: port,
                },
              ],
              env: Object.entries(envVars).map(([name, value]) => ({
                name,
                value,
              })),
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
                  path: '/health',
                  port: port,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: port,
                },
                initialDelaySeconds: 15,
                periodSeconds: 20,
              },
            },
          ],
        },
      },
    },
  };
}

/**
 * Generate Kubernetes Service manifest
 */
export function generateServiceManifest(
  projectSlug: string,
  port: number
): object {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: projectSlug,
    },
    spec: {
      selector: {
        app: projectSlug,
      },
      ports: [
        {
          port: 80,
          targetPort: port,
        },
      ],
    },
  };
}

/**
 * Generate Kubernetes Ingress manifest
 */
export function generateIngressManifest(
  projectSlug: string,
  domain: string
): object {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: projectSlug,
      annotations: {
        'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
      },
    },
    spec: {
      ingressClassName: 'traefik',
      tls: [
        {
          hosts: [domain],
          secretName: `${projectSlug}-tls`,
        },
      ],
      rules: [
        {
          host: domain,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: projectSlug,
                    port: {
                      number: 80,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



