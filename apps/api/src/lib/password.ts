// ═══════════════════════════════════════════════════════════════════════════
// Password Hashing Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// This file provides functions for securely hashing and verifying passwords.
// We use bcryptjs which is a pure JavaScript implementation of bcrypt.
//
// WHY BCRYPT?
// - Industry standard for password hashing
// - Built-in salting (prevents rainbow table attacks)
// - Adjustable work factor (can increase as hardware gets faster)
// - Slow by design (makes brute-force attacks impractical)
//
// EXPRESS EQUIVALENT:
// const bcrypt = require('bcryptjs');
// 
// // Hash a password
// const hash = await bcrypt.hash('password123', 12);
// 
// // Verify a password
// const isValid = await bcrypt.compare('password123', hash);
//
// SECURITY NOTES:
// - NEVER store plain text passwords
// - NEVER log passwords (even in debug mode)
// - NEVER send passwords back in API responses
// - ALWAYS hash passwords before storing in database
//
// ═══════════════════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────

/**
 * Salt rounds (work factor) for bcrypt
 * 
 * Higher = more secure but slower
 * 
 * Recommended values:
 * - Development: 10 (fast for testing)
 * - Production: 12-14 (good balance)
 * - High security: 14+ (very slow)
 * 
 * Each increment doubles the time:
 * - 10 rounds: ~100ms
 * - 12 rounds: ~400ms
 * - 14 rounds: ~1600ms
 * 
 * We use 12 as a good balance between security and performance
 */
const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────
// HASH PASSWORD
// ─────────────────────────────────────────────────────────────────

/**
 * Hash a plain text password
 * 
 * EXPRESS EQUIVALENT:
 * const bcrypt = require('bcryptjs');
 * const hashPassword = async (password) => {
 *   const salt = await bcrypt.genSalt(12);
 *   return bcrypt.hash(password, salt);
 * };
 * 
 * USAGE:
 * const hash = await hashPassword('mySecurePassword123');
 * // Store 'hash' in database, never the plain password
 * 
 * @param password - Plain text password from user input
 * @returns Bcrypt hash string (starts with $2a$ or $2b$)
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password before hashing
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  // Check maximum length (bcrypt has a 72-byte limit)
  // This prevents DoS attacks with extremely long passwords
  if (password.length > 72) {
    throw new Error('Password must be at most 72 characters');
  }
  
  // Generate salt and hash in one step
  // bcrypt.hash() internally calls genSalt() then hash()
  //
  // The resulting hash looks like:
  // $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.aUqk2YEuS.N5Oi
  // └─┬┘└┬┘└───────────────────────────────┬────────────────────────┘
  //   │  │                                 └── hash (31 chars)
  //   │  └── salt (22 chars, includes cost)
  //   └── algorithm version + cost factor (12)
  //
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  
  return hash;
}

// ─────────────────────────────────────────────────────────────────
// VERIFY PASSWORD
// ─────────────────────────────────────────────────────────────────

/**
 * Verify a password against a hash
 * 
 * EXPRESS EQUIVALENT:
 * const bcrypt = require('bcryptjs');
 * const verifyPassword = async (password, hash) => {
 *   return bcrypt.compare(password, hash);
 * };
 * 
 * USAGE:
 * const isValid = await verifyPassword('userInput', user.passwordHash);
 * if (!isValid) {
 *   throw new Error('Invalid password');
 * }
 * 
 * @param password - Plain text password from user input
 * @param hash - Stored bcrypt hash from database
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  // Handle edge cases
  if (!password || !hash) {
    return false;
  }
  
  // bcrypt.compare() is timing-safe
  // It always takes the same time regardless of where the comparison fails
  // This prevents timing attacks
  const isValid = await bcrypt.compare(password, hash);
  
  return isValid;
}

// ─────────────────────────────────────────────────────────────────
// PASSWORD VALIDATION
// ─────────────────────────────────────────────────────────────────

/**
 * Password strength requirements
 */
export interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

/**
 * Default password requirements
 * You can adjust these based on your security needs
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  maxLength: 72,  // bcrypt limit
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,  // Optional: makes passwords harder to remember
};

/**
 * Validation result
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password against requirements
 * 
 * USAGE:
 * const result = validatePassword('MyP@ssw0rd');
 * if (!result.isValid) {
 *   console.log('Password errors:', result.errors);
 * }
 * 
 * @param password - Password to validate
 * @param requirements - Custom requirements (optional)
 * @returns Validation result with errors
 */
export function validatePassword(
  password: string,
  requirements: Partial<PasswordRequirements> = {}
): PasswordValidationResult {
  const reqs = { ...DEFAULT_PASSWORD_REQUIREMENTS, ...requirements };
  const errors: string[] = [];
  
  // Check length
  if (!password || password.length < reqs.minLength) {
    errors.push(`Password must be at least ${reqs.minLength} characters`);
  }
  
  if (password && password.length > reqs.maxLength) {
    errors.push(`Password must be at most ${reqs.maxLength} characters`);
  }
  
  // Check uppercase
  if (reqs.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check lowercase
  if (reqs.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check number
  if (reqs.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Check special character
  if (reqs.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Check if a hash needs to be re-hashed
 * 
 * Use this when upgrading salt rounds:
 * if (needsRehash(user.passwordHash)) {
 *   user.passwordHash = await hashPassword(plainPassword);
 *   await user.save();
 * }
 * 
 * @param hash - Existing bcrypt hash
 * @param desiredRounds - Desired salt rounds (default: SALT_ROUNDS)
 * @returns true if hash should be regenerated
 */
export function needsRehash(hash: string, desiredRounds = SALT_ROUNDS): boolean {
  // Extract the cost factor from the hash
  // Hash format: $2b$12$...
  const match = hash.match(/^\$2[aby]\$(\d{2})\$/);
  
  if (!match) {
    return true; // Invalid hash format, definitely needs rehash
  }
  
  const currentRounds = parseInt(match[1], 10);
  return currentRounds < desiredRounds;
}

/**
 * Generate a random password
 * Useful for generating temporary passwords or password reset tokens
 * 
 * @param length - Length of the password (default: 16)
 * @returns Random password string
 */
export function generateRandomPassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
}


