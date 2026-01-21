// ═══════════════════════════════════════════════════════════════════════════
// Authentication Routes
// ═══════════════════════════════════════════════════════════════════════════
//
// Handles user registration, login, logout, and OAuth flows.
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.post('/register', authController.register);
// router.post('/login', authController.login);
// router.get('/me', authMiddleware, authController.me);
// module.exports = router;
//
// ENDPOINTS:
// POST   /auth/register     - Create new account
// POST   /auth/login        - Login with email/password
// GET    /auth/me           - Get current user (protected)
// POST   /auth/logout       - Logout (client should discard token)
// POST   /auth/refresh      - Refresh access token
// PATCH  /auth/profile      - Update profile (protected)
// POST   /auth/password     - Change password (protected)
// GET    /auth/github       - Initiate GitHub OAuth
// GET    /auth/github/callback - GitHub OAuth callback
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { verifyToken } from '../lib/jwt';
import { HTTPException } from 'hono/http-exception';

// Create router
// EXPRESS: const router = express.Router();
const authRoutes = new Hono();

// ─────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────
// Using Zod for request body validation
// EXPRESS EQUIVALENT: Using express-validator or Joi
//
// const { body, validationResult } = require('express-validator');
// router.post('/register',
//   body('email').isEmail(),
//   body('password').isLength({ min: 8 }),
//   body('name').isLength({ min: 2 }),
//   (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
//     next();
//   },
//   authController.register
// );

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  avatarUrl: z.string().url('Invalid URL').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/register - Register new user
// ─────────────────────────────────────────────────────────────────
//
// Request body:
// {
//   "email": "user@example.com",
//   "password": "securePassword123",
//   "name": "John Doe"
// }
//
// Response (201):
// {
//   "success": true,
//   "data": {
//     "user": { id, email, name, plan, ... },
//     "token": "eyJhbGc...",
//     "refreshToken": "eyJhbGc..."
//   }
// }
//
// EXPRESS EQUIVALENT:
// router.post('/register', validateBody(registerSchema), async (req, res) => {
//   const result = await authController.register(req.body);
//   res.status(201).json({ success: true, data: result });
// });

authRoutes.post(
  '/register',
  zValidator('json', registerSchema),
  async (c) => {
    // Get validated body (Zod has already validated it)
    // EXPRESS: const { email, password, name } = req.body;
    const body = c.req.valid('json');

    // Call controller with validated input
    const result = await authController.register(body);

    // Return success response with 201 Created
    // EXPRESS: res.status(201).json({ ... });
    return c.json({
      success: true,
      data: result,
    }, 201);
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/login - Login user
// ─────────────────────────────────────────────────────────────────
//
// Request body:
// {
//   "email": "user@example.com",
//   "password": "securePassword123"
// }
//
// Response (200):
// {
//   "success": true,
//   "data": {
//     "user": { id, email, name, plan, ... },
//     "token": "eyJhbGc...",
//     "refreshToken": "eyJhbGc..."
//   }
// }
//
// EXPRESS EQUIVALENT:
// router.post('/login', validateBody(loginSchema), async (req, res) => {
//   const result = await authController.login(req.body);
//   res.json({ success: true, data: result });
// });

authRoutes.post(
  '/login',
  zValidator('json', loginSchema),
  async (c) => {
    const body = c.req.valid('json');
    const result = await authController.login(body);

    return c.json({
      success: true,
      data: result,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /auth/me - Get current user
// ─────────────────────────────────────────────────────────────────
//
// Headers:
//   Authorization: Bearer <token>
//
// Response (200):
// {
//   "success": true,
//   "data": { id, email, name, plan, avatarUrl, createdAt, ... }
// }
//
// EXPRESS EQUIVALENT:
// router.get('/me', authMiddleware, async (req, res) => {
//   const user = await authController.getCurrentUser(req.user.id);
//   res.json({ success: true, data: user });
// });

authRoutes.get('/me', authMiddleware, async (c) => {
  // Get user from context (set by authMiddleware)
  // EXPRESS: const userId = req.user.id;
  const authUser = c.get('user');
  
  // Get full user profile from database
  const user = await authController.getCurrentUser(authUser.id);

  return c.json({
    success: true,
    data: user,
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/logout - Logout user
// ─────────────────────────────────────────────────────────────────
//
// Note: With JWT, logout is primarily client-side (discard the token).
// This endpoint exists for:
// 1. Clearing HTTP-only cookies (if used)
// 2. Invalidating refresh tokens in database (TODO)
// 3. Logging the logout event
//
// Response (200):
// {
//   "success": true,
//   "message": "Logged out successfully"
// }

authRoutes.post('/logout', authMiddleware, async (c) => {
  // Get user for logging purposes
  const user = c.get('user');
  
  // TODO: If using refresh token rotation, invalidate the refresh token here
  // await tokenService.revokeRefreshToken(user.id);
  
  // Log the logout event (token invalidation happens client-side)
  // In production, you might want to add the token to a blacklist
  // or use short-lived tokens with refresh token rotation
  
  // Placeholder: log the logout
  void user; // Acknowledge we have the user for future use

  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/refresh - Refresh access token
// ─────────────────────────────────────────────────────────────────
//
// Request body:
// {
//   "refreshToken": "eyJhbGc..."
// }
//
// Response (200):
// {
//   "success": true,
//   "data": {
//     "token": "eyJhbGc..." (new access token)
//   }
// }

authRoutes.post(
  '/refresh',
  zValidator('json', refreshTokenSchema),
  async (c) => {
    const { refreshToken } = c.req.valid('json');

    try {
      // Verify the refresh token
      const payload = await verifyToken(refreshToken);
      
      // Check if it's actually a refresh token
      if (payload.type !== 'refresh') {
        throw new HTTPException(401, {
          message: 'Invalid refresh token',
        });
      }
      
      // Generate new access token
      const result = await authController.refreshToken(payload.sub);

      return c.json({
        success: true,
        data: result,
      });
      
    } catch (error) {
      throw new HTTPException(401, {
        message: 'Invalid or expired refresh token',
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// PATCH /auth/profile - Update user profile
// ─────────────────────────────────────────────────────────────────
//
// Headers:
//   Authorization: Bearer <token>
//
// Request body:
// {
//   "name": "New Name",         // optional
//   "avatarUrl": "https://..."  // optional
// }
//
// Response (200):
// {
//   "success": true,
//   "data": { updated user profile }
// }

authRoutes.patch(
  '/profile',
  authMiddleware,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const authUser = c.get('user');
    const body = c.req.valid('json');

    const user = await authController.updateProfile(authUser.id, body);

    return c.json({
      success: true,
      data: user,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /auth/password - Change password
// ─────────────────────────────────────────────────────────────────
//
// Headers:
//   Authorization: Bearer <token>
//
// Request body:
// {
//   "currentPassword": "oldPassword123",
//   "newPassword": "newSecurePassword456"
// }
//
// Response (200):
// {
//   "success": true,
//   "message": "Password changed successfully"
// }

authRoutes.post(
  '/password',
  authMiddleware,
  zValidator('json', changePasswordSchema),
  async (c) => {
    const authUser = c.get('user');
    const { currentPassword, newPassword } = c.req.valid('json');

    await authController.changePassword(authUser.id, currentPassword, newPassword);

    return c.json({
      success: true,
      message: 'Password changed successfully',
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /auth/github - GitHub OAuth initiation
// ─────────────────────────────────────────────────────────────────
//
// Redirects user to GitHub OAuth authorization page
// TODO: Implement GitHub OAuth

authRoutes.get('/github', async (c) => {
  // TODO: Implement GitHub OAuth
  // 1. Generate state parameter for CSRF protection
  // 2. Build GitHub authorization URL
  // 3. Redirect user to GitHub
  
  return c.json({
    success: false,
    message: 'GitHub OAuth not implemented yet',
    hint: 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env',
  }, 501);
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/github/callback - GitHub OAuth callback
// ─────────────────────────────────────────────────────────────────
//
// GitHub redirects here after user authorizes
// TODO: Implement GitHub OAuth callback

authRoutes.get('/github/callback', async (c) => {
  // TODO: Implement GitHub OAuth callback
  // 1. Verify state parameter
  // 2. Exchange code for access token
  // 3. Get user info from GitHub
  // 4. Create or update user in database
  // 5. Generate JWT token
  // 6. Redirect to frontend with token
  
  return c.json({
    success: false,
    message: 'GitHub OAuth callback not implemented yet',
  }, 501);
});

export { authRoutes };

