# Real Build & Deploy — Implementation Plan

> **Purpose:** Track progress from **simulation mode** (working on branch `paas-v2`) to **real Docker builds + Kubernetes deployments** on your local Windows machine, in a production-shaped way.
>
> **Related docs:** [01-paas-overview.md](./01-paas-overview.md) · [02-technical-deep-dive.md](./02-technical-deep-dive.md)

---

## Current status (baseline)

| Area | Status | Notes |
|------|--------|--------|
| API (Control Plane) | ✅ Done | Auth, projects, deployments, webhooks, domains, services |
| Database | ✅ Done | Supabase (cloud) |
| Redis + BullMQ queue | ✅ Done | `build-jobs` queue |
| Build worker (simulation) | ✅ Done | Full pipeline: clone → detect → build → push → deploy |
| Build worker (real Docker) | ⏳ Not started | `build.ts` / `push.ts` stubs |
| Build worker (real K8s) | ⏳ Not started | `deploy.ts` `realDeploy` stub |
| Frontend | ⏳ Not started | — |

**Git branch:** `paas-v2` (simulation working, pushed to GitHub)

---

## Your local environment (verified)

### Docker

| Item | Status | Detail |
|------|--------|--------|
| Docker Desktop | ✅ | v27.3.1 |
| `docker` CLI | ✅ | Working |
| PaaS stack containers | ✅ | postgres, redis, registry, adminer, redis-commander |
| Registry container | ✅ | `paas-registry` → **host port `5001`** → container `5000` |
| Registry push test | ✅ | `hello-world` pushed to `localhost:5001/hello-world:test` |

**Running containers (reference):**

```
paas-adminer          → 8083
paas-redis-commander  → 8084
paas-postgres         → 5434
paas-redis            → 6379
paas-registry         → 5001
```

### Kubernetes (Minikube)

| Item | Status | Detail |
|------|--------|--------|
| Minikube | ✅ | Control plane, kubelet, apiserver running |
| `kubectl` | ✅ | Configured |
| Ingress | ✅ | `ingress-nginx` namespace exists (from prior DevOpsee setup) |
| PaaS namespace | ✅ | `paas-apps` created |

```powershell
kubectl create namespace paas-apps   # ✅ Done
```

### Demo application

| Item | Status |
|------|--------|
| Simple app folder (outside repo) | ✅ Created |
| Push to GitHub | ⏳ Pending — use this URL in project `gitRepoUrl` |

---

## Fix before Phase 1 (config)

### 1. Docker Engine — insecure registry (optional but recommended)

Your registry push to `localhost:5001` already works. If you later see TLS/certificate errors, add to **Docker Desktop → Settings → Docker Engine**:

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "insecure-registries": [
    "localhost:5001",
    "host.docker.internal:5001"
  ]
}
```

Click **Apply & restart**.

### 2. `.env` alignment (`apps/api/.env`)

Worker loads from `apps/api/.env`. Fix these for local real builds:

| Variable | Current | Should be |
|----------|---------|-----------|
| `REGISTRY_URL` | `localhost:5000` | **`localhost:5001`** (matches Docker port mapping) |
| `K8S_NAMESPACE` | `paas-apps` | ✅ Correct |
| `BUILD_WORKSPACE` | `C:\tmp\paas-builds` | ✅ Good for Windows |
| `SIMULATION_MODE` | (missing → defaults `true`) | Add `SIMULATION_MODE=false` only when Phase 1b is implemented |
| `PLATFORM_DOMAIN` | duplicated | Keep one line |

Do **not** commit `.env` to git (secrets).

---

## Architecture (target)

```
User / Postman / GitHub webhook
        │
        ▼
   API (apps/api) ──► PostgreSQL (Supabase)
        │
        ▼
   Redis (BullMQ: build-jobs)
        │
        ▼
   Worker (apps/worker)
        │
        ├──► git clone (simple-git)
        ├──► detect (package.json / Dockerfile / …)
        ├──► docker build OR nixpacks build
        ├──► docker push ──► Registry (localhost:5001)
        └──► kubectl apply ──► Minikube (namespace: paas-apps)
                    │
                    └──► Ingress (ingress-nginx) → app URL
```

---

## What changes per layer (not worker-only)

| Layer | Responsibility | Phase |
|-------|----------------|-------|
| **`apps/worker`** | Docker build, push, K8s deploy, utilities | 1–2 (main work) |
| **`apps/api`** | Env validation, health checks, optional GitHub token | 1–2 (small) |
| **`infrastructure/kubernetes/`** | Manifest templates, setup scripts | 2 (new) |
| **`infrastructure/docker/`** | Registry compose (exists) | 0 (done) |
| **`packages/shared`** | Types/constants if needed | As needed |
| **`apps/web`** | UI for logs/deployments | Later |

---

## Implementation phases

### Phase 0 — Platform prerequisites

**Goal:** Local infra ready; no worker code changes yet.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Docker Desktop running | ✅ | |
| 0.2 | PaaS docker-compose up (redis, registry, …) | ✅ | |
| 0.3 | Registry push test (`hello-world` → `localhost:5001`) | ✅ | |
| 0.4 | Minikube running | ✅ | |
| 0.5 | Namespace `paas-apps` | ✅ | |
| 0.6 | Fix `REGISTRY_URL=localhost:5001` in `.env` | ⏳ | |
| 0.7 | Push demo app to GitHub | ⏳ | Public repo URL for tests |
| 0.8 | Demo app has `GET /health` (for K8s probes) | ⏳ | Recommended |
| 0.9 | Verify registry catalog | ⏳ | `curl http://localhost:5001/v2/_catalog` |

**Demo app minimum (suggested):**

```
demo-app/
  package.json      # "start": "node index.js"
  index.js          # Express, PORT from env, GET / and GET /health
  .gitignore
  README.md
```

Avoid placeholder URL `https://github.com/user/repo` — use your real repo after push.

---

### Phase 1 — Real Docker build + push

**Goal:** Worker produces real images in local registry. Deploy can stay simulated until Phase 2.

| # | Task | Status | Where |
|---|------|--------|-------|
| 1.1 | Create `apps/worker/src/utils/docker.ts` — run `docker build`, stream logs | ✅ | worker |
| 1.2 | Create `apps/worker/src/utils/nixpacks.ts` — Nixpacks via CLI or Docker image | ⏳ Phase 1b | worker |
| 1.3 | Implement `realPush` in `steps/push.ts` | ✅ | worker |
| 1.4 | Wire `dockerBuild` / `nixpacksBuild` in `steps/build.ts` | ✅ | worker |
| 1.5 | Pass project `envVars` as build-args / Nixpacks `--env` | ✅ (PORT only) | worker |
| 1.6 | Install Nixpacks (or document Docker-only path first) | ⏳ Phase 1b | local + worker |
| 1.7 | Build timeouts + cleanup `workDir` on success/failure | ✅ (cleanup exists) | worker |
| 1.8 | Set `SIMULATION_MODE=false` in `.env` | ⏳ Ready | After 1.1–1.4 |
| 1.9 | Test: create project with real GitHub URL → deploy | ⏳ | Postman |
| 1.10 | Verify image in registry | ⏳ | `curl localhost:5001/v2/_catalog` |
| 1.11 | Verify `deployments.imageTag` in DB | ⏳ | Supabase / API |

**Build strategy (order):**

1. If `Dockerfile` exists → `docker build -t {REGISTRY_URL}/{slug}:{commitShort} .`
2. Else → Nixpacks (or require Dockerfile in Phase 1a if Nixpacks deferred)

**API changes (Phase 1):** Minimal — queue payload already sufficient. Optional: registry health on `/health/ready`.

---

### Phase 2 — Real Kubernetes deploy

**Goal:** Pods run in Minikube; app reachable via Ingress or port-forward.

| # | Task | Status | Where |
|---|------|--------|-------|
| 2.1 | Add `infrastructure/kubernetes/templates/` (Deployment, Service, Ingress) | ⏳ Later | infrastructure |
| 2.2 | Create `apps/worker/src/utils/k8s.ts` — apply manifests, wait rollout | ✅ | worker |
| 2.3 | Implement `realDeploy` in `steps/deploy.ts` | ✅ | worker |
| 2.4 | Create K8s Secret from project env vars | ✅ (inline env) | worker |
| 2.5 | Per-project labels: `app={projectSlug}`, `deploymentId=…` | ✅ | worker |
| 2.6 | Configure Minikube to pull from `localhost:5001` | ✅ (minikube image load) | worker |
| 2.7 | Use existing `ingress-nginx` for routing | ⏳ Later | Minikube |
| 2.8 | Store app URL on deployment / project | ⏳ Later | worker + api |
| 2.9 | Test: `kubectl get pods -n paas-apps` | ⏳ | |
| 2.10 | Test: HTTP access to deployed app | ⏳ | port-forward |

**K8s objects per deployment:**

- `Deployment` — image, env Secret, resources, readiness/liveness on `/health`
- `Service` — ClusterIP → container port
- `Ingress` — host e.g. `{subdomain}.localhost` (or nip.io)

**Minikube + local registry note:** Images built on host Docker must be visible to Minikube. Options:

- `minikube image load <image>` after push, or
- Use Minikube Docker daemon (`eval $(minikube docker-env)`) for builds (advanced)

Plan time to debug `ImagePullBackOff`.

---

### Phase 3 — Production hardening (after local works)

| # | Task | Status |
|---|------|--------|
| 3.1 | GitHub token for private repos (`GITHUB_TOKEN`) | ⏳ |
| 3.2 | Never log secret env values | ⏳ |
| 3.3 | Build worker as isolated process / future K8s Job | ⏳ |
| 3.4 | Resource limits per plan (CPU/memory) | ⏳ |
| 3.5 | Cancel build → stop container / remove job | ⏳ |
| 3.6 | Cloud registry (GHCR / ECR / Harbor) | ⏳ |
| 3.7 | Managed K8s + Traefik + cert-manager + real DNS | ⏳ |
| 3.8 | WebSocket live build logs in dashboard | ⏳ |

---

## Testing checklist

### Infrastructure (one-time)

- [x] `docker push localhost:5001/hello-world:test`
- [x] `kubectl create namespace paas-apps`
- [ ] `curl http://localhost:5001/v2/_catalog` shows pushed images
- [ ] `kubectl get pods -n ingress-nginx` (ingress controller running)

### End-to-end (after Phase 1)

- [ ] API + worker running (`pnpm dev:api`, `pnpm dev:worker`)
- [ ] `SIMULATION_MODE=false`
- [ ] Register/login → JWT
- [ ] Create project with **real** `gitRepoUrl` (your GitHub demo app)
- [ ] `POST /api/v1/projects/:id/deploy`
- [ ] Worker logs show real `docker build` output (not `[SIMULATION]`)
- [ ] `GET .../deployments/:id` → `buildStatus: success`, `imageTag` set
- [ ] Registry contains `{slug}:{commit}` image

### End-to-end (after Phase 2)

- [ ] `deployStatus: live`
- [ ] Pod `Running` in `paas-apps`
- [ ] App responds on HTTP (browser or curl)

---

## Worker files reference (current)

| File | Simulation | Real |
|------|------------|------|
| `src/steps/clone.ts` | Mock files | `simple-git` clone ✅ |
| `src/steps/detect.ts` | Fake stack | File detection ✅ |
| `src/steps/build.ts` | Fake logs | Stub — **implement** |
| `src/steps/push.ts` | Fake layers | Throws — **implement** |
| `src/steps/deploy.ts` | Fake K8s | Stub — **implement** |
| `src/processor.ts` | Orchestrates pipeline | ✅ |
| `src/utils/db-updater.ts` | DB status + logs | ✅ |

**New files to add (planned):**

```
apps/worker/src/utils/
  docker.ts      # docker build, stream output
  nixpacks.ts    # optional auto-build
  k8s.ts         # apply manifests, rollout status

infrastructure/kubernetes/templates/
  deployment.yaml.tmpl
  service.yaml.tmpl
  ingress.yaml.tmpl
```

---

## Recommended order of work

```
Phase 0  (finish config + demo repo on GitHub)
    ↓
Phase 1a Dockerfile-only real build + push  (simplest path)
    ↓
Phase 1b Nixpacks for non-Dockerfile repos
    ↓
Phase 2  K8s deploy + ingress
    ↓
Phase 3  Hardening + cloud
```

**Practical tip:** Add a `Dockerfile` to your demo app first so Phase 1a does not depend on Nixpacks.

**Example minimal Dockerfile for demo app:**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "index.js"]
```

---

## Commands cheat sheet

```powershell
# Start PaaS infra
cd "C:\Users\PrajwalRaj\Desktop\DevOpsee Proje\PaaS ( Platform as a Service )\infrastructure\docker"
docker compose up -d

# Start app processes (from monorepo root)
pnpm dev:api
pnpm dev:worker

# Registry
curl http://localhost:5001/v2/_catalog

# Kubernetes
minikube status
kubectl get pods -n paas-apps
kubectl get ingress -n paas-apps
kubectl logs -n paas-apps -l app=<project-slug>

# Debug image pull
kubectl describe pod -n paas-apps <pod-name>
```

---

## Progress log

| Date | Milestone |
|------|-----------|
| 2026-05-15 | Simulation pipeline E2E working; branch `paas-v2` pushed |
| 2026-05-16 | Registry push test OK; `paas-apps` namespace created; implementation plan doc created |
| 2026-05-16 | Phase 0.6 ✅ — REGISTRY_URL=localhost:5001 in `.env` |
| 2026-05-16 | Phase 0.7 ✅ — demo app on GitHub: https://github.com/Prajwalraj2/paas-demo-app-node-express-backend |
| 2026-05-16 | Phase 1.1–1.4 ✅ — Implemented `utils/docker.ts`, `dockerBuild()`, `realPush()` |
| 2026-05-16 | Phase 1.8 ✅ — Set `SIMULATION_MODE=false`, real Docker build tested |
| 2026-05-16 | Phase 1.9 ✅ — Image pushed to registry: `real-node-expressapp-1-kzmy-7:41eba20a` |
| 2026-05-16 | Phase 2.2–2.6 ✅ — Implemented `utils/k8s.ts`, `realDeploy()`, minikube image load |
| 2026-05-16 | **🎉 PHASE 2 COMPLETE** — Full E2E working: Clone → Build → Push → Deploy → Running pod! |
| 2026-05-16 | Pod `real-node-expressapp-1-kzmy-7` running in `paas-apps` namespace |
| 2026-05-16 | App accessible at `localhost:3000` via port-forward: "Hello from Express backend 🚀" |

---

## Next action (immediate)

1. Update `REGISTRY_URL=localhost:5001` in `apps/api/.env`
2. Push demo app to GitHub (public repo with `Dockerfile` + `/health`)
3. Start **Phase 1a**: implement `utils/docker.ts` + `realPush` (Dockerfile path only)

---

*Last updated: 2026-05-16*
