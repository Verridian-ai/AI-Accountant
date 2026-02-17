/**
 * MutationTools types and interfaces.
 *
 * Extracted from mutation-tools.ts to comply with the 300-line enterprise standard.
 */

import type { AgentType } from './types.js';

// ── Mutation Status Lifecycle ─────────────────────────────────────

export type MutationStatus =
  | 'proposed'
  | 'pending_confirmation'
  | 'confirmed'
  | 'executing'
  | 'executed'
  | 'rejected'
  | 'expired'
  | 'failed';

// ── Interfaces ────────────────────────────────────────────────────

/** Agent-facing proposal — what the agent submits when it wants a DB change. */
export interface MutationProposal {
  agentType: AgentType;
  mutationType: 'create' | 'update' | 'delete' | 'batch_update';
  targetTable: string;
  targetId?: string;
  targetIds?: string[];
  beforeState?: unknown;
  afterState: unknown;
  description: string;
  confidence?: number;
  requiresConfirmation?: boolean;
}

/** Persisted mutation record stored in the `agent_mutations` table. */
export interface AgentMutation {
  id: string;
  sessionId: string;
  agentType: AgentType;
  mutationType: string;
  targetTable: string;
  targetId: string | null;
  targetIds: string | null;
  beforeState: string | null;
  afterState: string;
  description: string;
  status: MutationStatus;
  confidence: number | null;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  executedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result returned after attempting to execute a mutation. */
export interface MutationExecutionResult {
  success: boolean;
  mutationId: string;
  error?: string;
  affectedRows?: number;
}
