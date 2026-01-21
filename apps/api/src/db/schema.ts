// ═══════════════════════════════════════════════════════════════════════════
// Database Schema - Drizzle ORM Table Definitions
// ═══════════════════════════════════════════════════════════════════════════
//
// This file defines all database tables using Drizzle ORM schema syntax.
// Drizzle schema is similar to Prisma schema but written in TypeScript.
//
// EXPRESS/SEQUELIZE EQUIVALENT:
// const User = sequelize.define('User', {
//   id: { type: DataTypes.UUID, primaryKey: true },
//   email: { type: DataTypes.STRING, unique: true },
//   ...
// });
//
// PRISMA EQUIVALENT:
// model User {
//   id    String @id @default(uuid())
//   email String @unique
//   ...
// }
//
// ═══════════════════════════════════════════════════════════════════════════

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════════════
// USERS & AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Users Table
 * Stores user account information
 * 
 * SEQUELIZE EQUIVALENT:
 * const User = sequelize.define('User', {
 *   id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
 *   email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
 *   passwordHash: { type: DataTypes.STRING(255) },
 *   name: { type: DataTypes.STRING(255) },
 *   avatarUrl: { type: DataTypes.STRING(500) },
 *   githubId: { type: DataTypes.STRING(100), unique: true },
 *   plan: { type: DataTypes.STRING(50), defaultValue: 'free' },
 * });
 */
export const users = pgTable('users', {
  // Primary key - auto-generated UUID
  id: uuid('id').primaryKey().defaultRandom(),
  
  // User email (required, unique)
  email: varchar('email', { length: 255 }).unique().notNull(),
  
  // Password hash (null for OAuth-only users)
  // We store bcrypt hash, never the plain password
  passwordHash: varchar('password_hash', { length: 255 }),
  
  // User display name
  name: varchar('name', { length: 255 }),
  
  // Profile picture URL (from GitHub/uploaded)
  avatarUrl: varchar('avatar_url', { length: 500 }),
  
  // GitHub OAuth ID (for linking accounts)
  githubId: varchar('github_id', { length: 100 }).unique(),
  
  // Subscription plan: 'free', 'pro', 'enterprise'
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  
  // Email verification status
  emailVerified: boolean('email_verified').default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on email for faster lookups during login
  emailIdx: index('users_email_idx').on(table.email),
  // Index on GitHub ID for OAuth lookups
  githubIdIdx: index('users_github_id_idx').on(table.githubId),
}));

/**
 * Sessions Table (optional - if using session-based auth instead of JWT)
 * For now we use JWT, but this is here for future use
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 500 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
  tokenIdx: index('sessions_token_idx').on(table.token),
}));

/**
 * API Keys Table
 * For programmatic API access (CLI, CI/CD, etc.)
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // Human-readable name (e.g., "GitHub Actions", "Local CLI")
  name: varchar('name', { length: 255 }).notNull(),
  
  // Hashed API key (we never store the plain key)
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  
  // First 8 chars of key for display (e.g., "paas_abc1...")
  prefix: varchar('prefix', { length: 20 }).notNull(),
  
  // Track usage
  lastUsedAt: timestamp('last_used_at'),
  
  // Optional expiration
  expiresAt: timestamp('expires_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Teams Table
 * For collaborative project management
 */
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Team name (displayed in UI)
  name: varchar('name', { length: 255 }).notNull(),
  
  // URL-friendly identifier (e.g., "my-team")
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  
  // Team owner (the user who created it)
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('teams_slug_idx').on(table.slug),
  ownerIdIdx: index('teams_owner_id_idx').on(table.ownerId),
}));

/**
 * Team Members Table
 * Many-to-many relationship between users and teams
 */
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // Role: 'owner', 'admin', 'member', 'viewer'
  role: varchar('role', { length: 50 }).default('member').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Ensure a user can only be in a team once
  teamUserIdx: uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Projects Table
 * Core table - represents a deployed application
 * 
 * SEQUELIZE EQUIVALENT:
 * const Project = sequelize.define('Project', {
 *   id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
 *   userId: { type: DataTypes.UUID, references: { model: 'Users', key: 'id' } },
 *   name: { type: DataTypes.STRING(255), allowNull: false },
 *   ...
 * });
 */
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Owner (user or team)
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  teamId: uuid('team_id').references(() => teams.id),
  
  // Project identifiers
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  
  // ─────────────────────────────────────────────────────────────────
  // GIT SOURCE CONFIGURATION
  // ─────────────────────────────────────────────────────────────────
  
  // Git provider: 'github', 'gitlab', 'bitbucket'
  gitProvider: varchar('git_provider', { length: 50 }).notNull(),
  
  // Full repository URL (e.g., "https://github.com/user/repo")
  gitRepoUrl: varchar('git_repo_url', { length: 500 }).notNull(),
  
  // Provider-specific repo ID (for webhooks)
  gitRepoId: varchar('git_repo_id', { length: 100 }),
  
  // Branch to deploy from
  gitBranch: varchar('git_branch', { length: 255 }).default('main').notNull(),
  
  // Root directory (if app is in a subdirectory)
  gitRootDir: varchar('git_root_dir', { length: 255 }).default('/').notNull(),
  
  // ─────────────────────────────────────────────────────────────────
  // BUILD CONFIGURATION
  // ─────────────────────────────────────────────────────────────────
  
  // Custom build command (overrides auto-detection)
  buildCommand: varchar('build_command', { length: 500 }),
  
  // Custom start command
  startCommand: varchar('start_command', { length: 500 }),
  
  // Path to Dockerfile (if using custom Dockerfile)
  dockerfilePath: varchar('dockerfile_path', { length: 255 }),
  
  // ─────────────────────────────────────────────────────────────────
  // RUNTIME CONFIGURATION
  // ─────────────────────────────────────────────────────────────────
  
  // Instance size: 'small', 'medium', 'large'
  instanceType: varchar('instance_type', { length: 50 }).default('small').notNull(),
  
  // Number of running instances (replicas)
  instanceCount: integer('instance_count').default(1).notNull(),
  
  // Application port (for health checks and routing)
  port: integer('port').default(3000).notNull(),
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS & URLS
  // ─────────────────────────────────────────────────────────────────
  
  // Project status: 'inactive', 'building', 'deploying', 'running', 'failed', 'stopped'
  status: varchar('status', { length: 50 }).default('inactive').notNull(),
  
  // Auto-generated subdomain (e.g., "my-app-abc123")
  subdomain: varchar('subdomain', { length: 255 }).unique(),
  
  // ─────────────────────────────────────────────────────────────────
  // KUBERNETES REFERENCES
  // ─────────────────────────────────────────────────────────────────
  
  // Kubernetes namespace for this project
  k8sNamespace: varchar('k8s_namespace', { length: 255 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('projects_user_id_idx').on(table.userId),
  teamIdIdx: index('projects_team_id_idx').on(table.teamId),
  statusIdx: index('projects_status_idx').on(table.status),
  slugIdx: uniqueIndex('projects_slug_idx').on(table.slug),
}));

/**
 * Environment Variables Table
 * Stores encrypted environment variables for projects
 */
export const environmentVariables = pgTable('environment_variables', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  
  // Variable name (e.g., "DATABASE_URL")
  key: varchar('key', { length: 255 }).notNull(),
  
  // Encrypted value (we encrypt before storing)
  value: text('value').notNull(),
  
  // Whether to mask in logs/UI
  isSecret: boolean('is_secret').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Ensure unique key per project
  projectKeyIdx: uniqueIndex('env_vars_project_key_idx').on(table.projectId, table.key),
}));

/**
 * Custom Domains Table
 * User's custom domains pointed to their projects
 */
export const customDomains = pgTable('custom_domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  
  // The custom domain (e.g., "app.example.com")
  domain: varchar('domain', { length: 255 }).unique().notNull(),
  
  // DNS verification status
  verified: boolean('verified').default(false).notNull(),
  
  // SSL certificate status: 'pending', 'active', 'failed'
  sslStatus: varchar('ssl_status', { length: 50 }).default('pending').notNull(),
  
  // DNS TXT record for verification
  verificationToken: varchar('verification_token', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('custom_domains_project_id_idx').on(table.projectId),
  domainIdx: uniqueIndex('custom_domains_domain_idx').on(table.domain),
}));

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deployments Table
 * Each deployment represents a single build + deploy cycle
 */
export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  
  // ─────────────────────────────────────────────────────────────────
  // GIT INFORMATION
  // ─────────────────────────────────────────────────────────────────
  
  gitCommitSha: varchar('git_commit_sha', { length: 100 }),
  gitCommitMessage: varchar('git_commit_message', { length: 500 }),
  gitBranch: varchar('git_branch', { length: 255 }),
  gitAuthor: varchar('git_author', { length: 255 }),
  
  // ─────────────────────────────────────────────────────────────────
  // BUILD INFORMATION
  // ─────────────────────────────────────────────────────────────────
  
  // Build status: 'queued', 'building', 'success', 'failed', 'cancelled'
  buildStatus: varchar('build_status', { length: 50 }).default('queued').notNull(),
  
  buildStartedAt: timestamp('build_started_at'),
  buildFinishedAt: timestamp('build_finished_at'),
  
  // Build duration in milliseconds
  buildDurationMs: integer('build_duration_ms'),
  
  // Docker image tag (e.g., "registry.paas.com/user/project:abc123")
  imageTag: varchar('image_tag', { length: 255 }),
  
  // Image size in bytes
  imageSizeBytes: bigint('image_size_bytes', { mode: 'number' }),
  
  // ─────────────────────────────────────────────────────────────────
  // DEPLOY INFORMATION
  // ─────────────────────────────────────────────────────────────────
  
  // Deploy status: 'pending', 'deploying', 'live', 'failed', 'rolled_back'
  deployStatus: varchar('deploy_status', { length: 50 }).default('pending').notNull(),
  
  deployStartedAt: timestamp('deploy_started_at'),
  deployFinishedAt: timestamp('deploy_finished_at'),
  
  // ─────────────────────────────────────────────────────────────────
  // META
  // ─────────────────────────────────────────────────────────────────
  
  // Is this the current live deployment?
  isCurrent: boolean('is_current').default(false).notNull(),
  
  // How was this deployment triggered: 'webhook', 'manual', 'rollback', 'cli'
  triggeredBy: varchar('triggered_by', { length: 50 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('deployments_project_id_idx').on(table.projectId),
  createdAtIdx: index('deployments_created_at_idx').on(table.createdAt),
  isCurrentIdx: index('deployments_is_current_idx').on(table.isCurrent),
}));

/**
 * Build Logs Table
 * Stores build output logs line by line
 */
export const buildLogs = pgTable('build_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').references(() => deployments.id, { onDelete: 'cascade' }).notNull(),
  
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  
  // Log level: 'info', 'warn', 'error', 'debug'
  level: varchar('level', { length: 20 }).default('info').notNull(),
  
  // Log message
  message: text('message').notNull(),
}, (table) => ({
  deploymentIdIdx: index('build_logs_deployment_id_idx').on(table.deploymentId),
  timestampIdx: index('build_logs_timestamp_idx').on(table.timestamp),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES (Databases)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Services Table
 * Add-on services like PostgreSQL, Redis, etc.
 */
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  
  // Service name (user-defined)
  name: varchar('name', { length: 255 }).notNull(),
  
  // Service type: 'postgres', 'redis', 'mysql', 'mongodb'
  type: varchar('type', { length: 50 }).notNull(),
  
  // Service version (e.g., "16" for PostgreSQL 16)
  version: varchar('version', { length: 50 }),
  
  // ─────────────────────────────────────────────────────────────────
  // CONNECTION INFO (encrypted)
  // ─────────────────────────────────────────────────────────────────
  
  host: varchar('host', { length: 255 }),
  port: integer('port'),
  username: varchar('username', { length: 255 }),
  password: text('password'), // Encrypted
  databaseName: varchar('database_name', { length: 255 }),
  connectionUrl: text('connection_url'), // Encrypted
  
  // ─────────────────────────────────────────────────────────────────
  // KUBERNETES REFERENCE
  // ─────────────────────────────────────────────────────────────────
  
  k8sServiceName: varchar('k8s_service_name', { length: 255 }),
  
  // ─────────────────────────────────────────────────────────────────
  // RESOURCES
  // ─────────────────────────────────────────────────────────────────
  
  // Storage size in GB
  storageGb: integer('storage_gb').default(1).notNull(),
  
  // Service status: 'provisioning', 'running', 'stopped', 'failed'
  status: varchar('status', { length: 50 }).default('provisioning').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('services_project_id_idx').on(table.projectId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// BILLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscriptions Table
 * User subscription information (Stripe integration)
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // Stripe IDs
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  
  // Plan: 'free', 'pro', 'enterprise'
  plan: varchar('plan', { length: 50 }).notNull(),
  
  // Status: 'active', 'cancelled', 'past_due'
  status: varchar('status', { length: 50 }).notNull(),
  
  // Billing period
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
}));

/**
 * Usage Records Table
 * Track resource usage for billing
 */
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  
  // Date of usage
  date: date('date').notNull(),
  
  // CPU usage in seconds
  cpuSeconds: bigint('cpu_seconds', { mode: 'number' }).default(0).notNull(),
  
  // Memory usage in GB-seconds
  memoryGbSeconds: bigint('memory_gb_seconds', { mode: 'number' }).default(0).notNull(),
  
  // Bandwidth in bytes
  bandwidthBytes: bigint('bandwidth_bytes', { mode: 'number' }).default(0).notNull(),
  
  // Build minutes used
  buildMinutes: integer('build_minutes').default(0).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Unique usage record per project per day
  projectDateIdx: uniqueIndex('usage_records_project_date_idx').on(table.projectId, table.date),
  dateIdx: index('usage_records_date_idx').on(table.date),
}));

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS (for Drizzle Query API)
// ═══════════════════════════════════════════════════════════════════════════
//
// Relations define how tables are connected.
// This enables the Drizzle Query API for fetching related data.
//
// Usage:
//   db.query.users.findFirst({
//     with: { projects: true, teamMemberships: true }
//   })
//
// ═══════════════════════════════════════════════════════════════════════════

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  sessions: many(sessions),
  apiKeys: many(apiKeys),
  teamMemberships: many(teamMembers),
  ownedTeams: many(teams),
  subscriptions: many(subscriptions),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, {
    fields: [teams.ownerId],
    references: [users.id],
  }),
  members: many(teamMembers),
  projects: many(projects),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  deployments: many(deployments),
  environmentVariables: many(environmentVariables),
  customDomains: many(customDomains),
  services: many(services),
  usageRecords: many(usageRecords),
}));

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
  buildLogs: many(buildLogs),
}));

export const environmentVariablesRelations = relations(environmentVariables, ({ one }) => ({
  project: one(projects, {
    fields: [environmentVariables.projectId],
    references: [projects.id],
  }),
}));

export const customDomainsRelations = relations(customDomains, ({ one }) => ({
  project: one(projects, {
    fields: [customDomains.projectId],
    references: [projects.id],
  }),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  project: one(projects, {
    fields: [services.projectId],
    references: [projects.id],
  }),
}));

export const buildLogsRelations = relations(buildLogs, ({ one }) => ({
  deployment: one(deployments, {
    fields: [buildLogs.deploymentId],
    references: [deployments.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
//
// Export types for use in controllers and services
// These give us full type safety when working with database records
//
// Usage:
//   import { User, NewUser, Project } from './db/schema';
//   const user: User = await db.query.users.findFirst(...);
//   const newUser: NewUser = { email: 'test@example.com', ... };
//
// ═══════════════════════════════════════════════════════════════════════════

// Infer types from schemas
// $inferSelect = type for SELECT queries (all fields)
// $inferInsert = type for INSERT queries (required fields only)

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type EnvironmentVariable = typeof environmentVariables.$inferSelect;
export type NewEnvironmentVariable = typeof environmentVariables.$inferInsert;

export type CustomDomain = typeof customDomains.$inferSelect;
export type NewCustomDomain = typeof customDomains.$inferInsert;

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;

export type BuildLog = typeof buildLogs.$inferSelect;
export type NewBuildLog = typeof buildLogs.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;


