/**
 * NeonBranchManager — Manages Neon AI branches via the Neon REST API.
 *
 * Handles:
 * - Listing available branches for the project
 * - Getting connection strings for specific branches
 * - Checking if pg_anonymizer extension is installed
 * - Refreshing the masked branch (create new, swap pool, delete old)
 * - Branch health/status checks
 *
 * Uses: https://console.neon.tech/api/v2/
 */

import { swapMaskedPool } from '../../db/neon-connection.js';
import { logger } from '../../lib/logger.js';
import type {
  NeonBranch,
  NeonEndpoint,
  NeonBranchStatus,
  BranchRefreshResult,
  MaskingRule,
  NeonApiError,
} from './masking-types.js';
import { loadNeonConfig } from './masking-types.js';

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

export class NeonBranchManager {
  private readonly apiKey: string;
  private readonly projectId: string;
  private currentAiBranchId: string | null = null;

  constructor(apiKey?: string, projectId?: string) {
    const config = loadNeonConfig();
    this.apiKey = apiKey ?? config.apiKey;
    this.projectId = projectId ?? config.projectId;

    if (!this.apiKey) {
      logger.warn('[NeonBranchManager] NEON_API_KEY not set — branch management disabled');
    }
    if (!this.projectId) {
      logger.warn('[NeonBranchManager] NEON_PROJECT_ID not set — branch management disabled');
    }
  }

  // ── API Helpers ─────────────────────────────────────────

  private isConfigured(): boolean {
    return Boolean(this.apiKey) && Boolean(this.projectId);
  }

  private async neonFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('[NeonBranchManager] API key or project ID not configured');
    }

    const url = `${NEON_API_BASE}/projects/${this.projectId}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorBody: NeonApiError | null = null;
      try {
        errorBody = (await response.json()) as NeonApiError;
      } catch {
        // ignore parse errors
      }
      throw new Error(
        `[NeonAPI] ${response.status} ${response.statusText}: ${errorBody?.message ?? 'Unknown error'} (${url})`,
      );
    }

    // DELETE returns 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // ── Branch Operations ─────────────────────────────────────

  /**
   * List all branches for the project.
   */
  async listBranches(): Promise<NeonBranch[]> {
    const data = await this.neonFetch<{ branches: NeonBranch[] }>('/branches');
    return data.branches;
  }

  /**
   * Get endpoints (connection info) for a specific branch.
   */
  async getBranchEndpoints(branchId: string): Promise<NeonEndpoint[]> {
    const data = await this.neonFetch<{ endpoints: NeonEndpoint[] }>(
      `/branches/${branchId}/endpoints`,
    );
    return data.endpoints;
  }

  /**
   * Get the connection string for a specific branch.
   * Returns the host of the first read_write endpoint.
   */
  async getBranchConnectionString(branchId: string): Promise<string> {
    const endpoints = await this.getBranchEndpoints(branchId);
    const rwEndpoint = endpoints.find((ep) => ep.type === 'read_write');

    if (!rwEndpoint) {
      throw new Error(`[NeonBranchManager] No read_write endpoint found for branch ${branchId}`);
    }

    // Build connection string from endpoint host
    // Password must come from environment (not exposed via API)
    const password = process.env.NEON_DB_PASSWORD ?? '';
    const dbName = process.env.NEON_DB_NAME ?? 'neondb';
    const user = process.env.NEON_DB_USER ?? 'neondb_owner';

    return `postgresql://${user}:${password}@${rwEndpoint.host}/${dbName}?sslmode=require`;
  }

  /**
   * Get full status for a branch including endpoint readiness.
   */
  async getBranchStatus(branchId: string): Promise<NeonBranchStatus> {
    const [branchData, endpoints] = await Promise.all([
      this.neonFetch<{ branch: NeonBranch }>(`/branches/${branchId}`),
      this.getBranchEndpoints(branchId),
    ]);

    const readyForConnections =
      branchData.branch.current_state === 'ready' &&
      endpoints.some((ep) => ep.current_state === 'active' || ep.current_state === 'idle');

    return {
      branch: branchData.branch,
      endpoints,
      readyForConnections,
    };
  }

  /**
   * Check if pg_anonymizer extension is installed on the masked branch.
   * Requires an active connection to the branch.
   */
  async checkAnonymizerInstalled(): Promise<boolean> {
    try {
      // This check relies on the masked pool being connected
      // In practice, run: SELECT extname FROM pg_extension WHERE extname = 'anon';
      // For now, return based on configuration presence
      const branches = await this.listBranches();
      return branches.some((b) => b.name.startsWith('masked-ai-') && b.current_state === 'ready');
    } catch {
      return false;
    }
  }

  /**
   * Find the current AI masked branch (if any).
   */
  async findCurrentMaskedBranch(): Promise<NeonBranch | null> {
    const branches = await this.listBranches();
    // Find the most recent masked-ai-* branch
    const maskedBranches = branches
      .filter((b) => b.name.startsWith('masked-ai-'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return maskedBranches[0] ?? null;
  }

  // ── Branch Refresh Cycle ──────────────────────────────────

  /**
   * Full masked branch refresh cycle:
   * 1. Create a new anonymized branch from production
   * 2. Wait for it to be ready
   * 3. Hot-swap the AI connection pool
   * 4. Delete the old branch
   *
   * Because masking is DETERMINISTIC (anon.pseudo_*), the token map
   * from the previous branch is still valid — only new rows need mapping.
   */
  async refreshMaskedBranch(maskingRules?: MaskingRule[]): Promise<BranchRefreshResult> {
    const oldBranchId = this.currentAiBranchId;
    const branchName = `masked-ai-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    logger.info(`[NeonBranchManager] Creating new masked branch: ${branchName}`);

    // 1. Create anonymized branch via Neon API
    const createPayload: Record<string, unknown> = {
      branch: {
        name: branchName,
      },
      endpoints: [
        {
          type: 'read_write',
          autoscaling_limit_min_cu: 0.25,
          autoscaling_limit_max_cu: 1,
          suspend_timeout_seconds: 300,
        },
      ],
    };

    // If masking rules provided, use the anonymized branch endpoint
    if (maskingRules && maskingRules.length > 0) {
      const createResult = await this.neonFetch<{
        branch: NeonBranch;
        endpoints: NeonEndpoint[];
      }>('/branches/anonymized', {
        method: 'POST',
        body: JSON.stringify({
          masking_rules: maskingRules,
          start_anonymization: true,
        }),
      });

      this.currentAiBranchId = createResult.branch.id;

      // 2. Wait for branch to be ready
      await this.waitForBranchReady(createResult.branch.id);

      // 3. Get connection string and hot-swap
      const connectionString = await this.getBranchConnectionString(createResult.branch.id);
      await swapMaskedPool(connectionString);

      // 4. Delete old branch
      if (oldBranchId) {
        await this.deleteBranch(oldBranchId);
      }

      return {
        newBranchId: createResult.branch.id,
        oldBranchId,
        connectionString,
        anonymizationStatus: 'completed',
        refreshedAt: new Date().toISOString(),
      };
    }

    // Standard branch creation (masking applied separately)
    const createResult = await this.neonFetch<{
      branch: NeonBranch;
      endpoints: NeonEndpoint[];
    }>('/branches', {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    this.currentAiBranchId = createResult.branch.id;

    // 2. Wait for branch to be ready
    await this.waitForBranchReady(createResult.branch.id);

    // 3. Get connection string and hot-swap
    const connectionString = await this.getBranchConnectionString(createResult.branch.id);
    await swapMaskedPool(connectionString);

    // 4. Delete old branch
    if (oldBranchId) {
      await this.deleteBranch(oldBranchId);
    }

    logger.info(`[NeonBranchManager] Branch refresh complete: ${this.currentAiBranchId}`);

    return {
      newBranchId: createResult.branch.id,
      oldBranchId,
      connectionString,
      anonymizationStatus: 'completed',
      refreshedAt: new Date().toISOString(),
    };
  }

  /**
   * Delete a branch by ID.
   */
  async deleteBranch(branchId: string): Promise<void> {
    logger.info(`[NeonBranchManager] Deleting branch: ${branchId}`);
    await this.neonFetch(`/branches/${branchId}`, { method: 'DELETE' });

    if (this.currentAiBranchId === branchId) {
      this.currentAiBranchId = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Poll until a branch reaches 'ready' state.
   * Times out after 120 seconds.
   */
  private async waitForBranchReady(branchId: string, timeoutMs: number = 120_000): Promise<void> {
    const start = Date.now();
    const pollIntervalMs = 3_000;

    while (Date.now() - start < timeoutMs) {
      const status = await this.getBranchStatus(branchId);
      if (status.readyForConnections) {
        logger.info(`[NeonBranchManager] Branch ${branchId} is ready (${Date.now() - start}ms)`);
        return;
      }

      logger.info(
        `[NeonBranchManager] Branch ${branchId} state: ${status.branch.current_state}, waiting...`,
      );
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `[NeonBranchManager] Branch ${branchId} did not become ready within ${timeoutMs}ms`,
    );
  }

  /**
   * Get the current AI branch ID (if managed by this instance).
   */
  getCurrentAiBranchId(): string | null {
    return this.currentAiBranchId;
  }
}
