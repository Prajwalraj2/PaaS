# Frontend Implementation Plan

> Complete guide for building the PaaS Dashboard with Next.js 16, React 19, and shadcn/ui

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS v4** | Styling |
| **shadcn/ui (Radix Nova)** | Component library |
| **TanStack Query** | Server state management |
| **Axios** | HTTP client |
| **Lucide React** | Icons |
| **date-fns** | Date formatting |
| **Sonner** | Toast notifications |

---

## Project Structure

```
apps/web/
├── app/                          # Next.js App Router pages
│   ├── (auth)/                   # Auth pages (public)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx            # Auth layout (centered card)
│   │
│   ├── (dashboard)/              # Dashboard pages (protected)
│   │   ├── projects/
│   │   │   ├── page.tsx          # Project list
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create project
│   │   │   └── [projectId]/
│   │   │       ├── page.tsx      # Project overview
│   │   │       ├── deployments/
│   │   │       │   ├── page.tsx  # Deployment list
│   │   │       │   └── [deployId]/
│   │   │       │       └── page.tsx  # Deployment details + logs
│   │   │       ├── settings/
│   │   │       │   └── page.tsx  # Project settings
│   │   │       ├── env/
│   │   │       │   └── page.tsx  # Environment variables
│   │   │       ├── domains/
│   │   │       │   └── page.tsx  # Custom domains
│   │   │       └── services/
│   │   │           └── page.tsx  # Add-on services
│   │   │
│   │   ├── settings/
│   │   │   ├── page.tsx          # User settings
│   │   │   └── profile/
│   │   │       └── page.tsx      # Profile settings
│   │   │
│   │   └── layout.tsx            # Dashboard layout (sidebar + navbar)
│   │
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing / redirect to dashboard
│   └── globals.css
│
├── components/
│   ├── ui/                       # shadcn/ui components (auto-generated)
│   │
│   ├── auth/                     # Auth-specific components
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   └── auth-provider.tsx     # Auth context provider
│   │
│   ├── dashboard/                # Dashboard layout components
│   │   ├── sidebar.tsx
│   │   ├── navbar.tsx
│   │   ├── user-menu.tsx
│   │   └── mobile-nav.tsx
│   │
│   ├── projects/                 # Project-related components
│   │   ├── project-card.tsx
│   │   ├── project-list.tsx
│   │   ├── create-project-form.tsx
│   │   ├── project-header.tsx
│   │   └── project-tabs.tsx
│   │
│   ├── deployments/              # Deployment components
│   │   ├── deployment-list.tsx
│   │   ├── deployment-card.tsx
│   │   ├── deployment-status.tsx
│   │   ├── build-logs.tsx        # Real-time log viewer
│   │   └── deploy-button.tsx
│   │
│   ├── env-vars/                 # Environment variable components
│   │   ├── env-var-list.tsx
│   │   ├── env-var-form.tsx
│   │   └── env-var-row.tsx
│   │
│   ├── domains/                  # Custom domain components
│   │   ├── domain-list.tsx
│   │   ├── add-domain-form.tsx
│   │   └── dns-instructions.tsx
│   │
│   ├── services/                 # Add-on service components
│   │   ├── service-list.tsx
│   │   ├── create-service-form.tsx
│   │   └── service-card.tsx
│   │
│   └── shared/                   # Shared components
│       ├── loading-spinner.tsx
│       ├── empty-state.tsx
│       ├── error-boundary.tsx
│       ├── confirm-dialog.tsx
│       └── page-header.tsx
│
├── lib/
│   ├── api/                      # API client
│   │   ├── client.ts             # Axios instance with interceptors
│   │   ├── auth.ts               # Auth API calls
│   │   ├── projects.ts           # Project API calls
│   │   ├── deployments.ts        # Deployment API calls
│   │   ├── domains.ts            # Domain API calls
│   │   └── services.ts           # Services API calls
│   │
│   ├── hooks/                    # Custom hooks
│   │   ├── use-auth.ts           # Auth hook
│   │   ├── use-projects.ts       # Projects queries
│   │   ├── use-deployments.ts    # Deployments queries
│   │   └── use-polling.ts        # Polling for real-time updates
│   │
│   ├── providers/                # Context providers
│   │   ├── query-provider.tsx    # TanStack Query provider
│   │   └── auth-provider.tsx     # Auth context
│   │
│   ├── types/                    # TypeScript types
│   │   ├── auth.ts
│   │   ├── project.ts
│   │   ├── deployment.ts
│   │   └── api.ts
│   │
│   └── utils.ts                  # Utilities (cn, formatDate, etc.)
│
└── middleware.ts                 # Auth middleware for protected routes
```

---

## Implementation Phases

### Phase 1: Foundation & Authentication (Priority: HIGH)

#### 1.1 API Client Setup

```typescript
// lib/api/client.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### 1.2 Auth API Functions

```typescript
// lib/api/auth.ts
import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export const authApi = {
  login: (data: LoginRequest) => 
    apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', data),
  
  register: (data: RegisterRequest) => 
    apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/register', data),
  
  me: () => 
    apiClient.get<{ success: boolean; data: User }>('/auth/me'),
  
  logout: () => 
    apiClient.post('/auth/logout'),
  
  refresh: (refreshToken: string) => 
    apiClient.post<{ success: boolean; data: { token: string } }>('/auth/refresh', { refreshToken }),
  
  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    apiClient.patch<{ success: boolean; data: User }>('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/auth/password', data),
};
```

#### 1.3 Auth Context Provider

```typescript
// lib/providers/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, User } from '@/lib/api/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.me()
        .then(res => setUser(res.data.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('token', res.data.data.token);
    localStorage.setItem('refreshToken', res.data.data.refreshToken);
    setUser(res.data.data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    localStorage.setItem('token', res.data.data.token);
    localStorage.setItem('refreshToken', res.data.data.refreshToken);
    setUser(res.data.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

#### 1.4 Auth Pages

| Page | Route | Features |
|------|-------|----------|
| Login | `/login` | Email/password form, link to register, error handling |
| Register | `/register` | Name/email/password form, validation, link to login |

#### 1.5 Middleware (Route Protection)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = ['/login', '/register', '/'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

### Phase 2: Dashboard & Project CRUD (Priority: HIGH)

#### 2.1 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────────────────────────────────────────────────┐  │
│  │         │  │  Navbar                                    [User ▼] │  │
│  │  Logo   │  └─────────────────────────────────────────────────────┘  │
│  │         │  ┌─────────────────────────────────────────────────────┐  │
│  │ ─────── │  │                                                     │  │
│  │         │  │                                                     │  │
│  │ Projects│  │                   Main Content                      │  │
│  │ Settings│  │                                                     │  │
│  │         │  │                                                     │  │
│  │         │  │                                                     │  │
│  │         │  │                                                     │  │
│  └─────────┘  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.2 Project List Page

| Component | Description |
|-----------|-------------|
| Header | "Projects" title + "New Project" button |
| Project Cards | Grid of project cards with status, last deploy, URL |
| Empty State | Shown when no projects exist |
| Loading | Skeleton cards during load |

#### 2.3 Create Project Form

| Field | Type | Validation |
|-------|------|------------|
| Name | Input | 3-50 chars, lowercase + numbers + hyphens |
| Git URL | Input | Valid URL |
| Branch | Input | Default: main |
| Build Command | Input | Optional |
| Start Command | Input | Optional |

#### 2.4 Project API Functions

```typescript
// lib/api/projects.ts
import { apiClient } from './client';

export interface Project {
  id: string;
  name: string;
  slug: string;
  gitProvider: string;
  gitRepoUrl: string;
  gitBranch: string;
  buildCommand?: string;
  startCommand?: string;
  status: 'inactive' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  subdomain?: string;
  instanceType: string;
  instanceCount: number;
  port: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  gitRepoUrl: string;
  gitBranch?: string;
  buildCommand?: string;
  startCommand?: string;
}

export const projectsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<{ success: boolean; data: Project[]; pagination: Pagination }>(
      '/projects', { params: { page, limit } }
    ),
  
  get: (id: string) =>
    apiClient.get<{ success: boolean; data: Project }>(`/projects/${id}`),
  
  create: (data: CreateProjectInput) =>
    apiClient.post<{ success: boolean; data: Project }>('/projects', data),
  
  update: (id: string, data: Partial<Project>) =>
    apiClient.patch<{ success: boolean; data: Project }>(`/projects/${id}`, data),
  
  delete: (id: string) =>
    apiClient.delete(`/projects/${id}`),
  
  deploy: (id: string) =>
    apiClient.post<{ success: boolean; data: Deployment }>(`/projects/${id}/deploy`),
  
  // Environment Variables
  listEnvVars: (id: string) =>
    apiClient.get<{ success: boolean; data: EnvVar[] }>(`/projects/${id}/env`),
  
  setEnvVar: (id: string, data: { key: string; value: string; isSecret?: boolean }) =>
    apiClient.post(`/projects/${id}/env`, data),
  
  deleteEnvVar: (id: string, key: string) =>
    apiClient.delete(`/projects/${id}/env/${key}`),
};
```

---

### Phase 3: Deployments (Priority: HIGH)

#### 3.1 Deployment List Page

| Feature | Description |
|---------|-------------|
| Deployment History | Table/list of all deployments |
| Status Badges | Colored badges for build/deploy status |
| Quick Actions | View logs, rollback buttons |
| Filters | Filter by status, branch |

#### 3.2 Deployment Detail Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Deployments                                                  │
│                                                                         │
│  Deployment #abc123                                    [Cancel] [Rollback]
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐                      │
│  │ Build Status        │  │ Deploy Status       │                      │
│  │ ✓ Success (45s)     │  │ ✓ Live              │                      │
│  └─────────────────────┘  └─────────────────────┘                      │
│                                                                         │
│  Git Info:                                                              │
│  • Commit: abc123def                                                    │
│  • Message: "Fix authentication bug"                                    │
│  • Branch: main                                                         │
│  • Author: John Doe                                                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  BUILD LOGS                                         [Auto-scroll]│   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  [14:23:01] Starting build...                                   │   │
│  │  [14:23:02] Cloning repository...                               │   │
│  │  [14:23:05] Installing dependencies...                          │   │
│  │  [14:23:15] npm install completed                               │   │
│  │  [14:23:16] Building application...                             │   │
│  │  [14:23:30] Build successful                                    │   │
│  │  [14:23:31] Pushing image to registry...                        │   │
│  │  [14:23:45] Deploy complete!                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.3 Build Logs Component (Real-time)

```typescript
// components/deployments/build-logs.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deploymentsApi } from '@/lib/api/deployments';

interface BuildLogsProps {
  projectId: string;
  deploymentId: string;
  isBuilding: boolean;
}

export function BuildLogs({ projectId, deploymentId, isBuilding }: BuildLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data } = useQuery({
    queryKey: ['build-logs', deploymentId],
    queryFn: () => deploymentsApi.getLogs(projectId, deploymentId),
    refetchInterval: isBuilding ? 2000 : false, // Poll every 2s while building
  });

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data, autoScroll]);

  return (
    <div className="rounded-lg border bg-black text-white font-mono text-sm">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
        <span>Build Logs</span>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>
      <div ref={scrollRef} className="h-96 overflow-y-auto p-4 space-y-1">
        {data?.data.logs.map((log) => (
          <div key={log.id} className={getLogColor(log.level)}>
            <span className="text-gray-500">[{formatTime(log.timestamp)}]</span>{' '}
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3.4 Deployments API

```typescript
// lib/api/deployments.ts
export interface Deployment {
  id: string;
  projectId: string;
  gitCommitSha?: string;
  gitCommitMessage?: string;
  gitBranch?: string;
  gitAuthor?: string;
  buildStatus: 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
  buildStartedAt?: string;
  buildFinishedAt?: string;
  buildDurationMs?: number;
  imageTag?: string;
  imageSizeBytes?: number;
  deployStatus: 'pending' | 'deploying' | 'live' | 'failed' | 'rolled_back';
  deployStartedAt?: string;
  deployFinishedAt?: string;
  appUrl?: string;
  isCurrent: boolean;
  triggeredBy?: string;
  createdAt: string;
}

export interface BuildLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export const deploymentsApi = {
  list: (projectId: string, params?: { page?: number; limit?: number; buildStatus?: string }) =>
    apiClient.get<{ success: boolean; data: Deployment[]; pagination: Pagination }>(
      `/projects/${projectId}/deployments`, { params }
    ),
  
  get: (projectId: string, deployId: string) =>
    apiClient.get<{ success: boolean; data: Deployment }>(
      `/projects/${projectId}/deployments/${deployId}`
    ),
  
  getLogs: (projectId: string, deployId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<{ 
      success: boolean; 
      data: { logs: BuildLog[]; pagination: Pagination; deployment: Deployment } 
    }>(`/projects/${projectId}/deployments/${deployId}/logs`, { params }),
  
  getStats: (projectId: string) =>
    apiClient.get<{ 
      success: boolean; 
      data: { total: number; successful: number; failed: number; inProgress: number } 
    }>(`/projects/${projectId}/deployments/stats`),
  
  rollback: (projectId: string, deployId: string) =>
    apiClient.post<{ success: boolean; data: Deployment }>(
      `/projects/${projectId}/deployments/${deployId}/rollback`
    ),
  
  cancel: (projectId: string, deployId: string) =>
    apiClient.post<{ success: boolean; data: Deployment }>(
      `/projects/${projectId}/deployments/${deployId}/cancel`
    ),
};
```

---

### Phase 4: Project Settings & Environment Variables (Priority: MEDIUM)

#### 4.1 Project Settings Page

| Section | Fields |
|---------|--------|
| General | Name, Git URL, Branch, Root Directory |
| Build | Build Command, Start Command, Dockerfile Path |
| Runtime | Instance Type, Instance Count, Port |
| Danger Zone | Delete Project |

#### 4.2 Environment Variables Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Environment Variables                            [+ Add Variable]     │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DATABASE_URL        •••••••••••           [👁️] [✏️] [🗑️]     │   │
│  │  Secret                                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  NODE_ENV            production            [👁️] [✏️] [🗑️]     │   │
│  │  Visible                                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ⚠️ Changes require a new deployment to take effect                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Custom Domains (Priority: MEDIUM)

#### 5.1 Domains Page

| Feature | Description |
|---------|-------------|
| Domain List | All custom domains with status |
| Add Domain | Form to add new domain |
| Verify Button | Trigger DNS verification |
| DNS Instructions | Show TXT and CNAME records to configure |
| SSL Status | Show certificate status |

#### 5.2 Domains API

```typescript
// lib/api/domains.ts
export interface CustomDomain {
  id: string;
  domain: string;
  verified: boolean;
  sslStatus: 'pending' | 'active' | 'failed';
  verificationToken?: string;
  createdAt: string;
}

export interface DnsInstructions {
  txtRecord: {
    name: string;
    value: string;
    description: string;
  };
  cnameRecord: {
    name: string;
    value: string;
    description: string;
  };
}

export const domainsApi = {
  list: (projectId: string) =>
    apiClient.get<{ success: boolean; data: CustomDomain[] }>(
      `/projects/${projectId}/domains`
    ),
  
  add: (projectId: string, domain: string) =>
    apiClient.post<{ 
      success: boolean; 
      data: { domain: CustomDomain; dnsInstructions: DnsInstructions } 
    }>(`/projects/${projectId}/domains`, { domain }),
  
  get: (projectId: string, domainId: string) =>
    apiClient.get<{ success: boolean; data: { domain: CustomDomain; dnsInstructions: DnsInstructions } }>(
      `/projects/${projectId}/domains/${domainId}`
    ),
  
  verify: (projectId: string, domainId: string) =>
    apiClient.post<{ success: boolean; data: { verified: boolean; domain: CustomDomain } }>(
      `/projects/${projectId}/domains/${domainId}/verify`
    ),
  
  delete: (projectId: string, domainId: string) =>
    apiClient.delete(`/projects/${projectId}/domains/${domainId}`),
};
```

---

### Phase 6: Add-on Services (Priority: LOW)

#### 6.1 Services Page

| Feature | Description |
|---------|-------------|
| Service List | PostgreSQL, Redis, MySQL, MongoDB instances |
| Create Service | Form with type, name, version |
| Credentials | Show connection URL (hidden by default) |
| Actions | Restart, Regenerate credentials, Delete |

---

### Phase 7: User Settings (Priority: LOW)

#### 7.1 Profile Settings

| Section | Features |
|---------|----------|
| Profile | Name, Avatar |
| Security | Change password |
| API Keys | Generate/revoke API keys |
| Plan | Current plan, upgrade options |

---

## API Endpoints Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Get current user |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh token |
| PATCH | `/auth/profile` | Update profile |
| POST | `/auth/password` | Change password |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PATCH | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |
| POST | `/projects/:id/deploy` | Trigger deployment |
| GET | `/projects/:id/env` | List env vars |
| POST | `/projects/:id/env` | Set env var |
| DELETE | `/projects/:id/env/:key` | Delete env var |

### Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/deployments` | List deployments |
| POST | `/projects/:id/deployments` | Trigger deployment |
| GET | `/projects/:id/deployments/stats` | Get stats |
| GET | `/projects/:id/deployments/:deployId` | Get deployment |
| GET | `/projects/:id/deployments/:deployId/logs` | Get logs |
| POST | `/projects/:id/deployments/:deployId/rollback` | Rollback |
| POST | `/projects/:id/deployments/:deployId/cancel` | Cancel |

### Domains

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/domains` | List domains |
| POST | `/projects/:id/domains` | Add domain |
| GET | `/projects/:id/domains/:domainId` | Get domain |
| POST | `/projects/:id/domains/:domainId/verify` | Verify domain |
| DELETE | `/projects/:id/domains/:domainId` | Delete domain |

### Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/services/supported` | List service types |
| GET | `/projects/:id/services` | List services |
| POST | `/projects/:id/services` | Create service |
| GET | `/projects/:id/services/:svcId` | Get service |
| GET | `/projects/:id/services/:svcId/credentials` | Get credentials |
| POST | `/projects/:id/services/:svcId/restart` | Restart service |
| DELETE | `/projects/:id/services/:svcId` | Delete service |

---

## Implementation Order

```
Week 1: Foundation
├── Day 1-2: API client, types, providers
├── Day 3-4: Auth pages (login, register)
└── Day 5: Dashboard layout

Week 2: Core Features
├── Day 1-2: Project list & create
├── Day 3-4: Project detail & settings
└── Day 5: Deploy button & status

Week 3: Deployments
├── Day 1-2: Deployment list & detail
├── Day 3: Build logs (real-time)
├── Day 4: Rollback & cancel
└── Day 5: Environment variables

Week 4: Polish
├── Day 1-2: Custom domains
├── Day 3: Add-on services
├── Day 4: User settings
└── Day 5: Testing & bug fixes
```

---

## Key Components to Build First

1. **API Client** (`lib/api/client.ts`) - Foundation for all API calls
2. **Auth Provider** (`lib/providers/auth-provider.tsx`) - Authentication state
3. **Query Provider** (`lib/providers/query-provider.tsx`) - TanStack Query setup
4. **Login Form** (`components/auth/login-form.tsx`) - First user interaction
5. **Dashboard Layout** (`app/(dashboard)/layout.tsx`) - Main app shell
6. **Project Card** (`components/projects/project-card.tsx`) - Project list item
7. **Deployment Status** (`components/deployments/deployment-status.tsx`) - Status badges
8. **Build Logs** (`components/deployments/build-logs.tsx`) - Real-time log viewer

---

## Environment Variables

Add to `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8082
```

---

## Next Steps

1. Start with Phase 1 (API client + Auth)
2. Build incrementally, testing each feature
3. Use TanStack Query for all API calls
4. Implement real-time updates with polling for deployments
5. Add loading states and error handling throughout
