// ═══════════════════════════════════════════════════════════════════════════
// Drizzle Kit Configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// This file configures drizzle-kit for database migrations.
// 
// Commands:
//   pnpm db:generate  - Generate migration files from schema changes
//   pnpm db:migrate   - Apply migrations to database
//   pnpm db:studio    - Open Drizzle Studio (database GUI)
//
// ═══════════════════════════════════════════════════════════════════════════

import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config();

export default defineConfig({
  // Path to schema file(s)
  schema: './src/db/schema.ts',
  
  // Output directory for migration files
  out: './src/db/migrations',
  
  // Database dialect
  dialect: 'postgresql',
  
  // Database connection
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5434/paas_db',
  },
  
  // Verbose output
  verbose: true,
  
  // Strict mode - fail on warnings
  strict: true,
});


