/**
 * Neon Branch Management Types
 *
 * Shared types for the dual-pool connection system and
 * Neon API branch management.
 */

// ── Neon API Response Types ─────────────────────────────────

export interface NeonBranch {
  id: string;
  project_id: string;
  parent_id: string | null;
  parent_lsn: string | null;
  name: string;
  current_state: 'init' | 'ready' | 'deleting';
  logical_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface NeonEndpoint {
  id: string;
  host: string;
  branch_id: string;
  project_id: string;
  type: 'read_write' | 'read_only';
  current_state: 'init' | 'active' | 'idle';
  autoscaling_limit_min_cu: number;
  autoscaling_limit_max_cu: number;
  suspend_timeout_seconds: number;
  created_at: string;
}

export interface NeonBranchStatus {
  branch: NeonBranch;
  endpoints: NeonEndpoint[];
  readyForConnections: boolean;
}

// ── Masking Rule Definition ─────────────────────────────────

export interface MaskingRule {
  database_name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  masking_function: string;
}

// ── Branch Refresh Lifecycle ────────────────────────────────

export interface BranchRefreshResult {
  newBranchId: string;
  oldBranchId: string | null;
  connectionString: string;
  anonymizationStatus: 'completed' | 'in_progress' | 'failed';
  refreshedAt: string;
}

// ── Health Check Types ──────────────────────────────────────

export interface PoolHealthStatus {
  status: 'healthy' | 'unhealthy' | 'not_configured';
  latencyMs: number;
  poolStats: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  error?: string;
}

export interface NeonHealthResult {
  production: PoolHealthStatus;
  masked: PoolHealthStatus;
  useNeon: boolean;
  maskedBranchConfigured: boolean;
}

// ── Neon API Error ──────────────────────────────────────────

export interface NeonApiError {
  code: string;
  message: string;
}

// ── Configuration ───────────────────────────────────────────

export interface NeonConfig {
  apiKey: string;
  projectId: string;
  productionUrl: string;
  maskedBranchUrl: string | null;
  useNeon: boolean;
}

export function loadNeonConfig(): NeonConfig {
  return {
    apiKey: process.env.NEON_API_KEY ?? '',
    projectId: process.env.NEON_PROJECT_ID ?? '',
    productionUrl: process.env.NEON_DATABASE_URL ?? '',
    maskedBranchUrl: process.env.NEON_AI_BRANCH_URL ?? null,
    useNeon: process.env.USE_NEON === 'true',
  };
}
