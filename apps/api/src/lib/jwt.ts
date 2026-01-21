// ═══════════════════════════════════════════════════════════════════════════
// JWT (JSON Web Token) Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// This file provides functions for creating and verifying JWT tokens.
// We use the 'jose' library which is a modern, lightweight JWT implementation.
//
// EXPRESS EQUIVALENT (using jsonwebtoken):
// const jwt = require('jsonwebtoken');
// 
// // Sign a token
// const token = jwt.sign({ userId: '123' }, process.env.JWT_SECRET, { expiresIn: '7d' });
//
// // Verify a token
// const payload = jwt.verify(token, process.env.JWT_SECRET);
//
// WHY JOSE INSTEAD OF JSONWEBTOKEN?
// - jose is more modern and actively maintained
// - Better TypeScript support
// - Smaller bundle size
// - Works in Edge runtimes (Cloudflare Workers, Vercel Edge)
// - Supports all modern JWA algorithms
//
// ═══════════════════════════════════════════════════════════════════════════

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from './env';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * JWT Token Payload
 * This is the data we encode in the token
 * 
 * IMPORTANT: Don't put sensitive data here!
 * JWTs are encoded, not encrypted - anyone can decode them
 */
export interface TokenPayload extends JWTPayload {
  // User ID (required)
  sub: string;          // 'sub' is standard JWT claim for subject (user ID)
  
  // User email
  email: string;
  
  // User's subscription plan
  plan: string;
  
  // Team IDs the user belongs to (for authorization)
  teams?: string[];
  
  // Token type: 'access' or 'refresh'
  type: 'access' | 'refresh';
}

/**
 * Token generation options
 */
export interface TokenOptions {
  userId: string;
  email: string;
  plan?: string;
  teams?: string[];
}

// ─────────────────────────────────────────────────────────────────
// SECRET KEY
// ─────────────────────────────────────────────────────────────────

// Convert secret string to Uint8Array for jose
// jose requires the secret as a Uint8Array (or KeyLike object)
const getSecretKey = (): Uint8Array => {
  const secret = env.JWT_SECRET;
  
  // In production, ensure secret is strong enough
  if (env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  
  return new TextEncoder().encode(secret);
};

// ─────────────────────────────────────────────────────────────────
// TOKEN EXPIRATION
// ─────────────────────────────────────────────────────────────────

/**
 * Parse expiration string to seconds
 * Supports: '7d', '24h', '30m', '3600s', '3600'
 * 
 * EXPRESS EQUIVALENT:
 * jwt.sign(payload, secret, { expiresIn: '7d' });
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])?$/);
  
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2] || 's';
  
  switch (unit) {
    case 's': return value;           // seconds
    case 'm': return value * 60;       // minutes
    case 'h': return value * 3600;     // hours
    case 'd': return value * 86400;    // days
    default:  return value;
  }
}

// ─────────────────────────────────────────────────────────────────
// SIGN TOKEN
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a JWT access token
 * 
 * EXPRESS EQUIVALENT:
 * const jwt = require('jsonwebtoken');
 * const token = jwt.sign(
 *   { userId: user.id, email: user.email, plan: user.plan },
 *   process.env.JWT_SECRET,
 *   { expiresIn: '7d' }
 * );
 * 
 * @param options - User data to encode in the token
 * @returns JWT token string
 */
export async function signToken(options: TokenOptions): Promise<string> {
  const { userId, email, plan = 'free', teams = [] } = options;
  
  // Calculate expiration time
  const expiresInSeconds = parseExpiresIn(env.JWT_EXPIRES_IN);
  
  // Create the token
  // SignJWT uses builder pattern for configuration
  const token = await new SignJWT({
    email,
    plan,
    teams,
    type: 'access',
  } as TokenPayload)
    // Set the subject (user ID) - standard JWT claim
    .setSubject(userId)
    
    // Set the issuer (who created the token)
    .setIssuer(env.API_URL)
    
    // Set the audience (who the token is for)
    .setAudience(env.FRONTEND_URL)
    
    // Set issued at time (now)
    .setIssuedAt()
    
    // Set expiration time
    .setExpirationTime(`${expiresInSeconds}s`)
    
    // Set the algorithm (HS256 = HMAC-SHA256)
    .setProtectedHeader({ alg: 'HS256' })
    
    // Sign with our secret
    .sign(getSecretKey());
  
  return token;
}

/**
 * Generate a refresh token (longer-lived)
 * Refresh tokens are used to get new access tokens
 */
export async function signRefreshToken(options: TokenOptions): Promise<string> {
  const { userId, email, plan = 'free' } = options;
  
  // Refresh tokens last 30 days
  const token = await new SignJWT({
    email,
    plan,
    type: 'refresh',
  } as TokenPayload)
    .setSubject(userId)
    .setIssuer(env.API_URL)
    .setAudience(env.FRONTEND_URL)
    .setIssuedAt()
    .setExpirationTime('30d')
    .setProtectedHeader({ alg: 'HS256' })
    .sign(getSecretKey());
  
  return token;
}

// ─────────────────────────────────────────────────────────────────
// VERIFY TOKEN
// ─────────────────────────────────────────────────────────────────

/**
 * Verify and decode a JWT token
 * 
 * EXPRESS EQUIVALENT:
 * const jwt = require('jsonwebtoken');
 * try {
 *   const payload = jwt.verify(token, process.env.JWT_SECRET);
 *   console.log(payload.userId);
 * } catch (error) {
 *   console.error('Invalid token');
 * }
 * 
 * @param token - JWT token string
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    // Verify the token signature and decode payload
    const { payload } = await jwtVerify(token, getSecretKey(), {
      // Validate issuer
      issuer: env.API_URL,
      
      // Validate audience
      audience: env.FRONTEND_URL,
    });
    
    // Type assertion - we know the shape of our tokens
    return payload as TokenPayload;
    
  } catch (error) {
    // jose throws specific errors we can handle
    if (error instanceof Error) {
      // Common error types:
      // - JWTExpired: Token has expired
      // - JWTClaimValidationFailed: Issuer/audience mismatch
      // - JWSSignatureVerificationFailed: Invalid signature
      // - JWTInvalid: Malformed token
      
      throw new Error(`Invalid token: ${error.message}`);
    }
    
    throw new Error('Invalid token');
  }
}

/**
 * Decode a token WITHOUT verifying the signature
 * 
 * DANGER: Only use this for debugging or when you don't need security
 * The token could be forged if you don't verify the signature
 * 
 * EXPRESS EQUIVALENT:
 * const jwt = require('jsonwebtoken');
 * const payload = jwt.decode(token); // No verification!
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    // Split the token into parts: header.payload.signature
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return null;
    }
    
    // Decode the payload (middle part)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    
    return payload as TokenPayload;
    
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Check if a token is expired (without full verification)
 * Useful for deciding whether to refresh a token
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  
  if (!payload || !payload.exp) {
    return true;
  }
  
  // exp is in seconds, Date.now() is in milliseconds
  return payload.exp * 1000 < Date.now();
}

/**
 * Extract user ID from token (without verification)
 * Only use when you don't need security (e.g., logging)
 */
export function extractUserId(token: string): string | null {
  const payload = decodeToken(token);
  return payload?.sub || null;
}


