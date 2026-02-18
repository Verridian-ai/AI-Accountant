/**
 * Elimination Rules
 *
 * Intercompany elimination rules and logic. Fetches confirmed inter-entity
 * transactions and creates offsetting entries based on active rules.
 */

import { db } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import {
  consolidationRules,
  interEntityTransactions,
  type ConsolidationRule,
  type ConsolidationSnapshotLine,
  type RuleCriteria,
  type RuleAction,
} from './types.js';
import {
  applyRevenueElimination,
  applyLoanElimination,
  applyDividendElimination,
  applyCategoryMatchElimination,
  applyAmountThresholdElimination,
} from './elimination-handlers.js';

export interface EliminationResult {
  eliminatedLines: ConsolidationSnapshotLine[];
  totalEliminationsAmount: number;
  eliminationDetails: Array<{
    ruleId: string;
    ruleName: string;
    amount: number;
    description: string;
  }>;
}

/**
 * Apply elimination rules against snapshot lines.
 * Fetches confirmed inter-entity transactions and creates offsetting entries.
 */
export async function applyEliminations(
  parentEntityId: string,
  snapshotId: string,
  lines: ConsolidationSnapshotLine[],
  userId: string,
  fyStart: string,
  fyEnd: string,
): Promise<EliminationResult> {
  const eliminatedLines: ConsolidationSnapshotLine[] = [];
  const eliminationDetails: Array<{
    ruleId: string;
    ruleName: string;
    amount: number;
    description: string;
  }> = [];
  let totalEliminationsAmount = 0;

  // Fetch active rules for this parent entity, ordered by priority
  const rules = (await db
    .select()
    .from(consolidationRules)
    .where(
      and(
        eq(consolidationRules.parentEntityId, parentEntityId),
        eq(consolidationRules.isActive, true),
      ),
    )
    .orderBy(consolidationRules.priority)
    .all()) as ConsolidationRule[];

  // Fetch confirmed inter-entity transactions for the FY
  type IET = InferSelectModel<typeof interEntityTransactions>;
  const confirmedIETs: IET[] = await db
    .select()
    .from(interEntityTransactions)
    .where(
      and(
        eq(interEntityTransactions.userId, userId),
        eq(interEntityTransactions.status, 'confirmed'),
        sql`${interEntityTransactions.transactionDate} >= ${fyStart}`,
        sql`${interEntityTransactions.transactionDate} <= ${fyEnd}`,
      ),
    )
    .all();

  for (const rule of rules) {
    const criteria: RuleCriteria = JSON.parse(rule.criteriaJson);
    const action: RuleAction = JSON.parse(rule.actionJson);

    switch (criteria.matchType) {
      case 'inter_entity_revenue': {
        applyRevenueElimination(
          criteria,
          confirmedIETs,
          snapshotId,
          rule,
          eliminatedLines,
          eliminationDetails,
        );
        totalEliminationsAmount += sumIETAmounts(
          confirmedIETs.filter(
            (iet) =>
              iet.transactionType === 'management_fee' ||
              iet.transactionType === 'service_fee' ||
              iet.transactionType === 'rent',
          ),
        );
        break;
      }

      case 'inter_entity_loan': {
        applyLoanElimination(
          criteria,
          confirmedIETs,
          snapshotId,
          rule,
          eliminatedLines,
          eliminationDetails,
        );
        totalEliminationsAmount += sumIETAmounts(
          confirmedIETs.filter((iet) => iet.transactionType === 'loan'),
        );
        break;
      }

      case 'inter_entity_dividend': {
        applyDividendElimination(
          confirmedIETs,
          snapshotId,
          rule,
          eliminatedLines,
          eliminationDetails,
        );
        totalEliminationsAmount += sumIETAmounts(
          confirmedIETs.filter(
            (iet) => iet.transactionType === 'dividend' || iet.transactionType === 'distribution',
          ),
        );
        break;
      }

      case 'category_match': {
        applyCategoryMatchElimination(
          criteria,
          action,
          lines,
          snapshotId,
          rule,
          eliminatedLines,
          eliminationDetails,
        );
        totalEliminationsAmount += sumCategoryMatchAmount(criteria, action, lines);
        break;
      }

      case 'amount_threshold': {
        applyAmountThresholdElimination(
          criteria,
          action,
          lines,
          snapshotId,
          rule,
          eliminatedLines,
          eliminationDetails,
        );
        break;
      }
    }
  }

  return { eliminatedLines, totalEliminationsAmount, eliminationDetails };
}

function sumIETAmounts(iets: Array<{ amount: number | string | null }>): number {
  return iets.reduce((sum: number, iet) => sum + Math.abs(Number(iet.amount ?? 0)), 0);
}

function sumCategoryMatchAmount(
  criteria: RuleCriteria,
  action: RuleAction,
  lines: ConsolidationSnapshotLine[],
): number {
  if (!criteria.matchCategories || criteria.matchCategories.length === 0) return 0;
  if (action.actionType !== 'eliminate') return 0;
  const matchingLines = lines.filter(
    (l) => criteria.matchCategories!.includes(l.category) && !l.isElimination,
  );
  return matchingLines.reduce((s, l) => s + Math.abs(l.amount), 0);
}
