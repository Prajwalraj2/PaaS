// ═══════════════════════════════════════════════════════════════════════════
// Database Connection - Drizzle ORM with PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════
//
// This file sets up the database connection using Drizzle ORM.
// Drizzle is a TypeScript-first ORM that provides type-safe queries.
//
// EXPRESS/SEQUELIZE EQUIVALENT:
// const { Sequelize } = require('sequelize');
// const sequelize = new Sequelize(process.env.DATABASE_URL);
// module.exports = sequelize;
//
// EXPRESS/PRISMA EQUIVALENT:
// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient();
// module.exports = prisma;
//
// ═══════════════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import * as schema from './schema';

// ─────────────────────────────────────────────────────────────────
// DATABASE CLIENT
// ─────────────────────────────────────────────────────────────────

// Create PostgreSQL connection using postgres.js driver
// This is similar to creating a Sequelize instance or PrismaClient
//
// CONNECTION POOLING:
// postgres.js handles connection pooling automatically
// Default: max 10 connections (good for development)
// Production: Consider setting max: 20-50 based on your server
//
const queryClient = postgres(env.DATABASE_URL, {
  // Maximum number of connections in the pool
  max: env.NODE_ENV === 'production' ? 20 : 10,
  
  // Connection timeout in milliseconds
  connect_timeout: 10,
  
  // Idle connection timeout (close idle connections after 30 seconds)
  idle_timeout: 30,
  
  // Log queries in development (useful for debugging)
  // Similar to: sequelize.options.logging = console.log
  debug: env.NODE_ENV === 'development',
  
  // Transform column names from snake_case to camelCase
  // e.g., created_at → createdAt (we handle this in schema)
  transform: {
    undefined: null, // Transform undefined to null
  },
});

// ─────────────────────────────────────────────────────────────────
// DRIZZLE INSTANCE
// ─────────────────────────────────────────────────────────────────

// Create Drizzle ORM instance with our schema
// This is what we'll use to perform all database operations
//
// Usage examples:
//   db.select().from(users).where(eq(users.id, userId))
//   db.insert(users).values({ email, name })
//   db.update(users).set({ name }).where(eq(users.id, userId))
//   db.delete(users).where(eq(users.id, userId))
//
export const db = drizzle(queryClient, { 
  schema,
  // Enable query logging in development
  logger: env.NODE_ENV === 'development',
});

// Export the raw postgres client for advanced operations
// (like transactions or raw SQL queries)
export { queryClient };

// ─────────────────────────────────────────────────────────────────
// CONNECTION FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Test database connection
 * Call this during server startup to ensure DB is accessible
 * 
 * EXPRESS EQUIVALENT:
 * async function testConnection() {
 *   try {
 *     await sequelize.authenticate();
 *     console.log('Database connected');
 *   } catch (error) {
 *     console.error('Database connection failed:', error);
 *     throw error;
 *   }
 * }
 */
export async function connectDatabase(): Promise<void> {
  try {
    // Execute a simple query to test the connection
    // This is similar to sequelize.authenticate() or prisma.$connect()
    await queryClient`SELECT 1 as connected`;
    
    logger.info('✅ Database connected successfully');
    logger.info(`📊 Database: ${env.DATABASE_URL.split('@')[1]?.split('/')[1] || 'paas_db'}`);
    
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to connect to database');
    throw error;
  }
}

/**
 * Close database connection
 * Call this during graceful shutdown
 * 
 * EXPRESS EQUIVALENT:
 * async function closeConnection() {
 *   await sequelize.close();
 * }
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await queryClient.end();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error({ err: error }, 'Error closing database connection');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────

// Export types for use in other files
export type Database = typeof db;


