// ═══════════════════════════════════════════════════════════════════════════
// Health Check Routes
// ═══════════════════════════════════════════════════════════════════════════
//
// Health check endpoints for Kubernetes readiness/liveness probes
// and general API status checks.
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.get('/', (req, res) => res.json({ status: 'ok' }));
// module.exports = router;
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';

// Create router
// EXPRESS: const router = express.Router();
const healthRoutes = new Hono();

// ─────────────────────────────────────────────────────────────────
// GET /health - Basic health check
// ─────────────────────────────────────────────────────────────────
// Used by load balancers and Kubernetes liveness probe

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'paas-api',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /health/ready - Readiness check
// ─────────────────────────────────────────────────────────────────
// Used by Kubernetes readiness probe
// Checks if all dependencies (DB, Redis) are available

healthRoutes.get('/ready', async (c) => {
  const checks = {
    database: false,
    redis: false,
  };

  // TODO: Add actual health checks when services are connected
  // try {
  //   await db.execute(sql`SELECT 1`);
  //   checks.database = true;
  // } catch (e) {
  //   checks.database = false;
  // }

  // For now, return healthy (we'll add real checks later)
  checks.database = true;
  checks.redis = true;

  const isHealthy = Object.values(checks).every(Boolean);

  return c.json({
    status: isHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  }, isHealthy ? 200 : 503);
});

// ─────────────────────────────────────────────────────────────────
// GET /health/live - Liveness check
// ─────────────────────────────────────────────────────────────────
// Simple check that the process is running

healthRoutes.get('/live', (c) => {
  return c.json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { healthRoutes };



