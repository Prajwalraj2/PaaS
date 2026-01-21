// ═══════════════════════════════════════════════════════════════════════════
// Authentication Middleware
// ═══════════════════════════════════════════════════════════════════════════
//
// This middleware protects routes by verifying JWT tokens.
// It extracts the user information and makes it available to route handlers.
//
// EXPRESS EQUIVALENT:
// const jwt = require('jsonwebtoken');
// 
// const authMiddleware = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'No token provided' });
//   }
//   
//   const token = authHeader.split(' ')[1];
//   
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = payload;
//     next();
//   } catch (error) {
//     return res.status(401).json({ error: 'Invalid token' });
//   }
// };
//
// ═══════════════════════════════════════════════════════════════════════════

import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyToken, type TokenPayload } from '../lib/jwt';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

/**
 * User object available in route handlers after authentication
 * 
 * USAGE:
 * app.get('/profile', authMiddleware, (c) => {
 *   const user = c.get('user');  // Access authenticated user
 *   return c.json({ user });
 * });
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  teams: string[];
}

/**
 * Extend Hono's Context to include our user
 * This gives us type safety when accessing c.get('user')
 * 
 * HONO-SPECIFIC:
 * In Express, you'd just do req.user = payload;
 * In Hono, we use c.set('user', payload) and this type declaration
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    token: string;
  }
}

// ─────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

/**
 * Authentication middleware
 * 
 * Verifies the JWT token and attaches user info to the context.
 * Returns 401 Unauthorized if token is missing or invalid.
 * 
 * EXPRESS EQUIVALENT:
 * const authMiddleware = (req, res, next) => { ... };
 * router.use(authMiddleware);
 * 
 * HONO USAGE:
 * // Protect all routes in a group
 * projectRoutes.use('*', authMiddleware);
 * 
 * // Or protect individual routes
 * app.get('/profile', authMiddleware, (c) => { ... });
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  // ─────────────────────────────────────────────────────────────
  // STEP 1: Extract token from Authorization header
  // ─────────────────────────────────────────────────────────────
  
  // Get Authorization header
  // Format: "Bearer <token>"
  //
  // EXPRESS: const authHeader = req.headers.authorization;
  // HONO:    const authHeader = c.req.header('Authorization');
  const authHeader = c.req.header('Authorization');
  
  // Check if header exists and has correct format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Log the attempt (useful for debugging and security monitoring)
    logger.debug({ 
      path: c.req.path,
      method: c.req.method,
    }, 'Auth failed: No token provided');
    
    // Return 401 Unauthorized
    //
    // EXPRESS: return res.status(401).json({ ... });
    // HONO:    throw new HTTPException(401, { message: '...' });
    //          or return c.json({ ... }, 401);
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }
  
  // Extract token (remove "Bearer " prefix)
  const token = authHeader.slice(7); // "Bearer ".length = 7
  
  // ─────────────────────────────────────────────────────────────
  // STEP 2: Verify and decode the token
  // ─────────────────────────────────────────────────────────────
  
  let payload: TokenPayload;
  
  try {
    // Verify token signature and expiration
    // This throws if token is invalid
    payload = await verifyToken(token);
    
  } catch (error) {
    logger.debug({
      path: c.req.path,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Auth failed: Invalid token');
    
    throw new HTTPException(401, {
      message: 'Invalid or expired token',
    });
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 3: Verify user still exists in database
  // ─────────────────────────────────────────────────────────────
  
  // This is important because:
  // - User might have been deleted
  // - User might have been banned
  // - User's plan might have changed
  //
  // You could skip this for performance and rely only on the token,
  // but it's more secure to verify
  
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);
  
  if (!user) {
    logger.warn({
      userId: payload.sub,
      path: c.req.path,
    }, 'Auth failed: User not found');
    
    throw new HTTPException(401, {
      message: 'User not found',
    });
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 4: Attach user to context
  // ─────────────────────────────────────────────────────────────
  
  // Create user object for route handlers
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    teams: payload.teams || [],
  };
  
  // Set user in context (like req.user = user in Express)
  //
  // EXPRESS: req.user = authUser;
  // HONO:    c.set('user', authUser);
  c.set('user', authUser);
  
  // Also store the token (useful for refresh operations)
  c.set('token', token);
  
  // ─────────────────────────────────────────────────────────────
  // STEP 5: Continue to next middleware/handler
  // ─────────────────────────────────────────────────────────────
  
  // EXPRESS: next();
  // HONO:    await next();
  await next();
});

// ─────────────────────────────────────────────────────────────────
// OPTIONAL AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

/**
 * Optional authentication middleware
 * 
 * Like authMiddleware, but doesn't fail if no token is provided.
 * Useful for routes that work for both authenticated and anonymous users.
 * 
 * USAGE:
 * app.get('/posts', optionalAuthMiddleware, (c) => {
 *   const user = c.get('user');  // May be undefined
 *   if (user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 * });
 */
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  // No token? That's fine, just continue
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await next();
    return;
  }
  
  const token = authHeader.slice(7);
  
  try {
    const payload = await verifyToken(token);
    
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        plan: users.plan,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    
    if (user) {
      c.set('user', {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        teams: payload.teams || [],
      });
      c.set('token', token);
    }
    
  } catch {
    // Token is invalid, but that's okay - just continue without user
    logger.debug({ path: c.req.path }, 'Optional auth: Invalid token');
  }
  
  await next();
});

// ─────────────────────────────────────────────────────────────────
// PLAN CHECK MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

/**
 * Factory function to create plan-checking middleware
 * 
 * USAGE:
 * // Require Pro plan
 * app.post('/teams', authMiddleware, requirePlan('pro'), (c) => { ... });
 * 
 * // Require Pro or Enterprise
 * app.post('/teams', authMiddleware, requirePlan(['pro', 'enterprise']), (c) => { ... });
 */
export function requirePlan(plans: string | string[]) {
  const allowedPlans = Array.isArray(plans) ? plans : [plans];
  
  return createMiddleware(async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }
    
    if (!allowedPlans.includes(user.plan)) {
      throw new HTTPException(403, {
        message: `This feature requires a ${allowedPlans.join(' or ')} plan`,
      });
    }
    
    await next();
  });
}

// ─────────────────────────────────────────────────────────────────
// TEAM ROLE MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

/**
 * Factory function to check team membership and role
 * 
 * USAGE:
 * // Require team admin role
 * teamRoutes.delete('/:teamId', requireTeamRole('admin'), (c) => { ... });
 */
export function requireTeamRole(requiredRoles: string | string[]) {
  // Convert to array if single role passed
  const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return createMiddleware(async (c, next) => {
    const user = c.get('user');
    const teamId = c.req.param('teamId');
    
    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }
    
    if (!teamId) {
      throw new HTTPException(400, {
        message: 'Team ID required',
      });
    }
    
    // Check team membership
    // This would need to be implemented based on your team members table
    // For now, we'll check if the team is in the user's teams array from the token
    
    if (!user.teams.includes(teamId)) {
      throw new HTTPException(403, {
        message: 'Not a member of this team',
      });
    }
    
    // TODO: Check actual role from database
    // For now, we log the required roles for future implementation
    // When implemented, query team_members table for user's role in this team
    // and check if it's in allowedRoles
    logger.debug({
      teamId,
      userId: user.id,
      requiredRoles: allowedRoles,
    }, 'Team role check (role verification not yet implemented)');
    
    await next();
  });
}


