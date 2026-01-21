// ═══════════════════════════════════════════════════════════════════════════
// GitHub Utilities
// ═══════════════════════════════════════════════════════════════════════════
//
// This file provides utilities for interacting with GitHub:
// - Webhook signature verification
// - Parsing webhook payloads
// - GitHub API calls (future: for OAuth, repo listing)
//
// SECURITY NOTE:
// Always verify webhook signatures before processing!
// This prevents attackers from triggering fake deployments.
//
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from './logger';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * GitHub Push Event Payload
 * Sent when code is pushed to a repository
 * 
 * Full documentation: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
 */
export interface GitHubPushPayload {
  // Reference that was pushed (e.g., "refs/heads/main")
  ref: string;
  
  // SHA of the most recent commit after the push
  after: string;
  
  // SHA before the push (0000... for new branches)
  before: string;
  
  // Whether this push created a new branch
  created: boolean;
  
  // Whether this push deleted a branch
  deleted: boolean;
  
  // Whether this was a force push
  forced: boolean;
  
  // Repository information
  repository: {
    id: number;
    name: string;
    full_name: string; // e.g., "user/repo"
    html_url: string;  // e.g., "https://github.com/user/repo"
    clone_url: string; // e.g., "https://github.com/user/repo.git"
    ssh_url: string;   // e.g., "git@github.com:user/repo.git"
    default_branch: string;
    private: boolean;
  };
  
  // User who pushed
  pusher: {
    name: string;
    email: string;
  };
  
  // User who owns the repo
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
  
  // Commits in this push
  commits: Array<{
    id: string;      // SHA
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    url: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  
  // The most recent commit (head commit)
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    url: string;
  } | null;
  
  // Compare URL showing the diff
  compare: string;
}

/**
 * GitHub Ping Event Payload
 * Sent when a webhook is first created
 */
export interface GitHubPingPayload {
  zen: string;
  hook_id: number;
  hook: {
    type: string;
    id: number;
    active: boolean;
    events: string[];
    config: {
      content_type: string;
      url: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
}

/**
 * Parsed information from a push event
 */
export interface ParsedPushEvent {
  // Branch name (e.g., "main", "develop")
  branch: string;
  
  // Latest commit SHA
  commitSha: string;
  
  // Latest commit message
  commitMessage: string;
  
  // Author name
  author: string;
  
  // Repository URL
  repoUrl: string;
  
  // Repository full name (e.g., "user/repo")
  repoFullName: string;
  
  // GitHub repository ID
  repoId: string;
  
  // Whether this is a branch deletion
  isDeleted: boolean;
}

// ─────────────────────────────────────────────────────────────────
// SIGNATURE VERIFICATION
// ─────────────────────────────────────────────────────────────────

/**
 * Verify GitHub webhook signature
 * 
 * GitHub signs webhook payloads using HMAC-SHA256.
 * The signature is in the X-Hub-Signature-256 header.
 * 
 * Format: sha256=<signature>
 * 
 * HOW IT WORKS:
 * 1. GitHub creates HMAC-SHA256 hash of the payload using your secret
 * 2. Sends the hash in the X-Hub-Signature-256 header
 * 3. We recreate the hash with our secret and compare
 * 4. If they match, the request is authentic
 * 
 * SECURITY:
 * - We use timingSafeEqual to prevent timing attacks
 * - Never log the signature or secret
 * 
 * @param payload - Raw request body (string or Buffer)
 * @param signature - X-Hub-Signature-256 header value
 * @param secret - Your webhook secret
 * @returns true if signature is valid
 */
export function verifyGitHubSignature(
  payload: string | Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  // No signature provided
  if (!signature) {
    logger.warn('GitHub webhook: No signature provided');
    return false;
  }
  
  // Signature should start with "sha256="
  if (!signature.startsWith('sha256=')) {
    logger.warn('GitHub webhook: Invalid signature format');
    return false;
  }
  
  // Extract the actual signature (remove "sha256=" prefix)
  const providedSignature = signature.slice(7);
  
  // Create our own signature using the same secret
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // Convert to buffers for timing-safe comparison
  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  // Buffers must be same length for timingSafeEqual
  if (providedBuffer.length !== expectedBuffer.length) {
    logger.warn('GitHub webhook: Signature length mismatch');
    return false;
  }
  
  // Timing-safe comparison prevents timing attacks
  const isValid = timingSafeEqual(providedBuffer, expectedBuffer);
  
  if (!isValid) {
    logger.warn('GitHub webhook: Signature verification failed');
  }
  
  return isValid;
}

// ─────────────────────────────────────────────────────────────────
// PAYLOAD PARSING
// ─────────────────────────────────────────────────────────────────

/**
 * Extract branch name from ref
 * 
 * GitHub sends refs like:
 * - "refs/heads/main" → "main"
 * - "refs/heads/feature/auth" → "feature/auth"
 * - "refs/tags/v1.0.0" → (not a branch)
 * 
 * @param ref - Git reference (e.g., "refs/heads/main")
 * @returns Branch name or null if not a branch
 */
export function extractBranchFromRef(ref: string): string | null {
  const branchPrefix = 'refs/heads/';
  
  if (ref.startsWith(branchPrefix)) {
    return ref.slice(branchPrefix.length);
  }
  
  return null;
}

/**
 * Parse a GitHub push event payload
 * 
 * @param payload - GitHub push event payload
 * @returns Parsed event data or null if invalid
 */
export function parsePushEvent(payload: GitHubPushPayload): ParsedPushEvent | null {
  // Extract branch name
  const branch = extractBranchFromRef(payload.ref);
  
  if (!branch) {
    // Not a branch push (could be a tag)
    return null;
  }
  
  // Get head commit info
  const headCommit = payload.head_commit;
  const lastCommit = payload.commits?.[payload.commits.length - 1];
  
  return {
    branch,
    commitSha: payload.after,
    commitMessage: headCommit?.message || lastCommit?.message || 'No commit message',
    author: headCommit?.author?.name || payload.pusher.name,
    repoUrl: payload.repository.html_url,
    repoFullName: payload.repository.full_name,
    repoId: payload.repository.id.toString(),
    isDeleted: payload.deleted,
  };
}

/**
 * Check if a push event should trigger a deployment
 * 
 * We don't deploy for:
 * - Branch deletions
 * - Empty commits (0000... SHA)
 * - Tag pushes (handled by extractBranchFromRef)
 */
export function shouldTriggerDeployment(
  parsedEvent: ParsedPushEvent,
  configuredBranch: string
): boolean {
  // Don't deploy branch deletions
  if (parsedEvent.isDeleted) {
    logger.debug({ branch: parsedEvent.branch }, 'Skipping: branch deleted');
    return false;
  }
  
  // Don't deploy empty pushes
  if (parsedEvent.commitSha === '0000000000000000000000000000000000000000') {
    logger.debug('Skipping: empty commit SHA');
    return false;
  }
  
  // Check if branch matches configured branch
  if (parsedEvent.branch !== configuredBranch) {
    logger.debug(
      { pushBranch: parsedEvent.branch, configuredBranch },
      'Skipping: branch does not match configured branch'
    );
    return false;
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────────────
// URL UTILITIES
// ─────────────────────────────────────────────────────────────────

/**
 * Normalize a GitHub repository URL
 * 
 * Converts various formats to a standard format:
 * - https://github.com/user/repo
 * - https://github.com/user/repo.git
 * - git@github.com:user/repo.git
 * - github.com/user/repo
 * 
 * All become: https://github.com/user/repo
 */
export function normalizeGitHubUrl(url: string): string {
  let normalized = url.trim();
  
  // Remove .git suffix
  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4);
  }
  
  // Convert SSH format to HTTPS
  if (normalized.startsWith('git@github.com:')) {
    normalized = normalized.replace('git@github.com:', 'https://github.com/');
  }
  
  // Add https:// if missing
  if (normalized.startsWith('github.com/')) {
    normalized = 'https://' + normalized;
  }
  
  // Ensure https://
  if (!normalized.startsWith('https://')) {
    normalized = normalized.replace('http://', 'https://');
  }
  
  return normalized;
}

/**
 * Extract owner and repo from a GitHub URL
 * 
 * @param url - GitHub repository URL
 * @returns { owner, repo } or null if invalid
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const normalized = normalizeGitHubUrl(url);
  
  // Match: https://github.com/owner/repo
  const match = normalized.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)$/);
  
  if (!match) {
    return null;
  }
  
  return {
    owner: match[1],
    repo: match[2],
  };
}

// ─────────────────────────────────────────────────────────────────
// GITHUB API (Future use for OAuth, repo listing)
// ─────────────────────────────────────────────────────────────────

/**
 * GitHub API base URL
 */
const GITHUB_API_URL = 'https://api.github.com';

/**
 * Fetch user's repositories (for OAuth flow)
 * TODO: Implement when adding GitHub OAuth
 */
export async function fetchUserRepos(accessToken: string): Promise<unknown[]> {
  const response = await fetch(`${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'PaaS-Platform',
    },
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return response.json() as Promise<unknown[]>;
}

/**
 * Get repository information
 * TODO: Implement when needed
 */
export async function getRepoInfo(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'PaaS-Platform',
  };
  
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return response.json();
}


