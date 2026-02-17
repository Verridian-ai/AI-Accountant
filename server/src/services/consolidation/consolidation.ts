/**
 * Consolidation Service
 *
 * Main ConsolidationService orchestrator class. Delegates to sub-modules
 * for elimination rules, report generation, and consolidation steps.
 */

import type {
  ConsolidationRule,
  ConsolidationSnapshot,
  ConsolidationSnapshotLine,
  RuleCriteria,
  RuleAction,
} from './types.js';
import { generateConsolidation } from './consolidation-steps.js';
import {
  createConsolidationRule,
  updateConsolidationRule,
  deleteConsolidationRule,
  finalizeSnapshot,
} from './rule-management.js';
import { getConsolidationHistory, getSnapshotDetail } from './report-generator.js';

export class ConsolidationService {
  /**
   * Generate a consolidation snapshot for a parent entity and its children.
   * Aggregates transactions by category, applies elimination rules, and
   * creates a point-in-time snapshot.
   */
  async generateConsolidation(params: {
    userId: string;
    parentEntityId: string;
    financialYear: string;
  }): Promise<{
    snapshot: ConsolidationSnapshot;
    lines: ConsolidationSnapshotLine[];
    eliminations: Array<{
      ruleId: string;
      ruleName: string;
      amount: number;
      description: string;
    }>;
  }> {
    return generateConsolidation(params);
  }

  /**
   * Create a new consolidation rule.
   */
  async createConsolidationRule(params: {
    userId: string;
    parentEntityId: string;
    ruleName: string;
    ruleType: 'elimination' | 'adjustment' | 'reclassification' | 'minority_interest';
    description?: string;
    criteria: RuleCriteria;
    action: RuleAction;
    priority?: number;
  }): Promise<ConsolidationRule> {
    return createConsolidationRule(params);
  }

  /**
   * Partial update of a consolidation rule. Re-serializes JSON fields if changed.
   */
  async updateConsolidationRule(
    ruleId: string,
    userId: string,
    updates: Partial<{
      ruleName: string;
      description: string;
      criteria: RuleCriteria;
      action: RuleAction;
      priority: number;
      isActive: boolean;
    }>,
  ): Promise<ConsolidationRule> {
    return updateConsolidationRule(ruleId, userId, updates);
  }

  /**
   * Soft-delete a consolidation rule by setting isActive=false.
   */
  async deleteConsolidationRule(ruleId: string, userId: string): Promise<void> {
    return deleteConsolidationRule(ruleId, userId);
  }

  /**
   * Finalize a consolidation snapshot. Prevents further modifications.
   */
  async finalizeSnapshot(snapshotId: string, userId: string): Promise<ConsolidationSnapshot> {
    return finalizeSnapshot(snapshotId, userId);
  }

  /**
   * Get consolidation history for a parent entity, optionally filtered by financial year.
   */
  async getConsolidationHistory(
    parentEntityId: string,
    userId: string,
    financialYear?: string,
  ): Promise<{
    snapshots: Array<ConsolidationSnapshot & { lineCount: number }>;
  }> {
    return getConsolidationHistory(parentEntityId, userId, financialYear);
  }

  /**
   * Get full detail of a consolidation snapshot including all lines,
   * entity-level breakdowns, and consolidated totals.
   */
  async getSnapshotDetail(
    snapshotId: string,
    userId: string,
  ): Promise<{
    snapshot: ConsolidationSnapshot;
    lines: ConsolidationSnapshotLine[];
    byEntity: Record<
      string,
      {
        entityName: string;
        revenue: number;
        expenses: number;
        assets: number;
        liabilities: number;
        equity: number;
      }
    >;
    eliminations: ConsolidationSnapshotLine[];
    consolidatedTotals: {
      revenue: number;
      expenses: number;
      netProfit: number;
      assets: number;
      liabilities: number;
      equity: number;
    };
  }> {
    return getSnapshotDetail(snapshotId, userId);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const consolidationService = new ConsolidationService();
