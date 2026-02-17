/**
 * Confirmation Flow Types — Interfaces for agent session and confirmation flow.
 */

/** Session creation options. */
export interface CreateSessionOptions {
  userId?: string;
  context?: Record<string, unknown>;
}

/** Agent session record. */
export interface AgentSession {
  id: string;
  userId?: string | null;
  startedAt: string;
  lastActivityAt: string;
  status: 'active' | 'completed' | 'expired';
  context?: string | null;
  totalMutations: number;
  confirmedMutations: number;
  rejectedMutations: number;
  queryCount: number;
  agentTypesUsed?: string | null;
  createdAt: string;
}
