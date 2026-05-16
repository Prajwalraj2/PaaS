// ═══════════════════════════════════════════════════════════════════════════
// Worker Environment Variables
// ═══════════════════════════════════════════════════════════════════════════
//
// This file loads and validates environment variables for the worker.
//
// ═══════════════════════════════════════════════════════════════════════════

import { z } from 'zod';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility - get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from api folder (shared config)
// Using absolute path resolution for reliability
config({ path: resolve(__dirname, '../../../../apps/api/.env') });
// Also try current directory
config();
// Also try root directory
config({ path: resolve(__dirname, '../../../../.env') });

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT SCHEMA
// ─────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database (for updating deployment status)
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5434/paas_db'),
  
  // Redis (for job queue)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Container Registry
  REGISTRY_URL: z.string().default('localhost:5001'),
  REGISTRY_USERNAME: z.string().optional(),
  REGISTRY_PASSWORD: z.string().optional(),
  
  // Build settings
  BUILD_TIMEOUT_MS: z.coerce.number().default(30 * 60 * 1000), // 30 minutes
  BUILD_WORKSPACE: z.string().default('/tmp/paas-builds'),
  
  // Simulation mode (for development without Docker)
  SIMULATION_MODE: z.coerce.boolean().default(true),
  SIMULATION_BUILD_DELAY_MS: z.coerce.number().default(3000), // 3 seconds
  
  // Worker settings
  WORKER_CONCURRENCY: z.coerce.number().default(2), // Process 2 jobs at a time
  WORKER_NAME: z.string().default('worker-1'),
});

// ─────────────────────────────────────────────────────────────────
// PARSE AND EXPORT
// ─────────────────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;



