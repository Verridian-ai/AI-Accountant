/**
 * Mutation Auth Types — Permission interfaces for agent-proposed mutations.
 */

import type { AgentType } from '../types.js';

/** Authorization decision for a proposed mutation. */
export interface MutationAuthDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

/** Table-level permission for an agent. */
export interface TablePermission {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

/** Auto-execution rule — when can a mutation skip user confirmation? */
export interface AutoExecuteRule {
  agentType: AgentType;
  mutationType: string;
  targetTable: string;
  minConfidence: number;
}
