# Phase 3 — Developer Experience Plan

> **Branch:** `paas-v3` (real build + K8s deploy working)  
> **Related:** [03-real-build-deploy-implementation-plan.md](./03-real-build-deploy-implementation-plan.md)

---

## Goal

Make the PaaS feel like a real platform: deploy from Git, get a URL in the browser, auto-rebuild on push — without manual `kubectl port-forward`.

---

## Order of work

```
A.1 Ingress routing     → apps at http://{slug}.paas.localhost
A.2 Nixpacks            → build repos without Dockerfile
A.3 Store app URL in DB → API returns live URL after deploy
A.4 GitHub webhooks     → auto-deploy on git push
```

---

## A.1 — Ingress routing

**Goal:** Each deployed app is reachable at a stable browser URL (no port-forward).

### Architecture

```
Browser → http://{projectSlug}.paas.localhost
              ↓
    ingress-nginx (cluster)
              ↓
    Service :80 → Pod :3000
```

### Tasks

| # | Task | Where | Status |
|---|------|-------|--------|
| A.1.1 | Env: `INGRESS_ENABLED`, `INGRESS_CLASS`, `INGRESS_BASE_DOMAIN` | worker `env.ts`, `env.example` | ✅ |
| A.1.2 | `generateIngressManifest()` — nginx class, no TLS (local) | `utils/k8s.ts` | ✅ |
| A.1.3 | Apply Ingress after Service in `deployToK8s()` | `utils/k8s.ts` | ✅ |
| A.1.4 | Service port 80 → targetPort app port (align with Ingress) | `utils/k8s.ts` | ✅ |
| A.1.5 | Return `appUrl` = `http://{slug}.{INGRESS_BASE_DOMAIN}` | `utils/k8s.ts` | ✅ |
| A.1.6 | Log setup: `minikube tunnel` + optional hosts | deploy logs | ✅ |
| A.1.7 | Test: deploy → open URL in browser | manual | ⏳ |

### Local setup (one-time)

```powershell
# Ensure ingress controller is running
kubectl get pods -n ingress-nginx

# Route LoadBalancer traffic to your machine (keep terminal open)
minikube tunnel

# Deploy via API, then open:
# http://{project-slug}.paas.localhost
```

**Note:** `.localhost` subdomains resolve to `127.0.0.1` in modern browsers. `minikube tunnel` binds the ingress controller to localhost.

### Fallback

If Ingress fails, deployment still succeeds; logs show `kubectl port-forward` command.

---

## A.2 — Nixpacks (no Dockerfile)

**Goal:** Detect Node/Python/etc. and build automatically when no `Dockerfile` exists.

| # | Task | Where | Status |
|---|------|-------|--------|
| A.2.1 | Use Docker image `ghcr.io/railwayapp/nixpacks` (no CLI install) | worker | ✅ |
| A.2.2 | Create `apps/worker/src/utils/nixpacks.ts` | worker | ✅ |
| A.2.3 | Implement `nixpacksBuild()` in `steps/build.ts` | worker | ✅ |
| A.2.4 | Pass `envVars` as build/runtime env | worker | ✅ |
| A.2.5 | Test: repo with only `package.json` (no Dockerfile) | Postman | ✅ |

**Build order (unchanged):** Dockerfile → Nixpacks → error with helpful message.

### How Nixpacks works

Runs via Docker (no local install):
```
docker run -v <source>:/app -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/railwayapp/nixpacks build /app --name <image-tag>
```

### Testing A.2

1. Pull Nixpacks image (one-time):
   ```powershell
   docker pull ghcr.io/railwayapp/nixpacks:latest
   ```

2. Create a test repo **without Dockerfile** — just `package.json` + `index.js`

3. Create project with that repo URL, deploy, watch logs

---

## A.3 — Store app URL in DB

**Goal:** API/deployment responses include the live URL.

| # | Task | Where |
|---|------|-------|
| A.3.1 | Add `app_url` column to `deployments` (migration) | `apps/api` schema |
| A.3.2 | Worker: save `appUrl` from deploy step | `db-updater.ts`, `processor.ts` |
| A.3.3 | Fix `getProjectUrl()` — use ingress host on port 80, not API port | `projects.service.ts` |
| A.3.4 | Return `appUrl` in deployment GET + trigger deploy response | controllers |
| A.3.5 | Optional: store on `projects` when current deployment is live | projects table |

---

## A.4 — GitHub webhooks (auto-deploy)

**Goal:** Push to `main` → new deployment queued automatically.

| # | Task | Where |
|---|------|-------|
| A.4.1 | Wire `processGitHubWebhook` to find project by repo URL | `webhooks.controller.ts` |
| A.4.2 | Verify `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET` | controller |
| A.4.3 | On `push` to configured branch → `addBuildJob()` | controller |
| A.4.4 | Expose webhook URL in project settings API | optional |
| A.4.5 | Local test: ngrok + GitHub webhook delivery | manual |

**Webhook URL:** `POST {API_URL}/api/v1/webhooks/github`

---

## Progress log

| Date | Milestone |
|------|-----------|
| 2026-05-16 | Phase 3 plan created |
| 2026-05-16 | A.1 Ingress ✅ — apps accessible at `http://{slug}.paas.localhost` |
| 2026-05-17 | A.2 Nixpacks ✅ — CLI-based build, tested successfully with Node.js app |

---

*Last updated: 2026-05-16*
