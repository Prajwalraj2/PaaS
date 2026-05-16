// ═══════════════════════════════════════════════════════════════════════════
// Step 2: Detect Application Type
// ═══════════════════════════════════════════════════════════════════════════
//
// This step analyzes the cloned repository to determine:
// - Programming language (Node.js, Python, Go, etc.)
// - Framework (Next.js, Django, Express, etc.)
// - Build tool (npm, yarn, pnpm, pip, etc.)
// - Whether a Dockerfile exists
//
// ═══════════════════════════════════════════════════════════════════════════

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import type { BuildContext, BuildStep, DetectedAppType } from '../types';
import { env } from '../lib/env';
import { addLog } from '../utils/log-helper';

// ─────────────────────────────────────────────────────────────────
// DETECT STEP
// ─────────────────────────────────────────────────────────────────

export const detectStep: BuildStep = {
  name: 'detect',
  
  async execute(context: BuildContext): Promise<BuildContext> {
    addLog(context, 'info', '🔍 Detecting application type...', 'detect');
    
    if (env.SIMULATION_MODE) {
      return simulateDetect(context);
    }
    
    return realDetect(context);
  },
};

// ─────────────────────────────────────────────────────────────────
// SIMULATION MODE
// ─────────────────────────────────────────────────────────────────

async function simulateDetect(context: BuildContext): Promise<BuildContext> {
  addLog(context, 'info', '[SIMULATION] Analyzing project structure...', 'detect');
  
  // Simulate detection delay
  await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
  
  // In simulation, assume Node.js with Express
  const appType: DetectedAppType = {
    type: 'nodejs',
    version: '20.x',
    framework: 'express',
    buildTool: 'npm',
    hasDockerfile: false,
  };
  
  context.appType = appType;
  
  addLog(context, 'info', `[SIMULATION] Detected: ${appType.type}`, 'detect');
  addLog(context, 'info', `[SIMULATION] Framework: ${appType.framework || 'none'}`, 'detect');
  addLog(context, 'info', `[SIMULATION] Version: ${appType.version || 'unknown'}`, 'detect');
  addLog(context, 'info', `[SIMULATION] Build tool: ${appType.buildTool || 'none'}`, 'detect');
  addLog(context, 'info', `[SIMULATION] Has Dockerfile: ${appType.hasDockerfile}`, 'detect');
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// REAL MODE
// ─────────────────────────────────────────────────────────────────

async function realDetect(context: BuildContext): Promise<BuildContext> {
  const { workDir } = context;
  
  const appType: DetectedAppType = {
    type: 'unknown',
    hasDockerfile: false,
  };
  
  // Check for Dockerfile first (highest priority)
  if (await fileExists(join(workDir, 'Dockerfile'))) {
    appType.hasDockerfile = true;
    appType.type = 'docker';
    addLog(context, 'info', 'Found Dockerfile - will use custom Docker build', 'detect');
  }
  
  // Check for Node.js
  if (await fileExists(join(workDir, 'package.json'))) {
    const packageJson = await readJsonFile(join(workDir, 'package.json'));
    appType.type = 'nodejs';
    appType.version = detectNodeVersion(packageJson);
    appType.framework = detectNodeFramework(packageJson);
    appType.buildTool = await detectNodeBuildTool(workDir);
    addLog(context, 'info', 'Detected Node.js application', 'detect');
  }
  
  // Check for Python
  else if (await fileExists(join(workDir, 'requirements.txt')) || 
           await fileExists(join(workDir, 'pyproject.toml'))) {
    appType.type = 'python';
    appType.version = await detectPythonVersion(workDir);
    appType.framework = await detectPythonFramework(workDir);
    addLog(context, 'info', 'Detected Python application', 'detect');
  }
  
  // Check for Go
  else if (await fileExists(join(workDir, 'go.mod'))) {
    appType.type = 'go';
    const goMod = await readFile(join(workDir, 'go.mod'), 'utf-8');
    const versionMatch = goMod.match(/go\s+(\d+\.\d+)/);
    appType.version = versionMatch ? versionMatch[1] : undefined;
    addLog(context, 'info', 'Detected Go application', 'detect');
  }
  
  // Check for Rust
  else if (await fileExists(join(workDir, 'Cargo.toml'))) {
    appType.type = 'rust';
    addLog(context, 'info', 'Detected Rust application', 'detect');
  }
  
  // Check for Ruby
  else if (await fileExists(join(workDir, 'Gemfile'))) {
    appType.type = 'ruby';
    addLog(context, 'info', 'Detected Ruby application', 'detect');
  }
  
  // Check for PHP
  else if (await fileExists(join(workDir, 'composer.json'))) {
    appType.type = 'php';
    addLog(context, 'info', 'Detected PHP application', 'detect');
  }
  
  // Check for Java (Maven)
  else if (await fileExists(join(workDir, 'pom.xml'))) {
    appType.type = 'java';
    appType.buildTool = 'maven';
    addLog(context, 'info', 'Detected Java (Maven) application', 'detect');
  }
  
  // Check for Java (Gradle)
  else if (await fileExists(join(workDir, 'build.gradle')) ||
           await fileExists(join(workDir, 'build.gradle.kts'))) {
    appType.type = 'java';
    appType.buildTool = 'gradle';
    addLog(context, 'info', 'Detected Java (Gradle) application', 'detect');
  }
  
  // Check for static site (index.html)
  else if (await fileExists(join(workDir, 'index.html'))) {
    appType.type = 'static';
    addLog(context, 'info', 'Detected static website', 'detect');
  }
  
  if (appType.type === 'unknown' && !appType.hasDockerfile) {
    addLog(context, 'warn', 'Could not detect application type', 'detect');
    addLog(context, 'warn', 'Please add a Dockerfile for custom builds', 'detect');
  }
  
  context.appType = appType;
  
  addLog(context, 'info', `Application type: ${appType.type}`, 'detect');
  if (appType.framework) addLog(context, 'info', `Framework: ${appType.framework}`, 'detect');
  if (appType.version) addLog(context, 'info', `Version: ${appType.version}`, 'detect');
  if (appType.buildTool) addLog(context, 'info', `Build tool: ${appType.buildTool}`, 'detect');
  
  return context;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function detectNodeVersion(packageJson: Record<string, unknown>): string | undefined {
  const engines = packageJson.engines as Record<string, string> | undefined;
  if (engines?.node) {
    return engines.node;
  }
  return '20.x'; // Default to LTS
}

function detectNodeFramework(packageJson: Record<string, unknown>): string | undefined {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };
  
  if (deps['next']) return 'next';
  if (deps['nuxt']) return 'nuxt';
  if (deps['@remix-run/react']) return 'remix';
  if (deps['gatsby']) return 'gatsby';
  if (deps['svelte']) return 'svelte';
  if (deps['vue']) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  if (deps['hono']) return 'hono';
  if (deps['koa']) return 'koa';
  if (deps['nestjs']) return 'nestjs';
  
  return undefined;
}

async function detectNodeBuildTool(workDir: string): Promise<string> {
  if (await fileExists(join(workDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(join(workDir, 'yarn.lock'))) return 'yarn';
  if (await fileExists(join(workDir, 'bun.lockb'))) return 'bun';
  return 'npm';
}

async function detectPythonVersion(workDir: string): Promise<string | undefined> {
  // Check .python-version file
  if (await fileExists(join(workDir, '.python-version'))) {
    const version = await readFile(join(workDir, '.python-version'), 'utf-8');
    return version.trim();
  }
  
  // Check pyproject.toml for python version
  if (await fileExists(join(workDir, 'pyproject.toml'))) {
    const content = await readFile(join(workDir, 'pyproject.toml'), 'utf-8');
    const match = content.match(/python\s*=\s*["']([^"']+)["']/);
    if (match) return match[1];
  }
  
  return '3.11'; // Default
}

async function detectPythonFramework(workDir: string): Promise<string | undefined> {
  let requirements = '';
  
  if (await fileExists(join(workDir, 'requirements.txt'))) {
    requirements = await readFile(join(workDir, 'requirements.txt'), 'utf-8');
  }
  
  const lower = requirements.toLowerCase();
  
  if (lower.includes('django')) return 'django';
  if (lower.includes('flask')) return 'flask';
  if (lower.includes('fastapi')) return 'fastapi';
  if (lower.includes('streamlit')) return 'streamlit';
  
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



