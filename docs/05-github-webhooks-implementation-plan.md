# Phase A.4 - GitHub Webhooks Implementation Plan

> Auto-deploy on Git push events

---

## Current Status: 90% Backend Complete

The webhook backend infrastructure is **already implemented**. The remaining work is:
- Local testing with ngrok/Cloudflare Tunnel
- Frontend UI for webhook configuration
- Production deployment considerations

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GITHUB WEBHOOK FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   [Developer pushes code to GitHub]                                             │
│              │                                                                   │
│              ▼                                                                   │
│   ┌──────────────────┐                                                          │
│   │   GitHub Server   │  ─── Sends POST with signature ───────────────┐         │
│   └──────────────────┘                                                │         │
│                                                                       ▼         │
│                                                           ┌─────────────────┐   │
│   [LOCAL DEVELOPMENT]                                     │  ngrok / Tunnel │   │
│   ngrok http 8082 ─────────────────────────────────────► │  HTTPS proxy    │   │
│                                                           └────────┬────────┘   │
│                                                                    │            │
│                                                                    ▼            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        API SERVER (apps/api)                             │   │
│   │                                                                          │   │
│   │   POST /api/v1/webhooks/github                                          │   │
│   │        │                                                                 │   │
│   │        ├── 1. Extract headers (X-Hub-Signature-256, X-GitHub-Event)     │   │
│   │        ├── 2. Verify HMAC-SHA256 signature with GITHUB_WEBHOOK_SECRET   │   │
│   │        ├── 3. Parse JSON payload                                        │   │
│   │        ├── 4. Handle event type (ping vs push)                          │   │
│   │        ├── 5. Find matching projects (by repo URL + branch)             │   │
│   │        ├── 6. Check for duplicate deployments (same commit SHA)         │   │
│   │        ├── 7. Create deployment record in database                      │   │
│   │        └── 8. Add job to BullMQ queue                                   │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                │                                                 │
│                                ▼                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     WORKER (apps/worker)                                 │   │
│   │                                                                          │   │
│   │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   │   │
│   │   │  Clone  │──▶│ Detect  │──▶│  Build  │──▶│  Push   │──▶│ Deploy  │   │   │
│   │   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│                                ▼                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     DEPLOYED APPLICATION                                 │   │
│   │                                                                          │   │
│   │   http://my-app.paas.localhost  ← Accessible via browser                │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Already Implemented (Backend)

### 2.1 Routes (`apps/api/src/routes/webhooks.routes.ts`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/webhooks/github` | POST | Public | Receive GitHub webhook payloads |
| `/api/v1/webhooks/github/info` | GET | Public | Get webhook setup instructions |
| `/api/v1/webhooks/simulate` | POST | JWT | Simulate webhook for testing (dev only) |
| `/api/v1/webhooks/gitlab` | POST | Public | GitLab webhooks (placeholder) |
| `/api/v1/webhooks/bitbucket` | POST | Public | Bitbucket webhooks (placeholder) |

### 2.2 Controller (`apps/api/src/controllers/webhooks.controller.ts`)

**Functions:**
- `processGitHubWebhook()` - Main entry point for GitHub webhooks
- `handlePingEvent()` - Handle webhook setup ping
- `handlePushEvent()` - Handle code push events
- `simulatePushEvent()` - Test webhook without GitHub (dev only)

### 2.3 GitHub Utilities (`apps/api/src/lib/github.ts`)

**Functions:**
- `verifyGitHubSignature()` - HMAC-SHA256 signature verification (timing-safe)
- `extractBranchFromRef()` - Parse branch from `refs/heads/main`
- `parsePushEvent()` - Extract commit info from payload
- `shouldTriggerDeployment()` - Check if deployment should proceed
- `normalizeGitHubUrl()` - Handle URL variations (SSH, HTTPS, with/without .git)
- `parseGitHubUrl()` - Extract owner/repo from URL

### 2.4 Webhook Service (`apps/api/src/services/webhooks.service.ts`)

**Functions:**
- `findProjectsByWebhook()` - Find projects matching repo + branch
- `updateProjectRepoId()` - Store GitHub repo ID for reliable matching
- `createDeploymentFromWebhook()` - Create deployment record
- `deploymentExistsForCommit()` - Check for duplicates (idempotency)
- `queueDeploymentBuild()` - Add to BullMQ queue

### 2.5 Environment Variable (`apps/api/src/lib/env.ts`)

```typescript
GITHUB_WEBHOOK_SECRET: z.string().default('dev-webhook-secret-change-in-production')
```

---

## 3. Remaining Work

### 3.1 Local Testing Setup (Priority: HIGH)

Since GitHub requires HTTPS for webhooks, we need a tunnel for local development.

#### Option A: ngrok (Recommended for Quick Tests)

```powershell
# 1. Install ngrok (if not installed)
choco install ngrok
# OR download from https://ngrok.com/download

# 2. Sign up at ngrok.com and get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN

# 3. Start ngrok tunnel (in a separate terminal)
ngrok http 8082

# 4. Copy the HTTPS URL from ngrok output
# Example: https://abc123.ngrok-free.app
```

#### Option B: Cloudflare Tunnel (Better for Persistent Dev)

```powershell
# 1. Install cloudflared
choco install cloudflared
# OR download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# 2. Create a tunnel (one-time setup)
cloudflared tunnel login
cloudflared tunnel create paas-dev

# 3. Run the tunnel
cloudflared tunnel run --url http://localhost:8082 paas-dev
```

### 3.2 GitHub Webhook Configuration

1. Go to your GitHub repository settings
2. Navigate to **Settings → Webhooks → Add webhook**
3. Configure:
   - **Payload URL**: `https://<your-tunnel-url>/api/v1/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Generate a strong secret (see below)
   - **Events**: Select "Just the push event"
4. Click **Add webhook**

**Generate a webhook secret:**
```powershell
# Using OpenSSL (if available)
openssl rand -hex 32

# Or use an online generator
# Example output: a1b2c3d4e5f6...32 characters
```

### 3.3 Environment Variable Updates

Add to your `.env` file:

```env
# GitHub Webhook Secret (MUST match what you set in GitHub)
GITHUB_WEBHOOK_SECRET=your-generated-secret-here
```

### 3.4 Database Schema (Already Exists)

The `projects` table already has the necessary columns:
- `gitRepoUrl` - Repository URL
- `gitRepoId` - GitHub repository ID (populated on first webhook)
- `gitBranch` - Branch to deploy from
- `gitProvider` - 'github' | 'gitlab' | 'bitbucket'

---

## 4. Files Reference

### 4.1 Backend Files (Already Implemented)

| File | Purpose | Status |
|------|---------|--------|
| `apps/api/src/routes/webhooks.routes.ts` | Webhook endpoints | ✅ Complete |
| `apps/api/src/controllers/webhooks.controller.ts` | Webhook logic | ✅ Complete |
| `apps/api/src/services/webhooks.service.ts` | Database operations | ✅ Complete |
| `apps/api/src/lib/github.ts` | GitHub utilities | ✅ Complete |
| `apps/api/src/lib/env.ts` | Environment config | ✅ Complete |
| `apps/api/src/db/schema.ts` | Database schema | ✅ Complete |

### 4.2 Frontend Files (To Be Implemented)

| File | Purpose | Status |
|------|---------|--------|
| `apps/web/src/app/projects/[id]/settings/page.tsx` | Project settings page | ❌ TODO |
| `apps/web/src/components/webhook-config.tsx` | Webhook configuration UI | ❌ TODO |

---

## 5. Frontend UI Requirements (Future)

When the frontend is built, add these webhook-related features:

### 5.1 Project Settings Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Project Settings                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔗 GitHub Integration                                         │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Auto-deploy: [✓] Enabled                                      │
│                                                                 │
│  Webhook URL (copy this to GitHub):                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ https://api.yourpaas.com/api/v1/webhooks/github      [📋] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Webhook Secret:                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ••••••••••••••••••••••••••••••••  [👁️] [🔄] [📋]        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Branch: main                                                  │
│                                                                 │
│  ⚠️ Setup Instructions:                                        │
│  1. Go to your GitHub repo → Settings → Webhooks              │
│  2. Add a new webhook with the URL above                       │
│  3. Set Content-Type to application/json                       │
│  4. Enter the webhook secret shown above                       │
│  5. Select "Just the push event"                               │
│                                                                 │
│  [Test Webhook] [View Recent Deliveries]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Webhook Secret Management

**Options:**
1. **Global Secret** (current): Single `GITHUB_WEBHOOK_SECRET` for all projects
   - Simpler setup
   - Less secure (one compromised secret affects all projects)

2. **Per-Project Secret** (recommended for production):
   - Add `webhookSecret` column to `projects` table
   - Generate unique secret per project
   - More secure, but requires schema migration

---

## 6. Testing Guide

### 6.1 Manual Test with curl

```bash
# Generate signature for test payload
SECRET="your-webhook-secret"
PAYLOAD='{"ref":"refs/heads/main","after":"abc123","repository":{"html_url":"https://github.com/user/repo"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/SHA2-256(stdin)= /sha256=/')

# Send test webhook
curl -X POST http://localhost:8082/api/v1/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
```

### 6.2 Using the Simulate Endpoint (Dev Only)

```bash
# First, get your auth token
TOKEN="your-jwt-token"

# Simulate a push event
curl -X POST http://localhost:8082/api/v1/webhooks/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "your-project-uuid",
    "commitSha": "test-commit-123",
    "commitMessage": "Test deployment from simulate endpoint"
  }'
```

### 6.3 Using ngrok for Real GitHub Webhooks

```powershell
# Terminal 1: Start API
cd apps/api
pnpm dev

# Terminal 2: Start Worker
cd apps/worker
pnpm dev

# Terminal 3: Start ngrok
ngrok http 8082

# Then configure GitHub webhook with ngrok URL
# Push a commit to trigger deployment!
```

---

## 7. Security Considerations

### 7.1 Implemented Security

- ✅ HMAC-SHA256 signature verification
- ✅ Timing-safe comparison (prevents timing attacks)
- ✅ Duplicate detection (same commit SHA)
- ✅ Branch filtering (only deploy configured branch)
- ✅ Event filtering (only process push events)

### 7.2 Production Recommendations

- 🔒 Use strong, unique secrets (32+ characters)
- 🔒 Rotate secrets periodically
- 🔒 Consider per-project secrets
- 🔒 Rate limit the webhook endpoint
- 🔒 Log and monitor webhook deliveries
- 🔒 Store webhook event history for debugging

---

## 8. Troubleshooting

### Issue: "Invalid webhook signature"

**Causes:**
1. Secret mismatch between GitHub and your `.env`
2. Payload was modified in transit
3. Content-Type not set to `application/json`

**Solution:**
```powershell
# Verify your secret matches
echo $env:GITHUB_WEBHOOK_SECRET
# Should match what you set in GitHub
```

### Issue: "No projects found matching this webhook"

**Causes:**
1. Project's `gitRepoUrl` doesn't match the webhook's repo URL
2. Branch name doesn't match
3. `gitProvider` is not set to 'github'

**Solution:**
```sql
-- Check project configuration
SELECT slug, git_repo_url, git_branch, git_provider 
FROM projects 
WHERE slug = 'your-project-slug';
```

### Issue: ngrok tunnel not working

**Causes:**
1. ngrok not authenticated
2. Firewall blocking connections
3. ngrok session expired

**Solution:**
```powershell
# Re-authenticate ngrok
ngrok config add-authtoken YOUR_TOKEN

# Check ngrok status
ngrok http 8082
# Look for the "Forwarding" URL
```

---

## 9. Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Webhook endpoint | ✅ Done | `/api/v1/webhooks/github` |
| Signature verification | ✅ Done | HMAC-SHA256, timing-safe |
| Push event handling | ✅ Done | Parses commit, finds projects |
| Deployment creation | ✅ Done | Creates DB record, queues job |
| Duplicate detection | ✅ Done | Prevents same commit re-deploy |
| Environment variable | ✅ Done | `GITHUB_WEBHOOK_SECRET` |
| Local testing (ngrok) | ⏳ Manual | User needs to set up |
| Frontend UI | ❌ TODO | Part of frontend development |
| Per-project secrets | ❌ Optional | Future enhancement |

---

## 10. Next Steps

1. **Test locally with ngrok** - Verify the full flow works
2. **Build the frontend** - Include webhook configuration UI
3. **Production deployment** - Use real domain with HTTPS
4. **Add webhook event logging** - For debugging and audit trail
