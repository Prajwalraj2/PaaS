// ═══════════════════════════════════════════════════════════════════════════
// Environment Variables Configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// This file loads and validates all environment variables.
// Using Zod for type-safe environment variable parsing.
//
// ═══════════════════════════════════════════════════════════════════════════

import { z } from 'zod';
import { config } from 'dotenv';

// Load .env file
config();

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT SCHEMA
// ─────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8082),
  API_URL: z.string().default('http://localhost:8082'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5434/paas_db'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6380'),

  // JWT
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // GitHub Webhook Secret (for verifying webhook signatures)
  GITHUB_WEBHOOK_SECRET: z.string().default('dev-webhook-secret-change-in-production'),

  // Container Registry
  REGISTRY_URL: z.string().default('localhost:5001'),

  // Kubernetes
  KUBECONFIG_PATH: z.string().optional(),
  K8S_NAMESPACE: z.string().default('paas-apps'),

  // Platform
  PLATFORM_DOMAIN: z.string().default('localhost'),
});

// ─────────────────────────────────────────────────────────────────
// PARSE AND EXPORT
// ─────────────────────────────────────────────────────────────────

// Parse environment variables - will throw if validation fails
const parsed = envSchema.safeParse(process.env);

console.log('Database URL:', parsed.success ? parsed.data.DATABASE_URL : process.env.DATABASE_URL);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Export type for use in other files
export type Env = z.infer<typeof envSchema>;



