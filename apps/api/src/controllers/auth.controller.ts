// ═══════════════════════════════════════════════════════════════════════════
// Auth Controller - Business Logic for Authentication
// ═══════════════════════════════════════════════════════════════════════════
//
// This controller handles the business logic for authentication:
// - Validating input
// - Calling services
// - Handling errors
// - Formatting responses
//
// EXPRESS EQUIVALENT:
// exports.register = async (req, res, next) => {
//   try {
//     const { email, password, name } = req.body;
//     // ... business logic
//     res.status(201).json({ data: user });
//   } catch (error) {
//     next(error);
//   }
// };
//
// WHY SEPARATE CONTROLLER?
// - Routes define WHAT endpoints exist
// - Controllers define HOW to handle requests
// - Services define WHERE data comes from
// - This separation makes code more maintainable and testable
//
// ═══════════════════════════════════════════════════════════════════════════

import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as authService from '../services/auth.service';
import { hashPassword, verifyPassword, validatePassword } from '../lib/password';
import { signToken, signRefreshToken } from '../lib/jwt';
import { logger } from '../lib/logger';
import type { AuthUser } from '../middleware/auth.middleware';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  user: authService.SafeUser;
  token: string;
  refreshToken?: string;
}

// ─────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────

/**
 * Register a new user account
 * 
 * Flow:
 * 1. Validate password strength
 * 2. Check if email already exists
 * 3. Hash the password
 * 4. Create user in database
 * 5. Generate JWT token
 * 6. Return user and token
 * 
 * EXPRESS EQUIVALENT:
 * exports.register = async (req, res, next) => {
 *   const { email, password, name } = req.body;
 *   
 *   // Check if exists
 *   const existing = await User.findOne({ email });
 *   if (existing) return res.status(409).json({ error: 'Email already registered' });
 *   
 *   // Hash password
 *   const hash = await bcrypt.hash(password, 12);
 *   
 *   // Create user
 *   const user = await User.create({ email, passwordHash: hash, name });
 *   
 *   // Generate token
 *   const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
 *   
 *   res.status(201).json({ user, token });
 * };
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { email, password, name } = input;
  
  // ─────────────────────────────────────────────────────────────
  // STEP 1: Validate password strength
  // ─────────────────────────────────────────────────────────────
  
  const passwordValidation = validatePassword(password);
  
  if (!passwordValidation.isValid) {
    logger.debug({ email, errors: passwordValidation.errors }, 'Registration failed: weak password');
    
    throw new HTTPException(400, {
      message: passwordValidation.errors.join(', '),
    });
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 2: Check if email already exists
  // ─────────────────────────────────────────────────────────────
  
  const existingUser = await authService.findUserByEmail(email);
  
  if (existingUser) {
    logger.debug({ email }, 'Registration failed: email already exists');
    
    throw new HTTPException(409, {
      message: 'An account with this email already exists',
    });
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 3: Hash the password
  // ─────────────────────────────────────────────────────────────
  
  // NEVER store plain text passwords!
  // bcrypt hash includes the salt, so we don't need to store it separately
  const passwordHash = await hashPassword(password);
  
  // ─────────────────────────────────────────────────────────────
  // STEP 4: Create user in database
  // ─────────────────────────────────────────────────────────────
  
  const user = await authService.createUser({
    email,
    passwordHash,
    name,
  });
  
  logger.info({ userId: user.id, email }, 'New user registered');
  
  // ─────────────────────────────────────────────────────────────
  // STEP 5: Generate JWT token
  // ─────────────────────────────────────────────────────────────
  
  const token = await signToken({
    userId: user.id,
    email: user.email,
    plan: user.plan,
  });
  
  const refreshToken = await signRefreshToken({
    userId: user.id,
    email: user.email,
    plan: user.plan,
  });
  
  // ─────────────────────────────────────────────────────────────
  // STEP 6: Return user and token
  // ─────────────────────────────────────────────────────────────
  
  return {
    user: authService.toSafeUser(user),
    token,
    refreshToken,
  };
}

// ─────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────

/**
 * Login with email and password
 * 
 * Flow:
 * 1. Find user by email
 * 2. Verify password
 * 3. Generate JWT token
 * 4. Return user and token
 * 
 * SECURITY NOTES:
 * - Always use the same error message for "user not found" and "wrong password"
 *   This prevents attackers from knowing which emails are registered
 * - Use timing-safe password comparison (bcrypt.compare does this)
 * - Rate limit login attempts (TODO: implement)
 * 
 * EXPRESS EQUIVALENT:
 * exports.login = async (req, res) => {
 *   const { email, password } = req.body;
 *   
 *   const user = await User.findOne({ email });
 *   if (!user) return res.status(401).json({ error: 'Invalid credentials' });
 *   
 *   const isValid = await bcrypt.compare(password, user.passwordHash);
 *   if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
 *   
 *   const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
 *   res.json({ user, token });
 * };
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const { email, password } = input;
  
  // Generic error message to prevent email enumeration
  const invalidCredentialsError = new HTTPException(401, {
    message: 'Invalid email or password',
  });
  
  // ─────────────────────────────────────────────────────────────
  // STEP 1: Find user by email
  // ─────────────────────────────────────────────────────────────
  
  const user = await authService.findUserByEmail(email);
  
  if (!user) {
    // Log for debugging but don't reveal to user
    logger.debug({ email }, 'Login failed: user not found');
    throw invalidCredentialsError;
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 2: Check if user has a password (might be OAuth-only)
  // ─────────────────────────────────────────────────────────────
  
  if (!user.passwordHash) {
    // User signed up with OAuth, no password set
    logger.debug({ email }, 'Login failed: OAuth-only account');
    
    throw new HTTPException(401, {
      message: 'This account uses GitHub login. Please sign in with GitHub.',
    });
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 3: Verify password
  // ─────────────────────────────────────────────────────────────
  
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  
  if (!isPasswordValid) {
    logger.debug({ email }, 'Login failed: invalid password');
    throw invalidCredentialsError;
  }
  
  // ─────────────────────────────────────────────────────────────
  // STEP 4: Generate JWT token
  // ─────────────────────────────────────────────────────────────
  
  const token = await signToken({
    userId: user.id,
    email: user.email,
    plan: user.plan,
  });
  
  const refreshToken = await signRefreshToken({
    userId: user.id,
    email: user.email,
    plan: user.plan,
  });
  
  logger.info({ userId: user.id, email }, 'User logged in');
  
  // ─────────────────────────────────────────────────────────────
  // STEP 5: Return user and token
  // ─────────────────────────────────────────────────────────────
  
  return {
    user: authService.toSafeUser(user),
    token,
    refreshToken,
  };
}

// ─────────────────────────────────────────────────────────────────
// GET CURRENT USER
// ─────────────────────────────────────────────────────────────────

/**
 * Get the current authenticated user's full profile
 * 
 * @param userId - User ID from JWT token
 * @returns User profile
 */
export async function getCurrentUser(userId: string): Promise<authService.SafeUser> {
  const user = await authService.findUserById(userId);
  
  if (!user) {
    throw new HTTPException(404, {
      message: 'User not found',
    });
  }
  
  return authService.toSafeUser(user);
}

// ─────────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────────

/**
 * Refresh the access token using a refresh token
 * 
 * @param userId - User ID from refresh token
 * @returns New access token
 */
export async function refreshToken(userId: string): Promise<{ token: string }> {
  const user = await authService.findUserById(userId);
  
  if (!user) {
    throw new HTTPException(401, {
      message: 'Invalid refresh token',
    });
  }
  
  const token = await signToken({
    userId: user.id,
    email: user.email,
    plan: user.plan,
  });
  
  logger.debug({ userId }, 'Token refreshed');
  
  return { token };
}

// ─────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────────

/**
 * Update user profile information
 * 
 * @param userId - User ID
 * @param data - Profile data to update
 * @returns Updated user profile
 */
export async function updateProfile(
  userId: string,
  data: { name?: string; avatarUrl?: string }
): Promise<authService.SafeUser> {
  const user = await authService.updateUser(userId, data);
  
  if (!user) {
    throw new HTTPException(404, {
      message: 'User not found',
    });
  }
  
  logger.info({ userId }, 'User profile updated');
  
  return authService.toSafeUser(user);
}

// ─────────────────────────────────────────────────────────────────
// CHANGE PASSWORD
// ─────────────────────────────────────────────────────────────────

/**
 * Change user's password
 * 
 * @param userId - User ID
 * @param currentPassword - Current password for verification
 * @param newPassword - New password to set
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get user
  const user = await authService.findUserById(userId);
  
  if (!user) {
    throw new HTTPException(404, {
      message: 'User not found',
    });
  }
  
  // Check if user has a password (might be OAuth-only)
  if (!user.passwordHash) {
    throw new HTTPException(400, {
      message: 'Cannot change password for OAuth-only accounts',
    });
  }
  
  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isValid) {
    throw new HTTPException(401, {
      message: 'Current password is incorrect',
    });
  }
  
  // Validate new password
  const validation = validatePassword(newPassword);
  
  if (!validation.isValid) {
    throw new HTTPException(400, {
      message: validation.errors.join(', '),
    });
  }
  
  // Hash and save new password
  const newHash = await hashPassword(newPassword);
  await authService.updatePassword(userId, newHash);
  
  logger.info({ userId }, 'User password changed');
}


