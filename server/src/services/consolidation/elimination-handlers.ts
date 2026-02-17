/**
 * Elimination Handlers
 *
 * Individual elimination handler functions for each inter-entity
 * transaction type: revenue, loan, dividend, category match, and amount threshold.
 */
import crypto from 'crypto';
import type {
  ConsolidationRule,
  ConsolidationSnapshotLine,
  RuleCriteria,
  RuleAction,
} from './types.js';

type EliminationDetail = { ruleId: string; ruleName: string; amount: number; description: string };

export function applyRevenueElimination(
  criteria: RuleCriteria,
  confirmedIETs: any[],
  snapshotId: string,
  rule: ConsolidationRule,
  eliminatedLines: ConsolidationSnapshotLine[],
  eliminationDetails: EliminationDetail[],
): void {
  const matchingIETs = confirmedIETs.filter(
    (iet) =>
      iet.transactionType === 'management_fee' ||
      iet.transactionType === 'service_fee' ||
      iet.transactionType === 'rent',
  );

  for (const iet of matchingIETs) {
    if (criteria.matchEntities && criteria.matchEntities.length > 0) {
      if (
        !criteria.matchEntities.includes(iet.fromEntityId) &&
        !criteria.matchEntities.includes(iet.toEntityId)
      ) {
        continue;
      }
    }

    const amount = Math.abs(iet.amount);
    // Revenue elimination (credit side)
    eliminatedLines.push({
      id: crypto.randomUUID(),
      snapshotId,
      entityId: iet.toEntityId,
      lineType: 'elimination',
      category: 'Inter-entity Revenue Elimination',
      description: `Eliminate ${iet.transactionType}: ${iet.description ?? 'Inter-entity'}`,
      amount: -amount,
      isElimination: true,
      sourceRuleId: rule.id,
      createdAt: new Date().toISOString(),
    });

    // Expense elimination (debit side)
    eliminatedLines.push({
      id: crypto.randomUUID(),
      snapshotId,
      entityId: iet.fromEntityId,
      lineType: 'elimination',
      category: 'Inter-entity Expense Elimination',
      description: `Eliminate ${iet.transactionType}: ${iet.description ?? 'Inter-entity'}`,
      amount: amount,
      isElimination: true,
      sourceRuleId: rule.id,
      createdAt: new Date().toISOString(),
    });
  }

  if (matchingIETs.length > 0) {
    const totalEliminated = matchingIETs.reduce(
      (sum: number, iet: any) => sum + Math.abs(iet.amount),
      0,
    );
    eliminationDetails.push({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      amount: totalEliminated,
      description: `Eliminated ${matchingIETs.length} inter-entity revenue/expense transactions`,
    });
  }
}

export function applyLoanElimination(
  criteria: RuleCriteria,
  confirmedIETs: any[],
  snapshotId: string,
  rule: ConsolidationRule,
  eliminatedLines: ConsolidationSnapshotLine[],
  eliminationDetails: EliminationDetail[],
): void {
  const loanIETs = confirmedIETs.filter((iet) => iet.transactionType === 'loan');

  for (const iet of loanIETs) {
    if (criteria.matchEntities && criteria.matchEntities.length > 0) {
      if (
        !criteria.matchEntities.includes(iet.fromEntityId) &&
        !criteria.matchEntities.includes(iet.toEntityId)
      ) {
        continue;
      }
    }

    const amount = Math.abs(iet.amount);

    // Eliminate receivable
    eliminatedLines.push({
      id: crypto.randomUUID(),
      snapshotId,
      entityId: iet.fromEntityId,
      lineType: 'elimination',
      category: 'Inter-entity Loan Receivable Elimination',
      description: `Eliminate loan receivable: ${iet.description ?? 'Inter-entity loan'}`,
      amount: -amount,
      isElimination: true,
      sourceRuleId: rule.id,
      createdAt: new Date().toISOString(),
    });

    // Eliminate payable
    eliminatedLines.push({
      id: crypto.randomUUID(),
      snapshotId,
      entityId: iet.toEntityId,
      lineType: 'elimination',
      category: 'Inter-entity Loan Payable Elimination',
      description: `Eliminate loan payable: ${iet.description ?? 'Inter-entity loan'}`,
      amount: amount,
      isElimination: true,
      sourceRuleId: rule.id,
      createdAt: new Date().toISOString(),
    });
  }

  if (loanIETs.length > 0) {
    const totalEliminated = loanIETs.reduce(
      (sum: number, iet: any) => sum + Math.abs(iet.amount),
      0,
    );
    eliminationDetails.push({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      amount: totalEliminated,
      description: `Eliminated ${loanIETs.length} inter-entity loan balances`,
    });
  }
}

export function applyDividendElimination(
  confirmedIETs: any[],
  snapshotId: string,
  rule: ConsolidationRule,
  eliminatedLines: ConsolidationSnapshotLine[],
  eliminationDetails: EliminationDetail[],
): void {
  const dividendIETs = confirmedIETs.filter(
    (iet) => iet.transactionType === 'dividend' || iet.transactionType === 'distribution',
  );

  for (const iet of dividendIETs) {
    const amount = Math.abs(iet.amount);

    // Eliminate dividend income
    eliminatedLines.push({
      id: crypto.randomUUID(),
      snapshotId,
      entityId: iet.toEntityId,
      lineType: 'elimination',
      category: 'Dividend Income Elimination',
      description: `Eliminate dividend: ${iet.description ?? 'Inter-entity dividend'}`,
      amount: -amount,
      isElimination: true,
      sourceRuleId: rule.id,
      createdAt: new Date().toISOString(),
    });

    // Eliminate equity reduction
    eliminatedLines.push({
      id: crypto.randomUUID(),
      snapshotId,
      entityId: iet.fromEntityId,
      lineType: 'elimination',
      category: 'Dividend Equity Elimination',
      description: `Eliminate equity reduction for dividend: ${iet.description ?? 'Inter-entity dividend'}`,
      amount: amount,
      isElimination: true,
      sourceRuleId: rule.id,
      createdAt: new Date().toISOString(),
    });
  }

  if (dividendIETs.length > 0) {
    const totalEliminated = dividendIETs.reduce(
      (sum: number, iet: any) => sum + Math.abs(iet.amount),
      0,
    );
    eliminationDetails.push({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      amount: totalEliminated,
      description: `Eliminated ${dividendIETs.length} inter-entity dividend/distribution entries`,
    });
  }
}

export function applyCategoryMatchElimination(
  criteria: RuleCriteria,
  action: RuleAction,
  lines: ConsolidationSnapshotLine[],
  snapshotId: string,
  rule: ConsolidationRule,
  eliminatedLines: ConsolidationSnapshotLine[],
  eliminationDetails: EliminationDetail[],
): void {
  if (!criteria.matchCategories || criteria.matchCategories.length === 0) return;

  const matchingLines = lines.filter(
    (l) => criteria.matchCategories!.includes(l.category) && !l.isElimination,
  );

  for (const line of matchingLines) {
    if (action.actionType === 'eliminate') {
      eliminatedLines.push({
        id: crypto.randomUUID(),
        snapshotId,
        entityId: line.entityId,
        lineType: 'elimination',
        category: `Category Elimination: ${line.category}`,
        description: `Rule: ${rule.ruleName}`,
        amount: -line.amount,
        isElimination: true,
        sourceRuleId: rule.id,
        createdAt: new Date().toISOString(),
      });
    } else if (action.actionType === 'adjust' && action.adjustmentPercent) {
      const adjustedAmount = Math.round((line.amount * action.adjustmentPercent) / 100);
      eliminatedLines.push({
        id: crypto.randomUUID(),
        snapshotId,
        entityId: line.entityId,
        lineType: 'adjustment',
        category: action.targetCategory ?? line.category,
        description: `Adjustment (${action.adjustmentPercent}%): ${rule.ruleName}`,
        amount: adjustedAmount,
        isElimination: false,
        sourceRuleId: rule.id,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (matchingLines.length > 0) {
    eliminationDetails.push({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      amount: matchingLines.reduce((s, l) => s + Math.abs(l.amount), 0),
      description: `Applied ${action.actionType} to ${matchingLines.length} category-matched lines`,
    });
  }
}

export function applyAmountThresholdElimination(
  criteria: RuleCriteria,
  action: RuleAction,
  lines: ConsolidationSnapshotLine[],
  snapshotId: string,
  rule: ConsolidationRule,
  eliminatedLines: ConsolidationSnapshotLine[],
  eliminationDetails: EliminationDetail[],
): void {
  if (!criteria.amountThreshold) return;
  const threshold = criteria.amountThreshold;

  const matchingLines = lines.filter((l) => Math.abs(l.amount) >= threshold && !l.isElimination);

  for (const line of matchingLines) {
    if (action.actionType === 'reclassify' && action.targetCategory) {
      eliminatedLines.push({
        id: crypto.randomUUID(),
        snapshotId,
        entityId: line.entityId,
        lineType: 'adjustment',
        category: action.targetCategory,
        description: `Reclassified from ${line.category}: ${rule.ruleName}`,
        amount: line.amount,
        isElimination: false,
        sourceRuleId: rule.id,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (matchingLines.length > 0) {
    eliminationDetails.push({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      amount: matchingLines.reduce((s, l) => s + Math.abs(l.amount), 0),
      description: `Reclassified ${matchingLines.length} lines above threshold $${(threshold / 100).toFixed(2)}`,
    });
  }
}
