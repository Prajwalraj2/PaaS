// ═══════════════════════════════════════════════════════════════════════════
// PaaS API Server - Hono App Configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// This file sets up the Hono app with all middleware and routes.
//
// EXPRESS EQUIVALENT:
// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(morgan('dev'));
// app.use('/api/v1', routes);
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';

// Import routes
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/projects.routes';
import { deploymentRoutes } from './routes/deployments.routes';
import { webhookRoutes } from './routes/webhooks.routes';
import { domainRoutes } from './routes/domains.routes';
import { serviceRoutes } from './routes/services.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';

import { env } from './lib/env';

// ─────────────────────────────────────────────────────────────────
// CREATE HONO APP
// ─────────────────────────────────────────────────────────────────

// Create the main Hono app
// EXPRESS: const app = express();
const app = new Hono();

// ─────────────────────────────────────────────────────────────────
// GLOBAL MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

// Request ID - adds unique ID to each request for tracing
// EXPRESS: app.use(require('express-request-id')());
app.use('*', requestId());

// CORS - Cross-Origin Resource Sharing
// EXPRESS: app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use('*', cors({
  origin: [env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging (only in development)
// EXPRESS: app.use(morgan('dev'));
if (env.NODE_ENV === 'development') {
  app.use('*', honoLogger());
}

// Pretty JSON responses in development
// Makes JSON responses formatted with indentation
app.use('*', prettyJSON());

// Security headers
// EXPRESS: app.use(helmet());
app.use('*', secureHeaders());

// ─────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────

// Health check routes (no auth required)
// EXPRESS: app.use('/health', healthRoutes);
app.route('/health', healthRoutes);

// API v1 routes
// EXPRESS: app.use('/api/v1/auth', authRoutes);
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/projects', projectRoutes);

// Deployment routes (nested under /projects/:projectId/deployments)
// The route file handles the /:projectId/deployments/* paths
app.route('/api/v1/projects', deploymentRoutes);

// Webhook routes (for GitHub auto-deploy, etc.)
// These are PUBLIC endpoints - security via signature verification
app.route('/api/v1/webhooks', webhookRoutes);

// Domain routes (nested under /projects/:projectId/domains)
// Custom domain management with DNS verification
app.route('/api/v1/projects', domainRoutes);

// Service routes (add-on databases: Postgres, Redis, MySQL, MongoDB)
// GET /api/v1/services/supported - list available service types
// Nested routes: /api/v1/projects/:projectId/services/*
app.route('/api/v1/services', serviceRoutes);
app.route('/api/v1/projects', serviceRoutes);

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────

// Global error handler
// EXPRESS: app.use((err, req, res, next) => { ... });
app.onError(errorHandler);

// 404 handler - when no route matches
// EXPRESS: app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
  }, 404);
});

export { app };



