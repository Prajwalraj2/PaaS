// ═══════════════════════════════════════════════════════════════════════════
// Global Error Handler Middleware
// ═══════════════════════════════════════════════════════════════════════════
//
// This middleware catches all errors thrown in route handlers
// and returns a consistent error response.
//
// EXPRESS EQUIVALENT:
// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(500).json({ error: 'Internal Server Error' });
// });
//
// ═══════════════════════════════════════════════════════════════════════════

import type { ErrorHandler } from 'hono';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────────
// CUSTOM ERROR CLASS
// ─────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Common error factory functions
export const Errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new AppError(400, 'BAD_REQUEST', message, details),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'Forbidden') =>
    new AppError(403, 'FORBIDDEN', message),

  notFound: (resource: string) =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),

  conflict: (message: string) =>
    new AppError(409, 'CONFLICT', message),

  internal: (message = 'Internal server error') =>
    new AppError(500, 'INTERNAL_ERROR', message),
};

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────────────

export const errorHandler: ErrorHandler = (err, c) => {
  // Log the error
  logger.error({
    err,
    method: c.req.method,
    path: c.req.path,
    requestId: c.get('requestId'),
  }, 'Request error');

  // Handle our custom AppError
  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString(),
      },
    }, err.statusCode as 400 | 401 | 403 | 404 | 409 | 500);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err,
      },
      meta: {
        requestId: c.get('requestId'),
        timestamp: new Date().toISOString(),
      },
    }, 400);
  }

  // Handle unknown errors
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message || 'Unknown error',
    },
    meta: {
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
  }, 500);
};



