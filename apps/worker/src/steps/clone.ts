// ═══════════════════════════════════════════════════════════════════════════
// Step 1: Clone Repository
// ═══════════════════════════════════════════════════════════════════════════
//
// This step clones the user's repository from GitHub/GitLab/Bitbucket.
//
// In SIMULATION MODE:
// - Simulates cloning with a delay
// - Creates a mock directory structure
//
// In REAL MODE:
// - Uses simple-git to clone the repository
// - Handles authentication with access tokens
//
// ═══════════════════════════════════════════════════════════════════════════

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { BuildContext, BuildStep } from '../types';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { addLog } from '../utils/log-helper';

// ─────────────────────────────────────────────────────────────────
// CLONE STEP
// ─────────────────────────────────────────────────────────────────

export const cloneStep: BuildStep = {
  name: 'clone',
  
  async execute(context: BuildContext): Promise<BuildContext> {
    const { job } = context;
    
    addLog(context, 'info', '📥 Starting repository clone...', 'clone');
    addLog(context, 'info', `Repository: ${job.gitRepoUrl}`, 'clone');
    addLog(context, 'info', `Branch: ${job.gitBranch}`, 'clone');
    
    if (env.SIMULATION_MODE) {
      return simulateClone(context);
    }
    
    return realClone(context);
  },
};

// ─────────────────────────────────────────────────────────────────
// SIMULATION MODE
// ─────────────────────────────────────────────────────────────────

async function simulateClone(context: BuildContext): Promise<BuildContext> {
  const { job, workDir } = context;
  
  addLog(context, 'info', '[SIMULATION] Simulating git clone...', 'clone');
  
  // Simulate clone delay
  await sleep(env.SIMULATION_BUILD_DELAY_MS);
  
  // Create the workspace directory
  await mkdir(workDir, { recursive: true });
  
  // Create mock files based on detected app type
  // In simulation, we'll create a mock package.json for Node.js projects
  const mockPackageJson = {
    name: job.projectSlug,
    version: '1.0.0',
    scripts: {
      build: job.buildCommand || 'echo "No build command"',
      start: job.startCommand || 'node index.js',
    },
    dependencies: {
      express: '^4.18.0',
    },
  };
  
  await writeFile(
    join(workDir, 'package.json'),
    JSON.stringify(mockPackageJson, null, 2)
  );
  
  // Create a mock index.js
  const mockIndexJs = `
const express = require('express');
const app = express();
const PORT = process.env.PORT || ${job.port || 3000};

app.get('/', (req, res) => {
  res.send('Hello from ${job.projectName}!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;
  
  await writeFile(join(workDir, 'index.js'), mockIndexJs.trim());
  
  addLog(context, 'info', '[SIMULATION] Repository cloned successfully', 'clone');
  addLog(context, 'info', `[SIMULATION] Working directory: ${workDir}`, 'clone');
  
  // Simulate commit info
  if (!job.gitCommitSha) {
    context.job.gitCommitSha = generateMockCommitSha();
  }
  
  addLog(context, 'info', `Commit: ${context.job.gitCommitSha}`, 'clone');
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// REAL MODE
// ─────────────────────────────────────────────────────────────────

async function realClone(context: BuildContext): Promise<BuildContext> {
  const { job, workDir } = context;
  
  // Create workspace directory
  await mkdir(workDir, { recursive: true });
  
  // Initialize simple-git
  const git: SimpleGit = simpleGit();
  
  try {
    addLog(context, 'info', 'Cloning repository...', 'clone');
    
    // Clone with depth 1 for faster checkout
    const cloneOptions = [
      '--depth', '1',
      '--branch', job.gitBranch,
      '--single-branch',
    ];
    
    await git.clone(job.gitRepoUrl, workDir, cloneOptions);
    
    addLog(context, 'info', 'Repository cloned successfully', 'clone');
    
    // Get commit information
    const gitInWorkDir = simpleGit(workDir);
    const log = await gitInWorkDir.log({ maxCount: 1 });
    
    if (log.latest) {
      context.job.gitCommitSha = log.latest.hash;
      addLog(context, 'info', `Commit: ${log.latest.hash.slice(0, 8)}`, 'clone');
      addLog(context, 'info', `Author: ${log.latest.author_name}`, 'clone');
      addLog(context, 'info', `Message: ${log.latest.message}`, 'clone');
    }
    
    return context;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    addLog(context, 'error', `Failed to clone repository: ${errorMessage}`, 'clone');
    logger.error({ err: error, job }, 'Clone failed');
    throw new Error(`Clone failed: ${errorMessage}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockCommitSha(): string {
  const chars = '0123456789abcdef';
  let sha = '';
  for (let i = 0; i < 40; i++) {
    sha += chars[Math.floor(Math.random() * chars.length)];
  }
  return sha;
}



