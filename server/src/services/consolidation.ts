/**
 * Consolidation Service
 *
 * Financial consolidation engine for group reporting with elimination rules.
 * Aggregates entity data, applies inter-entity elimination rules,
 * and produces consolidated financial snapshots.
 */

import { db } from '../schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import crypto from 'crypto';

// ============================================================================
// LOCAL TABLE DEFINITIONS
// (Mirrors schema.ts definitions added by Agent 1 — will be replaced with
//  imports once schema.ts is updated)
// ============================================================================

const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  entityType: text('entity_type').notNull(),
  parentEntityId: text('parent_entity_id'),
  isConsolidatedParent: integer('is_consolidated_parent', { mode: 'boolean' }).default(false),
  financialYearEnd: text('financial_year_end').default('06-30'),
  status: text('status').default('active'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

const entityAccounts = sqliteTable('entity_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  accountId: text('account_id').notNull(),
  role: text('role').notNull().default('operating'),
  ownershipPercentage: real('ownership_percentage').default(100.0),
});

const interEntityTransactions = sqliteTable('inter_entity_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromEntityId: text('from_entity_id').notNull(),
  toEntityId: text('to_entity_id').notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  transactionDate: text('transaction_date').notNull(),
  transactionType: text('transaction_type').notNull(),
  status: text('status').default('pending'),
  confirmedByFrom: integer('confirmed_by_from', { mode: 'boolean' }).default(false),
  confirmedByTo: integer('confirmed_by_to', { mode: 'boolean' }).default(false),
  eliminationGroupId: text('elimination_group_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

const consolidationRules = sqliteTable('consolidation_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  parentEntityId: text('parent_entity_id').notNull(),
  ruleName: text('rule_name').notNull(),
  ruleType: text('rule_type').notNull(),
  description: text('description'),
  criteriaJson: text('criteria_json').notNull(),
  actionJson: text('action_json').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

const consolidationSnapshots = sqliteTable('consolidation_snapshots', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  parentEntityId: text('parent_entity_id').notNull(),
  financialYear: text('financial_year').notNull(),
  snapshotDate: text('snapshot_date').notNull(),
  status: text('status').default('draft'),
  totalRevenue: integer('total_revenue'),
  totalExpenses: integer('total_expenses'),
  totalAssets: integer('total_assets'),
  totalLiabilities: integer('total_liabilities'),
  totalEquity: integer('total_equity'),
  eliminationsApplied: integer('eliminations_applied').default(0),
  adjustmentsJson: text('adjustments_json'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

const consolidationSnapshotLines = sqliteTable('consolidation_snapshot_lines', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull(),
  entityId: text('entity_id').notNull(),
  lineType: text('line_type').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  amount: integer('amount').notNull(),
  isElimination: integer('is_elimination', { mode: 'boolean' }).default(false),
  sourceRuleId: text('source_rule_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  category: text('category'),
  accountId: text('account_id'),
  userId: text('user_id'),
});

// ============================================================================
// TYPES
// ============================================================================

export interface ConsolidationRule {
  id: string;
  userId: string;
  parentEntityId: string;
  ruleName: string;
  ruleType: 'elimination' | 'adjustment' | 'reclassification' | 'minority_interest';
  description: string | null;
  criteriaJson: string;
  actionJson: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsolidationSnapshot {
  id: string;
  userId: string;
  parentEntityId: string;
  financialYear: string;
  snapshotDate: string;
  status: 'draft' | 'reviewed' | 'finalized';
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  eliminationsApplied: number;
  adjustmentsJson: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ConsolidationSnapshotLine {
  id: string;
  snapshotId: string;
  entityId: string;
  lineType: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' | 'elimination' | 'adjustment';
  category: string;
  description: string | null;
  amount: number;
  isElimination: boolean;
  sourceRuleId: string | null;
  createdAt: string;
}

interface RuleCriteria {
  matchType:
    | 'inter_entity_revenue'
    | 'inter_entity_loan'
    | 'inter_entity_dividend'
    | 'category_match'
    | 'amount_threshold';
  matchEntities?: string[];
  matchCategories?: string[];
  amountThreshold?: number;
}

interface RuleAction {
  actionType: 'eliminate' | 'adjust' | 'reclassify';
  targetCategory?: string;
  adjustmentPercent?: number;
}

// Category-to-line-type mapping for Australian chart of accounts
const CATEGORY_LINE_TYPE_MAP: Record<string, ConsolidationSnapshotLine['lineType']> = {
  'Sales Revenue': 'revenue',
  'Service Revenue': 'revenue',
  'Interest Income': 'revenue',
  'Other Income': 'revenue',
  'Business Income': 'revenue',
  'Rental Income': 'revenue',
  'Export Revenue': 'revenue',
  'Cost of Goods Sold': 'expense',
  'Direct Labour': 'expense',
  'Freight Costs': 'expense',
  Materials: 'expense',
  'Advertising & Marketing': 'expense',
  'Bank Fees': 'expense',
  'Computer & IT': 'expense',
  Depreciation: 'expense',
  Entertainment: 'expense',
  Insurance: 'expense',
  'Interest Expense': 'expense',
  'Motor Vehicle Expenses': 'expense',
  'Office Supplies': 'expense',
  'Professional Fees': 'expense',
  Rent: 'expense',
  'Repairs & Maintenance': 'expense',
  Subscriptions: 'expense',
  'Telephone & Internet': 'expense',
  Travel: 'expense',
  Utilities: 'expense',
  'Wages & Salaries': 'expense',
  Superannuation: 'expense',
  'Work from Home Expenses': 'expense',
  Miscellaneous: 'expense',
  'General Expenses': 'expense',
  'Dining & Takeaway': 'expense',
  Groceries: 'expense',
  'Medical & Health': 'expense',
  Fuel: 'expense',
  'Clothing & Personal': 'expense',
  Education: 'expense',
  'Pet Care': 'expense',
  'Charity & Donations': 'expense',
  'Home & Garden': 'expense',
  Tax: 'expense',
  'Tax Payments': 'expense',
  'Software & Subscriptions': 'expense',
  'Travel & Accommodation': 'expense',
};

function getLineTypeForCategory(category: string): ConsolidationSnapshotLine['lineType'] {
  return CATEGORY_LINE_TYPE_MAP[category] ?? 'expense';
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

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
    // Verify parent entity is a consolidated parent
    const parentEntity = (await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, params.parentEntityId), eq(entities.userId, params.userId)))
      .get()) as any;

    if (!parentEntity) {
      throw new Error('Parent entity not found');
    }

    if (!parentEntity.isConsolidatedParent) {
      throw new Error('Entity is not marked as a consolidated parent');
    }

    // Recursively find all child entities
    const childEntities = await this.getDescendantEntities(params.parentEntityId, params.userId);
    const allEntityIds = [params.parentEntityId, ...childEntities.map((e) => e.id)];

    // Calculate FY date range
    const [startYear] = params.financialYear.split('-').map(Number);
    const fyStart = `${startYear}-07-01`;
    const fyEnd = `${startYear + 1}-06-30`;

    // Aggregate transactions by entity and category
    const lines: ConsolidationSnapshotLine[] = [];
    const snapshotId = crypto.randomUUID();

    for (const eid of allEntityIds) {
      // Get accounts linked to this entity
      const linkedAccounts = (await db
        .select()
        .from(entityAccounts)
        .where(eq(entityAccounts.entityId, eid))
        .all()) as any[];

      const accountIds = linkedAccounts.map((a: any) => a.accountId);
      if (accountIds.length === 0) continue;

      // Aggregate transactions for these accounts within the FY
      for (const accountId of accountIds) {
        const txnAggregates = (await db
          .select({
            category: transactions.category,
            totalAmount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.accountId, accountId),
              eq(transactions.userId, params.userId),
              sql`${transactions.date} >= ${fyStart}`,
              sql`${transactions.date} <= ${fyEnd}`,
            ),
          )
          .groupBy(transactions.category)
          .all()) as any[];

        for (const agg of txnAggregates) {
          if (!agg.category || agg.totalAmount === 0) continue;

          const lineType = getLineTypeForCategory(agg.category);
          const lineId = crypto.randomUUID();

          lines.push({
            id: lineId,
            snapshotId,
            entityId: eid,
            lineType,
            category: agg.category,
            description: `${agg.category} for entity`,
            amount: agg.totalAmount,
            isElimination: false,
            sourceRuleId: null,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Apply elimination rules
    const { eliminatedLines, totalEliminationsAmount, eliminationDetails } =
      await this.applyEliminations(
        params.parentEntityId,
        snapshotId,
        lines,
        params.userId,
        fyStart,
        fyEnd,
      );

    const allLines = [...lines, ...eliminatedLines];

    // Calculate totals
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const line of allLines) {
      const amt = line.amount;
      switch (line.lineType) {
        case 'revenue':
          totalRevenue += amt;
          break;
        case 'expense':
          totalExpenses += amt;
          break;
        case 'asset':
          totalAssets += amt;
          break;
        case 'liability':
          totalLiabilities += amt;
          break;
        case 'equity':
          totalEquity += amt;
          break;
        case 'elimination':
          // Eliminations reduce the relevant totals — tracked via amount sign
          break;
        case 'adjustment':
          break;
      }
    }

    const now = new Date().toISOString();

    // Create snapshot record
    const snapshot: ConsolidationSnapshot = {
      id: snapshotId,
      userId: params.userId,
      parentEntityId: params.parentEntityId,
      financialYear: params.financialYear,
      snapshotDate: now,
      status: 'draft',
      totalRevenue,
      totalExpenses,
      totalAssets,
      totalLiabilities,
      totalEquity,
      eliminationsApplied: eliminatedLines.length,
      adjustmentsJson: null,
      notes: null,
      createdBy: params.userId,
      createdAt: now,
    };

    await db.insert(consolidationSnapshots).values({
      id: snapshot.id,
      userId: snapshot.userId,
      parentEntityId: snapshot.parentEntityId,
      financialYear: snapshot.financialYear,
      snapshotDate: snapshot.snapshotDate,
      status: 'draft',
      totalRevenue,
      totalExpenses,
      totalAssets,
      totalLiabilities,
      totalEquity,
      eliminationsApplied: eliminatedLines.length,
      createdBy: params.userId,
      createdAt: now,
    });

    // Insert all snapshot lines
    for (const line of allLines) {
      await db.insert(consolidationSnapshotLines).values({
        id: line.id,
        snapshotId: line.snapshotId,
        entityId: line.entityId,
        lineType: line.lineType,
        category: line.category,
        description: line.description,
        amount: line.amount,
        isElimination: line.isElimination,
        sourceRuleId: line.sourceRuleId,
        createdAt: line.createdAt,
      });
    }

    return {
      snapshot,
      lines: allLines,
      eliminations: eliminationDetails,
    };
  }

  /**
   * Apply elimination rules against snapshot lines.
   * Fetches confirmed inter-entity transactions and creates offsetting entries.
   */
  async applyEliminations(
    parentEntityId: string,
    snapshotId: string,
    lines: ConsolidationSnapshotLine[],
    userId: string,
    fyStart: string,
    fyEnd: string,
  ): Promise<{
    eliminatedLines: ConsolidationSnapshotLine[];
    totalEliminationsAmount: number;
    eliminationDetails: Array<{
      ruleId: string;
      ruleName: string;
      amount: number;
      description: string;
    }>;
  }> {
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
    const confirmedIETs = (await db
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
      .all()) as any[];

    for (const rule of rules) {
      const criteria: RuleCriteria = JSON.parse(rule.criteriaJson);
      const action: RuleAction = JSON.parse(rule.actionJson);

      switch (criteria.matchType) {
        case 'inter_entity_revenue': {
          // Eliminate matching inter-entity revenue/expense
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

            totalEliminationsAmount += amount;
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
          break;
        }

        case 'inter_entity_loan': {
          // Eliminate matching receivable/payable between entities
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

            totalEliminationsAmount += amount;
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
          break;
        }

        case 'inter_entity_dividend': {
          // Eliminate dividend income against equity reduction
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

            totalEliminationsAmount += amount;
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
          break;
        }

        case 'category_match': {
          // Eliminate or adjust lines matching specific categories
          if (!criteria.matchCategories || criteria.matchCategories.length === 0) break;

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
              totalEliminationsAmount += Math.abs(line.amount);
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
          break;
        }

        case 'amount_threshold': {
          if (!criteria.amountThreshold) break;
          const threshold = criteria.amountThreshold;

          const matchingLines = lines.filter(
            (l) => Math.abs(l.amount) >= threshold && !l.isElimination,
          );

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
          break;
        }
      }
    }

    return { eliminatedLines, totalEliminationsAmount, eliminationDetails };
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
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const rule: ConsolidationRule = {
      id,
      userId: params.userId,
      parentEntityId: params.parentEntityId,
      ruleName: params.ruleName,
      ruleType: params.ruleType,
      description: params.description ?? null,
      criteriaJson: JSON.stringify(params.criteria),
      actionJson: JSON.stringify(params.action),
      isActive: true,
      priority: params.priority ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(consolidationRules).values({
      id: rule.id,
      userId: rule.userId,
      parentEntityId: rule.parentEntityId,
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      description: rule.description,
      criteriaJson: rule.criteriaJson,
      actionJson: rule.actionJson,
      isActive: true,
      priority: rule.priority,
      createdAt: now,
      updatedAt: now,
    });

    return rule;
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
    const now = new Date().toISOString();
    const setValues: Record<string, any> = { updatedAt: now };

    if (updates.ruleName !== undefined) setValues.ruleName = updates.ruleName;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.criteria !== undefined) setValues.criteriaJson = JSON.stringify(updates.criteria);
    if (updates.action !== undefined) setValues.actionJson = JSON.stringify(updates.action);
    if (updates.priority !== undefined) setValues.priority = updates.priority;
    if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

    await db
      .update(consolidationRules)
      .set(setValues)
      .where(and(eq(consolidationRules.id, ruleId), eq(consolidationRules.userId, userId)));

    const updated = (await db
      .select()
      .from(consolidationRules)
      .where(eq(consolidationRules.id, ruleId))
      .get()) as ConsolidationRule;

    if (!updated) {
      throw new Error('Consolidation rule not found');
    }

    return updated;
  }

  /**
   * Soft-delete a consolidation rule by setting isActive=false.
   */
  async deleteConsolidationRule(ruleId: string, userId: string): Promise<void> {
    await db
      .update(consolidationRules)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(and(eq(consolidationRules.id, ruleId), eq(consolidationRules.userId, userId)));
  }

  /**
   * Finalize a consolidation snapshot. Prevents further modifications.
   */
  async finalizeSnapshot(snapshotId: string, userId: string): Promise<ConsolidationSnapshot> {
    const existing = (await db
      .select()
      .from(consolidationSnapshots)
      .where(
        and(eq(consolidationSnapshots.id, snapshotId), eq(consolidationSnapshots.userId, userId)),
      )
      .get()) as ConsolidationSnapshot | undefined;

    if (!existing) {
      throw new Error('Consolidation snapshot not found');
    }

    if (existing.status === 'finalized') {
      throw new Error('Snapshot is already finalized');
    }

    await db
      .update(consolidationSnapshots)
      .set({ status: 'finalized' })
      .where(eq(consolidationSnapshots.id, snapshotId));

    return { ...existing, status: 'finalized' };
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
    const conditions = [
      eq(consolidationSnapshots.parentEntityId, parentEntityId),
      eq(consolidationSnapshots.userId, userId),
    ];

    if (financialYear) {
      conditions.push(eq(consolidationSnapshots.financialYear, financialYear));
    }

    const snapshots = (await db
      .select()
      .from(consolidationSnapshots)
      .where(and(...conditions))
      .orderBy(desc(consolidationSnapshots.createdAt))
      .all()) as ConsolidationSnapshot[];

    // Get line counts for each snapshot
    const enriched = [];
    for (const snap of snapshots) {
      const countResult = (await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consolidationSnapshotLines)
        .where(eq(consolidationSnapshotLines.snapshotId, snap.id))
        .get()) as any;

      enriched.push({
        ...snap,
        lineCount: countResult?.count ?? 0,
      });
    }

    return { snapshots: enriched };
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
    const snapshot = (await db
      .select()
      .from(consolidationSnapshots)
      .where(
        and(eq(consolidationSnapshots.id, snapshotId), eq(consolidationSnapshots.userId, userId)),
      )
      .get()) as ConsolidationSnapshot | undefined;

    if (!snapshot) {
      throw new Error('Consolidation snapshot not found');
    }

    const lines = (await db
      .select()
      .from(consolidationSnapshotLines)
      .where(eq(consolidationSnapshotLines.snapshotId, snapshotId))
      .all()) as ConsolidationSnapshotLine[];

    // Separate elimination lines
    const eliminations = lines.filter((l) => l.isElimination);
    const regularLines = lines.filter((l) => !l.isElimination);

    // Build entity-level breakdown
    const byEntity: Record<
      string,
      {
        entityName: string;
        revenue: number;
        expenses: number;
        assets: number;
        liabilities: number;
        equity: number;
      }
    > = {};

    // Fetch entity names
    const entityIds = [...new Set(regularLines.map((l) => l.entityId))];
    const entityNameMap = new Map<string, string>();
    for (const eid of entityIds) {
      const entity = (await db.select().from(entities).where(eq(entities.id, eid)).get()) as any;
      if (entity) {
        entityNameMap.set(eid, entity.name);
      }
    }

    for (const line of regularLines) {
      if (!byEntity[line.entityId]) {
        byEntity[line.entityId] = {
          entityName: entityNameMap.get(line.entityId) ?? 'Unknown',
          revenue: 0,
          expenses: 0,
          assets: 0,
          liabilities: 0,
          equity: 0,
        };
      }

      const entry = byEntity[line.entityId];
      switch (line.lineType) {
        case 'revenue':
          entry.revenue += line.amount;
          break;
        case 'expense':
          entry.expenses += line.amount;
          break;
        case 'asset':
          entry.assets += line.amount;
          break;
        case 'liability':
          entry.liabilities += line.amount;
          break;
        case 'equity':
          entry.equity += line.amount;
          break;
      }
    }

    // Calculate consolidated totals (entity totals minus eliminations)
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const line of lines) {
      switch (line.lineType) {
        case 'revenue':
          totalRevenue += line.amount;
          break;
        case 'expense':
          totalExpenses += line.amount;
          break;
        case 'asset':
          totalAssets += line.amount;
          break;
        case 'liability':
          totalLiabilities += line.amount;
          break;
        case 'equity':
          totalEquity += line.amount;
          break;
        case 'elimination':
          // Elimination amounts are negative offsets — already signed correctly
          break;
      }
    }

    // Include elimination amounts in totals
    for (const elim of eliminations) {
      // Elimination lines have signed amounts that offset the relevant totals
      if (elim.category.includes('Revenue')) totalRevenue += elim.amount;
      else if (elim.category.includes('Expense')) totalExpenses += elim.amount;
      else if (elim.category.includes('Receivable') || elim.category.includes('Asset'))
        totalAssets += elim.amount;
      else if (elim.category.includes('Payable') || elim.category.includes('Liability'))
        totalLiabilities += elim.amount;
      else if (elim.category.includes('Equity') || elim.category.includes('Dividend'))
        totalEquity += elim.amount;
    }

    return {
      snapshot,
      lines,
      byEntity,
      eliminations,
      consolidatedTotals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit: totalRevenue - Math.abs(totalExpenses),
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
      },
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Recursively fetch all descendant entities of a parent.
   */
  private async getDescendantEntities(parentId: string, userId: string): Promise<any[]> {
    const children = (await db
      .select()
      .from(entities)
      .where(and(eq(entities.parentEntityId, parentId), eq(entities.userId, userId)))
      .all()) as any[];

    const descendants = [...children];
    for (const child of children) {
      const grandchildren = await this.getDescendantEntities(child.id, userId);
      descendants.push(...grandchildren);
    }

    return descendants;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const consolidationService = new ConsolidationService();
