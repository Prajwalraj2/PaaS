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
import { checkRedisHealth } from '../lib/redis';
import { checkQueueHealth } from '../queue/queue.utils';

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
  // Check Redis health
  const redisHealth = await checkRedisHealth();
  
  const checks = {
    database: true, // TODO: Add actual DB health check
    redis: redisHealth.connected,
  };

  const isHealthy = Object.values(checks).every(Boolean);

  return c.json({
    status: isHealthy ? 'ready' : 'not_ready',
    checks,
    redisLatency: redisHealth.latency,
    timestamp: new Date().toISOString(),
  }, isHealthy ? 200 : 503);
});

// ─────────────────────────────────────────────────────────────────
// GET /health/queues - Queue status
// ─────────────────────────────────────────────────────────────────
// Returns status of all job queues

healthRoutes.get('/queues', async (c) => {
  const queueHealth = await checkQueueHealth();
  
  return c.json({
    status: queueHealth.healthy ? 'healthy' : 'unhealthy',
    queues: queueHealth.queues,
    error: queueHealth.error,
    timestamp: new Date().toISOString(),
  }, queueHealth.healthy ? 200 : 503);
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



