// ═══════════════════════════════════════════════════════════════════════════
// Shared Constants
// ═══════════════════════════════════════════════════════════════════════════
//
// Constants shared between frontend and backend.
//
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// PROJECT STATUS
// ─────────────────────────────────────────────────────────────────

export const PROJECT_STATUS = {
  INACTIVE: 'inactive',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  RUNNING: 'running',
  FAILED: 'failed',
  STOPPED: 'stopped',
} as const;

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  inactive: 'Not Deployed',
  building: 'Building',
  deploying: 'Deploying',
  running: 'Running',
  failed: 'Failed',
  stopped: 'Stopped',
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  inactive: 'gray',
  building: 'yellow',
  deploying: 'blue',
  running: 'green',
  failed: 'red',
  stopped: 'gray',
};

// ─────────────────────────────────────────────────────────────────
// INSTANCE TYPES
// ─────────────────────────────────────────────────────────────────

export const INSTANCE_TYPES = {
  small: {
    name: 'Small',
    cpu: '0.25 vCPU',
    memory: '256 MB',
    price: '$5/month',
  },
  medium: {
    name: 'Medium',
    cpu: '0.5 vCPU',
    memory: '512 MB',
    price: '$10/month',
  },
  large: {
    name: 'Large',
    cpu: '1 vCPU',
    memory: '1 GB',
    price: '$20/month',
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// SERVICE TYPES
// ─────────────────────────────────────────────────────────────────

export const SERVICE_TYPES = {
  postgres: {
    name: 'PostgreSQL',
    icon: '🐘',
    defaultVersion: '16',
    versions: ['16', '15', '14'],
  },
  redis: {
    name: 'Redis',
    icon: '🔴',
    defaultVersion: '7',
    versions: ['7', '6'],
  },
  mysql: {
    name: 'MySQL',
    icon: '🐬',
    defaultVersion: '8',
    versions: ['8', '5.7'],
  },
  mongodb: {
    name: 'MongoDB',
    icon: '🍃',
    defaultVersion: '7',
    versions: ['7', '6'],
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      projects: 3,
      deploymentsPerDay: 10,
      customDomains: 0,
      teamMembers: 1,
    },
  },
  pro: {
    name: 'Pro',
    price: 20,
    limits: {
      projects: 20,
      deploymentsPerDay: 100,
      customDomains: 10,
      teamMembers: 5,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 100,
    limits: {
      projects: -1, // unlimited
      deploymentsPerDay: -1,
      customDomains: -1,
      teamMembers: -1,
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// SUPPORTED FRAMEWORKS
// ─────────────────────────────────────────────────────────────────

export const SUPPORTED_FRAMEWORKS = [
  { id: 'nextjs', name: 'Next.js', icon: '▲' },
  { id: 'react', name: 'React', icon: '⚛️' },
  { id: 'vue', name: 'Vue.js', icon: '💚' },
  { id: 'nuxt', name: 'Nuxt', icon: '💚' },
  { id: 'svelte', name: 'SvelteKit', icon: '🔥' },
  { id: 'express', name: 'Express.js', icon: '🚂' },
  { id: 'fastify', name: 'Fastify', icon: '⚡' },
  { id: 'hono', name: 'Hono', icon: '🔥' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'django', name: 'Django', icon: '🐍' },
  { id: 'flask', name: 'Flask', icon: '🧪' },
  { id: 'go', name: 'Go', icon: '🐹' },
  { id: 'rust', name: 'Rust', icon: '🦀' },
  { id: 'docker', name: 'Docker', icon: '🐳' },
] as const;



