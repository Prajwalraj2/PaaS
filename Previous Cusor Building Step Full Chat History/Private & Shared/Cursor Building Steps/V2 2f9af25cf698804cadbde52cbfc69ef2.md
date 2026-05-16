# V2

---

Me:

```bash
Ok I have pushed the code to github

the command I followed

git init

git add .

git commit -m "feat: Initial PaaS platform - Control Plane APIs

- Auth API (register, login, JWT, profile)
- Projects API (CRUD, environment variables)
- Deployments API (trigger, rollback, cancel, logs)
- Webhooks API (GitHub auto-deploy)
- Domains API (custom domains, DNS verification)
- Services API (PostgreSQL, Redis, MySQL, MongoDB)
- Supabase database integration
- Monorepo setup with Turborepo + pnpm"

git remote add origin https://github.com/Prajwalraj2/PaaS.git

git checkout -b v1

git push -u origin v1
```

- Reply
    
    ---
    
    Excellent! 🎉 Your code is now on GitHub at: [https://github.com/Prajwalraj2/PaaS](https://github.com/Prajwalraj2/PaaS) (branch: `v1`)
    
    ---
    
    ## ✅ What We've Built So Far
    
    | Component | Status |
    | --- | --- |
    | **Auth API** | ✅ Complete |
    | **Projects API** | ✅ Complete |
    | **Deployments API** | ✅ Complete |
    | **Webhooks API** | ✅ Complete |
    | **Domains API** | ✅ Complete |
    | **Services API** | ✅ Complete |
    | **Supabase Integration** | ✅ Complete |
    | **GitHub Repo** | ✅ Pushed to v1 branch |
    
    ---
    
    ## 🎯 Next: Build Worker
    
    Now we're ready for the **Build Worker** - the heart of the PaaS that:
    
    1. **Pulls code** from GitHub
    2. **Builds Docker images** using Nixpacks or Dockerfile
    3. **Pushes images** to container registry
    4. **Deploys** to Kubernetes
    5. **Streams build logs** in real-time
    
    ---
    
    ### Build Worker Architecture
    
    ```
    Deployment Created (status: queued)
            ↓
    Build Worker picks up job from queue (BullMQ/Redis)
            ↓
    Clone repository from GitHub
            ↓
    Detect build type (Nixpacks / Dockerfile)
            ↓
    Build Docker image
            ↓
    Push to registry
            ↓
    Deploy to Kubernetes
            ↓
    Update deployment status → "live"
    
    ```
    
    ---
    
    **Ready to start implementing the Build Worker?**
    

#### Build Worker Implementation

---

Me:

```bash
Ok lets first understand its implementation

How are we going to implement it

What are the file/code changes we are going to do - create / update  and all

how the whole thing are going to work

Is there anything we will need to steup locally

You already know -> I am oon windows laptop -> developing this application locally

Lets first understand the whole implementation of it
```

- Reply
    
    ---
    
    Great question! Let's understand the Build Worker implementation thoroughly before coding.
    
    ---
    
    ## 🏗️ Build Worker - Complete Implementation Plan
    
    ---
    
    ### 1. What is the Build Worker?
    
    The Build Worker is a **background service** that:
    
    - Listens to a **job queue** (Redis + BullMQ)
    - Picks up deployment jobs
    - Builds Docker images from user code
    - Deploys to Kubernetes (or simulates locally)
    
    ---
    
    ### 2. Architecture Overview
    
    ```
    ┌─────────────────────────────────────────────────────────────────┐
    │                         API SERVER                               │
    │  (Creates deployment → Adds job to Redis queue)                  │
    └─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                      REDIS (BullMQ Queue)                        │
    │  Queue: "build-jobs"                                             │
    │  Job: { deploymentId, projectId, gitUrl, branch, commitSha }     │
    └─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                       BUILD WORKER                               │
    │                                                                  │
    │  1. Pick job from queue                                          │
    │  2. Clone git repository                                         │
    │  3. Detect build type (Nixpacks/Dockerfile)                      │
    │  4. Build Docker image                                           │
    │  5. Push to registry                                             │
    │  6. Deploy to K8s (or simulate)                                  │
    │  7. Update deployment status                                     │
    │  8. Stream logs to database                                      │
    └─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    CONTAINER REGISTRY                            │
    │  (Docker Hub / Local Registry / AWS ECR)                         │
    └─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                      KUBERNETES                                  │
    │  (Deployment, Service, Ingress created)                          │
    └─────────────────────────────────────────────────────────────────┘
    
    ```
    
    ---
    
    ### 3. Files to Create/Update
    
    ```
    apps/
    ├── api/
    │   └── src/
    │       ├── queue/
    │       │   ├── index.ts              # NEW: Queue connection setup
    │       │   ├── build.queue.ts        # NEW: Build job queue definition
    │       │   └── build.producer.ts     # NEW: Add jobs to queue
    │       │
    │       └── index.ts                  # UPDATE: Start queue on server start
    │
    ├── worker/                           # NEW: Entire folder
    │   ├── package.json                  # Worker dependencies
    │   ├── tsconfig.json                 # TypeScript config
    │   └── src/
    │       ├── index.ts                  # Worker entry point
    │       ├── processor.ts              # Job processor (main logic)
    │       ├── steps/
    │       │   ├── clone.ts              # Step 1: Clone git repo
    │       │   ├── detect.ts             # Step 2: Detect build type
    │       │   ├── build.ts              # Step 3: Build Docker image
    │       │   ├── push.ts               # Step 4: Push to registry
    │       │   └── deploy.ts             # Step 5: Deploy to K8s
    │       ├── utils/
    │       │   ├── docker.ts             # Docker commands wrapper
    │       │   ├── git.ts                # Git commands wrapper
    │       │   └── logger.ts             # Build log streaming
    │       └── types.ts                  # Type definitions
    │
    infrastructure/
    └── docker/
        └── docker-compose.yml            # UPDATE: Add Redis if not present
    
    ```
    
    ---
    
    ### 4. Build Process Flow (Step by Step)
    
    ```
    ┌────────────────────────────────────────────────────────────────┐
    │ STEP 1: CLONE REPOSITORY                                        │
    ├────────────────────────────────────────────────────────────────┤
    │ • Create temp directory: /tmp/builds/{deploymentId}            │
    │ • git clone --depth 1 --branch {branch} {repoUrl}              │
    │ • cd into project root directory                               │
    │ • Log: "Cloning repository..."                                  │
    └────────────────────────────────────────────────────────────────┘
                                  ↓
    ┌────────────────────────────────────────────────────────────────┐
    │ STEP 2: DETECT BUILD TYPE                                       │
    ├────────────────────────────────────────────────────────────────┤
    │ Check in order:                                                 │
    │ • Dockerfile exists? → Use Docker build                        │
    │ • package.json? → Node.js (Nixpacks)                           │
    │ • requirements.txt? → Python (Nixpacks)                        │
    │ • go.mod? → Go (Nixpacks)                                      │
    │ • Cargo.toml? → Rust (Nixpacks)                                │
    │ • Log: "Detected: Node.js application"                          │
    └────────────────────────────────────────────────────────────────┘
                                  ↓
    ┌────────────────────────────────────────────────────────────────┐
    │ STEP 3: BUILD DOCKER IMAGE                                      │
    ├────────────────────────────────────────────────────────────────┤
    │ Option A - Dockerfile:                                          │
    │   docker build -t {registry}/{project}:{commitSha} .           │
    │                                                                 │
    │ Option B - Nixpacks:                                            │
    │   nixpacks build . --name {registry}/{project}:{commitSha}     │
    │                                                                 │
    │ • Stream build output to logs                                   │
    │ • Log: "Building image... Step 1/10..."                         │
    └────────────────────────────────────────────────────────────────┘
                                  ↓
    ┌────────────────────────────────────────────────────────────────┐
    │ STEP 4: PUSH TO REGISTRY                                        │
    ├────────────────────────────────────────────────────────────────┤
    │ docker push {registry}/{project}:{commitSha}                   │
    │ • Log: "Pushing image to registry..."                           │
    │ • Update deployment.imageTag in database                        │
    └────────────────────────────────────────────────────────────────┘
                                  ↓
    ┌────────────────────────────────────────────────────────────────┐
    │ STEP 5: DEPLOY TO KUBERNETES                                    │
    ├────────────────────────────────────────────────────────────────┤
    │ • Create/Update Deployment manifest                             │
    │ • Create/Update Service manifest                                │
    │ • Create/Update Ingress manifest                                │
    │ • Apply to cluster: kubectl apply -f                            │
    │ • Wait for rollout: kubectl rollout status                      │
    │ • Log: "Deployment live!"                                       │
    └────────────────────────────────────────────────────────────────┘
                                  ↓
    ┌────────────────────────────────────────────────────────────────┐
    │ STEP 6: UPDATE STATUS                                           │
    ├────────────────────────────────────────────────────────────────┤
    │ • deployment.buildStatus = "success"                            │
    │ • deployment.deployStatus = "live"                              │
    │ • deployment.isCurrent = true                                   │
    │ • project.status = "running"                                    │
    │ • Cleanup temp directory                                        │
    └────────────────────────────────────────────────────────────────┘
    
    ```
    
    ---
    
    ### 5. Local Setup Requirements (Windows)
    
    | Requirement | Purpose | Installation |
    | --- | --- | --- |
    | **Docker Desktop** | Build & run containers | [Download](https://www.docker.com/products/docker-desktop/) |
    | **Git** | Clone repositories | Already installed (you're using it) |
    | **Redis** | Job queue | Via Docker (already in docker-compose) |
    | **Nixpacks** (optional) | Auto-detect & build | `cargo install nixpacks` or Docker |
    
    ---
    
    ### 6. Two Modes of Operation
    
    ### **Mode A: Full Mode (with Docker + K8s)**
    
    - Requires Docker Desktop running
    - Requires Kubernetes enabled in Docker Desktop (or Rancher Desktop)
    - Actually builds and deploys containers
    
    ### **Mode B: Simulation Mode (for development)**
    
    - No Docker required
    - Simulates build steps with delays
    - Updates database status
    - Good for testing the flow without heavy setup
    
    **I recommend starting with Mode B (simulation) to test the flow, then enable Mode A when ready.**
    
    ---
    
    ### 7. Technology Choices
    
    | Component | Technology | Why |
    | --- | --- | --- |
    | **Job Queue** | BullMQ + Redis | Industry standard, reliable, supports retries |
    | **Build Tool** | Nixpacks / Docker | Nixpacks auto-detects languages, Docker for custom |
    | **Process Execution** | Node.js `child_process` | Run shell commands (git, docker) |
    | **Logging** | Stream to database | Real-time build logs in UI |
    
    ---
    
    ### 8. Dependencies to Install
    
    ```json
    // apps/worker/package.json
    {
      "dependencies": {
        "bullmq": "^5.0.0",        // Job queue
        "ioredis": "^5.0.0",       // Redis client
        "drizzle-orm": "...",      // Database (shared)
        "postgres": "...",         // DB driver (shared)
        "simple-git": "^3.0.0",    // Git operations
        "dockerode": "^4.0.0",     // Docker API (optional)
        "pino": "...",             // Logging
        "dotenv": "...",           // Env vars
        "nanoid": "..."            // IDs
      }
    }
    
    ```
    
    ---
    
    ### 9. How Jobs Flow
    
    ```
    1. User clicks "Deploy" or GitHub webhook fires
            ↓
    2. API creates deployment record (status: queued)
            ↓
    3. API adds job to Redis queue:
       {
         deploymentId: "uuid",
         projectId: "uuid",
         gitRepoUrl: "<https://github.com/user/repo>",
         gitBranch: "main",
         commitSha: "abc123",
         buildCommand: "npm run build",
         startCommand: "npm start"
       }
            ↓
    4. Build Worker picks up job
            ↓
    5. Worker executes build steps, streaming logs
            ↓
    6. Worker updates deployment status on completion/failure
    
    ```
    
    ---
    
    ### 10. Summary - What We'll Build
    
    | Phase | What | Files |
    | --- | --- | --- |
    | **Phase 1** | Queue setup in API | `apps/api/src/queue/*` |
    | **Phase 2** | Worker service | `apps/worker/*` |
    | **Phase 3** | Build steps | `apps/worker/src/steps/*` |
    | **Phase 4** | Integration | Connect everything |
    
    ---
    
    ### Questions Before We Start:
    
    1. **Do you have Docker Desktop installed?** (Required for actual builds)
    2. **Should we start with Simulation Mode?** (Recommended for initial testing)
    3. **Is your Redis container running?** (From docker-compose)
    
    Let me know, and we'll start implementing! 🚀
    

Me:

```bash

Ok it looks good.

We had discuss initiallly as well @docs/01-paas-overview.md @docs/02-technical-deep-dive.md 
You can take reference from here as well if you want.

Yes I do have docker desktop - installed locally in my laptop

And I have made the redis running here
@powershell (88-121) 

And yes as you suggested -> as of now we can go with the Simulation mode 
```

- Reply
    
    ---
    
    ---
    
    Dependencies installed. Now let's verify the setup by starting both the API and Worker. First, let me check if there's already an API running:
    
    Good, no servers currently running. Let me start both the API and Worker. First, let me update the todo:
    
    ---
    
    ## ✅ Build Worker Implementation Complete!
    
    I've successfully implemented the Build Worker with **Simulation Mode**. Here's a summary of what was created:
    
    ---
    
    ### 📁 Files Created/Updated
    
    ### **New Worker App (`apps/worker/`)**
    
    | File | Purpose |
    | --- | --- |
    | `package.json` | Worker dependencies (BullMQ, simple-git, drizzle, etc.) |
    | `tsconfig.json` | TypeScript configuration |
    | `src/index.ts` | Entry point - starts worker, handles shutdown |
    | `src/processor.ts` | Main job processor - orchestrates build pipeline |
    | `src/types.ts` | Type definitions (BuildJobData, BuildContext, etc.) |
    | `src/lib/env.ts` | Environment variables with defaults |
    | `src/lib/logger.ts` | Pino logger configuration |
    | `src/lib/redis.ts` | Redis connection for BullMQ |
    | `src/db/index.ts` | Database connection for status updates |
    | `src/steps/clone.ts` | Step 1: Clone repository |
    | `src/steps/detect.ts` | Step 2: Detect app type (Node.js, Python, etc.) |
    | `src/steps/build.ts` | Step 3: Build Docker image |
    | `src/steps/push.ts` | Step 4: Push to registry |
    | `src/steps/deploy.ts` | Step 5: Deploy to K8s |
    | `src/utils/log-helper.ts` | Build log utilities |
    | `src/utils/db-updater.ts` | Database status updates |
    
    ### **API Queue Infrastructure (`apps/api/src/queue/`)**
    
    | File | Purpose |
    | --- | --- |
    | `index.ts` | Queue exports |
    | `build.queue.ts` | BullMQ queue definition |
    | `build.producer.ts` | Functions to add jobs |
    | `queue.utils.ts` | Queue management utilities |
    
    ### **Updated API Files**
    
    | File | Changes |
    | --- | --- |
    | `lib/redis.ts` | **NEW** - Redis connection setup |
    | `routes/health.routes.ts` | Added `/health/queues` endpoint |
    | `controllers/deployments.controller.ts` | Now adds jobs to queue |
    | `services/webhooks.service.ts` | Now adds jobs to queue |
    | `package.json` (root) | Added `dev:worker` script |
    
    ---
    
    ### 🚀 How to Run
    
    **Terminal 1 - Start API:**
    
    ```powershell
    pnpm dev:api
    ```
    
    **Terminal 2 - Start Worker:**
    
    ```powershell
    pnpm dev:worker
    ```
    
    ---
    
    ### 🔄 The Flow
    
    ```
    1. User clicks Deploy (or GitHub webhook fires)
             ↓
    2. API creates deployment record (status: queued)
             ↓
    3. API adds job to Redis queue (BullMQ)
             ↓
    4. Worker picks up job from queue
             ↓
    5. Worker runs build pipeline:
       • Clone repo (simulated)
       • Detect app type (simulated)
       • Build Docker image (simulated)
       • Push to registry (simulated)
       • Deploy to K8s (simulated)
             ↓
    6. Worker updates database with status & logs
             ↓
    7. Deployment marked as "live"
    ```
    
    ---
    
    ### ⚙️ Testing the Flow
    
    1. Start both API and Worker (in separate terminals)
    2. Trigger a deployment via API:
        
        ```
        POST <http://localhost:8082/api/v1/projects/:projectId/deployments>
        Authorization: Bearer <your-token>
        ```
        
    3. Watch the Worker terminal for build logs
    4. Check deployment status via API:
        
        ```
        GET <http://localhost:8082/api/v1/projects/:projectId/deployments/:deploymentId>
        GET <http://localhost:8082/api/v1/projects/:projectId/deployments/:deploymentId/logs>
        ```
        
    
    ---
    
    ### 🎮 Simulation Mode
    
    The Worker starts in **Simulation Mode** by default:
    
    - No Docker required
    - Build steps are simulated with delays
    - Database is updated with realistic status
    - Build logs are generated
    
    To disable simulation (when ready for real Docker builds):
    
    ```
    SIMULATION_MODE=false
    ```
    
    ---
    
    Would you like me to start both services so you can test the complete flow?
    

**AI Steps:**

- Created `apps\api\src\lib\redis.ts`
    
    ---
    
    ```sql
    // ═══════════════════════════════════════════════════════════════════════════
    // Redis Connection Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This file sets up the Redis connection for:
    // - BullMQ job queue
    // - Caching (future)
    // - Session storage (future)
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import Redis, { type RedisOptions } from 'ioredis';
    import { env } from './env';
    import { logger } from './logger';
    
    // ─────────────────────────────────────────────────────────────────
    // REDIS CONNECTION OPTIONS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Parse Redis URL into connection options
     * 
     * Supports formats:
     * - redis://localhost:6379
     * - redis://:password@localhost:6379
     * - redis://user:password@localhost:6379/0
     */
    function parseRedisUrl(url: string): RedisOptions {
      const parsed = new URL(url);
      
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
        // Connection settings
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false, // Required for BullMQ
        // Reconnection settings
        retryStrategy: (times: number) => {
          // Reconnect after 50ms, 100ms, 200ms, ..., max 5000ms
          const delay = Math.min(times * 50, 5000);
          logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
          return delay;
        },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // CREATE REDIS CONNECTION
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Create a new Redis connection
     * Each connection should be used for a specific purpose (queue, cache, etc.)
     */
    export function createRedisConnection(name: string = 'default'): Redis {
      const options = parseRedisUrl(env.REDIS_URL);
      
      const redis = new Redis({
        ...options,
        // Add a name for debugging
        connectionName: `paas-api-${name}`,
      });
    
      // Event handlers for logging
      redis.on('connect', () => {
        logger.info(`✅ Redis [${name}] connected to ${options.host}:${options.port}`);
      });
    
      redis.on('error', (error) => {
        logger.error({ err: error }, `❌ Redis [${name}] error`);
      });
    
      redis.on('close', () => {
        logger.warn(`Redis [${name}] connection closed`);
      });
    
      redis.on('reconnecting', () => {
        logger.info(`Redis [${name}] reconnecting...`);
      });
    
      return redis;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // SHARED REDIS INSTANCES
    // ─────────────────────────────────────────────────────────────────
    
    // Lazy initialization - connections created on first use
    let queueConnection: Redis | null = null;
    let subscriberConnection: Redis | null = null;
    
    /**
     * Get Redis connection for BullMQ queue operations
     * BullMQ requires a dedicated connection for queue operations
     */
    export function getQueueConnection(): Redis {
      if (!queueConnection) {
        queueConnection = createRedisConnection('queue');
      }
      return queueConnection;
    }
    
    /**
     * Get Redis connection for BullMQ event subscriptions
     * BullMQ requires a separate connection for event listening
     */
    export function getSubscriberConnection(): Redis {
      if (!subscriberConnection) {
        subscriberConnection = createRedisConnection('subscriber');
      }
      return subscriberConnection;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // CONNECTION CLEANUP
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Close all Redis connections
     * Call this during graceful shutdown
     */
    export async function closeAllRedisConnections(): Promise<void> {
      const connections: Promise<void>[] = [];
    
      if (queueConnection) {
        connections.push(
          queueConnection.quit().then(() => {
            queueConnection = null;
            logger.info('Redis [queue] connection closed');
          })
        );
      }
    
      if (subscriberConnection) {
        connections.push(
          subscriberConnection.quit().then(() => {
            subscriberConnection = null;
            logger.info('Redis [subscriber] connection closed');
          })
        );
      }
    
      await Promise.all(connections);
    }
    
    // ─────────────────────────────────────────────────────────────────
    // HEALTH CHECK
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Check if Redis is connected and responding
     */
    export async function checkRedisHealth(): Promise<{
      connected: boolean;
      latency?: number;
      error?: string;
    }> {
      try {
        const redis = getQueueConnection();
        const start = Date.now();
        await redis.ping();
        const latency = Date.now() - start;
        
        return { connected: true, latency };
      } catch (error) {
        return {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    ```
    
- Created `apps\api\src\queue\index.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Queue System - Main Export
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This module provides the job queue infrastructure using BullMQ.
    // 
    // BullMQ is a Redis-based queue for Node.js that provides:
    // - Reliable job processing with retries
    // - Delayed jobs
    // - Job prioritization
    // - Real-time events
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Export queue definitions
    export { buildQueue, BUILD_QUEUE_NAME } from './build.queue';
    
    // Export producers (functions to add jobs)
    export { addBuildJob, type BuildJobData } from './build.producer';
    
    // Export queue management utilities
    export { getQueueStatus, closeQueues } from './queue.utils';
    
    ```
    
- Created `apps\api\src\queue\build.queue.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Build Queue Definition
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This file defines the build job queue using BullMQ.
    // The queue handles:
    // - Cloning repositories
    // - Building Docker images
    // - Pushing to registry
    // - Deploying to Kubernetes
    //
    // EXPRESS EQUIVALENT:
    // This is similar to setting up a job processor with libraries like:
    // - bull
    // - agenda
    // - bee-queue
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { Queue, QueueEvents, type JobsOptions } from 'bullmq';
    import { getQueueConnection, getSubscriberConnection } from '../lib/redis';
    import { logger } from '../lib/logger';
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE NAME
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Queue name constant - use this everywhere to avoid typos
     */
    export const BUILD_QUEUE_NAME = 'build-jobs';
    
    // ─────────────────────────────────────────────────────────────────
    // DEFAULT JOB OPTIONS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Default options for build jobs
     */
    export const DEFAULT_BUILD_JOB_OPTIONS: JobsOptions = {
      // Number of retry attempts for failed jobs
      attempts: 3,
      
      // Exponential backoff between retries
      // 1st retry: 5 seconds, 2nd: 10 seconds, 3rd: 20 seconds
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds base delay
      },
      
      // Remove completed jobs after 24 hours
      removeOnComplete: {
        age: 24 * 60 * 60, // 24 hours in seconds
        count: 100, // Keep last 100 completed jobs
      },
      
      // Keep failed jobs for 7 days for debugging
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // 7 days in seconds
        count: 50, // Keep last 50 failed jobs
      },
    };
    
    // ─────────────────────────────────────────────────────────────────
    // CREATE QUEUE INSTANCE
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Build job queue instance
     * 
     * Use this to:
     * - Add jobs: buildQueue.add('build', jobData)
     * - Get job status: buildQueue.getJob(jobId)
     * - Monitor queue: buildQueue.getJobCounts()
     */
    export const buildQueue = new Queue(BUILD_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: DEFAULT_BUILD_JOB_OPTIONS,
    });
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE EVENTS (For monitoring)
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Queue events instance for monitoring job progress
     * 
     * Use this to:
     * - Listen for job completion
     * - Track job progress
     * - Handle job failures
     */
    export const buildQueueEvents = new QueueEvents(BUILD_QUEUE_NAME, {
      connection: getSubscriberConnection(),
    });
    
    // Set up event logging
    buildQueueEvents.on('completed', ({ jobId }) => {
      logger.info({ jobId }, `Build job completed`);
    });
    
    buildQueueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error({ jobId, reason: failedReason }, `Build job failed`);
    });
    
    buildQueueEvents.on('progress', ({ jobId, data }) => {
      logger.debug({ jobId, progress: data }, `Build job progress`);
    });
    
    buildQueueEvents.on('stalled', ({ jobId }) => {
      logger.warn({ jobId }, `Build job stalled`);
    });
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE CLEANUP
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Close the build queue gracefully
     * Call this during application shutdown
     */
    export async function closeBuildQueue(): Promise<void> {
      await buildQueueEvents.close();
      await buildQueue.close();
      logger.info('Build queue closed');
    }
    
    ```
    
- Created `apps\api\src\queue\build.producer.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Build Job Producer
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This file provides functions to add build jobs to the queue.
    // "Producer" means this code creates/adds jobs, not processes them.
    //
    // The actual job processing happens in the Worker service (apps/worker).
    //
    // EXPRESS EQUIVALENT:
    // This is like calling:
    // queue.add('build', { deploymentId, projectId, ... });
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { type Job, type JobsOptions } from 'bullmq';
    import { buildQueue, DEFAULT_BUILD_JOB_OPTIONS } from './build.queue';
    import { logger } from '../lib/logger';
    
    // ─────────────────────────────────────────────────────────────────
    // JOB DATA TYPES
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Data required to build and deploy an application
     * This is what gets stored in Redis and passed to the worker
     */
    export interface BuildJobData {
      // Identifiers
      deploymentId: string; // Unique deployment ID
      projectId: string;    // Project this belongs to
      userId: string;       // User who owns the project
      
      // Git information
      gitRepoUrl: string;   // Repository URL (e.g., https://github.com/user/repo)
      gitBranch: string;    // Branch to deploy (e.g., main)
      gitCommitSha?: string; // Specific commit (optional, uses HEAD if not provided)
      
      // Build configuration
      buildCommand?: string;  // Custom build command (e.g., npm run build)
      startCommand?: string;  // Start command (e.g., npm start)
      dockerfilePath?: string; // Path to Dockerfile if using custom
      rootDirectory?: string;  // Root directory if not repo root
      
      // Runtime configuration
      port?: number;          // Port the app listens on (default: 3000)
      instanceType?: string;  // small, medium, large
      
      // Environment variables (encrypted in DB, decrypted here)
      envVars?: Record<string, string>;
      
      // Registry information
      registryUrl?: string;   // Where to push the image
      imageTag?: string;      // Generated image tag
      
      // Metadata
      triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli';
      projectName: string;    // For generating subdomain
      projectSlug: string;    // URL-safe project identifier
    }
    
    /**
     * Result of adding a job to the queue
     */
    export interface BuildJobResult {
      jobId: string;
      queueName: string;
      status: 'added' | 'error';
      deploymentId: string;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // ADD BUILD JOB
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Add a new build job to the queue
     * 
     * This function:
     * 1. Validates the job data
     * 2. Adds the job to the Redis queue
     * 3. Returns the job ID for tracking
     * 
     * EXPRESS EQUIVALENT:
     * const addBuildJob = async (data) => {
     *   const job = await queue.add('build', data);
     *   return { jobId: job.id };
     * };
     * 
     * @param data - Build job data
     * @param options - Optional job options (priority, delay, etc.)
     * @returns Job result with ID
     */
    export async function addBuildJob(
      data: BuildJobData,
      options?: Partial<JobsOptions>
    ): Promise<BuildJobResult> {
      try {
        // Generate a unique job name for easier identification
        const jobName = `deploy-${data.projectSlug}-${data.deploymentId.slice(0, 8)}`;
        
        logger.info({
          deploymentId: data.deploymentId,
          projectId: data.projectId,
          branch: data.gitBranch,
          triggeredBy: data.triggeredBy,
        }, `Adding build job to queue`);
    
        // Add job to queue
        const job: Job<BuildJobData> = await buildQueue.add(
          jobName,
          data,
          {
            ...DEFAULT_BUILD_JOB_OPTIONS,
            ...options,
            // Use deployment ID as job ID for easy lookup
            jobId: data.deploymentId,
          }
        );
    
        logger.info({
          jobId: job.id,
          deploymentId: data.deploymentId,
        }, `Build job added to queue`);
    
        return {
          jobId: job.id!,
          queueName: buildQueue.name,
          status: 'added',
          deploymentId: data.deploymentId,
        };
        
      } catch (error) {
        logger.error({
          err: error,
          deploymentId: data.deploymentId,
        }, `Failed to add build job to queue`);
    
        throw error;
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // PRIORITY JOBS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Add a high-priority build job (for paid users, rollbacks, etc.)
     * Lower priority number = higher priority (1 is highest)
     */
    export async function addPriorityBuildJob(
      data: BuildJobData,
      priority: number = 1
    ): Promise<BuildJobResult> {
      return addBuildJob(data, { priority });
    }
    
    /**
     * Add a delayed build job (scheduled deployments)
     * 
     * @param data - Build job data
     * @param delayMs - Delay in milliseconds
     */
    export async function addDelayedBuildJob(
      data: BuildJobData,
      delayMs: number
    ): Promise<BuildJobResult> {
      return addBuildJob(data, { delay: delayMs });
    }
    
    // ─────────────────────────────────────────────────────────────────
    // JOB STATUS HELPERS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Get a build job by deployment ID
     */
    export async function getBuildJob(deploymentId: string): Promise<Job<BuildJobData> | null> {
      const job = await buildQueue.getJob(deploymentId);
      return job || null;
    }
    
    /**
     * Get the current state of a build job
     */
    export async function getBuildJobState(deploymentId: string): Promise<string | null> {
      const job = await getBuildJob(deploymentId);
      if (!job) return null;
      return job.getState();
    }
    
    /**
     * Check if a deployment has a pending or active job
     */
    export async function isDeploymentQueued(deploymentId: string): Promise<boolean> {
      const job = await getBuildJob(deploymentId);
      if (!job) return false;
      
      const state = await job.getState();
      return ['waiting', 'active', 'delayed'].includes(state);
    }
    
    /**
     * Remove a build job from the queue (if not yet processed)
     */
    export async function removeBuildJob(deploymentId: string): Promise<boolean> {
      const job = await getBuildJob(deploymentId);
      if (!job) return false;
      
      const state = await job.getState();
      
      // Can only remove if not active
      if (state !== 'active') {
        await job.remove();
        logger.info({ deploymentId }, `Build job removed from queue`);
        return true;
      }
      
      return false;
    }
    
    ```
    
- Created `apps\api\src\queue\queue.utils.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Queue Utilities
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Helper functions for queue management, monitoring, and cleanup.
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { buildQueue, closeBuildQueue } from './build.queue';
    import { logger } from '../lib/logger';
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE STATUS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Queue statistics
     */
    export interface QueueStatus {
      name: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
    }
    
    /**
     * Get the current status of all queues
     */
    export async function getQueueStatus(): Promise<QueueStatus[]> {
      const buildCounts = await buildQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed'
      );
      
      const isPaused = await buildQueue.isPaused();
    
      return [
        {
          name: buildQueue.name,
          waiting: buildCounts.waiting || 0,
          active: buildCounts.active || 0,
          completed: buildCounts.completed || 0,
          failed: buildCounts.failed || 0,
          delayed: buildCounts.delayed || 0,
          paused: isPaused,
        },
      ];
    }
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Pause all queues (stop processing new jobs)
     */
    export async function pauseAllQueues(): Promise<void> {
      await buildQueue.pause();
      logger.info('All queues paused');
    }
    
    /**
     * Resume all queues
     */
    export async function resumeAllQueues(): Promise<void> {
      await buildQueue.resume();
      logger.info('All queues resumed');
    }
    
    /**
     * Drain all queues (remove all waiting jobs)
     */
    export async function drainAllQueues(): Promise<void> {
      await buildQueue.drain();
      logger.info('All queues drained');
    }
    
    /**
     * Clean old jobs from all queues
     * 
     * @param gracePeriod - Time in milliseconds to keep jobs
     * @param limit - Maximum number of jobs to remove
     * @param status - Job status to clean (completed, failed, etc.)
     */
    export async function cleanOldJobs(
      gracePeriod: number = 24 * 60 * 60 * 1000, // 24 hours
      limit: number = 1000,
      status: 'completed' | 'failed' | 'delayed' | 'active' | 'wait' = 'completed'
    ): Promise<number[]> {
      const cleaned = await buildQueue.clean(gracePeriod, limit, status);
      logger.info({ count: cleaned.length, status }, 'Cleaned old jobs');
      return cleaned;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // GRACEFUL SHUTDOWN
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Close all queues gracefully
     * Call this during application shutdown
     */
    export async function closeQueues(): Promise<void> {
      logger.info('Closing all queues...');
      
      try {
        await closeBuildQueue();
        logger.info('All queues closed successfully');
      } catch (error) {
        logger.error({ err: error }, 'Error closing queues');
        throw error;
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE HEALTH CHECK
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Check if the queue system is healthy
     */
    export async function checkQueueHealth(): Promise<{
      healthy: boolean;
      queues: QueueStatus[];
      error?: string;
    }> {
      try {
        const status = await getQueueStatus();
        
        return {
          healthy: true,
          queues: status,
        };
      } catch (error) {
        return {
          healthy: false,
          queues: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    ```
    

AI Thinking: Now let me update the health routes to include Redis status, and then move to Phase 2 - creating the Worker app:

- Updated `apps\api\src\routes\health.routes.ts`
    
    ```tsx
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
    
    ```
    

AI starting phase2

- Created `apps\worker\package.json`
    
    ```json
    {
      "name": "worker",
      "version": "0.0.1",
      "private": true,
      "description": "PaaS Build Worker - Processes build and deployment jobs",
      "type": "module",
      "scripts": {
        "dev": "tsx watch src/index.ts",
        "build": "tsup src/index.ts --format esm --dts",
        "start": "node dist/index.js",
        "lint": "eslint src/",
        "typecheck": "tsc --noEmit"
      },
      "dependencies": {
        "bullmq": "^5.34.8",
        "ioredis": "^5.4.2",
        "drizzle-orm": "^0.38.3",
        "postgres": "^3.4.5",
        "simple-git": "^3.27.0",
        "zod": "^3.24.1",
        "nanoid": "^5.0.9",
        "pino": "^9.6.0",
        "pino-pretty": "^13.0.0",
        "dotenv": "^16.4.7"
      },
      "devDependencies": {
        "@types/node": "^22.10.5",
        "tsup": "^8.3.5",
        "tsx": "^4.19.2",
        "typescript": "^5.7.2"
      }
    }
    
    ```
    
- Created `apps\worker\tsconfig.json`
    
    ```json
    {
      "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "esModuleInterop": true,
        "strict": true,
        "skipLibCheck": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "types": ["node"],
        "lib": ["ES2022"]
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist"]
    }
    
    ```
    

- Created `apps\worker\src\lib\env.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Worker Environment Variables
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This file loads and validates environment variables for the worker.
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { z } from 'zod';
    import { config } from 'dotenv';
    
    // Load .env file from api folder (shared config)
    config({ path: '../api/.env' });
    // Also try current directory
    config();
    
    // ─────────────────────────────────────────────────────────────────
    // ENVIRONMENT SCHEMA
    // ─────────────────────────────────────────────────────────────────
    
    const envSchema = z.object({
      // Server
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      
      // Database (for updating deployment status)
      DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5434/paas_db'),
      
      // Redis (for job queue)
      REDIS_URL: z.string().default('redis://localhost:6380'),
      
      // Container Registry
      REGISTRY_URL: z.string().default('localhost:5001'),
      REGISTRY_USERNAME: z.string().optional(),
      REGISTRY_PASSWORD: z.string().optional(),
      
      // Build settings
      BUILD_TIMEOUT_MS: z.coerce.number().default(30 * 60 * 1000), // 30 minutes
      BUILD_WORKSPACE: z.string().default('/tmp/paas-builds'),
      
      // Simulation mode (for development without Docker)
      SIMULATION_MODE: z.coerce.boolean().default(true),
      SIMULATION_BUILD_DELAY_MS: z.coerce.number().default(3000), // 3 seconds
      
      // Worker settings
      WORKER_CONCURRENCY: z.coerce.number().default(2), // Process 2 jobs at a time
      WORKER_NAME: z.string().default('worker-1'),
    });
    
    // ─────────────────────────────────────────────────────────────────
    // PARSE AND EXPORT
    // ─────────────────────────────────────────────────────────────────
    
    const parsed = envSchema.safeParse(process.env);
    
    if (!parsed.success) {
      console.error('❌ Invalid environment variables:');
      console.error(parsed.error.flatten().fieldErrors);
      process.exit(1);
    }
    
    export const env = parsed.data;
    export type Env = z.infer<typeof envSchema>;
    
    ```
    
- Created `apps\worker\src\lib\logger.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Worker Logger Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    
    import pino from 'pino';
    import { env } from './env';
    
    export const logger = pino({
      name: 'paas-worker',
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport: env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
    
    ```
    
- Created `apps\worker\src\lib\redis.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Worker Redis Connection
    // ═══════════════════════════════════════════════════════════════════════════
    
    import Redis, { type RedisOptions } from 'ioredis';
    import { env } from './env';
    import { logger } from './logger';
    
    /**
     * Parse Redis URL into connection options
     */
    function parseRedisUrl(url: string): RedisOptions {
      const parsed = new URL(url);
      
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 5000);
          logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
          return delay;
        },
      };
    }
    
    /**
     * Create a new Redis connection
     */
    export function createRedisConnection(name: string = 'default'): Redis {
      const options = parseRedisUrl(env.REDIS_URL);
      
      const redis = new Redis({
        ...options,
        connectionName: `paas-worker-${name}`,
      });
    
      redis.on('connect', () => {
        logger.info(`✅ Redis [${name}] connected`);
      });
    
      redis.on('error', (error) => {
        logger.error({ err: error }, `❌ Redis [${name}] error`);
      });
    
      return redis;
    }
    
    // Lazy initialization
    let workerConnection: Redis | null = null;
    
    export function getWorkerConnection(): Redis {
      if (!workerConnection) {
        workerConnection = createRedisConnection('worker');
      }
      return workerConnection;
    }
    
    export async function closeRedisConnection(): Promise<void> {
      if (workerConnection) {
        await workerConnection.quit();
        workerConnection = null;
        logger.info('Redis connection closed');
      }
    }
    
    ```
    

- Created `apps\worker\src\types.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Worker Type Definitions
    // ═══════════════════════════════════════════════════════════════════════════
    
    // ─────────────────────────────────────────────────────────────────
    // BUILD JOB DATA (Must match API's BuildJobData)
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Data passed to the worker for each build job
     */
    export interface BuildJobData {
      // Identifiers
      deploymentId: string;
      projectId: string;
      userId: string;
      
      // Git information
      gitRepoUrl: string;
      gitBranch: string;
      gitCommitSha?: string;
      
      // Build configuration
      buildCommand?: string;
      startCommand?: string;
      dockerfilePath?: string;
      rootDirectory?: string;
      
      // Runtime configuration
      port?: number;
      instanceType?: string;
      
      // Environment variables
      envVars?: Record<string, string>;
      
      // Registry information
      registryUrl?: string;
      imageTag?: string;
      
      // Metadata
      triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli';
      projectName: string;
      projectSlug: string;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // BUILD CONTEXT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Context passed through each build step
     * Accumulates data as the build progresses
     */
    export interface BuildContext {
      // Job data
      job: BuildJobData;
      
      // Working directory (where source code is cloned)
      workDir: string;
      
      // Detected application type
      appType?: DetectedAppType;
      
      // Generated image tag
      imageTag?: string;
      
      // Build start time
      startTime: number;
      
      // Build logs
      logs: BuildLogEntry[];
    }
    
    /**
     * Detected application type
     */
    export interface DetectedAppType {
      type: 'nodejs' | 'python' | 'go' | 'rust' | 'ruby' | 'php' | 'java' | 'static' | 'docker' | 'unknown';
      version?: string;
      framework?: string; // next, nuxt, express, django, flask, etc.
      buildTool?: string; // npm, yarn, pnpm, pip, cargo, etc.
      hasDockerfile: boolean;
    }
    
    /**
     * Build log entry
     */
    export interface BuildLogEntry {
      timestamp: Date;
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      step?: string;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // BUILD RESULT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Result of the build process
     */
    export interface BuildResult {
      success: boolean;
      imageTag?: string;
      imageSizeBytes?: number;
      buildDurationMs: number;
      error?: string;
      logs: BuildLogEntry[];
    }
    
    // ─────────────────────────────────────────────────────────────────
    // BUILD STEP
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * A single step in the build pipeline
     */
    export interface BuildStep {
      name: string;
      execute: (context: BuildContext) => Promise<BuildContext>;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // DEPLOYMENT STATUS UPDATES
    // ─────────────────────────────────────────────────────────────────
    
    export type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
    export type DeployStatus = 'pending' | 'deploying' | 'live' | 'failed' | 'rolled_back';
    
    ```
    
- Created `apps\worker\src\steps\clone.ts`
    
    ```
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 1: Clone Repository
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This step clones the user's repository from GitHub/GitLab/Bitbucket.
    //
    // In SIMULATION MODE:
    // - Simulates cloning with a delay
    // - Creates a mock directory structure
    //
    // In REAL MODE:
    // - Uses simple-git to clone the repository
    // - Handles authentication with access tokens
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { mkdir, writeFile } from 'fs/promises';
    import { join } from 'path';
    import { simpleGit, type SimpleGit } from 'simple-git';
    import type { BuildContext, BuildStep } from '../types';
    import { env } from '../lib/env';
    import { logger } from '../lib/logger';
    import { addLog } from '../utils/log-helper';
    
    // ─────────────────────────────────────────────────────────────────
    // CLONE STEP
    // ─────────────────────────────────────────────────────────────────
    
    export const cloneStep: BuildStep = {
      name: 'clone',
      
      async execute(context: BuildContext): Promise<BuildContext> {
        const { job } = context;
        
        addLog(context, 'info', '📥 Starting repository clone...', 'clone');
        addLog(context, 'info', `Repository: ${job.gitRepoUrl}`, 'clone');
        addLog(context, 'info', `Branch: ${job.gitBranch}`, 'clone');
        
        if (env.SIMULATION_MODE) {
          return simulateClone(context);
        }
        
        return realClone(context);
      },
    };
    
    // ─────────────────────────────────────────────────────────────────
    // SIMULATION MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function simulateClone(context: BuildContext): Promise<BuildContext> {
      const { job, workDir } = context;
      
      addLog(context, 'info', '[SIMULATION] Simulating git clone...', 'clone');
      
      // Simulate clone delay
      await sleep(env.SIMULATION_BUILD_DELAY_MS);
      
      // Create the workspace directory
      await mkdir(workDir, { recursive: true });
      
      // Create mock files based on detected app type
      // In simulation, we'll create a mock package.json for Node.js projects
      const mockPackageJson = {
        name: job.projectSlug,
        version: '1.0.0',
        scripts: {
          build: job.buildCommand || 'echo "No build command"',
          start: job.startCommand || 'node index.js',
        },
        dependencies: {
          express: '^4.18.0',
        },
      };
      
      await writeFile(
        join(workDir, 'package.json'),
        JSON.stringify(mockPackageJson, null, 2)
      );
      
      // Create a mock index.js
      const mockIndexJs = `
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || ${job.port || 3000};
    
    app.get('/', (req, res) => {
      res.send('Hello from ${job.projectName}!');
    });
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    app.listen(PORT, () => {
      console.log(\`Server running on port \${PORT}\`);
    });
    `;
      
      await writeFile(join(workDir, 'index.js'), mockIndexJs.trim());
      
      addLog(context, 'info', '[SIMULATION] Repository cloned successfully', 'clone');
      addLog(context, 'info', `[SIMULATION] Working directory: ${workDir}`, 'clone');
      
      // Simulate commit info
      if (!job.gitCommitSha) {
        context.job.gitCommitSha = generateMockCommitSha();
      }
      
      addLog(context, 'info', `Commit: ${context.job.gitCommitSha}`, 'clone');
      
      return context;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // REAL MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function realClone(context: BuildContext): Promise<BuildContext> {
      const { job, workDir } = context;
      
      // Create workspace directory
      await mkdir(workDir, { recursive: true });
      
      // Initialize simple-git
      const git: SimpleGit = simpleGit();
      
      try {
        addLog(context, 'info', 'Cloning repository...', 'clone');
        
        // Clone with depth 1 for faster checkout
        const cloneOptions = [
          '--depth', '1',
          '--branch', job.gitBranch,
          '--single-branch',
        ];
        
        await git.clone(job.gitRepoUrl, workDir, cloneOptions);
        
        addLog(context, 'info', 'Repository cloned successfully', 'clone');
        
        // Get commit information
        const gitInWorkDir = simpleGit(workDir);
        const log = await gitInWorkDir.log({ maxCount: 1 });
        
        if (log.latest) {
          context.job.gitCommitSha = log.latest.hash;
          addLog(context, 'info', `Commit: ${log.latest.hash.slice(0, 8)}`, 'clone');
          addLog(context, 'info', `Author: ${log.latest.author_name}`, 'clone');
          addLog(context, 'info', `Message: ${log.latest.message}`, 'clone');
        }
        
        return context;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog(context, 'error', `Failed to clone repository: ${errorMessage}`, 'clone');
        logger.error({ err: error, job }, 'Clone failed');
        throw new Error(`Clone failed: ${errorMessage}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────
    
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    function generateMockCommitSha(): string {
      const chars = '0123456789abcdef';
      let sha = '';
      for (let i = 0; i < 40; i++) {
        sha += chars[Math.floor(Math.random() * chars.length)];
      }
      return sha;
    }
    
    ```
    
- Created `apps\worker\src\steps\detect.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 2: Detect Application Type
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This step analyzes the cloned repository to determine:
    // - Programming language (Node.js, Python, Go, etc.)
    // - Framework (Next.js, Django, Express, etc.)
    // - Build tool (npm, yarn, pnpm, pip, etc.)
    // - Whether a Dockerfile exists
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { readFile, access } from 'fs/promises';
    import { join } from 'path';
    import type { BuildContext, BuildStep, DetectedAppType } from '../types';
    import { env } from '../lib/env';
    import { addLog } from '../utils/log-helper';
    
    // ─────────────────────────────────────────────────────────────────
    // DETECT STEP
    // ─────────────────────────────────────────────────────────────────
    
    export const detectStep: BuildStep = {
      name: 'detect',
      
      async execute(context: BuildContext): Promise<BuildContext> {
        addLog(context, 'info', '🔍 Detecting application type...', 'detect');
        
        if (env.SIMULATION_MODE) {
          return simulateDetect(context);
        }
        
        return realDetect(context);
      },
    };
    
    // ─────────────────────────────────────────────────────────────────
    // SIMULATION MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function simulateDetect(context: BuildContext): Promise<BuildContext> {
      addLog(context, 'info', '[SIMULATION] Analyzing project structure...', 'detect');
      
      // Simulate detection delay
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
      
      // In simulation, assume Node.js with Express
      const appType: DetectedAppType = {
        type: 'nodejs',
        version: '20.x',
        framework: 'express',
        buildTool: 'npm',
        hasDockerfile: false,
      };
      
      context.appType = appType;
      
      addLog(context, 'info', `[SIMULATION] Detected: ${appType.type}`, 'detect');
      addLog(context, 'info', `[SIMULATION] Framework: ${appType.framework || 'none'}`, 'detect');
      addLog(context, 'info', `[SIMULATION] Version: ${appType.version || 'unknown'}`, 'detect');
      addLog(context, 'info', `[SIMULATION] Build tool: ${appType.buildTool || 'none'}`, 'detect');
      addLog(context, 'info', `[SIMULATION] Has Dockerfile: ${appType.hasDockerfile}`, 'detect');
      
      return context;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // REAL MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function realDetect(context: BuildContext): Promise<BuildContext> {
      const { workDir } = context;
      
      const appType: DetectedAppType = {
        type: 'unknown',
        hasDockerfile: false,
      };
      
      // Check for Dockerfile first (highest priority)
      if (await fileExists(join(workDir, 'Dockerfile'))) {
        appType.hasDockerfile = true;
        appType.type = 'docker';
        addLog(context, 'info', 'Found Dockerfile - will use custom Docker build', 'detect');
      }
      
      // Check for Node.js
      if (await fileExists(join(workDir, 'package.json'))) {
        const packageJson = await readJsonFile(join(workDir, 'package.json'));
        appType.type = 'nodejs';
        appType.version = detectNodeVersion(packageJson);
        appType.framework = detectNodeFramework(packageJson);
        appType.buildTool = await detectNodeBuildTool(workDir);
        addLog(context, 'info', 'Detected Node.js application', 'detect');
      }
      
      // Check for Python
      else if (await fileExists(join(workDir, 'requirements.txt')) || 
               await fileExists(join(workDir, 'pyproject.toml'))) {
        appType.type = 'python';
        appType.version = await detectPythonVersion(workDir);
        appType.framework = await detectPythonFramework(workDir);
        addLog(context, 'info', 'Detected Python application', 'detect');
      }
      
      // Check for Go
      else if (await fileExists(join(workDir, 'go.mod'))) {
        appType.type = 'go';
        const goMod = await readFile(join(workDir, 'go.mod'), 'utf-8');
        const versionMatch = goMod.match(/go\s+(\d+\.\d+)/);
        appType.version = versionMatch ? versionMatch[1] : undefined;
        addLog(context, 'info', 'Detected Go application', 'detect');
      }
      
      // Check for Rust
      else if (await fileExists(join(workDir, 'Cargo.toml'))) {
        appType.type = 'rust';
        addLog(context, 'info', 'Detected Rust application', 'detect');
      }
      
      // Check for Ruby
      else if (await fileExists(join(workDir, 'Gemfile'))) {
        appType.type = 'ruby';
        addLog(context, 'info', 'Detected Ruby application', 'detect');
      }
      
      // Check for PHP
      else if (await fileExists(join(workDir, 'composer.json'))) {
        appType.type = 'php';
        addLog(context, 'info', 'Detected PHP application', 'detect');
      }
      
      // Check for Java (Maven)
      else if (await fileExists(join(workDir, 'pom.xml'))) {
        appType.type = 'java';
        appType.buildTool = 'maven';
        addLog(context, 'info', 'Detected Java (Maven) application', 'detect');
      }
      
      // Check for Java (Gradle)
      else if (await fileExists(join(workDir, 'build.gradle')) ||
               await fileExists(join(workDir, 'build.gradle.kts'))) {
        appType.type = 'java';
        appType.buildTool = 'gradle';
        addLog(context, 'info', 'Detected Java (Gradle) application', 'detect');
      }
      
      // Check for static site (index.html)
      else if (await fileExists(join(workDir, 'index.html'))) {
        appType.type = 'static';
        addLog(context, 'info', 'Detected static website', 'detect');
      }
      
      if (appType.type === 'unknown' && !appType.hasDockerfile) {
        addLog(context, 'warn', 'Could not detect application type', 'detect');
        addLog(context, 'warn', 'Please add a Dockerfile for custom builds', 'detect');
      }
      
      context.appType = appType;
      
      addLog(context, 'info', `Application type: ${appType.type}`, 'detect');
      if (appType.framework) addLog(context, 'info', `Framework: ${appType.framework}`, 'detect');
      if (appType.version) addLog(context, 'info', `Version: ${appType.version}`, 'detect');
      if (appType.buildTool) addLog(context, 'info', `Build tool: ${appType.buildTool}`, 'detect');
      
      return context;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // HELPER FUNCTIONS
    // ─────────────────────────────────────────────────────────────────
    
    async function fileExists(path: string): Promise<boolean> {
      try {
        await access(path);
        return true;
      } catch {
        return false;
      }
    }
    
    async function readJsonFile(path: string): Promise<Record<string, unknown>> {
      try {
        const content = await readFile(path, 'utf-8');
        return JSON.parse(content);
      } catch {
        return {};
      }
    }
    
    function detectNodeVersion(packageJson: Record<string, unknown>): string | undefined {
      const engines = packageJson.engines as Record<string, string> | undefined;
      if (engines?.node) {
        return engines.node;
      }
      return '20.x'; // Default to LTS
    }
    
    function detectNodeFramework(packageJson: Record<string, unknown>): string | undefined {
      const deps = {
        ...(packageJson.dependencies as Record<string, string> || {}),
        ...(packageJson.devDependencies as Record<string, string> || {}),
      };
      
      if (deps['next']) return 'next';
      if (deps['nuxt']) return 'nuxt';
      if (deps['@remix-run/react']) return 'remix';
      if (deps['gatsby']) return 'gatsby';
      if (deps['svelte']) return 'svelte';
      if (deps['vue']) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps['express']) return 'express';
      if (deps['fastify']) return 'fastify';
      if (deps['hono']) return 'hono';
      if (deps['koa']) return 'koa';
      if (deps['nestjs']) return 'nestjs';
      
      return undefined;
    }
    
    async function detectNodeBuildTool(workDir: string): Promise<string> {
      if (await fileExists(join(workDir, 'pnpm-lock.yaml'))) return 'pnpm';
      if (await fileExists(join(workDir, 'yarn.lock'))) return 'yarn';
      if (await fileExists(join(workDir, 'bun.lockb'))) return 'bun';
      return 'npm';
    }
    
    async function detectPythonVersion(workDir: string): Promise<string | undefined> {
      // Check .python-version file
      if (await fileExists(join(workDir, '.python-version'))) {
        const version = await readFile(join(workDir, '.python-version'), 'utf-8');
        return version.trim();
      }
      
      // Check pyproject.toml for python version
      if (await fileExists(join(workDir, 'pyproject.toml'))) {
        const content = await readFile(join(workDir, 'pyproject.toml'), 'utf-8');
        const match = content.match(/python\s*=\s*["']([^"']+)["']/);
        if (match) return match[1];
      }
      
      return '3.11'; // Default
    }
    
    async function detectPythonFramework(workDir: string): Promise<string | undefined> {
      let requirements = '';
      
      if (await fileExists(join(workDir, 'requirements.txt'))) {
        requirements = await readFile(join(workDir, 'requirements.txt'), 'utf-8');
      }
      
      const lower = requirements.toLowerCase();
      
      if (lower.includes('django')) return 'django';
      if (lower.includes('flask')) return 'flask';
      if (lower.includes('fastapi')) return 'fastapi';
      if (lower.includes('streamlit')) return 'streamlit';
      
      return undefined;
    }
    
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    ```
    
- Created`apps\worker\src\steps\build.ts`
    
    ---
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 3: Build Docker Image
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This step builds a Docker image from the source code.
    //
    // In SIMULATION MODE:
    // - Simulates the build process with delays
    // - Logs mock build output
    //
    // In REAL MODE:
    // - Uses Nixpacks for automatic builds (if no Dockerfile)
    // - Uses docker build for custom Dockerfiles
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import type { BuildContext, BuildStep } from '../types';
    import { env } from '../lib/env';
    import { addLog } from '../utils/log-helper';
    
    // ─────────────────────────────────────────────────────────────────
    // BUILD STEP
    // ─────────────────────────────────────────────────────────────────
    
    export const buildStep: BuildStep = {
      name: 'build',
      
      async execute(context: BuildContext): Promise<BuildContext> {
        const { job, appType } = context;
        
        addLog(context, 'info', '🔨 Starting build process...', 'build');
        
        // Generate image tag
        const commitShort = job.gitCommitSha?.slice(0, 8) || 'latest';
        const imageTag = `${env.REGISTRY_URL}/${job.projectSlug}:${commitShort}`;
        context.imageTag = imageTag;
        
        addLog(context, 'info', `Target image: ${imageTag}`, 'build');
        
        if (env.SIMULATION_MODE) {
          return simulateBuild(context);
        }
        
        // Decide build strategy
        if (appType?.hasDockerfile) {
          return dockerBuild(context);
        }
        
        return nixpacksBuild(context);
      },
    };
    
    // ─────────────────────────────────────────────────────────────────
    // SIMULATION MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function simulateBuild(context: BuildContext): Promise<BuildContext> {
      const { appType } = context;
      
      addLog(context, 'info', '[SIMULATION] Building Docker image...', 'build');
      
      // Simulate detecting dependencies
      addLog(context, 'info', '[SIMULATION] Step 1/6: Analyzing dependencies...', 'build');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
      
      // Simulate installing dependencies
      addLog(context, 'info', '[SIMULATION] Step 2/6: Installing dependencies...', 'build');
      await sleep(env.SIMULATION_BUILD_DELAY_MS);
      
      if (appType?.type === 'nodejs') {
        addLog(context, 'info', '[SIMULATION]   npm install', 'build');
        addLog(context, 'info', '[SIMULATION]   added 125 packages in 2.3s', 'build');
      }
      
      // Simulate running build command
      addLog(context, 'info', '[SIMULATION] Step 3/6: Running build command...', 'build');
      await sleep(env.SIMULATION_BUILD_DELAY_MS);
      
      if (appType?.type === 'nodejs') {
        addLog(context, 'info', '[SIMULATION]   npm run build', 'build');
        addLog(context, 'info', '[SIMULATION]   Build completed successfully', 'build');
      }
      
      // Simulate creating image layers
      addLog(context, 'info', '[SIMULATION] Step 4/6: Creating image layers...', 'build');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
      
      addLog(context, 'info', '[SIMULATION]   Layer 1: Base image (node:20-alpine)', 'build');
      addLog(context, 'info', '[SIMULATION]   Layer 2: Dependencies', 'build');
      addLog(context, 'info', '[SIMULATION]   Layer 3: Application code', 'build');
      
      // Simulate optimizing
      addLog(context, 'info', '[SIMULATION] Step 5/6: Optimizing image...', 'build');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
      
      // Simulate finalizing
      addLog(context, 'info', '[SIMULATION] Step 6/6: Finalizing image...', 'build');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
      
      // Simulate image size
      const simulatedSize = Math.floor(Math.random() * 100 + 50) * 1024 * 1024; // 50-150 MB
      addLog(context, 'info', `[SIMULATION] Image size: ${formatBytes(simulatedSize)}`, 'build');
      addLog(context, 'info', `[SIMULATION] Image tag: ${context.imageTag}`, 'build');
      addLog(context, 'info', '[SIMULATION] Build completed successfully! ✅', 'build');
      
      return context;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // DOCKER BUILD (Custom Dockerfile)
    // ─────────────────────────────────────────────────────────────────
    
    async function dockerBuild(context: BuildContext): Promise<BuildContext> {
      const { workDir, imageTag, job } = context;
      
      addLog(context, 'info', 'Using custom Dockerfile...', 'build');
      
      // In a real implementation, we would:
      // 1. Run `docker build -t ${imageTag} ${workDir}`
      // 2. Stream the build output to logs
      // 3. Handle errors
      
      // For now, throw an error since we're in simulation-only mode
      throw new Error(
        'Real Docker build not implemented yet. ' +
        'Set SIMULATION_MODE=true for development.'
      );
    }
    
    // ─────────────────────────────────────────────────────────────────
    // NIXPACKS BUILD (Automatic)
    // ─────────────────────────────────────────────────────────────────
    
    async function nixpacksBuild(context: BuildContext): Promise<BuildContext> {
      const { workDir, imageTag, appType } = context;
      
      addLog(context, 'info', `Using Nixpacks for ${appType?.type} application...`, 'build');
      
      // In a real implementation, we would:
      // 1. Run `nixpacks build ${workDir} --name ${imageTag}`
      // 2. Stream the build output to logs
      // 3. Handle errors
      
      // For now, throw an error since we're in simulation-only mode
      throw new Error(
        'Real Nixpacks build not implemented yet. ' +
        'Set SIMULATION_MODE=true for development.'
      );
    }
    
    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────
    
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    function formatBytes(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    ```
    
- Created `apps\worker\src\steps\push.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 4: Push to Registry
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This step pushes the built Docker image to the container registry.
    //
    // In SIMULATION MODE:
    // - Simulates the push process with delays
    //
    // In REAL MODE:
    // - Uses docker push to upload the image
    // - Handles authentication with the registry
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import type { BuildContext, BuildStep } from '../types';
    import { env } from '../lib/env';
    import { addLog } from '../utils/log-helper';
    
    // ─────────────────────────────────────────────────────────────────
    // PUSH STEP
    // ─────────────────────────────────────────────────────────────────
    
    export const pushStep: BuildStep = {
      name: 'push',
      
      async execute(context: BuildContext): Promise<BuildContext> {
        const { imageTag } = context;
        
        addLog(context, 'info', '📤 Pushing image to registry...', 'push');
        addLog(context, 'info', `Image: ${imageTag}`, 'push');
        
        if (env.SIMULATION_MODE) {
          return simulatePush(context);
        }
        
        return realPush(context);
      },
    };
    
    // ─────────────────────────────────────────────────────────────────
    // SIMULATION MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function simulatePush(context: BuildContext): Promise<BuildContext> {
      addLog(context, 'info', '[SIMULATION] Authenticating with registry...', 'push');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
      
      addLog(context, 'info', '[SIMULATION] Pushing layers...', 'push');
      
      // Simulate layer push progress
      const layers = ['Layer 1/3', 'Layer 2/3', 'Layer 3/3'];
      for (const layer of layers) {
        addLog(context, 'info', `[SIMULATION]   ${layer}: Pushing...`, 'push');
        await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
        addLog(context, 'info', `[SIMULATION]   ${layer}: Pushed ✓`, 'push');
      }
      
      addLog(context, 'info', '[SIMULATION] Image pushed successfully! ✅', 'push');
      addLog(context, 'info', `[SIMULATION] Available at: ${context.imageTag}`, 'push');
      
      return context;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // REAL MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function realPush(context: BuildContext): Promise<BuildContext> {
      // In a real implementation, we would:
      // 1. Authenticate with the registry (docker login)
      // 2. Run `docker push ${imageTag}`
      // 3. Stream the push output to logs
      // 4. Handle errors
      
      throw new Error(
        'Real Docker push not implemented yet. ' +
        'Set SIMULATION_MODE=true for development.'
      );
    }
    
    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────
    
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    ```
    
- Created `apps\worker\src\steps\deploy.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 5: Deploy to Kubernetes
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This step deploys the built image to Kubernetes.
    //
    // In SIMULATION MODE:
    // - Simulates the deployment process with delays
    // - Updates database status
    //
    // In REAL MODE:
    // - Generates Kubernetes manifests (Deployment, Service, Ingress)
    // - Applies manifests to the cluster
    // - Waits for rollout to complete
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import type { BuildContext, BuildStep } from '../types';
    import { env } from '../lib/env';
    import { addLog } from '../utils/log-helper';
    
    // ─────────────────────────────────────────────────────────────────
    // DEPLOY STEP
    // ─────────────────────────────────────────────────────────────────
    
    export const deployStep: BuildStep = {
      name: 'deploy',
      
      async execute(context: BuildContext): Promise<BuildContext> {
        const { job, imageTag } = context;
        
        addLog(context, 'info', '🚀 Deploying to cluster...', 'deploy');
        addLog(context, 'info', `Project: ${job.projectName}`, 'deploy');
        addLog(context, 'info', `Image: ${imageTag}`, 'deploy');
        
        if (env.SIMULATION_MODE) {
          return simulateDeploy(context);
        }
        
        return realDeploy(context);
      },
    };
    
    // ─────────────────────────────────────────────────────────────────
    // SIMULATION MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function simulateDeploy(context: BuildContext): Promise<BuildContext> {
      const { job } = context;
      
      addLog(context, 'info', '[SIMULATION] Generating Kubernetes manifests...', 'deploy');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
      
      // Simulate manifest generation
      addLog(context, 'info', '[SIMULATION]   ✓ Deployment manifest', 'deploy');
      addLog(context, 'info', '[SIMULATION]   ✓ Service manifest', 'deploy');
      addLog(context, 'info', '[SIMULATION]   ✓ Ingress manifest', 'deploy');
      addLog(context, 'info', '[SIMULATION]   ✓ Secret manifest (env vars)', 'deploy');
      
      addLog(context, 'info', '[SIMULATION] Applying manifests to cluster...', 'deploy');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
      
      addLog(context, 'info', '[SIMULATION]   kubectl apply -f deployment.yaml', 'deploy');
      addLog(context, 'info', '[SIMULATION]   deployment.apps/project created', 'deploy');
      addLog(context, 'info', '[SIMULATION]   service/project created', 'deploy');
      addLog(context, 'info', '[SIMULATION]   ingress.networking.k8s.io/project created', 'deploy');
      
      addLog(context, 'info', '[SIMULATION] Waiting for rollout...', 'deploy');
      await sleep(env.SIMULATION_BUILD_DELAY_MS);
      
      addLog(context, 'info', '[SIMULATION]   Waiting for deployment to be ready...', 'deploy');
      addLog(context, 'info', '[SIMULATION]   0/1 pods ready', 'deploy');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 2);
      addLog(context, 'info', '[SIMULATION]   1/1 pods ready', 'deploy');
      
      addLog(context, 'info', '[SIMULATION] Running health checks...', 'deploy');
      await sleep(env.SIMULATION_BUILD_DELAY_MS / 3);
      addLog(context, 'info', '[SIMULATION]   Health check passed! ✅', 'deploy');
      
      // Generate the app URL
      const appUrl = `https://${job.projectSlug}.${env.REGISTRY_URL.replace('localhost:', 'localhost.')}`;
      
      addLog(context, 'info', '', 'deploy');
      addLog(context, 'info', '════════════════════════════════════════════', 'deploy');
      addLog(context, 'info', '🎉 DEPLOYMENT SUCCESSFUL!', 'deploy');
      addLog(context, 'info', '════════════════════════════════════════════', 'deploy');
      addLog(context, 'info', '', 'deploy');
      addLog(context, 'info', `[SIMULATION] Your app is live at: ${appUrl}`, 'deploy');
      addLog(context, 'info', '', 'deploy');
      
      return context;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // REAL MODE
    // ─────────────────────────────────────────────────────────────────
    
    async function realDeploy(context: BuildContext): Promise<BuildContext> {
      // In a real implementation, we would:
      // 1. Generate Kubernetes manifests using templates
      // 2. Apply manifests: kubectl apply -f
      // 3. Wait for rollout: kubectl rollout status
      // 4. Run health checks
      // 5. Configure SSL certificate
      // 6. Update DNS
      
      throw new Error(
        'Real Kubernetes deployment not implemented yet. ' +
        'Set SIMULATION_MODE=true for development.'
      );
    }
    
    // ─────────────────────────────────────────────────────────────────
    // MANIFEST TEMPLATES (for future use)
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Generate Kubernetes Deployment manifest
     */
    export function generateDeploymentManifest(
      projectSlug: string,
      imageTag: string,
      port: number,
      envVars: Record<string, string>
    ): object {
      return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: projectSlug,
          labels: {
            app: projectSlug,
            'managed-by': 'paas-platform',
          },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: projectSlug,
            },
          },
          template: {
            metadata: {
              labels: {
                app: projectSlug,
              },
            },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: imageTag,
                  ports: [
                    {
                      containerPort: port,
                    },
                  ],
                  env: Object.entries(envVars).map(([name, value]) => ({
                    name,
                    value,
                  })),
                  resources: {
                    requests: {
                      memory: '128Mi',
                      cpu: '100m',
                    },
                    limits: {
                      memory: '512Mi',
                      cpu: '500m',
                    },
                  },
                  readinessProbe: {
                    httpGet: {
                      path: '/health',
                      port: port,
                    },
                    initialDelaySeconds: 5,
                    periodSeconds: 10,
                  },
                  livenessProbe: {
                    httpGet: {
                      path: '/health',
                      port: port,
                    },
                    initialDelaySeconds: 15,
                    periodSeconds: 20,
                  },
                },
              ],
            },
          },
        },
      };
    }
    
    /**
     * Generate Kubernetes Service manifest
     */
    export function generateServiceManifest(
      projectSlug: string,
      port: number
    ): object {
      return {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: projectSlug,
        },
        spec: {
          selector: {
            app: projectSlug,
          },
          ports: [
            {
              port: 80,
              targetPort: port,
            },
          ],
        },
      };
    }
    
    /**
     * Generate Kubernetes Ingress manifest
     */
    export function generateIngressManifest(
      projectSlug: string,
      domain: string
    ): object {
      return {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: projectSlug,
          annotations: {
            'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          },
        },
        spec: {
          ingressClassName: 'traefik',
          tls: [
            {
              hosts: [domain],
              secretName: `${projectSlug}-tls`,
            },
          ],
          rules: [
            {
              host: domain,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: projectSlug,
                        port: {
                          number: 80,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────
    
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    ```
    

- Created `apps\worker\src\utils\log-helper.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Log Helper Utilities
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Helper functions for adding logs to the build context and database.
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import type { BuildContext, BuildLogEntry } from '../types';
    import { logger } from '../lib/logger';
    
    /**
     * Add a log entry to the build context
     * Also logs to the worker's logger for debugging
     * 
     * @param context - Build context
     * @param level - Log level
     * @param message - Log message
     * @param step - Current build step name
     */
    export function addLog(
      context: BuildContext,
      level: 'info' | 'warn' | 'error' | 'debug',
      message: string,
      step?: string
    ): void {
      const entry: BuildLogEntry = {
        timestamp: new Date(),
        level,
        message,
        step,
      };
      
      context.logs.push(entry);
      
      // Also log to the worker logger for visibility
      const logData = {
        deploymentId: context.job.deploymentId,
        step,
      };
      
      switch (level) {
        case 'error':
          logger.error(logData, message);
          break;
        case 'warn':
          logger.warn(logData, message);
          break;
        case 'debug':
          logger.debug(logData, message);
          break;
        default:
          logger.info(logData, message);
      }
    }
    
    /**
     * Format duration in a human-readable format
     */
    export function formatDuration(ms: number): string {
      if (ms < 1000) {
        return `${ms}ms`;
      }
      
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      
      if (minutes === 0) {
        return `${seconds}s`;
      }
      
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    /**
     * Create a formatted log prefix with timestamp
     */
    export function formatLogPrefix(step: string): string {
      const timestamp = new Date().toISOString();
      return `[${timestamp}] [${step.toUpperCase()}]`;
    }
    
    ```
    
- Created `apps\worker\src\utils\db-updater.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Database Updater
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Functions to update deployment status in the database.
    // This allows the worker to report progress back to the API.
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { eq, and } from 'drizzle-orm';
    import { db } from '../db';
    import { logger } from '../lib/logger';
    import type { BuildLogEntry, BuildStatus, DeployStatus } from '../types';
    
    // Import schema types - we'll inline the table definitions since we're in a separate package
    // In production, you'd share this through a shared package
    import { pgTable, uuid, varchar, text, timestamp, boolean, integer, bigint } from 'drizzle-orm/pg-core';
    
    // ─────────────────────────────────────────────────────────────────
    // SCHEMA DEFINITIONS (duplicated from API for now)
    // ─────────────────────────────────────────────────────────────────
    
    const deployments = pgTable('deployments', {
      id: uuid('id').defaultRandom().primaryKey(),
      projectId: uuid('project_id').notNull(),
      gitCommitSha: varchar('git_commit_sha', { length: 100 }),
      gitCommitMessage: varchar('git_commit_message', { length: 500 }),
      gitBranch: varchar('git_branch', { length: 255 }),
      gitAuthor: varchar('git_author', { length: 255 }),
      buildStatus: varchar('build_status', { length: 50 }).default('queued'),
      buildStartedAt: timestamp('build_started_at'),
      buildFinishedAt: timestamp('build_finished_at'),
      buildDurationMs: integer('build_duration_ms'),
      imageTag: varchar('image_tag', { length: 255 }),
      imageSizeBytes: bigint('image_size_bytes', { mode: 'number' }),
      deployStatus: varchar('deploy_status', { length: 50 }).default('pending'),
      deployStartedAt: timestamp('deploy_started_at'),
      deployFinishedAt: timestamp('deploy_finished_at'),
      isCurrent: boolean('is_current').default(false),
      triggeredBy: varchar('triggered_by', { length: 50 }),
      createdAt: timestamp('created_at').defaultNow(),
    });
    
    const buildLogs = pgTable('build_logs', {
      id: uuid('id').defaultRandom().primaryKey(),
      deploymentId: uuid('deployment_id').notNull(),
      timestamp: timestamp('timestamp').defaultNow(),
      level: varchar('level', { length: 20 }).default('info'),
      message: text('message').notNull(),
    });
    
    const projects = pgTable('projects', {
      id: uuid('id').defaultRandom().primaryKey(),
      status: varchar('status', { length: 50 }).default('inactive'),
    });
    
    // ─────────────────────────────────────────────────────────────────
    // UPDATE FUNCTIONS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Update deployment build status
     */
    export async function updateBuildStatus(
      deploymentId: string,
      status: BuildStatus,
      additionalData?: {
        buildStartedAt?: Date;
        buildFinishedAt?: Date;
        buildDurationMs?: number;
        imageTag?: string;
        imageSizeBytes?: number;
      }
    ): Promise<void> {
      try {
        await db
          .update(deployments)
          .set({
            buildStatus: status,
            ...additionalData,
          })
          .where(eq(deployments.id, deploymentId));
        
        logger.debug({ deploymentId, status }, 'Updated build status');
      } catch (error) {
        logger.error({ err: error, deploymentId }, 'Failed to update build status');
        throw error;
      }
    }
    
    /**
     * Update deployment deploy status
     */
    export async function updateDeployStatus(
      deploymentId: string,
      status: DeployStatus,
      additionalData?: {
        deployStartedAt?: Date;
        deployFinishedAt?: Date;
      }
    ): Promise<void> {
      try {
        await db
          .update(deployments)
          .set({
            deployStatus: status,
            ...additionalData,
          })
          .where(eq(deployments.id, deploymentId));
        
        logger.debug({ deploymentId, status }, 'Updated deploy status');
      } catch (error) {
        logger.error({ err: error, deploymentId }, 'Failed to update deploy status');
        throw error;
      }
    }
    
    /**
     * Mark a deployment as current (live)
     */
    export async function markDeploymentAsCurrent(
      deploymentId: string,
      projectId: string
    ): Promise<void> {
      try {
        // First, unmark all current deployments for this project
        await db
          .update(deployments)
          .set({ isCurrent: false })
          .where(
            and(
              eq(deployments.projectId, projectId),
              eq(deployments.isCurrent, true)
            )
          );
        
        // Then mark the specified deployment as current
        await db
          .update(deployments)
          .set({
            isCurrent: true,
            deployStatus: 'live',
            deployFinishedAt: new Date(),
          })
          .where(eq(deployments.id, deploymentId));
        
        logger.info({ deploymentId, projectId }, 'Marked deployment as current');
      } catch (error) {
        logger.error({ err: error, deploymentId }, 'Failed to mark deployment as current');
        throw error;
      }
    }
    
    /**
     * Update project status
     */
    export async function updateProjectStatus(
      projectId: string,
      status: string
    ): Promise<void> {
      try {
        await db
          .update(projects)
          .set({ status })
          .where(eq(projects.id, projectId));
        
        logger.debug({ projectId, status }, 'Updated project status');
      } catch (error) {
        logger.error({ err: error, projectId }, 'Failed to update project status');
        throw error;
      }
    }
    
    /**
     * Add build logs to the database
     */
    export async function saveBuildLogs(
      deploymentId: string,
      logs: BuildLogEntry[]
    ): Promise<void> {
      if (logs.length === 0) return;
      
      try {
        const values = logs.map((log) => ({
          deploymentId,
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
        }));
        
        await db.insert(buildLogs).values(values);
        
        logger.debug({ deploymentId, count: logs.length }, 'Saved build logs');
      } catch (error) {
        logger.error({ err: error, deploymentId }, 'Failed to save build logs');
        // Don't throw - logging failures shouldn't stop the build
      }
    }
    
    /**
     * Add a single build log entry
     */
    export async function addBuildLog(
      deploymentId: string,
      message: string,
      level: 'info' | 'warn' | 'error' | 'debug' = 'info'
    ): Promise<void> {
      try {
        await db.insert(buildLogs).values({
          deploymentId,
          message,
          level,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error({ err: error, deploymentId }, 'Failed to add build log');
        // Don't throw - logging failures shouldn't stop the build
      }
    }
    
    ```
    

- Created `apps\worker\src\processor.ts`
    
    ---
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Build Job Processor
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This is the main processor that handles build jobs.
    // It orchestrates the build pipeline:
    // 1. Clone repository
    // 2. Detect application type
    // 3. Build Docker image
    // 4. Push to registry
    // 5. Deploy to Kubernetes
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { Worker, type Job } from 'bullmq';
    import { join } from 'path';
    import { rm } from 'fs/promises';
    import { nanoid } from 'nanoid';
    import { getWorkerConnection } from './lib/redis';
    import { env } from './lib/env';
    import { logger } from './lib/logger';
    import type { BuildContext, BuildJobData, BuildResult, BuildStep } from './types';
    
    // Import build steps
    import { cloneStep } from './steps/clone';
    import { detectStep } from './steps/detect';
    import { buildStep } from './steps/build';
    import { pushStep } from './steps/push';
    import { deployStep } from './steps/deploy';
    
    // Import database updaters
    import {
      updateBuildStatus,
      updateDeployStatus,
      markDeploymentAsCurrent,
      updateProjectStatus,
      saveBuildLogs,
    } from './utils/db-updater';
    import { addLog, formatDuration } from './utils/log-helper';
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE NAME (must match API)
    // ─────────────────────────────────────────────────────────────────
    
    const BUILD_QUEUE_NAME = 'build-jobs';
    
    // ─────────────────────────────────────────────────────────────────
    // BUILD PIPELINE
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * The ordered list of build steps
     */
    const BUILD_PIPELINE: BuildStep[] = [
      cloneStep,
      detectStep,
      buildStep,
      pushStep,
      deployStep,
    ];
    
    // ─────────────────────────────────────────────────────────────────
    // MAIN PROCESSOR
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Process a build job
     * This is called by BullMQ for each job in the queue
     */
    async function processJob(job: Job<BuildJobData>): Promise<BuildResult> {
      const startTime = Date.now();
      const { data } = job;
      
      logger.info({
        jobId: job.id,
        deploymentId: data.deploymentId,
        projectId: data.projectId,
        triggeredBy: data.triggeredBy,
      }, '🚀 Starting build job');
    
      // Create work directory
      const workDir = join(
        env.BUILD_WORKSPACE,
        `${data.projectSlug}-${nanoid(8)}`
      );
    
      // Initialize build context
      const context: BuildContext = {
        job: data,
        workDir,
        startTime,
        logs: [],
      };
    
      try {
        // Update status to "building"
        await updateBuildStatus(data.deploymentId, 'building', {
          buildStartedAt: new Date(),
        });
        await updateProjectStatus(data.projectId, 'building');
    
        addLog(context, 'info', '════════════════════════════════════════════');
        addLog(context, 'info', '🏗️  PaaS BUILD STARTED');
        addLog(context, 'info', '════════════════════════════════════════════');
        addLog(context, 'info', '');
        addLog(context, 'info', `Project: ${data.projectName}`);
        addLog(context, 'info', `Branch: ${data.gitBranch}`);
        addLog(context, 'info', `Triggered by: ${data.triggeredBy}`);
        addLog(context, 'info', '');
    
        // Run each step in the pipeline
        let currentContext = context;
        
        for (const step of BUILD_PIPELINE) {
          const stepStartTime = Date.now();
          
          logger.info({ step: step.name, deploymentId: data.deploymentId }, `Starting step: ${step.name}`);
          
          // Update job progress
          await job.updateProgress({
            step: step.name,
            message: `Running ${step.name}...`,
          });
    
          // Execute the step
          currentContext = await step.execute(currentContext);
          
          const stepDuration = Date.now() - stepStartTime;
          logger.info({ 
            step: step.name, 
            deploymentId: data.deploymentId,
            duration: stepDuration,
          }, `Completed step: ${step.name}`);
        }
    
        // Calculate build duration
        const buildDuration = Date.now() - startTime;
    
        // Update deployment as successful
        await updateBuildStatus(data.deploymentId, 'success', {
          buildFinishedAt: new Date(),
          buildDurationMs: buildDuration,
          imageTag: currentContext.imageTag,
        });
        
        await updateDeployStatus(data.deploymentId, 'deploying', {
          deployStartedAt: new Date(),
        });
    
        // Mark as current deployment
        await markDeploymentAsCurrent(data.deploymentId, data.projectId);
        
        // Update project status to running
        await updateProjectStatus(data.projectId, 'running');
    
        // Save build logs to database
        await saveBuildLogs(data.deploymentId, currentContext.logs);
    
        addLog(currentContext, 'info', '');
        addLog(currentContext, 'info', `Total build time: ${formatDuration(buildDuration)}`);
    
        logger.info({
          deploymentId: data.deploymentId,
          duration: buildDuration,
          imageTag: currentContext.imageTag,
        }, '✅ Build completed successfully');
    
        return {
          success: true,
          imageTag: currentContext.imageTag,
          buildDurationMs: buildDuration,
          logs: currentContext.logs,
        };
    
      } catch (error) {
        const buildDuration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
        logger.error({
          err: error,
          deploymentId: data.deploymentId,
          duration: buildDuration,
        }, '❌ Build failed');
    
        addLog(context, 'error', '');
        addLog(context, 'error', '════════════════════════════════════════════');
        addLog(context, 'error', '❌ BUILD FAILED');
        addLog(context, 'error', '════════════════════════════════════════════');
        addLog(context, 'error', '');
        addLog(context, 'error', `Error: ${errorMessage}`);
        addLog(context, 'error', `Build time: ${formatDuration(buildDuration)}`);
    
        // Update deployment as failed
        await updateBuildStatus(data.deploymentId, 'failed', {
          buildFinishedAt: new Date(),
          buildDurationMs: buildDuration,
        });
        
        await updateProjectStatus(data.projectId, 'failed');
    
        // Save build logs even on failure
        await saveBuildLogs(data.deploymentId, context.logs);
    
        return {
          success: false,
          buildDurationMs: buildDuration,
          error: errorMessage,
          logs: context.logs,
        };
    
      } finally {
        // Cleanup: Remove working directory
        try {
          await rm(workDir, { recursive: true, force: true });
          logger.debug({ workDir }, 'Cleaned up working directory');
        } catch (cleanupError) {
          logger.warn({ err: cleanupError, workDir }, 'Failed to cleanup working directory');
        }
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // WORKER INSTANCE
    // ─────────────────────────────────────────────────────────────────
    
    let worker: Worker<BuildJobData, BuildResult> | null = null;
    
    /**
     * Start the build worker
     */
    export function startWorker(): Worker<BuildJobData, BuildResult> {
      if (worker) {
        logger.warn('Worker already started');
        return worker;
      }
    
      worker = new Worker<BuildJobData, BuildResult>(
        BUILD_QUEUE_NAME,
        processJob,
        {
          connection: getWorkerConnection(),
          concurrency: env.WORKER_CONCURRENCY,
          name: env.WORKER_NAME,
        }
      );
    
      // Event handlers
      worker.on('ready', () => {
        logger.info({
          queueName: BUILD_QUEUE_NAME,
          concurrency: env.WORKER_CONCURRENCY,
          workerName: env.WORKER_NAME,
        }, '🔧 Worker is ready and listening for jobs');
      });
    
      worker.on('completed', (job, result) => {
        logger.info({
          jobId: job.id,
          deploymentId: job.data.deploymentId,
          success: result.success,
          duration: result.buildDurationMs,
        }, 'Job completed');
      });
    
      worker.on('failed', (job, error) => {
        logger.error({
          jobId: job?.id,
          deploymentId: job?.data.deploymentId,
          error: error.message,
        }, 'Job failed');
      });
    
      worker.on('error', (error) => {
        logger.error({ err: error }, 'Worker error');
      });
    
      worker.on('stalled', (jobId) => {
        logger.warn({ jobId }, 'Job stalled');
      });
    
      return worker;
    }
    
    /**
     * Stop the worker gracefully
     */
    export async function stopWorker(): Promise<void> {
      if (worker) {
        logger.info('Stopping worker...');
        await worker.close();
        worker = null;
        logger.info('Worker stopped');
      }
    }
    
    /**
     * Check if worker is running
     */
    export function isWorkerRunning(): boolean {
      return worker !== null && worker.isRunning();
    }
    
    ```
    
- Created `apps\worker\src\index.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // PaaS Build Worker - Entry Point
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This is the main entry point for the Build Worker service.
    // The worker:
    // - Connects to Redis to listen for build jobs
    // - Processes jobs through the build pipeline
    // - Updates the database with build status and logs
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { env } from './lib/env';
    import { logger } from './lib/logger';
    import { testDatabaseConnection, closeDatabaseConnection } from './db';
    import { closeRedisConnection } from './lib/redis';
    import { startWorker, stopWorker } from './processor';
    
    // ─────────────────────────────────────────────────────────────────
    // STARTUP
    // ─────────────────────────────────────────────────────────────────
    
    async function main() {
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('🏗️  PaaS Build Worker Starting...');
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('');
    
      // Log configuration
      logger.info({
        nodeEnv: env.NODE_ENV,
        simulationMode: env.SIMULATION_MODE,
        concurrency: env.WORKER_CONCURRENCY,
        workerName: env.WORKER_NAME,
        buildTimeout: `${env.BUILD_TIMEOUT_MS / 1000}s`,
        buildWorkspace: env.BUILD_WORKSPACE,
      }, 'Worker configuration');
    
      // Test database connection
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        logger.error('Failed to connect to database. Exiting...');
        process.exit(1);
      }
    
      // Start the worker
      const worker = startWorker();
    
      logger.info('');
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('✅ Worker is running and waiting for jobs!');
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('');
    
      if (env.SIMULATION_MODE) {
        logger.warn('🧪 SIMULATION MODE is enabled - builds will be simulated');
        logger.warn('   Set SIMULATION_MODE=false to enable real Docker builds');
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // GRACEFUL SHUTDOWN
    // ─────────────────────────────────────────────────────────────────
    
    async function shutdown(signal: string) {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
      try {
        // Stop accepting new jobs and wait for current jobs to finish
        await stopWorker();
        
        // Close database connection
        await closeDatabaseConnection();
        
        // Close Redis connection
        await closeRedisConnection();
    
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      }
    }
    
    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught exception');
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled rejection');
      process.exit(1);
    });
    
    // ─────────────────────────────────────────────────────────────────
    // START
    // ─────────────────────────────────────────────────────────────────
    
    main().catch((error) => {
      logger.error({ err: error }, 'Failed to start worker');
      process.exit(1);
    });
    
    ```
    

- AI Thinking
    
    ---
    
    Good progress! Now I need to:
    
    1. Update the API to add jobs to the queue when a deployment is triggered
    2. Update the root package.json to add worker scripts
    3. Test everything
- Now let me update the API to add jobs to the queue when deployments are triggered:

- Updated: `apps\api\src\controllers\deployments.controller.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Deployments Controller - Business Logic for Deployments
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This controller handles the business logic for deployment management:
    // - Authorization checks
    // - Status validation
    // - Calling services
    // - Formatting responses
    //
    // EXPRESS EQUIVALENT:
    // exports.list = async (req, res, next) => {
    //   try {
    //     const deployments = await deploymentService.listByProjectId(req.params.projectId);
    //     res.json({ data: deployments });
    //   } catch (error) {
    //     next(error);
    //   }
    // };
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { HTTPException } from 'hono/http-exception';
    import * as deploymentService from '../services/deployments.service';
    import * as projectService from '../services/projects.service';
    import { logger } from '../lib/logger';
    import { addBuildJob, removeBuildJob, type BuildJobData } from '../queue';
    
    // ─────────────────────────────────────────────────────────────────
    // TYPES
    // ─────────────────────────────────────────────────────────────────
    
    export interface ListDeploymentsOptions {
      page?: number;
      limit?: number;
      buildStatus?: string;
      deployStatus?: string;
      gitBranch?: string;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // AUTHORIZATION HELPER
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Verify that the user owns the project
     * Throws 404 if project not found or doesn't belong to user
     */
    async function verifyProjectOwnership(
      projectId: string,
      userId: string
    ): Promise<void> {
      const project = await projectService.getProjectByIdAndUserId(projectId, userId);
    
      if (!project) {
        throw new HTTPException(404, {
          message: 'Project not found',
        });
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // LIST DEPLOYMENTS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * List all deployments for a project
     * 
     * EXPRESS EQUIVALENT:
     * exports.list = async (req, res) => {
     *   const deployments = await Deployment.findAll({
     *     where: { projectId: req.params.projectId },
     *     order: [['createdAt', 'DESC']],
     *   });
     *   res.json({ data: deployments });
     * };
     */
    export async function listDeployments(
      projectId: string,
      userId: string,
      options: ListDeploymentsOptions = {}
    ) {
      // Verify user owns the project
      await verifyProjectOwnership(projectId, userId);
    
      const { page = 1, limit = 20, ...filters } = options;
    
      const { deployments, total } = await deploymentService.listDeploymentsByProjectId(
        projectId,
        { page, limit, ...filters }
      );
    
      return {
        deployments,
        pagination: {
          page,
          perPage: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // GET DEPLOYMENT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Get a single deployment with details
     */
    export async function getDeployment(
      projectId: string,
      deploymentId: string,
      userId: string
    ) {
      // Verify user owns the project
      await verifyProjectOwnership(projectId, userId);
    
      const deployment = await deploymentService.getDeploymentByIdAndProjectId(
        deploymentId,
        projectId
      );
    
      if (!deployment) {
        throw new HTTPException(404, {
          message: 'Deployment not found',
        });
      }
    
      return deployment;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // GET BUILD LOGS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Get build logs for a deployment
     */
    export async function getBuildLogs(
      projectId: string,
      deploymentId: string,
      userId: string,
      options: { page?: number; limit?: number } = {}
    ) {
      // Verify user owns the project
      await verifyProjectOwnership(projectId, userId);
    
      // Verify deployment belongs to project
      const deployment = await deploymentService.getDeploymentByIdAndProjectId(
        deploymentId,
        projectId
      );
    
      if (!deployment) {
        throw new HTTPException(404, {
          message: 'Deployment not found',
        });
      }
    
      const { page = 1, limit = 500 } = options;
    
      const { logs, total } = await deploymentService.getBuildLogsPaginated(
        deploymentId,
        { page, limit }
      );
    
      return {
        logs,
        pagination: {
          page,
          perPage: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        deployment: {
          id: deployment.id,
          buildStatus: deployment.buildStatus,
          deployStatus: deployment.deployStatus,
        },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // TRIGGER DEPLOYMENT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Trigger a new deployment for a project
     * This creates a deployment record, updates project status, and adds to build queue
     */
    export async function triggerDeployment(
      projectId: string,
      userId: string,
      triggeredBy: 'webhook' | 'manual' | 'rollback' | 'cli' = 'manual',
      gitCommitSha?: string,
      gitCommitMessage?: string
    ) {
      // Verify user owns the project
      const project = await projectService.getProjectByIdAndUserId(projectId, userId);
    
      if (!project) {
        throw new HTTPException(404, {
          message: 'Project not found',
        });
      }
    
      // Check if there's already a deployment in progress
      // We allow new deployments even if one is in progress
      // The build worker will handle queuing
    
      // Create deployment record
      const deployment = await deploymentService.createDeployment({
        projectId,
        gitBranch: project.gitBranch,
        gitCommitSha,
        gitCommitMessage,
        triggeredBy,
      });
    
      // Update project status to building
      await projectService.updateProjectStatus(projectId, 'building');
    
      logger.info(
        { userId, projectId, deploymentId: deployment.id, triggeredBy },
        'Deployment triggered'
      );
    
      // Add initial log entry
      await deploymentService.addBuildLog(
        deployment.id,
        `Deployment triggered by ${triggeredBy}`,
        'info'
      );
    
      // Get environment variables for the build (unmasked for build)
      const envVars = await projectService.listEnvVarsUnmasked(projectId);
      const envVarsMap: Record<string, string> = {};
      for (const ev of envVars) {
        envVarsMap[ev.key] = ev.value;
      }
    
      // Add job to build queue
      try {
        const jobData: BuildJobData = {
          deploymentId: deployment.id,
          projectId: project.id,
          userId: userId,
          gitRepoUrl: project.gitRepoUrl,
          gitBranch: project.gitBranch || 'main',
          gitCommitSha: gitCommitSha,
          buildCommand: project.buildCommand || undefined,
          startCommand: project.startCommand || undefined,
          rootDirectory: project.gitRootDir || undefined,
          port: project.port || 3000,
          instanceType: project.instanceType || 'small',
          envVars: envVarsMap,
          triggeredBy,
          projectName: project.name,
          projectSlug: project.slug,
        };
    
        await addBuildJob(jobData);
        
        await deploymentService.addBuildLog(
          deployment.id,
          'Build job added to queue',
          'info'
        );
        
        logger.info(
          { deploymentId: deployment.id, projectId },
          'Build job added to queue'
        );
      } catch (error) {
        logger.error(
          { err: error, deploymentId: deployment.id },
          'Failed to add build job to queue'
        );
        
        // Update deployment status to failed
        await deploymentService.updateBuildStatus(deployment.id, 'failed');
        
        await deploymentService.addBuildLog(
          deployment.id,
          `Failed to queue build job: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
    
        throw new HTTPException(500, {
          message: 'Failed to queue deployment',
        });
      }
    
      return deployment;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // ROLLBACK DEPLOYMENT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Rollback to a previous deployment
     * 
     * This marks the target deployment as current and creates a new
     * deployment record for tracking purposes.
     */
    export async function rollbackDeployment(
      projectId: string,
      deploymentId: string,
      userId: string
    ) {
      // Verify user owns the project
      await verifyProjectOwnership(projectId, userId);
    
      // Get the deployment to rollback to
      const targetDeployment = await deploymentService.getDeploymentByIdAndProjectId(
        deploymentId,
        projectId
      );
    
      if (!targetDeployment) {
        throw new HTTPException(404, {
          message: 'Deployment not found',
        });
      }
    
      // Check if deployment can be rolled back to
      if (!deploymentService.canRollbackTo(targetDeployment)) {
        throw new HTTPException(400, {
          message: 'Cannot rollback to this deployment. Deployment must have a successful build with an image.',
        });
      }
    
      // Get current deployment (if any)
      const currentDeployment = await deploymentService.getCurrentDeployment(projectId);
    
      // Create a new deployment record for the rollback
      const rollbackDeployment = await deploymentService.createDeployment({
        projectId,
        gitCommitSha: targetDeployment.gitCommitSha || undefined,
        gitCommitMessage: `Rollback to deployment ${targetDeployment.id.slice(0, 8)}`,
        gitBranch: targetDeployment.gitBranch || undefined,
        triggeredBy: 'rollback',
      });
    
      // Update the rollback deployment with the same image as target
      await deploymentService.updateBuildStatus(rollbackDeployment.id, 'success', {
        buildStartedAt: new Date(),
        buildFinishedAt: new Date(),
        buildDurationMs: 0,
        imageTag: targetDeployment.imageTag || undefined,
        imageSizeBytes: targetDeployment.imageSizeBytes || undefined,
      });
    
      // Mark the rollback deployment as current
      await deploymentService.markDeploymentAsCurrent(rollbackDeployment.id, projectId);
    
      // Update project status
      await projectService.updateProjectStatus(projectId, 'running');
    
      logger.info(
        {
          userId,
          projectId,
          rollbackDeploymentId: rollbackDeployment.id,
          targetDeploymentId: deploymentId,
          previousDeploymentId: currentDeployment?.id,
        },
        'Deployment rolled back'
      );
    
      // Add log entry
      await deploymentService.addBuildLog(
        rollbackDeployment.id,
        `Rolled back to deployment ${targetDeployment.id.slice(0, 8)}`,
        'info'
      );
    
      return rollbackDeployment;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // CANCEL DEPLOYMENT
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Cancel a running deployment
     */
    export async function cancelDeployment(
      projectId: string,
      deploymentId: string,
      userId: string
    ) {
      // Verify user owns the project
      await verifyProjectOwnership(projectId, userId);
    
      // Get the deployment
      const deployment = await deploymentService.getDeploymentByIdAndProjectId(
        deploymentId,
        projectId
      );
    
      if (!deployment) {
        throw new HTTPException(404, {
          message: 'Deployment not found',
        });
      }
    
      // Check if deployment can be cancelled
      if (!deploymentService.canCancelDeployment(deployment)) {
        throw new HTTPException(400, {
          message: 'Cannot cancel this deployment. Only queued or building deployments can be cancelled.',
        });
      }
    
      // Try to remove from queue if not yet started
      try {
        await removeBuildJob(deploymentId);
        logger.info({ deploymentId }, 'Removed build job from queue');
      } catch (error) {
        logger.debug({ deploymentId }, 'Build job not in queue or already processing');
      }
    
      // Cancel the deployment
      const cancelled = await deploymentService.cancelDeployment(deploymentId);
    
      if (!cancelled) {
        throw new HTTPException(400, {
          message: 'Failed to cancel deployment',
        });
      }
    
      // Update project status back to previous state
      const currentDeployment = await deploymentService.getCurrentDeployment(projectId);
      const newStatus = currentDeployment ? 'running' : 'inactive';
      await projectService.updateProjectStatus(projectId, newStatus);
    
      logger.info(
        { userId, projectId, deploymentId },
        'Deployment cancelled'
      );
    
      // Add log entry
      await deploymentService.addBuildLog(
        deploymentId,
        'Deployment cancelled by user',
        'warn'
      );
    
      return cancelled;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // GET DEPLOYMENT STATS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Get deployment statistics for a project
     */
    export async function getDeploymentStats(projectId: string, userId: string) {
      // Verify user owns the project
      await verifyProjectOwnership(projectId, userId);
    
      const stats = await deploymentService.getDeploymentStats(projectId);
    
      return stats;
    }
    
    ```
    

- Updated`package.json`
    
    ---
    
    ```json
    {
      "name": "paas-platform",
      "version": "0.0.1",
      "private": true,
      "description": "Production-grade Platform as a Service",
      "scripts": {
        "dev": "turbo dev",
        "build": "turbo build",
        "lint": "turbo lint",
        "clean": "turbo clean",
        "dev:api": "pnpm --filter api dev",
        "dev:web": "pnpm --filter web dev",
        "dev:worker": "pnpm --filter worker dev",
        "db:generate": "pnpm --filter api db:generate",
        "db:migrate": "pnpm --filter api db:migrate",
        "db:studio": "pnpm --filter api db:studio"
      },
      "keywords": ["paas", "platform", "kubernetes", "docker", "devops"],
      "author": "",
      "license": "MIT",
      "engines": {
        "node": ">=20.0.0",
        "pnpm": ">=9.0.0"
      }
    }
    
    ```
    
- Updated:`apps\api\src\services\webhooks.service.ts`
    
    ```tsx
    // ═══════════════════════════════════════════════════════════════════════════
    // Webhooks Service - Database Operations for Webhooks
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // This service handles:
    // - Looking up projects by GitHub repo ID or URL
    // - Creating deployments from webhook events
    // - Coordinating with the deployment pipeline
    //
    // EXPRESS EQUIVALENT:
    // This is similar to a Mongoose/Sequelize model service where you'd have
    // methods like Project.findByRepoId() and Deployment.createFromWebhook()
    //
    // ═══════════════════════════════════════════════════════════════════════════
    
    import { eq, and, or } from 'drizzle-orm';
    import { db } from '../db';
    import { projects, deployments, environmentVariables } from '../db/schema';
    import { logger } from '../lib/logger';
    import type { ParsedPushEvent } from '../lib/github';
    import { normalizeGitHubUrl } from '../lib/github';
    import { addBuildJob, type BuildJobData } from '../queue';
    
    // ─────────────────────────────────────────────────────────────────
    // TYPES
    // ─────────────────────────────────────────────────────────────────
    
    export interface WebhookProject {
      id: string;
      name: string;
      slug: string;
      gitBranch: string;
      gitRepoUrl: string;
      gitRepoId: string | null;
      userId: string;
      status: string;
    }
    
    export interface WebhookDeployment {
      id: string;
      projectId: string;
      gitCommitSha: string | null;
      gitCommitMessage: string | null;
      gitBranch: string | null;
      gitAuthor: string | null;
      buildStatus: string;
      deployStatus: string;
      triggeredBy: string | null;
      createdAt: Date;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // PROJECT LOOKUP FUNCTIONS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Find projects that should be deployed based on GitHub push event
     * 
     * We match projects by:
     * 1. GitHub repo ID (most reliable - unique identifier from GitHub)
     * 2. Normalized repo URL (fallback - handle URL variations)
     * 
     * Multiple projects can deploy from the same repo but different branches.
     * 
     * @param repoId - GitHub repository ID from webhook payload
     * @param repoUrl - Repository URL from webhook payload
     * @param branch - Branch that was pushed to
     * @returns Array of matching projects
     */
    export async function findProjectsByWebhook(
      repoId: string,
      repoUrl: string,
      branch: string
    ): Promise<WebhookProject[]> {
      try {
        // Normalize the URL for comparison
        const normalizedUrl = normalizeGitHubUrl(repoUrl);
        
        // Find all projects that:
        // 1. Match either the repo ID or normalized URL
        // 2. AND are configured to deploy from this branch
        // 3. AND are using 'github' as their git provider
        const matchingProjects = await db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            gitBranch: projects.gitBranch,
            gitRepoUrl: projects.gitRepoUrl,
            gitRepoId: projects.gitRepoId,
            userId: projects.userId,
            status: projects.status,
          })
          .from(projects)
          .where(
            and(
              // Match by repo ID or URL
              or(
                eq(projects.gitRepoId, repoId),
                eq(projects.gitRepoUrl, normalizedUrl),
                eq(projects.gitRepoUrl, repoUrl) // Also check original URL
              ),
              // Match the branch
              eq(projects.gitBranch, branch),
              // Only GitHub projects
              eq(projects.gitProvider, 'github')
            )
          );
        
        logger.debug(
          {
            repoId,
            repoUrl: normalizedUrl,
            branch,
            matchCount: matchingProjects.length,
            projectIds: matchingProjects.map(p => p.id),
          },
          'Found projects matching webhook'
        );
        
        return matchingProjects;
      } catch (error) {
        logger.error({ err: error, repoId, repoUrl, branch }, 'Failed to find projects by webhook');
        throw error;
      }
    }
    
    /**
     * Find a single project by GitHub repo ID
     * Useful for updating git repo ID when webhook first arrives
     */
    export async function findProjectByRepoId(repoId: string): Promise<WebhookProject | null> {
      try {
        const [project] = await db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            gitBranch: projects.gitBranch,
            gitRepoUrl: projects.gitRepoUrl,
            gitRepoId: projects.gitRepoId,
            userId: projects.userId,
            status: projects.status,
          })
          .from(projects)
          .where(eq(projects.gitRepoId, repoId))
          .limit(1);
        
        return project || null;
      } catch (error) {
        logger.error({ err: error, repoId }, 'Failed to find project by repo ID');
        throw error;
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // UPDATE OPERATIONS
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Update project's gitRepoId if not already set
     * 
     * This is called on first webhook to store the GitHub repo ID
     * for more reliable matching in the future.
     */
    export async function updateProjectRepoId(
      projectId: string,
      repoId: string
    ): Promise<void> {
      try {
        await db
          .update(projects)
          .set({
            gitRepoId: repoId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(projects.id, projectId),
              // Only update if not already set (prevent overwriting)
              or(
                eq(projects.gitRepoId, ''),
                // Check for null by comparing with a string we know won't match
                eq(projects.gitRepoId, null as any)
              )
            )
          );
        
        logger.debug({ projectId, repoId }, 'Updated project gitRepoId');
      } catch (error) {
        logger.error({ err: error, projectId, repoId }, 'Failed to update project repo ID');
        // Don't throw - this is not critical
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // DEPLOYMENT CREATION
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Create a new deployment from a webhook event
     * 
     * This creates a deployment record with 'queued' status.
     * The Build Worker will pick it up and process it.
     * 
     * EXPRESS EQUIVALENT:
     * const deployment = await Deployment.create({
     *   projectId: project.id,
     *   gitCommitSha: event.commitSha,
     *   ...
     * });
     */
    export async function createDeploymentFromWebhook(
      project: WebhookProject,
      event: ParsedPushEvent
    ): Promise<WebhookDeployment> {
      try {
        // Truncate commit message if too long (database column limit)
        const truncatedMessage = event.commitMessage.length > 490
          ? event.commitMessage.substring(0, 487) + '...'
          : event.commitMessage;
        
        const [deployment] = await db
          .insert(deployments)
          .values({
            projectId: project.id,
            gitCommitSha: event.commitSha,
            gitCommitMessage: truncatedMessage,
            gitBranch: event.branch,
            gitAuthor: event.author,
            buildStatus: 'queued',
            deployStatus: 'pending',
            triggeredBy: 'webhook',
          })
          .returning();
        
        logger.info(
          {
            deploymentId: deployment.id,
            projectId: project.id,
            projectSlug: project.slug,
            commitSha: event.commitSha.substring(0, 7),
            branch: event.branch,
            author: event.author,
          },
          'Created deployment from webhook'
        );
        
        // Update project status to 'building'
        await db
          .update(projects)
          .set({
            status: 'building',
            updatedAt: new Date(),
          })
          .where(eq(projects.id, project.id));
        
        return {
          id: deployment.id,
          projectId: deployment.projectId,
          gitCommitSha: deployment.gitCommitSha,
          gitCommitMessage: deployment.gitCommitMessage,
          gitBranch: deployment.gitBranch,
          gitAuthor: deployment.gitAuthor,
          buildStatus: deployment.buildStatus,
          deployStatus: deployment.deployStatus,
          triggeredBy: deployment.triggeredBy,
          createdAt: deployment.createdAt,
        };
      } catch (error) {
        logger.error(
          { err: error, projectId: project.id, commitSha: event.commitSha },
          'Failed to create deployment from webhook'
        );
        throw error;
      }
    }
    
    /**
     * Check if a deployment already exists for this commit
     * 
     * Prevents duplicate deployments if webhook is sent multiple times.
     */
    export async function deploymentExistsForCommit(
      projectId: string,
      commitSha: string
    ): Promise<boolean> {
      try {
        const [existing] = await db
          .select({ id: deployments.id })
          .from(deployments)
          .where(
            and(
              eq(deployments.projectId, projectId),
              eq(deployments.gitCommitSha, commitSha)
            )
          )
          .limit(1);
        
        return !!existing;
      } catch (error) {
        logger.error(
          { err: error, projectId, commitSha },
          'Failed to check for existing deployment'
        );
        return false; // Default to allowing creation if check fails
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // WEBHOOK LOGGING (Future: Store webhook events for debugging)
    // ─────────────────────────────────────────────────────────────────
    
    // TODO: Add webhook_events table to store all webhook payloads
    // This is useful for:
    // - Debugging webhook issues
    // - Replaying failed webhooks
    // - Audit trail
    
    export interface WebhookEventLog {
      id: string;
      provider: 'github' | 'gitlab' | 'bitbucket';
      event: string;
      payload: unknown;
      signature: string;
      deliveryId: string;
      processedAt: Date | null;
      status: 'pending' | 'success' | 'failed' | 'ignored';
      errorMessage: string | null;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // QUEUE INTEGRATION (BullMQ)
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * Add deployment to the build queue
     * 
     * This function:
     * 1. Gets the full project details
     * 2. Gets environment variables
     * 3. Creates a build job and adds it to the queue
     */
    export async function queueDeploymentBuild(deployment: WebhookDeployment): Promise<void> {
      try {
        // Get full project details
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, deployment.projectId))
          .limit(1);
        
        if (!project) {
          logger.error({ deploymentId: deployment.id, projectId: deployment.projectId }, 'Project not found for webhook deployment');
          return;
        }
        
        // Get environment variables
        const envVars = await db
          .select()
          .from(environmentVariables)
          .where(eq(environmentVariables.projectId, deployment.projectId));
        
        const envVarsMap: Record<string, string> = {};
        for (const ev of envVars) {
          envVarsMap[ev.key] = ev.value;
        }
        
        // Create build job data
        const jobData: BuildJobData = {
          deploymentId: deployment.id,
          projectId: deployment.projectId,
          userId: project.userId,
          gitRepoUrl: project.gitRepoUrl,
          gitBranch: deployment.gitBranch || project.gitBranch || 'main',
          gitCommitSha: deployment.gitCommitSha || undefined,
          buildCommand: project.buildCommand || undefined,
          startCommand: project.startCommand || undefined,
          rootDirectory: project.gitRootDir || undefined,
          port: project.port || 3000,
          instanceType: project.instanceType || 'small',
          envVars: envVarsMap,
          triggeredBy: 'webhook',
          projectName: project.name,
          projectSlug: project.slug,
        };
        
        // Add to queue
        await addBuildJob(jobData);
        
        logger.info(
          {
            deploymentId: deployment.id,
            projectId: deployment.projectId,
            projectSlug: project.slug,
          },
          'Deployment added to build queue'
        );
      } catch (error) {
        logger.error(
          {
            err: error,
            deploymentId: deployment.id,
            projectId: deployment.projectId,
          },
          'Failed to queue deployment build'
        );
        throw error;
      }
    }
    
    ```
    

Then AI ran:

```sql
cd "C:\Users\PrajwalRaj\Desktop\DevOpsee Proje\PaaS ( Platform as a Service )"; pnpm install
```

- Output
    
    ---
    
    ```
    Scope: all 4 workspace projects
    Progress: resolved 1, reused 0, downloaded 0, added 0
    
       ╭──────────────────────────────────────────╮
       │                                          │
       │   Update available! 10.28.0 → 10.28.2.   │
       │   Changelog: https://pnpm.io/v/10.28.2   │
       │     To update, run: pnpm add -g pnpm     │
       │                                          │
       ╰──────────────────────────────────────────╯
    
    Progress: resolved 19, reused 13, downloaded 0, added 0
    Progress: resolved 21, reused 19, downloaded 0, added 0
    Progress: resolved 31, reused 24, downloaded 1, added 0
    Progress: resolved 61, reused 37, downloaded 1, added 0
    Progress: resolved 80, reused 65, downloaded 1, added 0
    Progress: resolved 120, reused 82, downloaded 1, added 0
    Progress: resolved 182, reused 101, downloaded 3, added 0
     WARN  2 deprecated subdependencies found: @esbuild-kit/core-utils@3.3.2, @esbuild-kit/esm-loader@2.6.5
    Packages: +3
    +++
    Progress: resolved 231, reused 116, downloaded 3, added 0
    Progress: resolved 231, reused 131, downloaded 3, added 3, done
    
    ╭ Warning ─────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │   Ignored build scripts: esbuild@0.18.20, esbuild@0.19.12, esbuild@0.27.2,   │
    │   msgpackr-extract@3.0.3.                                                    │
    │   Run "pnpm approve-builds" to pick which dependencies should be allowed     │
    │   to run scripts.                                                            │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    Done in 13.7s using pnpm v10.28.0
    ```