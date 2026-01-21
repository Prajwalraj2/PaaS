# PaaS Platform 🚀

A production-grade Platform as a Service (PaaS) for deploying applications.

## Overview

This platform allows developers to deploy applications directly from GitHub repositories with automatic builds, scaling, and SSL certificates.

**Features:**
- 🔌 Connect GitHub repositories
- 🏗️ Automatic builds with Nixpacks
- ☸️ Kubernetes-based deployments
- 🔒 Automatic SSL certificates
- 📊 Real-time logs and metrics
- 🗄️ One-click databases (PostgreSQL, Redis)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Hono (Node.js), TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Queue | Redis, BullMQ |
| Orchestration | Kubernetes |
| Build System | Nixpacks |

## Project Structure

```
paas-platform/
├── apps/
│   ├── api/          # Backend API (Hono)
│   └── web/          # Frontend Dashboard (Next.js)
├── packages/
│   └── shared/       # Shared types, schemas, constants
├── workers/          # Background workers
├── infrastructure/   # Docker, Kubernetes configs
└── docs/             # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (for local development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd paas-platform
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start infrastructure services**
   ```bash
   cd infrastructure/docker
   docker-compose up -d
   ```

4. **Copy environment variables**
   ```bash
   cp env.example .env
   ```

5. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

6. **Start development servers**
   ```bash
   pnpm dev
   ```

### Development URLs

| Service | URL |
|---------|-----|
| API Server | http://localhost:8080 |
| Web Dashboard | http://localhost:3000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Adminer (DB UI) | http://localhost:8081 |
| Redis Commander | http://localhost:8082 |

## API Endpoints

### Health Check
```
GET /health         # Basic health check
GET /health/ready   # Kubernetes readiness probe
GET /health/live    # Kubernetes liveness probe
```

### Authentication
```
POST /api/v1/auth/register   # Register new user
POST /api/v1/auth/login      # Login
GET  /api/v1/auth/me         # Get current user
POST /api/v1/auth/logout     # Logout
```

### Projects
```
GET    /api/v1/projects          # List projects
POST   /api/v1/projects          # Create project
GET    /api/v1/projects/:id      # Get project
PATCH  /api/v1/projects/:id      # Update project
DELETE /api/v1/projects/:id      # Delete project
POST   /api/v1/projects/:id/deploy   # Trigger deployment
```

## Documentation

See the `/docs` folder for detailed documentation:

- [01-paas-overview.md](docs/01-paas-overview.md) - Architecture overview
- [02-technical-deep-dive.md](docs/02-technical-deep-dive.md) - Technical specifications

## License

MIT



