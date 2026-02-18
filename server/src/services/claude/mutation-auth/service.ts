/**
 * Mutation Auth Service — Authorization rules for agent-proposed mutations.
 *
 * Enforces a permission matrix controlling:
 *  1. Which agents can propose mutations to which tables
 *  2. Which mutations can auto-execute without user confirmation
 *  3. Confidence thresholds for auto-execution
 *
 * Design principles:
 *  - Allowlist-only: agents not in the matrix are denied by default
 *  - Haiku agents (fast, cheaper) always require confirmation for writes
 *  - Sonnet agents can auto-execute categorization with confidence > 0.9
 *  - Financial mutations (GST, BAS, tax, journal entries) ALWAYS require confirmation
 *  - Delete operations ALWAYS require confirmation
 */

import type { AgentType } from '../types.js';
import type { MutationAuthDecision, TablePermission } from './types.js';
import { PERMISSION_MATRIX, AUTO_EXECUTE_RULES, FINANCIAL_TABLES } from './permissions.js';

export class MutationAuthService {
  /**
   * Check if an agent is allowed to propose a mutation to a given table.
   */
  canPropose(
    agentType: AgentType,
    targetTable: string,
    mutationType: 'create' | 'update' | 'delete' | 'batch_update',
  ): MutationAuthDecision {
    const permissions = this.getTablePermissions(agentType, targetTable);

    if (!permissions) {
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: `Agent '${agentType}' has no permissions for table '${targetTable}'`,
      };
    }

    const opKey = mutationType === 'batch_update' ? 'update' : mutationType;
    if (!permissions[opKey as keyof TablePermission]) {
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: `Agent '${agentType}' cannot ${mutationType} on '${targetTable}'`,
      };
    }

    return {
      allowed: true,
      requiresConfirmation: true, // Default — canAutoExecute() may override
    };
  }

  /**
   * Determine if a mutation can skip user confirmation.
   * Returns false by default — only specific high-confidence scenarios auto-execute.
   */
  canAutoExecute(
    agentType: AgentType,
    mutationType: string,
    targetTable: string,
    confidence: number,
  ): boolean {
    // Rule 1: Delete operations NEVER auto-execute
    if (mutationType === 'delete') return false;

    // Rule 2: Financial tables NEVER auto-execute
    if (FINANCIAL_TABLES.has(targetTable)) return false;

    // Rule 3: Check specific auto-execute rules
    const rule = AUTO_EXECUTE_RULES.find(
      (r) =>
        r.agentType === agentType &&
        r.mutationType === mutationType &&
        r.targetTable === targetTable,
    );

    if (!rule) return false;

    // Rule 4: Confidence threshold must be met
    return confidence >= rule.minConfidence;
  }

  /**
   * Get the full permission matrix for an agent.
   */
  getAgentPermissions(agentType: AgentType): Record<string, TablePermission> {
    return PERMISSION_MATRIX[agentType] ?? {};
  }

  /**
   * Get table permissions for an agent (exact match only — no wildcards).
   */
  private getTablePermissions(agentType: AgentType, targetTable: string): TablePermission | null {
    const agentPerms = PERMISSION_MATRIX[agentType];
    if (!agentPerms) return null;
    if (agentPerms[targetTable]) return agentPerms[targetTable];
    return null;
  }
}
