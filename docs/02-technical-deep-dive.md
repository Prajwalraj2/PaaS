# PaaS Platform - Technical Deep Dive

> Complete technical specification for building a production-grade PaaS

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [System Components](#system-components)
3. [User Flow](#user-flow)
4. [Features & Functions](#features--functions)
5. [API Design](#api-design)
6. [Database Schema](#database-schema)
7. [Build Pipeline](#build-pipeline)
8. [Kubernetes Integration](#kubernetes-integration)
9. [Security](#security)
10. [Scalability](#scalability)

---

## Technology Stack

### Core Platform Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TECHNOLOGY STACK                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FRONTEND (Dashboard)                                                       │
│  ├── Framework:        Next.js 14+ (App Router)                            │
│  ├── Language:         TypeScript                                           │
│  ├── Styling:          Tailwind CSS + shadcn/ui                            │
│  ├── State:            Zustand / TanStack Query                            │
│  ├── Real-time:        Socket.io / Server-Sent Events                      │
│  └── Auth:             NextAuth.js                                          │
│                                                                             │
│  BACKEND (API Server)                                                       │
│  ├── Language:         Go (recommended) or Node.js                         │
│  ├── Framework:        Fiber/Gin (Go) or Fastify/Hono (Node)               │
│  ├── API Style:        REST + WebSocket                                     │
│  ├── Validation:       Zod (Node) / validator (Go)                         │
│  └── ORM:              Drizzle/Prisma (Node) / GORM/sqlc (Go)              │
│                                                                             │
│  DATABASE                                                                   │
│  ├── Primary:          PostgreSQL 16                                        │
│  ├── Cache:            Redis 7                                              │
│  ├── Queue:            Redis (BullMQ) or RabbitMQ                          │
│  └── Search:           PostgreSQL Full-Text (or Meilisearch)               │
│                                                                             │
│  BUILD SYSTEM                                                               │
│  ├── Primary:          Nixpacks                                             │
│  ├── Fallback:         Cloud Native Buildpacks                              │
│  ├── Registry:         Harbor / Docker Registry                            │
│  └── Storage:          MinIO (S3-compatible)                                │
│                                                                             │
│  ORCHESTRATION                                                              │
│  ├── Platform:         Kubernetes (K3s for simplicity)                     │
│  ├── Ingress:          Traefik                                              │
│  ├── SSL:              cert-manager + Let's Encrypt                        │
│  ├── DNS:              External-DNS + Cloudflare                           │
│  └── GitOps:           Flux / ArgoCD (optional)                            │
│                                                                             │
│  OBSERVABILITY                                                              │
│  ├── Logging:          Loki + Promtail                                      │
│  ├── Metrics:          Prometheus + Grafana                                 │
│  ├── Tracing:          Jaeger / Tempo                                       │
│  └── Alerting:         Alertmanager + PagerDuty/Slack                      │
│                                                                             │
│  INFRASTRUCTURE                                                             │
│  ├── Cloud:            AWS / GCP / Hetzner / DigitalOcean                  │
│  ├── IaC:              Terraform / Pulumi                                   │
│  ├── Secrets:          Vault / Sealed Secrets                              │
│  └── CI/CD:            GitHub Actions                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why These Technologies?


| Technology     | Why Chosen                           | Alternatives Considered     |
| -------------- | ------------------------------------ | --------------------------- |
| **Next.js**    | SSR, API routes, great DX, ecosystem | Remix, SvelteKit            |
| **Go**         | Performance, low memory, K8s native  | Node.js, Rust               |
| **PostgreSQL** | ACID, JSON support, reliability      | MySQL, CockroachDB          |
| **Redis**      | Speed, pub/sub, queues               | Valkey, Dragonfly           |
| **Nixpacks**   | Fast, reproducible, modern           | Buildpacks, Dockerfile-only |
| **Kubernetes** | Industry standard, ecosystem         | Nomad, Docker Swarm         |
| **Traefik**    | K8s native, auto-discovery, auto-SSL | Nginx, Kong                 |
| **Loki**       | Log aggregation, Grafana native      | ELK, Splunk                 |


---

## System Components

### Component Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM COMPONENTS                                          │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND LAYER                                                                          │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           WEB DASHBOARD (Next.js)                                │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │   │
│  │  │   Auth       │ │  Projects    │ │  Deployments │ │   Settings   │           │   │
│  │  │   Pages      │ │  Management  │ │   & Logs     │ │   & Billing  │           │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │   │
│  │                                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                     REAL-TIME COMPONENTS                                  │   │   │
│  │  │  • Build Logs Streaming (WebSocket)                                       │   │   │
│  │  │  • Deployment Status Updates (SSE)                                        │   │   │
│  │  │  • Application Logs Viewer (WebSocket)                                    │   │   │
│  │  │  • Resource Metrics (Polling/WebSocket)                                   │   │   │
│  │  └──────────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           CLI TOOL (Go/Node)                                     │   │
│  │                                                                                  │   │
│  │  paas login                    # Authenticate                                    │   │
│  │  paas projects list            # List projects                                   │   │
│  │  paas deploy                   # Deploy current directory                        │   │
│  │  paas logs -f                  # Stream logs                                     │   │
│  │  paas env set KEY=VALUE        # Set environment variable                        │   │
│  │  paas scale web=3              # Scale to 3 instances                            │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ API LAYER                                                                               │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           API GATEWAY / SERVER                                   │   │
│  │                                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐     │   │
│  │  │                        REST API ENDPOINTS                               │     │   │
│  │  │                                                                         │     │   │
│  │  │  /api/v1/auth/*           Authentication & OAuth                       │     │   │
│  │  │  /api/v1/users/*          User management                              │     │   │
│  │  │  /api/v1/projects/*       Project CRUD                                 │     │   │
│  │  │  /api/v1/deployments/*    Deployment management                        │     │   │
│  │  │  /api/v1/services/*       Database & add-on services                   │     │   │
│  │  │  /api/v1/domains/*        Custom domain management                     │     │   │
│  │  │  /api/v1/billing/*        Billing & subscription                       │     │   │
│  │  │  /api/v1/teams/*          Team & collaboration                         │     │   │
│  │  │                                                                         │     │   │
│  │  └────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐     │   │
│  │  │                        WEBHOOK HANDLERS                                 │     │   │
│  │  │                                                                         │     │   │
│  │  │  /webhooks/github         GitHub push events                           │     │   │
│  │  │  /webhooks/gitlab         GitLab push events                           │     │   │
│  │  │  /webhooks/stripe         Payment events                               │     │   │
│  │  │                                                                         │     │   │
│  │  └────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐     │   │
│  │  │                        WEBSOCKET ENDPOINTS                              │     │   │
│  │  │                                                                         │     │   │
│  │  │  /ws/builds/:id           Build log streaming                          │     │   │
│  │  │  /ws/logs/:projectId      Application log streaming                    │     │   │
│  │  │  /ws/metrics/:projectId   Real-time metrics                            │     │   │
│  │  │                                                                         │     │   │
│  │  └────────────────────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ WORKER LAYER                                                                            │
│                                                                                         │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐               │
│  │   BUILD WORKER     │  │   DEPLOY WORKER    │  │   CLEANUP WORKER   │               │
│  │                    │  │                    │  │                    │               │
│  │  • Clone repo      │  │  • Generate K8s    │  │  • Remove old      │               │
│  │  • Detect app type │  │    manifests       │  │    deployments     │               │
│  │  • Run Nixpacks    │  │  • Apply to cluster│  │  • Prune images    │               │
│  │  • Push image      │  │  • Health check    │  │  • Clean volumes   │               │
│  │  • Update status   │  │  • Update DNS      │  │  • Archive logs    │               │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘               │
│                                                                                         │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐               │
│  │   METRICS WORKER   │  │   BILLING WORKER   │  │   BACKUP WORKER    │               │
│  │                    │  │                    │  │                    │               │
│  │  • Collect CPU/RAM │  │  • Calculate usage │  │  • Backup databases│               │
│  │  • Track bandwidth │  │  • Generate invoice│  │  • Snapshot volumes│               │
│  │  • Store in DB     │  │  • Process payments│  │  • Upload to S3    │               │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER                                                                    │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           KUBERNETES CLUSTER                                     │   │
│  │                                                                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                    SYSTEM NAMESPACE (paas-system)                        │   │   │
│  │   │                                                                          │   │   │
│  │   │  • API Server Deployment         • Traefik Ingress Controller           │   │   │
│  │   │  • Build Workers                 • cert-manager                         │   │   │
│  │   │  • Deploy Workers                • External-DNS                          │   │   │
│  │   │  • Container Registry            • Prometheus + Grafana                  │   │   │
│  │   │  • PostgreSQL (platform DB)      • Loki + Promtail                       │   │   │
│  │   │  • Redis (cache + queue)                                                 │   │   │
│  │   │                                                                          │   │   │
│  │   └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                  │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │   │ user-abc123 │  │ user-def456 │  │ user-ghi789 │  │ user-jkl012 │           │   │
│  │   │  Namespace  │  │  Namespace  │  │  Namespace  │  │  Namespace  │           │   │
│  │   │             │  │             │  │             │  │             │           │   │
│  │   │ • App pods  │  │ • App pods  │  │ • App pods  │  │ • App pods  │           │   │
│  │   │ • Services  │  │ • Services  │  │ • Services  │  │ • Services  │           │   │
│  │   │ • Ingress   │  │ • Ingress   │  │ • Ingress   │  │ • Ingress   │           │   │
│  │   │ • Secrets   │  │ • Secrets   │  │ • Secrets   │  │ • Secrets   │           │   │
│  │   │ • ConfigMap │  │ • ConfigMap │  │ • ConfigMap │  │ • ConfigMap │           │   │
│  │   │ • PG Pod    │  │             │  │ • Redis Pod │  │ • PG + Redis│           │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## User Flow

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER JOURNEY                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: ONBOARDING
═══════════════════

    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   Visit     │     │   Sign Up   │     │   Verify    │     │  Dashboard  │
    │   Landing   │────►│   OAuth/    │────►│   Email     │────►│   Home      │
    │   Page      │     │   Email     │     │   (optional)│     │             │
    └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘


PHASE 2: FIRST PROJECT
══════════════════════

    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                 │
    │   ┌───────────────┐                                                            │
    │   │ + New Project │                                                            │
    │   └───────┬───────┘                                                            │
    │           │                                                                     │
    │           ▼                                                                     │
    │   ┌───────────────────────────────────────────────────────────────────────┐    │
    │   │                     PROJECT CREATION WIZARD                            │    │
    │   │                                                                        │    │
    │   │   Step 1: Choose Source                                                │    │
    │   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │    │
    │   │   │   GitHub    │  │   GitLab    │  │  Bitbucket  │                   │    │
    │   │   │     ✓       │  │             │  │             │                   │    │
    │   │   └─────────────┘  └─────────────┘  └─────────────┘                   │    │
    │   │                                                                        │    │
    │   │   Step 2: Select Repository                                            │    │
    │   │   ┌────────────────────────────────────────────────────┐              │    │
    │   │   │  🔍 Search repositories...                         │              │    │
    │   │   ├────────────────────────────────────────────────────┤              │    │
    │   │   │  📁 my-nextjs-app              ⭐ 12    ●          │              │    │
    │   │   │  📁 api-backend                ⭐ 5     ●          │              │    │
    │   │   │  📁 landing-page               ⭐ 3     ●          │              │    │
    │   │   └────────────────────────────────────────────────────┘              │    │
    │   │                                                                        │    │
    │   │   Step 3: Configure                                                    │    │
    │   │   ┌────────────────────────────────────────────────────┐              │    │
    │   │   │  Project Name:  [ my-nextjs-app        ]           │              │    │
    │   │   │  Branch:        [ main ▼ ]                         │              │    │
    │   │   │  Root Dir:      [ / ]                              │              │    │
    │   │   │  Auto Deploy:   [✓] on push to main                │              │    │
    │   │   └────────────────────────────────────────────────────┘              │    │
    │   │                                                                        │    │
    │   │   Step 4: Environment Variables (Optional)                             │    │
    │   │   ┌────────────────────────────────────────────────────┐              │    │
    │   │   │  DATABASE_URL     = [••••••••••••••••]             │              │    │
    │   │   │  API_KEY          = [••••••••••••••••]             │              │    │
    │   │   │  + Add Variable                                    │              │    │
    │   │   └────────────────────────────────────────────────────┘              │    │
    │   │                                                                        │    │
    │   │                              [ 🚀 Deploy ]                             │    │
    │   └───────────────────────────────────────────────────────────────────────┘    │
    │                                                                                 │
    └─────────────────────────────────────────────────────────────────────────────────┘


PHASE 3: DEPLOYMENT (What happens after clicking Deploy)
═════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │                            DEPLOYMENT VIEW                                       │
    │                                                                                  │
    │   Project: my-nextjs-app                                        Status: Building│
    │   ─────────────────────────────────────────────────────────────────────────────│
    │                                                                                  │
    │   ┌─────────────────────────────────────────────────────────────────────────┐   │
    │   │  DEPLOYMENT #1                                                          │   │
    │   │  ───────────────────────────────────────────────────────────────────── │   │
    │   │                                                                         │   │
    │   │  [✓] Queued                                              00:00         │   │
    │   │  [✓] Cloning repository                                  00:03         │   │
    │   │  [✓] Detected: Next.js application                       00:04         │   │
    │   │  [●] Building...                                         00:15         │   │
    │   │  [ ] Pushing image                                                      │   │
    │   │  [ ] Deploying to cluster                                               │   │
    │   │  [ ] Configuring routing                                                │   │
    │   │  [ ] Running health checks                                              │   │
    │   │  [ ] Live!                                                              │   │
    │   │                                                                         │   │
    │   └─────────────────────────────────────────────────────────────────────────┘   │
    │                                                                                  │
    │   ┌─────────────────────────────────────────────────────────────────────────┐   │
    │   │  BUILD LOGS                                               [ ↓ Auto-scroll]│   │
    │   │  ───────────────────────────────────────────────────────────────────── │   │
    │   │  [2024-01-12 10:23:15] Nixpacks: Detected Node.js 20.x                  │   │
    │   │  [2024-01-12 10:23:16] Installing dependencies...                       │   │
    │   │  [2024-01-12 10:23:45] npm install completed                            │   │
    │   │  [2024-01-12 10:23:46] Running: npm run build                           │   │
    │   │  [2024-01-12 10:24:12] Next.js build completed                          │   │
    │   │  [2024-01-12 10:24:13] Creating container image...                      │   │
    │   │  [2024-01-12 10:24:25] Image size: 245MB                                │   │
    │   │  ▌                                                                      │   │
    │   └─────────────────────────────────────────────────────────────────────────┘   │
    │                                                                                  │
    └─────────────────────────────────────────────────────────────────────────────────┘


PHASE 4: LIVE APPLICATION
═════════════════════════

    ┌─────────────────────────────────────────────────────────────────────────────────┐
    │                            PROJECT DASHBOARD                                     │
    │                                                                                  │
    │   my-nextjs-app                                                 ● Running       │
    │   ─────────────────────────────────────────────────────────────────────────────│
    │                                                                                  │
    │   🔗 https://my-nextjs-app-abc123.yourpaas.com                  [ Open ↗ ]      │
    │                                                                                  │
    │   ┌───────────────────────────────────────────────────────────────────────────┐ │
    │   │  TABS:  [ Overview ] [ Deployments ] [ Logs ] [ Metrics ] [ Settings ]   │ │
    │   └───────────────────────────────────────────────────────────────────────────┘ │
    │                                                                                  │
    │   OVERVIEW                                                                       │
    │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
    │   │   CPU Usage     │  │   Memory        │  │   Requests      │                │
    │   │   ████░░░ 45%   │  │   ███░░░ 128MB  │  │   1.2k/min      │                │
    │   └─────────────────┘  └─────────────────┘  └─────────────────┘                │
    │                                                                                  │
    │   RECENT DEPLOYMENTS                                                            │
    │   ┌─────────────────────────────────────────────────────────────────────────┐   │
    │   │  #3  abc1234  "Add dark mode"          ● Live      2 min ago    [Logs]  │   │
    │   │  #2  def5678  "Fix auth bug"           ○ Previous  1 hour ago   [Logs]  │   │
    │   │  #1  ghi9012  "Initial deploy"         ○ Previous  2 hours ago  [Logs]  │   │
    │   └─────────────────────────────────────────────────────────────────────────┘   │
    │                                                                                  │
    │   SERVICES                                                                       │
    │   ┌─────────────────────────────────────────────────────────────────────────┐   │
    │   │  🐘 PostgreSQL    postgres-abc    ● Running    [ Connection String ]     │   │
    │   │  🔴 Redis         redis-abc       ● Running    [ Connection String ]     │   │
    │   │                                                                          │   │
    │   │  [ + Add Service ]                                                       │   │
    │   └─────────────────────────────────────────────────────────────────────────┘   │
    │                                                                                  │
    └─────────────────────────────────────────────────────────────────────────────────┘


PHASE 5: ONGOING MANAGEMENT
═══════════════════════════

    User can:
    ├── Push to GitHub → Auto-deploy triggers
    ├── View real-time logs
    ├── Monitor metrics & alerts
    ├── Scale instances (web=3)
    ├── Add custom domains
    ├── Manage environment variables
    ├── Add databases & services
    ├── Rollback to previous deployment
    ├── View deployment history
    └── Manage team members & permissions
```

---

## Features & Functions

### MVP Features (Phase 1)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                MVP FEATURES                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  AUTHENTICATION                                                                         │
│  ├── [ ] GitHub OAuth login                                                            │
│  ├── [ ] Email/password registration                                                   │
│  ├── [ ] JWT token management                                                          │
│  └── [ ] Session handling                                                              │
│                                                                                         │
│  PROJECT MANAGEMENT                                                                     │
│  ├── [ ] Create project from GitHub repo                                               │
│  ├── [ ] List user's projects                                                          │
│  ├── [ ] Delete project                                                                │
│  ├── [ ] Project settings (name, branch, etc.)                                         │
│  └── [ ] Environment variables (CRUD)                                                  │
│                                                                                         │
│  BUILD SYSTEM                                                                           │
│  ├── [ ] Clone repository                                                              │
│  ├── [ ] Auto-detect app type                                                          │
│  ├── [ ] Build with Nixpacks                                                           │
│  ├── [ ] Dockerfile fallback                                                           │
│  ├── [ ] Push to container registry                                                    │
│  └── [ ] Build log streaming                                                           │
│                                                                                         │
│  DEPLOYMENT                                                                             │
│  ├── [ ] Deploy to Kubernetes                                                          │
│  ├── [ ] Generate unique subdomain                                                     │
│  ├── [ ] SSL/TLS certificate                                                           │
│  ├── [ ] Health checks                                                                 │
│  ├── [ ] Deployment status tracking                                                    │
│  └── [ ] Rollback capability                                                           │
│                                                                                         │
│  LOGGING                                                                                │
│  ├── [ ] Collect container logs                                                        │
│  ├── [ ] Stream logs to dashboard                                                      │
│  └── [ ] Log search (basic)                                                            │
│                                                                                         │
│  DASHBOARD                                                                              │
│  ├── [ ] Project list view                                                             │
│  ├── [ ] Project detail view                                                           │
│  ├── [ ] Deployment history                                                            │
│  ├── [ ] Build logs viewer                                                             │
│  └── [ ] Application logs viewer                                                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Production Features (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION FEATURES                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ADVANCED DEPLOYMENT                                                                    │
│  ├── [ ] Preview deployments (per PR)                                                  │
│  ├── [ ] Manual deploy trigger                                                         │
│  ├── [ ] Scheduled deployments                                                         │
│  ├── [ ] Blue-green deployments                                                        │
│  ├── [ ] Canary deployments                                                            │
│  └── [ ] Multi-region deployment                                                       │
│                                                                                         │
│  DATABASES & SERVICES                                                                   │
│  ├── [ ] One-click PostgreSQL                                                          │
│  ├── [ ] One-click Redis                                                               │
│  ├── [ ] One-click MongoDB                                                             │
│  ├── [ ] Database connection strings                                                   │
│  ├── [ ] Automated backups                                                             │
│  └── [ ] Point-in-time recovery                                                        │
│                                                                                         │
│  CUSTOM DOMAINS                                                                         │
│  ├── [ ] Add custom domain                                                             │
│  ├── [ ] DNS verification                                                              │
│  ├── [ ] Automatic SSL provisioning                                                    │
│  └── [ ] Wildcard certificates                                                         │
│                                                                                         │
│  SCALING                                                                                │
│  ├── [ ] Manual scaling (replicas)                                                     │
│  ├── [ ] Auto-scaling (HPA)                                                            │
│  ├── [ ] Resource limits configuration                                                 │
│  └── [ ] Scale to zero                                                                 │
│                                                                                         │
│  MONITORING & OBSERVABILITY                                                             │
│  ├── [ ] Real-time metrics dashboard                                                   │
│  ├── [ ] CPU/Memory/Network graphs                                                     │
│  ├── [ ] Custom alerts                                                                 │
│  ├── [ ] Uptime monitoring                                                             │
│  └── [ ] Error tracking integration                                                    │
│                                                                                         │
│  TEAM & COLLABORATION                                                                   │
│  ├── [ ] Team creation                                                                 │
│  ├── [ ] Invite members                                                                │
│  ├── [ ] Role-based access control                                                     │
│  └── [ ] Audit logs                                                                    │
│                                                                                         │
│  BILLING                                                                                │
│  ├── [ ] Usage tracking                                                                │
│  ├── [ ] Subscription plans                                                            │
│  ├── [ ] Stripe integration                                                            │
│  ├── [ ] Invoices                                                                      │
│  └── [ ] Usage alerts                                                                  │
│                                                                                         │
│  CLI TOOL                                                                               │
│  ├── [ ] Authentication                                                                │
│  ├── [ ] Deploy from local directory                                                   │
│  ├── [ ] Log streaming                                                                 │
│  ├── [ ] Environment variable management                                               │
│  └── [ ] Project management                                                            │
│                                                                                         │
│  GITHUB INTEGRATION                                                                     │
│  ├── [ ] GitHub App installation                                                       │
│  ├── [ ] Commit status checks                                                          │
│  ├── [ ] PR comments with preview URLs                                                 │
│  └── [ ] Branch protection integration                                                 │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Advanced Features (Phase 3)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              ADVANCED FEATURES                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ├── [ ] Edge deployments (multi-region)                                               │
│  ├── [ ] WebSocket/long-running process support                                        │
│  ├── [ ] Cron jobs                                                                     │
│  ├── [ ] Background workers                                                            │
│  ├── [ ] Private networking between services                                           │
│  ├── [ ] VPC peering                                                                   │
│  ├── [ ] SOC 2 compliance features                                                     │
│  ├── [ ] SAML/SSO authentication                                                       │
│  ├── [ ] Terraform provider                                                            │
│  ├── [ ] API rate limiting                                                             │
│  ├── [ ] DDoS protection                                                               │
│  └── [ ] AI-assisted debugging                                                         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## API Design

### RESTful API Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                API ENDPOINTS                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤

BASE URL: https://api.yourpaas.com/v1

AUTHENTICATION
──────────────
POST   /auth/register              Register new user
POST   /auth/login                 Login with email/password
POST   /auth/github                GitHub OAuth callback
POST   /auth/refresh               Refresh JWT token
POST   /auth/logout                Logout (invalidate token)
GET    /auth/me                    Get current user

USERS
─────
GET    /users/:id                  Get user profile
PATCH  /users/:id                  Update user profile
DELETE /users/:id                  Delete user account

PROJECTS
────────
GET    /projects                   List all projects
POST   /projects                   Create new project
GET    /projects/:id               Get project details
PATCH  /projects/:id               Update project
DELETE /projects/:id               Delete project
POST   /projects/:id/redeploy      Trigger redeployment

DEPLOYMENTS
───────────
GET    /projects/:id/deployments                List deployments
POST   /projects/:id/deployments                Create deployment
GET    /projects/:id/deployments/:deployId      Get deployment details
POST   /projects/:id/deployments/:deployId/rollback   Rollback to this deployment
GET    /projects/:id/deployments/:deployId/logs       Get build logs

ENVIRONMENT VARIABLES
─────────────────────
GET    /projects/:id/env           List env vars (masked)
POST   /projects/:id/env           Add env var
PATCH  /projects/:id/env/:key      Update env var
DELETE /projects/:id/env/:key      Delete env var

DOMAINS
───────
GET    /projects/:id/domains       List domains
POST   /projects/:id/domains       Add custom domain
DELETE /projects/:id/domains/:domain   Remove domain
POST   /projects/:id/domains/:domain/verify   Verify domain

SERVICES (Databases)
────────────────────
GET    /projects/:id/services      List services
POST   /projects/:id/services      Create service (postgres, redis, etc.)
GET    /projects/:id/services/:serviceId   Get service details
DELETE /projects/:id/services/:serviceId   Delete service

LOGS
────
GET    /projects/:id/logs          Get application logs
WS     /projects/:id/logs/stream   Stream logs in real-time

METRICS
───────
GET    /projects/:id/metrics       Get current metrics
GET    /projects/:id/metrics/history   Get historical metrics

TEAMS
─────
GET    /teams                      List user's teams
POST   /teams                      Create team
GET    /teams/:id                  Get team details
PATCH  /teams/:id                  Update team
DELETE /teams/:id                  Delete team
POST   /teams/:id/members          Add team member
DELETE /teams/:id/members/:userId  Remove team member

BILLING
───────
GET    /billing                    Get billing overview
GET    /billing/usage              Get current usage
GET    /billing/invoices           List invoices
POST   /billing/subscription       Update subscription
POST   /billing/payment-method     Update payment method

WEBHOOKS (Incoming)
───────────────────
POST   /webhooks/github            GitHub push events
POST   /webhooks/stripe            Stripe payment events

└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### API Response Format

```json
// Success Response
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "my-app",
    "status": "running",
    "url": "https://my-app-abc123.yourpaas.com"
  },
  "meta": {
    "requestId": "req_xyz789",
    "timestamp": "2024-01-12T10:30:00Z"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID 'proj_abc123' not found",
    "details": {}
  },
  "meta": {
    "requestId": "req_xyz789",
    "timestamp": "2024-01-12T10:30:00Z"
  }
}

// Paginated Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 45,
    "totalPages": 3
  },
  "meta": {...}
}
```

---

## Database Schema

### Core Tables

```sql
-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),  -- NULL for OAuth users
    name            VARCHAR(255),
    avatar_url      VARCHAR(500),
    github_id       VARCHAR(100) UNIQUE,
    plan            VARCHAR(50) DEFAULT 'free',  -- free, pro, enterprise
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500) UNIQUE NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL,
    prefix          VARCHAR(20) NOT NULL,  -- First 8 chars for display
    last_used_at    TIMESTAMP,
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id         UUID REFERENCES teams(id),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    
    -- Git source
    git_provider    VARCHAR(50) NOT NULL,  -- github, gitlab, bitbucket
    git_repo_url    VARCHAR(500) NOT NULL,
    git_repo_id     VARCHAR(100),
    git_branch      VARCHAR(255) DEFAULT 'main',
    git_root_dir    VARCHAR(255) DEFAULT '/',
    
    -- Build config
    build_command   VARCHAR(500),
    start_command   VARCHAR(500),
    dockerfile_path VARCHAR(255),
    
    -- Runtime config
    instance_type   VARCHAR(50) DEFAULT 'small',  -- small, medium, large
    instance_count  INT DEFAULT 1,
    port            INT DEFAULT 3000,
    
    -- Status
    status          VARCHAR(50) DEFAULT 'inactive',  -- inactive, building, deploying, running, failed
    
    -- URLs
    subdomain       VARCHAR(255) UNIQUE,
    
    -- K8s references
    k8s_namespace   VARCHAR(255),
    
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE environment_variables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    key             VARCHAR(255) NOT NULL,
    value           TEXT NOT NULL,  -- Encrypted
    is_secret       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, key)
);

CREATE TABLE custom_domains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    domain          VARCHAR(255) UNIQUE NOT NULL,
    verified        BOOLEAN DEFAULT false,
    ssl_status      VARCHAR(50) DEFAULT 'pending',  -- pending, active, failed
    verification_token VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- DEPLOYMENTS
-- ============================================

CREATE TABLE deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Git info
    git_commit_sha  VARCHAR(100),
    git_commit_msg  VARCHAR(500),
    git_branch      VARCHAR(255),
    git_author      VARCHAR(255),
    
    -- Build info
    build_status    VARCHAR(50) DEFAULT 'queued',  -- queued, building, success, failed
    build_started_at TIMESTAMP,
    build_finished_at TIMESTAMP,
    build_duration_ms INT,
    image_tag       VARCHAR(255),
    image_size_bytes BIGINT,
    
    -- Deploy info
    deploy_status   VARCHAR(50) DEFAULT 'pending',  -- pending, deploying, live, failed, rolled_back
    deploy_started_at TIMESTAMP,
    deploy_finished_at TIMESTAMP,
    
    -- Meta
    is_current      BOOLEAN DEFAULT false,
    triggered_by    VARCHAR(50),  -- webhook, manual, rollback, cli
    
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE build_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id   UUID REFERENCES deployments(id) ON DELETE CASCADE,
    timestamp       TIMESTAMP DEFAULT NOW(),
    level           VARCHAR(20) DEFAULT 'info',  -- info, warn, error
    message         TEXT NOT NULL
);

-- ============================================
-- SERVICES (Databases)
-- ============================================

CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50) NOT NULL,  -- postgres, redis, mysql, mongodb
    version         VARCHAR(50),
    
    -- Connection info (encrypted)
    host            VARCHAR(255),
    port            INT,
    username        VARCHAR(255),
    password        TEXT,
    database_name   VARCHAR(255),
    connection_url  TEXT,
    
    -- K8s reference
    k8s_service_name VARCHAR(255),
    
    -- Resources
    storage_gb      INT DEFAULT 1,
    
    status          VARCHAR(50) DEFAULT 'provisioning',  -- provisioning, running, stopped, failed
    
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TEAMS
-- ============================================

CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    owner_id        UUID REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50) DEFAULT 'member',  -- owner, admin, member, viewer
    created_at      TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(team_id, user_id)
);

-- ============================================
-- BILLING
-- ============================================

CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    plan            VARCHAR(50) NOT NULL,  -- free, pro, enterprise
    status          VARCHAR(50) NOT NULL,  -- active, cancelled, past_due
    current_period_start    TIMESTAMP,
    current_period_end      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    cpu_seconds     BIGINT DEFAULT 0,
    memory_gb_seconds BIGINT DEFAULT 0,
    bandwidth_bytes BIGINT DEFAULT 0,
    build_minutes   INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_deployments_project_id ON deployments(project_id);
CREATE INDEX idx_deployments_created_at ON deployments(created_at);
CREATE INDEX idx_services_project_id ON services(project_id);
CREATE INDEX idx_usage_records_date ON usage_records(date);
```

---

## Build Pipeline

### Detailed Build Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BUILD PIPELINE DETAIL                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

TRIGGER
═══════
    GitHub Webhook (push event)
            │
            ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │  API SERVER                                                               │
    │                                                                           │
    │  1. Verify webhook signature (HMAC SHA-256)                              │
    │  2. Extract: repo, branch, commit SHA, author                            │
    │  3. Find matching project in database                                    │
    │  4. Check if branch matches configured branch                            │
    │  5. Create deployment record (status: queued)                            │
    │  6. Add job to Redis queue                                               │
    │                                                                           │
    │  Queue Payload:                                                           │
    │  {                                                                        │
    │    "deploymentId": "dep_abc123",                                         │
    │    "projectId": "proj_xyz789",                                           │
    │    "gitUrl": "https://github.com/user/repo",                             │
    │    "gitBranch": "main",                                                  │
    │    "gitCommit": "abc123def",                                             │
    │    "envVars": { "NODE_ENV": "production", ... }                          │
    │  }                                                                        │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
BUILD WORKER (Kubernetes Job)
═════════════════════════════
    ┌───────────────────────────────────────────────────────────────────────────┐
    │  BUILD CONTAINER (runs in isolated pod)                                   │
    │                                                                           │
    │  STEP 1: CLONE                                                           │
    │  ────────────────                                                        │
    │  git clone --depth 1 --branch main \                                     │
    │    https://x-access-token:${GITHUB_TOKEN}@github.com/user/repo \         │
    │    /workspace                                                            │
    │                                                                           │
    │  Output: Source code in /workspace                                       │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 2: DETECT APP TYPE                                                 │
    │  ────────────────────────                                                │
    │  Check for (in order):                                                   │
    │                                                                           │
    │  ┌─────────────────┬──────────────────────────────────────────────────┐  │
    │  │ File            │ Detected As                                      │  │
    │  ├─────────────────┼──────────────────────────────────────────────────┤  │
    │  │ Dockerfile      │ Docker (use as-is)                               │  │
    │  │ package.json    │ Node.js (check for next, nuxt, etc.)             │  │
    │  │ requirements.txt│ Python                                           │  │
    │  │ go.mod          │ Go                                               │  │
    │  │ Cargo.toml      │ Rust                                             │  │
    │  │ Gemfile         │ Ruby                                             │  │
    │  │ pom.xml         │ Java (Maven)                                     │  │
    │  │ build.gradle    │ Java (Gradle)                                    │  │
    │  │ mix.exs         │ Elixir                                           │  │
    │  │ composer.json   │ PHP                                              │  │
    │  └─────────────────┴──────────────────────────────────────────────────┘  │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 3: BUILD IMAGE                                                     │
    │  ───────────────────                                                     │
    │                                                                           │
    │  If Dockerfile exists:                                                   │
    │    docker build -t registry.paas.com/user/project:abc123 .              │
    │                                                                           │
    │  Else use Nixpacks:                                                      │
    │    nixpacks build . \                                                    │
    │      --name registry.paas.com/user/project:abc123 \                      │
    │      --env NODE_ENV=production \                                         │
    │      --env DATABASE_URL=*** \                                            │
    │      --start-cmd "npm start"                                             │
    │                                                                           │
    │  Nixpacks internally:                                                    │
    │  1. Creates build plan based on detected language                        │
    │  2. Generates optimized Dockerfile                                       │
    │  3. Builds multi-stage image                                             │
    │  4. Runs npm install, npm build (or equivalent)                          │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 4: PUSH IMAGE                                                      │
    │  ──────────────────                                                      │
    │  docker push registry.paas.com/user/project:abc123                       │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 5: UPDATE STATUS                                                   │
    │  ─────────────────────                                                   │
    │  POST /api/internal/deployments/dep_abc123/build-complete               │
    │  {                                                                        │
    │    "status": "success",                                                  │
    │    "imageTag": "registry.paas.com/user/project:abc123",                  │
    │    "imageSize": 245000000,                                               │
    │    "buildDuration": 45000                                                │
    │  }                                                                        │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
DEPLOY WORKER
═════════════
    ┌───────────────────────────────────────────────────────────────────────────┐
    │  DEPLOY CONTROLLER                                                        │
    │                                                                           │
    │  STEP 1: GENERATE KUBERNETES MANIFESTS                                   │
    │  ─────────────────────────────────────                                   │
    │                                                                           │
    │  Deployment:                                                             │
    │  ```yaml                                                                 │
    │  apiVersion: apps/v1                                                     │
    │  kind: Deployment                                                        │
    │  metadata:                                                               │
    │    name: project-abc123                                                  │
    │    namespace: user-xyz                                                   │
    │  spec:                                                                   │
    │    replicas: 1                                                           │
    │    selector:                                                             │
    │      matchLabels:                                                        │
    │        app: project-abc123                                               │
    │    template:                                                             │
    │      metadata:                                                           │
    │        labels:                                                           │
    │          app: project-abc123                                             │
    │      spec:                                                               │
    │        containers:                                                       │
    │        - name: app                                                       │
    │          image: registry.paas.com/user/project:abc123                    │
    │          ports:                                                          │
    │          - containerPort: 3000                                           │
    │          envFrom:                                                        │
    │          - secretRef:                                                    │
    │              name: project-abc123-env                                    │
    │          resources:                                                      │
    │            requests:                                                     │
    │              memory: "128Mi"                                             │
    │              cpu: "100m"                                                 │
    │            limits:                                                       │
    │              memory: "512Mi"                                             │
    │              cpu: "500m"                                                 │
    │          readinessProbe:                                                 │
    │            httpGet:                                                      │
    │              path: /                                                     │
    │              port: 3000                                                  │
    │            initialDelaySeconds: 5                                        │
    │            periodSeconds: 10                                             │
    │  ```                                                                     │
    │                                                                           │
    │  Service:                                                                │
    │  ```yaml                                                                 │
    │  apiVersion: v1                                                          │
    │  kind: Service                                                           │
    │  metadata:                                                               │
    │    name: project-abc123                                                  │
    │    namespace: user-xyz                                                   │
    │  spec:                                                                   │
    │    selector:                                                             │
    │      app: project-abc123                                                 │
    │    ports:                                                                │
    │    - port: 80                                                            │
    │      targetPort: 3000                                                    │
    │  ```                                                                     │
    │                                                                           │
    │  Ingress:                                                                │
    │  ```yaml                                                                 │
    │  apiVersion: networking.k8s.io/v1                                        │
    │  kind: Ingress                                                           │
    │  metadata:                                                               │
    │    name: project-abc123                                                  │
    │    namespace: user-xyz                                                   │
    │    annotations:                                                          │
    │      cert-manager.io/cluster-issuer: letsencrypt-prod                    │
    │  spec:                                                                   │
    │    ingressClassName: traefik                                             │
    │    tls:                                                                  │
    │    - hosts:                                                              │
    │      - project-abc123.yourpaas.com                                       │
    │      secretName: project-abc123-tls                                      │
    │    rules:                                                                │
    │    - host: project-abc123.yourpaas.com                                   │
    │      http:                                                               │
    │        paths:                                                            │
    │        - path: /                                                         │
    │          pathType: Prefix                                                │
    │          backend:                                                        │
    │            service:                                                      │
    │              name: project-abc123                                        │
    │              port:                                                       │
    │                number: 80                                                │
    │  ```                                                                     │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 2: APPLY MANIFESTS                                                 │
    │  ───────────────────────                                                 │
    │  kubectl apply -f manifests/ --namespace user-xyz                        │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 3: WAIT FOR ROLLOUT                                                │
    │  ────────────────────────                                                │
    │  kubectl rollout status deployment/project-abc123 \                      │
    │    --namespace user-xyz \                                       n         │
    │    --timeout=300s                                                        │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 4: HEALTH CHECK                                                    │
    │  ────────────────────                                                    │
    │  Wait for readiness probe to pass                                        │
    │  curl https://project-abc123.yourpaas.com/health                         │
    │                                                                           │
    │  ─────────────────────────────────────────────────────────────────────── │
    │                                                                           │
    │  STEP 5: MARK AS LIVE                                                    │
    │  ────────────────────                                                    │
    │  Update deployment record: status = "live", is_current = true            │
    │  Mark previous deployment: is_current = false                            │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                                                                           │
    │   🎉 DEPLOYMENT COMPLETE                                                  │
    │                                                                           │
    │   https://project-abc123.yourpaas.com                                    │
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘
```

---

## Security

### Security Considerations

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤

MULTI-TENANCY ISOLATION
════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              KUBERNETES ISOLATION                                       │
│                                                                                         │
│   ┌───────────────────────────────────────────────────────────────────────────────┐    │
│   │                         NAMESPACE ISOLATION                                    │    │
│   │                                                                                │    │
│   │   Each user/team gets their own namespace with:                               │    │
│   │                                                                                │    │
│   │   1. ResourceQuota (limit CPU, memory, storage)                               │    │
│   │   2. LimitRange (default resource limits)                                     │    │
│   │   3. NetworkPolicy (restrict pod-to-pod traffic)                              │    │
│   │   4. RBAC (no access to other namespaces)                                     │    │
│   │                                                                                │    │
│   └───────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
│   ┌───────────────────────────────────────────────────────────────────────────────┐    │
│   │                         NETWORK ISOLATION                                      │    │
│   │                                                                                │    │
│   │   NetworkPolicy Example:                                                       │    │
│   │   ```yaml                                                                      │    │
│   │   apiVersion: networking.k8s.io/v1                                            │    │
│   │   kind: NetworkPolicy                                                          │    │
│   │   metadata:                                                                    │    │
│   │     name: deny-from-other-namespaces                                          │    │
│   │   spec:                                                                        │    │
│   │     podSelector: {}                                                            │    │
│   │     ingress:                                                                   │    │
│   │     - from:                                                                    │    │
│   │       - podSelector: {}  # Allow same namespace only                          │    │
│   │   ```                                                                          │    │
│   │                                                                                │    │
│   └───────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

SECRETS MANAGEMENT
══════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   1. Environment Variables                                                              │
│      • Encrypted at rest in PostgreSQL (AES-256)                                       │
│      • Decrypted only when creating K8s Secrets                                        │
│      • Never logged or exposed in API responses                                        │
│                                                                                         │
│   2. Kubernetes Secrets                                                                 │
│      • Created per-deployment                                                           │
│      • etcd encryption enabled                                                          │
│      • Mounted as environment variables (not files)                                    │
│                                                                                         │
│   3. Platform Secrets (HashiCorp Vault - optional)                                     │
│      • Database credentials                                                            │
│      • API keys                                                                         │
│      • TLS certificates                                                                │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

AUTHENTICATION & AUTHORIZATION
══════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   JWT Token Structure:                                                                  │
│   {                                                                                     │
│     "sub": "user_abc123",                                                              │
│     "email": "user@example.com",                                                       │
│     "plan": "pro",                                                                     │
│     "teams": ["team_xyz"],                                                             │
│     "iat": 1704067200,                                                                 │
│     "exp": 1704153600                                                                  │
│   }                                                                                     │
│                                                                                         │
│   RBAC Roles:                                                                           │
│   • Owner: Full access (delete project, billing)                                       │
│   • Admin: Manage deployments, settings, team members                                  │
│   • Member: Deploy, view logs, manage env vars                                         │
│   • Viewer: Read-only access                                                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

BUILD SECURITY
══════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   1. Isolated Build Environment                                                         │
│      • Each build runs in isolated Kubernetes Job                                      │
│      • No network access to other user workloads                                       │
│      • Ephemeral: destroyed after build completes                                      │
│                                                                                         │
│   2. Resource Limits                                                                    │
│      • CPU: 2 cores max                                                                │
│      • Memory: 4GB max                                                                 │
│      • Build timeout: 30 minutes                                                       │
│      • Disk: 10GB max                                                                  │
│                                                                                         │
│   3. Image Scanning (optional but recommended)                                         │
│      • Trivy for vulnerability scanning                                                │
│      • Block deployment if critical CVEs found                                         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Scalability

### Scaling Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SCALABILITY DESIGN                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤

HORIZONTAL SCALING
══════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   Component              Scaling Strategy                                               │
│   ─────────────────────────────────────────────────────────────────────────────────    │
│   API Server             HPA based on CPU/request count                                │
│   Build Workers          KEDA based on Redis queue length                              │
│   Deploy Workers         KEDA based on job queue                                       │
│   Container Registry     Distributed storage (S3)                                      │
│   PostgreSQL             Read replicas, connection pooling (PgBouncer)                 │
│   Redis                  Redis Cluster or Redis Sentinel                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

USER APP SCALING
════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   HorizontalPodAutoscaler for user apps:                                               │
│                                                                                         │
│   ```yaml                                                                              │
│   apiVersion: autoscaling/v2                                                           │
│   kind: HorizontalPodAutoscaler                                                        │
│   metadata:                                                                            │
│     name: project-abc123                                                               │
│   spec:                                                                                │
│     scaleTargetRef:                                                                    │
│       apiVersion: apps/v1                                                              │
│       kind: Deployment                                                                 │
│       name: project-abc123                                                             │
│     minReplicas: 1                                                                     │
│     maxReplicas: 10                                                                    │
│     metrics:                                                                           │
│     - type: Resource                                                                   │
│       resource:                                                                        │
│         name: cpu                                                                      │
│         target:                                                                        │
│           type: Utilization                                                            │
│           averageUtilization: 70                                                       │
│   ```                                                                                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

MULTI-REGION (Future)
═════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                             │
│   │   Region    │     │   Region    │     │   Region    │                             │
│   │   US-East   │     │   EU-West   │     │   AP-South  │                             │
│   │             │     │             │     │             │                             │
│   │  K8s Cluster│     │  K8s Cluster│     │  K8s Cluster│                             │
│   │  Registry   │     │  Registry   │     │  Registry   │                             │
│   │  Redis      │     │  Redis      │     │  Redis      │                             │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                             │
│          │                   │                   │                                     │
│          └───────────────────┼───────────────────┘                                     │
│                              │                                                         │
│                    ┌─────────┴─────────┐                                              │
│                    │  Global Load      │                                              │
│                    │  Balancer         │                                              │
│                    │  (Cloudflare/     │                                              │
│                    │   AWS Global)     │                                              │
│                    └───────────────────┘                                              │
│                                                                                         │
│   • PostgreSQL: CockroachDB or read replicas per region                               │
│   • Registry: Replicated across regions                                                │
│   • Users choose deployment region(s)                                                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Libraries & Tools Summary

### Complete Dependency List

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              LIBRARIES & TOOLS                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤

FRONTEND (Next.js)
══════════════════
next                    ^14.0.0     Framework
react                   ^18.0.0     UI library
typescript              ^5.0.0      Type safety
tailwindcss             ^3.4.0      Styling
@radix-ui/*             latest      UI primitives
shadcn/ui               latest      Component library
@tanstack/react-query   ^5.0.0      Server state
zustand                 ^4.0.0      Client state
socket.io-client        ^4.0.0      Real-time
next-auth               ^4.0.0      Authentication
react-hook-form         ^7.0.0      Forms
zod                     ^3.0.0      Validation
lucide-react            latest      Icons
recharts                ^2.0.0      Charts
@monaco-editor/react    ^4.0.0      Code editor (logs)
date-fns                ^3.0.0      Date formatting

BACKEND (Go)
════════════
fiber                   v2          HTTP framework
gorm                    v2          ORM
redis/go-redis          v9          Redis client
golang-jwt/jwt          v5          JWT handling
go-playground/validator v10         Validation
spf13/viper             v1          Configuration
uber-go/zap             v1          Logging
prometheus/client       v1          Metrics
gorilla/websocket       v1          WebSocket
google/uuid             v1          UUID generation

BACKEND (Node.js Alternative)
═════════════════════════════
fastify                 ^4.0.0      HTTP framework (or hono)
drizzle-orm             ^0.29.0     ORM
ioredis                 ^5.0.0      Redis client
bullmq                  ^5.0.0      Job queue
jose                    ^5.0.0      JWT
pino                    ^8.0.0      Logging
zod                     ^3.0.0      Validation
ws                      ^8.0.0      WebSocket

BUILD SYSTEM
════════════
nixpacks                latest      Build tool (primary)
pack                    latest      Cloud Native Buildpacks
docker                  latest      Container runtime
buildkit                latest      Docker build backend

KUBERNETES
══════════
kubernetes              1.28+       Orchestration
traefik                 v3          Ingress controller
cert-manager            v1.13       SSL automation
external-dns            v0.14       DNS automation
harbor                  v2.9        Container registry
prometheus              v2.48       Metrics
grafana                 v10         Visualization
loki                    v2.9        Log aggregation
promtail                v2.9        Log shipping
keda                    v2.12       Event-driven autoscaling

DATABASE
════════
postgresql              16          Primary database
redis                   7           Cache + queue
minio                   latest      Object storage (S3)

INFRASTRUCTURE
══════════════
terraform               v1.6        Infrastructure as Code
helm                    v3          K8s package manager
k3s                     v1.28       Lightweight K8s (or EKS/GKE)

DEVELOPMENT
═══════════
docker-compose          v2          Local development
pnpm                    v8          Package manager
turbo                   latest      Monorepo build
vitest                  v1          Testing
playwright              v1          E2E testing

└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

### Monorepo Structure (Turborepo)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              PROJECT FOLDER STRUCTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤

paas-platform/
│
├── apps/                              # Application packages
│   │
│   ├── web/                           # Frontend Dashboard (Next.js)
│   │   ├── app/                       # Next.js App Router
│   │   │   ├── (auth)/                # Auth route group (login, register)
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx       # Login page
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx       # Register page
│   │   │   │   └── layout.tsx         # Auth layout (centered, minimal)
│   │   │   │
│   │   │   ├── (dashboard)/           # Dashboard route group (protected)
│   │   │   │   ├── projects/
│   │   │   │   │   ├── page.tsx       # Project list
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx   # Create new project
│   │   │   │   │   └── [projectId]/
│   │   │   │   │       ├── page.tsx   # Project overview
│   │   │   │   │       ├── deployments/
│   │   │   │   │       │   └── page.tsx
│   │   │   │   │       ├── logs/
│   │   │   │   │       │   └── page.tsx
│   │   │   │   │       ├── settings/
│   │   │   │   │       │   └── page.tsx
│   │   │   │   │       └── services/
│   │   │   │   │           └── page.tsx
│   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx       # User settings
│   │   │   │   ├── billing/
│   │   │   │   │   └── page.tsx       # Billing page
│   │   │   │   └── layout.tsx         # Dashboard layout (sidebar, header)
│   │   │   │
│   │   │   ├── api/                   # Next.js API routes (for auth callbacks)
│   │   │   │   └── auth/
│   │   │   │       └── [...nextauth]/
│   │   │   │           └── route.ts   # NextAuth.js handler
│   │   │   │
│   │   │   ├── layout.tsx             # Root layout
│   │   │   ├── page.tsx               # Landing page
│   │   │   └── globals.css            # Global styles
│   │   │
│   │   ├── components/                # React components
│   │   │   ├── ui/                    # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   └── ...
│   │   │   ├── layout/                # Layout components
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── footer.tsx
│   │   │   ├── projects/              # Project-related components
│   │   │   │   ├── project-card.tsx
│   │   │   │   ├── project-list.tsx
│   │   │   │   ├── create-project-form.tsx
│   │   │   │   └── project-settings-form.tsx
│   │   │   ├── deployments/           # Deployment components
│   │   │   │   ├── deployment-list.tsx
│   │   │   │   ├── deployment-status.tsx
│   │   │   │   ├── build-logs.tsx
│   │   │   │   └── deployment-timeline.tsx
│   │   │   ├── logs/                  # Log viewer components
│   │   │   │   ├── log-viewer.tsx
│   │   │   │   └── log-filters.tsx
│   │   │   └── metrics/               # Metrics components
│   │   │       ├── cpu-chart.tsx
│   │   │       ├── memory-chart.tsx
│   │   │       └── requests-chart.tsx
│   │   │
│   │   ├── lib/                       # Utility functions
│   │   │   ├── api.ts                 # API client (fetch wrapper)
│   │   │   ├── auth.ts                # Auth utilities
│   │   │   ├── utils.ts               # General utilities
│   │   │   └── constants.ts           # Constants
│   │   │
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── use-projects.ts        # Project queries
│   │   │   ├── use-deployments.ts     # Deployment queries
│   │   │   ├── use-logs.ts            # Log streaming hook
│   │   │   └── use-websocket.ts       # WebSocket hook
│   │   │
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── auth-store.ts
│   │   │   └── ui-store.ts
│   │   │
│   │   ├── public/                    # Static assets
│   │   │   ├── logo.svg
│   │   │   └── favicon.ico
│   │   │
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   │
│   └── api/                           # Backend API Server (Hono)
│       ├── src/
│       │   ├── index.ts               # Entry point, starts server
│       │   │
│       │   ├── app.ts                 # Hono app setup, middleware
│       │   │
│       │   ├── routes/                # API route handlers
│       │   │   ├── index.ts           # Route aggregator
│       │   │   ├── auth.routes.ts     # /auth/* endpoints
│       │   │   ├── users.routes.ts    # /users/* endpoints
│       │   │   ├── projects.routes.ts # /projects/* endpoints
│       │   │   ├── deployments.routes.ts
│       │   │   ├── services.routes.ts
│       │   │   ├── domains.routes.ts
│       │   │   ├── billing.routes.ts
│       │   │   └── webhooks.routes.ts # GitHub, Stripe webhooks
│       │   │
│       │   ├── controllers/           # Business logic
│       │   │   ├── auth.controller.ts
│       │   │   ├── projects.controller.ts
│       │   │   ├── deployments.controller.ts
│       │   │   ├── services.controller.ts
│       │   │   └── billing.controller.ts
│       │   │
│       │   ├── services/              # Core services
│       │   │   ├── github.service.ts  # GitHub API integration
│       │   │   ├── kubernetes.service.ts  # K8s client
│       │   │   ├── build.service.ts   # Build orchestration
│       │   │   ├── deploy.service.ts  # Deployment orchestration
│       │   │   ├── logs.service.ts    # Log aggregation
│       │   │   └── stripe.service.ts  # Payment processing
│       │   │
│       │   ├── db/                    # Database layer
│       │   │   ├── index.ts           # Drizzle client setup
│       │   │   ├── schema.ts          # Drizzle schema definitions
│       │   │   ├── migrations/        # Database migrations
│       │   │   │   └── 0001_initial.sql
│       │   │   └── seed.ts            # Seed data for development
│       │   │
│       │   ├── queue/                 # Job queue (BullMQ)
│       │   │   ├── index.ts           # Queue setup
│       │   │   ├── queues.ts          # Queue definitions
│       │   │   └── processors/        # Job processors
│       │   │       ├── build.processor.ts
│       │   │       ├── deploy.processor.ts
│       │   │       └── cleanup.processor.ts
│       │   │
│       │   ├── middleware/            # Hono middleware
│       │   │   ├── auth.middleware.ts # JWT verification
│       │   │   ├── error.middleware.ts
│       │   │   ├── logger.middleware.ts
│       │   │   └── ratelimit.middleware.ts
│       │   │
│       │   ├── lib/                   # Utilities
│       │   │   ├── env.ts             # Environment variables
│       │   │   ├── logger.ts          # Pino logger setup
│       │   │   ├── redis.ts           # Redis client
│       │   │   ├── jwt.ts             # JWT utilities
│       │   │   ├── crypto.ts          # Encryption utilities
│       │   │   └── errors.ts          # Custom error classes
│       │   │
│       │   ├── types/                 # TypeScript types
│       │   │   ├── index.ts
│       │   │   ├── api.types.ts       # Request/Response types
│       │   │   └── env.d.ts           # Environment type declarations
│       │   │
│       │   └── websocket/             # WebSocket handlers
│       │       ├── index.ts
│       │       ├── logs.ws.ts         # Log streaming
│       │       └── builds.ws.ts       # Build log streaming
│       │
│       ├── Dockerfile
│       ├── tsconfig.json
│       └── package.json
│
│
├── packages/                          # Shared packages
│   │
│   ├── shared/                        # Shared types & utilities
│   │   ├── src/
│   │   │   ├── types/                 # Shared TypeScript types
│   │   │   │   ├── user.ts
│   │   │   │   ├── project.ts
│   │   │   │   ├── deployment.ts
│   │   │   │   ├── service.ts
│   │   │   │   └── index.ts
│   │   │   ├── schemas/               # Zod validation schemas
│   │   │   │   ├── auth.schema.ts
│   │   │   │   ├── project.schema.ts
│   │   │   │   ├── deployment.schema.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/             # Shared constants
│   │   │   │   ├── status.ts
│   │   │   │   ├── plans.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts               # Package entry point
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                            # Shared UI components (optional)
│   │   └── ...
│   │
│   └── config/                        # Shared configs
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
│
├── workers/                           # Background workers
│   │
│   └── build-worker/                  # Build worker service
│       ├── src/
│       │   ├── index.ts               # Worker entry point
│       │   ├── build.ts               # Build execution logic
│       │   ├── detect.ts              # App type detection
│       │   ├── nixpacks.ts            # Nixpacks wrapper
│       │   └── docker.ts              # Docker operations
│       ├── Dockerfile
│       └── package.json
│
│
├── infrastructure/                    # Infrastructure as Code
│   │
│   ├── kubernetes/                    # K8s manifests
│   │   ├── base/                      # Base configurations
│   │   │   ├── namespace.yaml
│   │   │   ├── traefik/
│   │   │   ├── cert-manager/
│   │   │   └── monitoring/
│   │   ├── platform/                  # Platform deployments
│   │   │   ├── api-deployment.yaml
│   │   │   ├── api-service.yaml
│   │   │   ├── worker-deployment.yaml
│   │   │   ├── postgres-statefulset.yaml
│   │   │   └── redis-statefulset.yaml
│   │   └── templates/                 # Templates for user apps
│   │       ├── deployment.yaml.tmpl
│   │       ├── service.yaml.tmpl
│   │       └── ingress.yaml.tmpl
│   │
│   ├── terraform/                     # Terraform configs (for AWS)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── eks.tf
│   │   ├── rds.tf
│   │   └── outputs.tf
│   │
│   └── docker/                        # Docker configs
│       ├── docker-compose.yml         # Local development
│       ├── docker-compose.prod.yml    # Production
│       └── .env.example
│
│
├── docs/                              # Documentation
│   ├── 01-paas-overview.md
│   ├── 02-technical-deep-dive.md
│   ├── 03-api-reference.md
│   ├── 04-deployment-guide.md
│   └── architecture/
│       └── diagrams/
│
│
├── scripts/                           # Utility scripts
│   ├── setup.sh                       # Initial setup script
│   ├── dev.sh                         # Start dev environment
│   ├── migrate.sh                     # Run database migrations
│   └── seed.sh                        # Seed database
│
│
├── .github/                           # GitHub configs
│   └── workflows/
│       ├── ci.yml                     # CI pipeline
│       ├── deploy.yml                 # Deployment pipeline
│       └── test.yml                   # Test pipeline
│
│
├── turbo.json                         # Turborepo config
├── pnpm-workspace.yaml                # PNPM workspace config
├── package.json                       # Root package.json
├── .env.example                       # Environment variables example
├── .gitignore
└── README.md

└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Files Explained

#### Frontend (apps/web)


| File                         | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `app/(dashboard)/layout.tsx` | Protected dashboard layout with sidebar   |
| `components/ui/*`            | shadcn/ui components (Button, Card, etc.) |
| `hooks/use-projects.ts`      | TanStack Query hooks for project data     |
| `lib/api.ts`                 | API client with auth headers              |
| `stores/auth-store.ts`       | Zustand store for auth state              |


#### Backend (apps/api)


| File                        | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `src/index.ts`              | Entry point, starts Hono server         |
| `src/app.ts`                | Hono app with all middleware            |
| `src/routes/*.ts`           | Route definitions (like Express Router) |
| `src/controllers/*.ts`      | Business logic handlers                 |
| `src/services/*.ts`         | External integrations (GitHub, K8s)     |
| `src/db/schema.ts`          | Drizzle ORM schema                      |
| `src/queue/processors/*.ts` | BullMQ job handlers                     |
| `src/middleware/*.ts`       | Hono middleware                         |


#### Shared (packages/shared)


| File                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `src/types/*.ts`     | TypeScript interfaces shared across apps |
| `src/schemas/*.ts`   | Zod schemas for validation               |
| `src/constants/*.ts` | Shared constants                         |


---

## Hono vs Express Comparison

Hono syntax is VERY similar to Express. Here's a side-by-side:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// HONO vs EXPRESS - They're almost identical!
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// BASIC APP SETUP
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// const express = require('express');
// const app = express();
// app.listen(3000);

// HONO:
import { Hono } from 'hono';
const app = new Hono();
// Use: serve(app) or export default app

// ─────────────────────────────────────────────────────────────────
// BASIC ROUTE
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// app.get('/hello', (req, res) => {
//   res.json({ message: 'Hello World' });
// });

// HONO:
app.get('/hello', (c) => {
  // 'c' is the Context object (similar to req + res combined)
  return c.json({ message: 'Hello World' });
});

// ─────────────────────────────────────────────────────────────────
// ROUTE WITH PARAMS
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// app.get('/users/:id', (req, res) => {
//   const { id } = req.params;
//   res.json({ userId: id });
// });

// HONO:
app.get('/users/:id', (c) => {
  const id = c.req.param('id');  // Similar to req.params.id
  return c.json({ userId: id });
});

// ─────────────────────────────────────────────────────────────────
// POST WITH BODY
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// app.post('/users', express.json(), async (req, res) => {
//   const { name, email } = req.body;
//   res.status(201).json({ name, email });
// });

// HONO:
app.post('/users', async (c) => {
  const { name, email } = await c.req.json();  // Similar to req.body
  return c.json({ name, email }, 201);  // Status as second arg
});

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// const authMiddleware = (req, res, next) => {
//   const token = req.headers.authorization;
//   if (!token) return res.status(401).json({ error: 'Unauthorized' });
//   req.user = verifyToken(token);
//   next();
// };
// app.use('/api', authMiddleware);

// HONO:
import { createMiddleware } from 'hono/factory';

const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization');  // Similar to req.headers
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', verifyToken(token));  // Similar to req.user = ...
  await next();  // Call next middleware
});

app.use('/api/*', authMiddleware);

// ─────────────────────────────────────────────────────────────────
// ROUTER (GROUPED ROUTES)
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// const router = express.Router();
// router.get('/', getAllProjects);
// router.post('/', createProject);
// router.get('/:id', getProject);
// app.use('/projects', router);

// HONO:
const projectRoutes = new Hono();
projectRoutes.get('/', getAllProjects);
projectRoutes.post('/', createProject);
projectRoutes.get('/:id', getProject);

app.route('/projects', projectRoutes);  // Mount router

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(500).json({ error: 'Internal Server Error' });
// });

// HONO:
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// ─────────────────────────────────────────────────────────────────
// QUERY PARAMS
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// app.get('/search', (req, res) => {
//   const { q, page } = req.query;
//   res.json({ query: q, page });
// });

// HONO:
app.get('/search', (c) => {
  const q = c.req.query('q');        // Single query param
  const page = c.req.query('page');
  // OR: const { q, page } = c.req.queries();  // All params
  return c.json({ query: q, page });
});

// ─────────────────────────────────────────────────────────────────
// HEADERS
// ─────────────────────────────────────────────────────────────────

// EXPRESS:
// app.get('/info', (req, res) => {
//   const userAgent = req.headers['user-agent'];
//   res.set('X-Custom-Header', 'value');
//   res.json({ userAgent });
// });

// HONO:
app.get('/info', (c) => {
  const userAgent = c.req.header('User-Agent');
  c.header('X-Custom-Header', 'value');  // Set response header
  return c.json({ userAgent });
});

// ─────────────────────────────────────────────────────────────────
// COOKIES
// ─────────────────────────────────────────────────────────────────

// EXPRESS (with cookie-parser):
// app.get('/auth', (req, res) => {
//   const token = req.cookies.token;
//   res.cookie('token', 'new-value', { httpOnly: true });
//   res.json({ ok: true });
// });

// HONO:
import { getCookie, setCookie } from 'hono/cookie';

app.get('/auth', (c) => {
  const token = getCookie(c, 'token');
  setCookie(c, 'token', 'new-value', { httpOnly: true });
  return c.json({ ok: true });
});
```

### Hono Cheat Sheet for Express Developers

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS → HONO CHEAT SHEET                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   EXPRESS                           HONO                                   │
│   ───────────────────────────────────────────────────────────────────────  │
│                                                                             │
│   req.params.id                     c.req.param('id')                      │
│   req.query.page                    c.req.query('page')                    │
│   req.body                          await c.req.json()                     │
│   req.headers['auth']               c.req.header('Auth')                   │
│   req.cookies.token                 getCookie(c, 'token')                  │
│                                                                             │
│   res.json({ data })                return c.json({ data })                │
│   res.status(201).json()            return c.json(data, 201)               │
│   res.send('text')                  return c.text('text')                  │
│   res.set('Header', 'val')          c.header('Header', 'val')              │
│   res.cookie('name', 'val')         setCookie(c, 'name', 'val')            │
│   res.redirect('/path')             return c.redirect('/path')             │
│                                                                             │
│   req.user = user                   c.set('user', user)                    │
│   const user = req.user             const user = c.get('user')             │
│                                                                             │
│   next()                            await next()                           │
│   express.Router()                  new Hono()                             │
│   app.use('/path', router)          app.route('/path', honoRouter)         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sample Code: API Server Structure

### Entry Point (src/index.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/index.ts - Entry point for the API server
// ═══════════════════════════════════════════════════════════════════════════
// 
// EXPRESS EQUIVALENT:
// const express = require('express');
// const app = express();
// app.listen(PORT, () => console.log(`Server running on ${PORT}`));
//
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { connectDatabase } from './db';
import { startWorkers } from './queue';

async function main() {
  // Connect to PostgreSQL
  await connectDatabase();
  logger.info('✅ Database connected');

  // Start background job workers
  await startWorkers();
  logger.info('✅ Workers started');

  // Start HTTP server
  const port = env.PORT || 8080;
  
  serve({
    fetch: app.fetch,
    port,
  });

  logger.info(`🚀 Server running on http://localhost:${port}`);
}

main().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
```

### App Setup (src/app.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/app.ts - Hono app configuration with middleware
// ═══════════════════════════════════════════════════════════════════════════
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

// Import our routes
import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/projects.routes';
import { deploymentRoutes } from './routes/deployments.routes';
import { webhookRoutes } from './routes/webhooks.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';

// Create Hono app
// EXPRESS: const app = express();
const app = new Hono();

// ─────────────────────────────────────────────────────────────────
// GLOBAL MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

// CORS - EXPRESS: app.use(cors())
app.use('*', cors({
  origin: ['http://localhost:3000'],  // Frontend URL
  credentials: true,
}));

// Request logging - EXPRESS: app.use(morgan('dev'))
app.use('*', honoLogger());

// Pretty JSON responses in development
app.use('*', prettyJSON());

// Security headers - EXPRESS: app.use(helmet())
app.use('*', secureHeaders());

// ─────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────

// EXPRESS: app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────
// API ROUTES (v1)
// ─────────────────────────────────────────────────────────────────

// Mount route modules
// EXPRESS: app.use('/api/v1/auth', authRoutes);
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/projects', projectRoutes);
app.route('/api/v1/deployments', deploymentRoutes);
app.route('/webhooks', webhookRoutes);

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────

// EXPRESS: app.use((err, req, res, next) => { ... });
app.onError(errorHandler);

// 404 handler
// EXPRESS: app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

export { app };
```

### Example Route File (src/routes/projects.routes.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/routes/projects.routes.ts - Project CRUD routes
// ═══════════════════════════════════════════════════════════════════════════
//
// EXPRESS EQUIVALENT:
// const router = express.Router();
// router.get('/', authMiddleware, projectController.list);
// router.post('/', authMiddleware, projectController.create);
// module.exports = router;
//
// ═══════════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { ProjectController } from '../controllers/projects.controller';
import { createProjectSchema, updateProjectSchema } from '@paas/shared/schemas';

// Create router - EXPRESS: const router = express.Router();
const projectRoutes = new Hono();

// Apply auth middleware to all routes in this router
// EXPRESS: router.use(authMiddleware);
projectRoutes.use('*', authMiddleware);

// ─────────────────────────────────────────────────────────────────
// GET /projects - List all user's projects
// ─────────────────────────────────────────────────────────────────
// EXPRESS:
// router.get('/', async (req, res) => {
//   const projects = await ProjectController.list(req.user.id);
//   res.json({ data: projects });
// });

projectRoutes.get('/', async (c) => {
  // Get user from context (set by authMiddleware)
  const user = c.get('user');
  
  // Call controller
  const projects = await ProjectController.list(user.id);
  
  return c.json({
    success: true,
    data: projects,
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /projects - Create new project
// ─────────────────────────────────────────────────────────────────
// EXPRESS:
// router.post('/', validateBody(createProjectSchema), async (req, res) => {
//   const project = await ProjectController.create(req.user.id, req.body);
//   res.status(201).json({ data: project });
// });

projectRoutes.post(
  '/',
  // Zod validation middleware (like express-validator)
  zValidator('json', createProjectSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');  // Validated body
    
    const project = await ProjectController.create(user.id, body);
    
    return c.json({
      success: true,
      data: project,
    }, 201);  // 201 Created
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /projects/:id - Get single project
// ─────────────────────────────────────────────────────────────────
// EXPRESS:
// router.get('/:id', async (req, res) => {
//   const project = await ProjectController.get(req.params.id, req.user.id);
//   res.json({ data: project });
// });

projectRoutes.get('/:id', async (c) => {
  const projectId = c.req.param('id');  // EXPRESS: req.params.id
  const user = c.get('user');
  
  const project = await ProjectController.get(projectId, user.id);
  
  if (!project) {
    return c.json({ 
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' }
    }, 404);
  }
  
  return c.json({
    success: true,
    data: project,
  });
});

// ─────────────────────────────────────────────────────────────────
// PATCH /projects/:id - Update project
// ─────────────────────────────────────────────────────────────────

projectRoutes.patch(
  '/:id',
  zValidator('json', updateProjectSchema),
  async (c) => {
    const projectId = c.req.param('id');
    const user = c.get('user');
    const body = c.req.valid('json');
    
    const project = await ProjectController.update(projectId, user.id, body);
    
    return c.json({
      success: true,
      data: project,
    });
  }
);

// ─────────────────────────────────────────────────────────────────
// DELETE /projects/:id - Delete project
// ─────────────────────────────────────────────────────────────────

projectRoutes.delete('/:id', async (c) => {
  const projectId = c.req.param('id');
  const user = c.get('user');
  
  await ProjectController.delete(projectId, user.id);
  
  return c.json({
    success: true,
    message: 'Project deleted',
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /projects/:id/deploy - Trigger deployment
// ─────────────────────────────────────────────────────────────────

projectRoutes.post('/:id/deploy', async (c) => {
  const projectId = c.req.param('id');
  const user = c.get('user');
  
  const deployment = await ProjectController.triggerDeploy(projectId, user.id);
  
  return c.json({
    success: true,
    data: deployment,
  }, 201);
});

export { projectRoutes };
```

### Auth Middleware (src/middleware/auth.middleware.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/middleware/auth.middleware.ts - JWT Authentication Middleware
// ═══════════════════════════════════════════════════════════════════════════
//
// EXPRESS EQUIVALENT:
// const authMiddleware = async (req, res, next) => {
//   const token = req.headers.authorization?.split(' ')[1];
//   if (!token) return res.status(401).json({ error: 'Unauthorized' });
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = payload;
//     next();
//   } catch (err) {
//     return res.status(401).json({ error: 'Invalid token' });
//   }
// };
//
// ═══════════════════════════════════════════════════════════════════════════

import { createMiddleware } from 'hono/factory';
import { verifyToken } from '../lib/jwt';
import type { User } from '@paas/shared/types';

// Extend Hono's context to include our user
// This is like adding req.user in Express
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // Get Authorization header
  // EXPRESS: const authHeader = req.headers.authorization;
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No token provided',
      },
    }, 401);
  }
  
  // Extract token
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify JWT token
    const payload = await verifyToken(token);
    
    // Set user in context (like req.user = payload in Express)
    c.set('user', payload as User);
    
    // Continue to next middleware/handler
    // EXPRESS: next();
    await next();
    
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    }, 401);
  }
});
```

---

*Document Version: 1.1*
*Last Updated: January 2026*