// ═══════════════════════════════════════════════════════════════════════════
// Auth Service - Database Operations for Authentication
// ═══════════════════════════════════════════════════════════════════════════
//
// This service handles all database operations related to authentication:
// - Finding users by email/ID
// - Creating new users
// - Updating user information
//
// EXPRESS EQUIVALENT:
// This is like having a separate file for database queries:
// const User = require('../models/User');
// exports.findByEmail = (email) => User.findOne({ email });
// exports.create = (data) => User.create(data);
//
// WHY SEPARATE SERVICE?
// - Keeps database logic separate from business logic
// - Makes testing easier (can mock the service)
// - Single responsibility principle
// - Reusable across different controllers
//
// ═══════════════════════════════════════════════════════════════════════════

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, type User } from '../db/schema';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * User data returned to clients (excludes sensitive fields)
 */
export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  emailVerified: boolean;
  createdAt: Date;
}

/**
 * Data required to create a new user
 */
export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

/**
 * Data for GitHub OAuth user creation
 */
export interface CreateGitHubUserData {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  githubId: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a database user to a safe user object
 * Removes sensitive fields like passwordHash
 * 
 * IMPORTANT: NEVER expose passwordHash to clients!
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    plan: user.plan,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────
// FIND USER BY EMAIL
// ─────────────────────────────────────────────────────────────────

/**
 * Find a user by email address
 * Used for login and checking if user exists during registration
 * 
 * EXPRESS/SEQUELIZE EQUIVALENT:
 * const findByEmail = async (email) => {
 *   return User.findOne({ where: { email } });
 * };
 * 
 * @param email - User's email address
 * @returns User object or null if not found
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  // Drizzle query builder
  // SELECT * FROM users WHERE email = ? LIMIT 1
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  
  return user || null;
}

// ─────────────────────────────────────────────────────────────────
// FIND USER BY ID
// ─────────────────────────────────────────────────────────────────

/**
 * Find a user by their ID
 * Used for getting current user, profile pages, etc.
 * 
 * EXPRESS/SEQUELIZE EQUIVALENT:
 * const findById = async (id) => {
 *   return User.findByPk(id);
 * };
 * 
 * @param id - User's UUID
 * @returns User object or null if not found
 */
export async function findUserById(id: string): Promise<User | null> {
  // SELECT * FROM users WHERE id = ? LIMIT 1
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  
  return user || null;
}

// ─────────────────────────────────────────────────────────────────
// FIND USER BY GITHUB ID
// ─────────────────────────────────────────────────────────────────

/**
 * Find a user by their GitHub ID
 * Used for GitHub OAuth flow
 * 
 * @param githubId - User's GitHub ID
 * @returns User object or null if not found
 */
export async function findUserByGitHubId(githubId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.githubId, githubId))
    .limit(1);
  
  return user || null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new user account
 * Used for email/password registration
 * 
 * EXPRESS/SEQUELIZE EQUIVALENT:
 * const create = async (data) => {
 *   return User.create(data);
 * };
 * 
 * @param data - User data (email, passwordHash, name)
 * @returns Created user object
 */
export async function createUser(data: CreateUserData): Promise<User> {
  // INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING *
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      name: data.name,
      plan: 'free', // Default plan
      emailVerified: false,
    })
    .returning();
  
  return user;
}

// ─────────────────────────────────────────────────────────────────
// CREATE OR UPDATE GITHUB USER
// ─────────────────────────────────────────────────────────────────

/**
 * Create or update a user from GitHub OAuth
 * If user exists with same GitHub ID, update their info
 * If user exists with same email, link GitHub account
 * Otherwise, create new user
 * 
 * @param data - GitHub user data
 * @returns User object
 */
export async function upsertGitHubUser(data: CreateGitHubUserData): Promise<User> {
  // First, check if user exists with this GitHub ID
  const existingByGitHub = await findUserByGitHubId(data.githubId);
  
  if (existingByGitHub) {
    // Update existing user's info from GitHub
    const [updated] = await db
      .update(users)
      .set({
        name: data.name || existingByGitHub.name,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByGitHub.id))
      .returning();
    
    return updated;
  }
  
  // Check if user exists with same email (link accounts)
  const existingByEmail = await findUserByEmail(data.email);
  
  if (existingByEmail) {
    // Link GitHub account to existing user
    const [updated] = await db
      .update(users)
      .set({
        githubId: data.githubId,
        avatarUrl: data.avatarUrl || existingByEmail.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail.id))
      .returning();
    
    return updated;
  }
  
  // Create new user
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      name: data.name,
      avatarUrl: data.avatarUrl,
      githubId: data.githubId,
      plan: 'free',
      emailVerified: true, // GitHub emails are verified
    })
    .returning();
  
  return user;
}

// ─────────────────────────────────────────────────────────────────
// UPDATE USER
// ─────────────────────────────────────────────────────────────────

/**
 * Update user profile information
 * 
 * @param id - User ID
 * @param data - Fields to update
 * @returns Updated user object
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'name' | 'avatarUrl' | 'emailVerified'>>
): Promise<User | null> {
  const [user] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  
  return user || null;
}

// ─────────────────────────────────────────────────────────────────
// UPDATE PASSWORD
// ─────────────────────────────────────────────────────────────────

/**
 * Update user's password
 * Used for password reset and change password features
 * 
 * @param id - User ID
 * @param passwordHash - New password hash (already hashed!)
 * @returns true if updated, false if user not found
 */
export async function updatePassword(
  id: string,
  passwordHash: string
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  
  // Check if any rows were updated
  return (result as unknown as { rowCount: number }).rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// CHECK IF EMAIL EXISTS
// ─────────────────────────────────────────────────────────────────

/**
 * Check if an email is already registered
 * Used for registration validation
 * 
 * @param email - Email to check
 * @returns true if email exists, false otherwise
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await findUserByEmail(email);
  return user !== null;
}


