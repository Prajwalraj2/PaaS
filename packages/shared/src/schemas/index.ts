// ═══════════════════════════════════════════════════════════════════════════
// Shared Validation Schemas (Zod)
// ═══════════════════════════════════════════════════════════════════════════
//
// Zod schemas used for validation in both frontend forms and backend API.
// This ensures consistent validation across the entire application.
//
// ═══════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────
// AUTH SCHEMAS
// ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────
// PROJECT SCHEMAS
// ─────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Name can only contain lowercase letters, numbers, and hyphens'
    ),
  gitRepoUrl: z
    .string()
    .url('Invalid repository URL')
    .refine(
      (url) => url.includes('github.com') || url.includes('gitlab.com'),
      'Only GitHub and GitLab repositories are supported'
    ),
  gitBranch: z.string().default('main'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  gitBranch: z.string().optional(),
  buildCommand: z.string().max(500).optional(),
  startCommand: z.string().max(500).optional(),
  instanceType: z.enum(['small', 'medium', 'large']).optional(),
  instanceCount: z.number().min(0).max(10).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE SCHEMAS
// ─────────────────────────────────────────────────────────────────

export const envVarSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(100)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      'Key must be uppercase letters, numbers, and underscores (e.g., DATABASE_URL)'
    ),
  value: z.string().min(1, 'Value is required').max(5000),
  isSecret: z.boolean().default(true),
});

export type EnvVarInput = z.infer<typeof envVarSchema>;

// ─────────────────────────────────────────────────────────────────
// SERVICE SCHEMAS
// ─────────────────────────────────────────────────────────────────

export const createServiceSchema = z.object({
  type: z.enum(['postgres', 'redis', 'mysql', 'mongodb']),
  name: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  version: z.string().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

// ─────────────────────────────────────────────────────────────────
// DOMAIN SCHEMAS
// ─────────────────────────────────────────────────────────────────

export const addDomainSchema = z.object({
  domain: z
    .string()
    .min(1, 'Domain is required')
    .regex(
      /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
      'Invalid domain format (e.g., app.example.com)'
    ),
});

export type AddDomainInput = z.infer<typeof addDomainSchema>;



