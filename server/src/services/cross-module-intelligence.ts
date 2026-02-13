/**
 * Cross-Module Intelligence Service
 *
 * Discovers correlations, cascading anomalies, and actionable insights
 * across all platform modules (transactions, forecasting, compliance,
 * anomaly_detection, tax, bas, knowledge, accounts, analytics).
 *
 * Uses Pearson correlation for metric analysis and 6 independent scanners
 * to detect patterns across module boundaries.
 */

import {
  db,
  transactions,
  basPeriods,
  basCalculations,
  taxYearSummary,
  reconciliationAlerts,
  forecastScenarios,
  forecastPeriods,
  kpiMetrics,
  crossModuleInsights,
  moduleConnections,
} from '../schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface CrossModuleInsight {
  id: string;
  userId: string;
  insightType: string;
  title: string;
  description: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  sourceModules: string[];
  relatedEntities: Array<{ type: string; id: string; module: string }>;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  confidence: number;
  evidence: Record<string, unknown>;
  recommendedAction?: string;
  status: string;
  actedOnAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface Correlation {
  moduleA: string;
  metricA: string;
  moduleB: string;
  metricB: string;
  coefficient: number;
  pValue: number;
  sampleSize: number;
  timeRange: { start: string; end: string };
  interpretation: string;
}

export interface ModuleConnection {
  id: string;
  sourceModule: string;
  targetModule: string;
  connectionType: string;
  description: string;
  strength: number;
  isBidirectional: boolean;
  activityCount: number;
  lastActivityAt: string | null;
}

export interface TimelineEntry {
  date: string;
  module: string;
  eventType: string;
  title: string;
  description: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  amount?: number;
  relatedInsights?: string[];
  metadata?: Record<string, unknown>;
}

export interface InsightScanOptions {
  modules?: string[];
  timeRange?: { start: string; end: string };
  minConfidence?: number;
  severityFilter?: string[];
  maxInsights?: number;
}

export interface InsightFilters {
  insightType?: string;
  severity?: string;
  status?: string;
  sourceModules?: string[];
  minConfidence?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ConnectionFilters {
  sourceModule?: string;
  targetModule?: string;
  connectionType?: string;
  minStrength?: number;
}

type TimeRange = { start: string; end: string };

// ============================================================================
// SERVICE
// ============================================================================

export class CrossModuleIntelligenceService {
  // --------------------------------------------------------------------------
  // PUBLIC: Scan & Discover
  // --------------------------------------------------------------------------

  /**
   * Run all 6 insight scanners, de-duplicate, rank, and persist new insights.
   */
  async scanForInsights(
    userId: string,
    options: InsightScanOptions = {},
  ): Promise<CrossModuleInsight[]> {
    const { modules, timeRange, minConfidence = 0.5, severityFilter, maxInsights = 50 } = options;

    const range: TimeRange = timeRange ?? {
      start: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    };

    // Run all scanners concurrently — each returns [] on failure
    const results = await Promise.allSettled([
      this._scanAnomalyCascades(userId, range),
      this._scanTrendAlignments(userId, range),
      this._scanComplianceRisks(userId, range),
      this._scanForecastDeviations(userId, range),
      this._scanTaxOpportunities(userId, range),
      this._scanSpendingPatterns(userId, range),
    ]);

    let allInsights: CrossModuleInsight[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        allInsights.push(...r.value);
      }
    }

    // Filter by requested modules
    if (modules?.length) {
      allInsights = allInsights.filter((i) => i.sourceModules.some((m) => modules.includes(m)));
    }

    // Filter by confidence
    allInsights = allInsights.filter((i) => i.confidence >= minConfidence);

    // Filter by severity
    if (severityFilter?.length) {
      allInsights = allInsights.filter((i) => severityFilter.includes(i.severity));
    }

    // De-duplicate
    allInsights = this._deduplicateInsights(allInsights);

    // Rank: critical > warning > suggestion > info, then by confidence desc
    const severityOrder: Record<string, number> = {
      critical: 4,
      warning: 3,
      suggestion: 2,
      info: 1,
    };
    allInsights.sort((a, b) => {
      const sevDiff = (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return b.confidence - a.confidence;
    });

    // Trim to maxInsights
    allInsights = allInsights.slice(0, maxInsights);

    // Persist new insights
    for (const insight of allInsights) {
      try {
        await (db as any)
          .insert(crossModuleInsights)
          .values({
            id: insight.id,
            userId: insight.userId,
            insightType: insight.insightType,
            title: insight.title,
            description: insight.description,
            severity: insight.severity,
            sourceModules: JSON.stringify(insight.sourceModules),
            relatedEntities: JSON.stringify(insight.relatedEntities),
            timeRangeStart: insight.timeRangeStart,
            timeRangeEnd: insight.timeRangeEnd,
            confidence: insight.confidence,
            evidence: JSON.stringify(insight.evidence),
            recommendedAction: insight.recommendedAction,
            status: insight.status,
            createdAt: insight.createdAt,
            expiresAt: insight.expiresAt,
          })
          .run();
      } catch {
        // Duplicate or DB error — skip silently
      }
    }

    return allInsights;
  }

  /**
   * Find statistical correlations between two modules' metrics.
   * Returns significant correlations where |r| > 0.6.
   */
  async findCorrelations(userId: string, moduleA: string, moduleB: string): Promise<Correlation[]> {
    const now = new Date();
    const range: TimeRange = {
      start: new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };

    const metricsA = await this._getModuleMetrics(userId, moduleA, range);
    const metricsB = await this._getModuleMetrics(userId, moduleB, range);

    const correlations: Correlation[] = [];

    for (const [nameA, valuesA] of Object.entries(metricsA)) {
      for (const [nameB, valuesB] of Object.entries(metricsB)) {
        const len = Math.min(valuesA.length, valuesB.length);
        if (len < 5) continue;

        const x = valuesA.slice(0, len);
        const y = valuesB.slice(0, len);
        const { coefficient, pValue } = this._calculatePearsonCorrelation(x, y);

        if (Math.abs(coefficient) > 0.6 && pValue < 0.05) {
          const direction = coefficient > 0 ? 'positive' : 'negative';
          const strength =
            Math.abs(coefficient) > 0.9
              ? 'very strong'
              : Math.abs(coefficient) > 0.75
                ? 'strong'
                : 'moderate';

          correlations.push({
            moduleA,
            metricA: nameA,
            moduleB,
            metricB: nameB,
            coefficient: Math.round(coefficient * 1000) / 1000,
            pValue: Math.round(pValue * 10000) / 10000,
            sampleSize: len,
            timeRange: range,
            interpretation: `${strength} ${direction} correlation between ${nameA} (${moduleA}) and ${nameB} (${moduleB}): as one increases, the other ${direction === 'positive' ? 'also increases' : 'decreases'}.`,
          });
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  }

  // --------------------------------------------------------------------------
  // PUBLIC: Module Connections
  // --------------------------------------------------------------------------

  async getModuleConnections(filters: ConnectionFilters = {}): Promise<ModuleConnection[]> {
    const conditions: any[] = [];

    if (filters.sourceModule) {
      conditions.push(eq(moduleConnections.sourceModule, filters.sourceModule));
    }
    if (filters.targetModule) {
      conditions.push(eq(moduleConnections.targetModule, filters.targetModule));
    }
    if (filters.connectionType) {
      conditions.push(eq(moduleConnections.connectionType, filters.connectionType));
    }
    if (filters.minStrength != null) {
      conditions.push(gte(moduleConnections.strength, filters.minStrength));
    }

    const query = (db as any).select().from(moduleConnections);
    const rows: any[] =
      conditions.length > 0 ? await query.where(and(...conditions)).all() : await query.all();

    return rows.map((r: any) => ({
      id: r.id,
      sourceModule: r.sourceModule ?? r.source_module,
      targetModule: r.targetModule ?? r.target_module,
      connectionType: r.connectionType ?? r.connection_type,
      description: r.description,
      strength: r.strength,
      isBidirectional: Boolean(r.isBidirectional ?? r.is_bidirectional),
      activityCount: r.activityCount ?? r.activity_count ?? 0,
      lastActivityAt: r.lastActivityAt ?? r.last_activity_at ?? null,
    }));
  }

  async updateConnectionActivity(
    sourceModule: string,
    targetModule: string,
    connectionType: string,
  ): Promise<void> {
    await (db as any)
      .update(moduleConnections)
      .set({
        activityCount: sql`${moduleConnections.activityCount} + 1`,
        lastActivityAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(moduleConnections.sourceModule, sourceModule),
          eq(moduleConnections.targetModule, targetModule),
          eq(moduleConnections.connectionType, connectionType),
        ),
      )
      .run();
  }

  // --------------------------------------------------------------------------
  // PUBLIC: Unified Timeline
  // --------------------------------------------------------------------------

  async generateTimeline(userId: string, timeRange: TimeRange): Promise<TimelineEntry[]> {
    const entries: TimelineEntry[] = [];

    // 1. Significant transactions (|amount| > $500)
    try {
      const txRows: any[] = await (db as any)
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
          ),
        )
        .orderBy(desc(transactions.date))
        .all();

      for (const tx of txRows) {
        const amt = tx.amount ?? 0;
        if (Math.abs(amt) >= 50000) {
          entries.push({
            date: tx.date,
            module: 'transactions',
            eventType: amt >= 0 ? 'large_credit' : 'large_debit',
            title: `${amt >= 0 ? 'Large credit' : 'Large debit'}: $${(Math.abs(amt) / 100).toFixed(2)}`,
            description: tx.description ?? 'Unknown transaction',
            severity: Math.abs(amt) >= 500000 ? 'warning' : 'info',
            amount: amt,
            metadata: { category: tx.category, accountId: tx.accountId ?? tx.account_id },
          });
        }
      }
    } catch {
      /* skip */
    }

    // 2. BAS events
    try {
      const basRows: any[] = await (db as any)
        .select()
        .from(basPeriods)
        .where(
          and(
            eq(basPeriods.userId, userId),
            gte(basPeriods.startDate, timeRange.start),
            lte(basPeriods.endDate, timeRange.end),
          ),
        )
        .all();

      for (const bp of basRows) {
        const status = bp.status;
        entries.push({
          date: bp.endDate ?? bp.end_date,
          module: 'bas',
          eventType: status === 'lodged' ? 'bas_lodged' : 'bas_period',
          title: `BAS Q${bp.quarter} ${bp.financialYear ?? bp.financial_year}: ${status}`,
          description: `BAS period ${bp.startDate ?? bp.start_date} to ${bp.endDate ?? bp.end_date}`,
          severity: status === 'overdue' ? 'critical' : status === 'draft' ? 'suggestion' : 'info',
          metadata: { periodType: bp.periodType ?? bp.period_type, status },
        });
      }
    } catch {
      /* skip */
    }

    // 3. Tax year summaries
    try {
      const taxRows: any[] = await (db as any)
        .select()
        .from(taxYearSummary)
        .where(eq(taxYearSummary.userId, userId))
        .all();

      for (const ts of taxRows) {
        entries.push({
          date: ts.calculatedAt ?? ts.calculated_at ?? timeRange.end,
          module: 'tax',
          eventType: 'tax_calculation',
          title: `Tax year ${ts.taxYear ?? ts.tax_year}: $${((ts.netTax ?? ts.net_tax ?? 0) / 100).toFixed(2)} net tax`,
          description: `Gross income: $${((ts.grossIncome ?? ts.gross_income ?? 0) / 100).toFixed(2)}, Deductions: $${((ts.totalDeductions ?? ts.total_deductions ?? 0) / 100).toFixed(2)}`,
          severity: 'info',
          amount: ts.netTax ?? ts.net_tax ?? 0,
          metadata: { taxYear: ts.taxYear ?? ts.tax_year },
        });
      }
    } catch {
      /* skip */
    }

    // 4. Reconciliation alerts
    try {
      const alertRows: any[] = await (db as any)
        .select()
        .from(reconciliationAlerts)
        .where(
          and(
            eq(reconciliationAlerts.userId, userId),
            gte(reconciliationAlerts.createdAt, timeRange.start),
          ),
        )
        .all();

      for (const al of alertRows) {
        entries.push({
          date: al.createdAt ?? al.created_at,
          module: 'anomaly_detection',
          eventType: 'reconciliation_alert',
          title: `Reconciliation alert: ${al.alertType ?? al.alert_type}`,
          description: al.description,
          severity: 'warning',
          amount: al.difference,
          metadata: {
            accountId: al.accountId ?? al.account_id,
            isResolved: Boolean(al.isResolved ?? al.is_resolved),
          },
        });
      }
    } catch {
      /* skip */
    }

    // 5. KPI deviations
    try {
      const kpiRows: any[] = await (db as any)
        .select()
        .from(kpiMetrics)
        .where(
          and(
            eq(kpiMetrics.userId, userId),
            gte(kpiMetrics.period, timeRange.start.slice(0, 7)),
            lte(kpiMetrics.period, timeRange.end.slice(0, 7)),
          ),
        )
        .all();

      for (const kpi of kpiRows) {
        const metricName = kpi.metricName ?? kpi.metric_name;
        const metricValue = kpi.metricValue ?? kpi.metric_value;
        const targetValue = kpi.targetValue ?? kpi.target_value;
        if (targetValue && Math.abs(metricValue - targetValue) / Math.abs(targetValue) > 0.2) {
          entries.push({
            date: kpi.period + '-01',
            module: 'analytics',
            eventType: 'kpi_deviation',
            title: `KPI deviation: ${metricName}`,
            description: `Value ${metricValue} vs target ${targetValue}`,
            severity: 'suggestion',
            metadata: { metricName, metricValue, targetValue },
          });
        }
      }
    } catch {
      /* skip */
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }

  // --------------------------------------------------------------------------
  // PUBLIC: Insight CRUD
  // --------------------------------------------------------------------------

  async getInsights(
    userId: string,
    filters: InsightFilters = {},
  ): Promise<{ items: CrossModuleInsight[]; total: number }> {
    const { limit = 20, offset = 0 } = filters;
    const conditions: any[] = [eq(crossModuleInsights.userId, userId)];

    if (filters.insightType) {
      conditions.push(eq(crossModuleInsights.insightType, filters.insightType));
    }
    if (filters.severity) {
      conditions.push(eq(crossModuleInsights.severity, filters.severity));
    }
    if (filters.status) {
      conditions.push(eq(crossModuleInsights.status, filters.status));
    }
    if (filters.minConfidence != null) {
      conditions.push(gte(crossModuleInsights.confidence, filters.minConfidence));
    }
    if (filters.dateFrom) {
      conditions.push(gte(crossModuleInsights.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(crossModuleInsights.createdAt, filters.dateTo));
    }

    const whereClause = and(...conditions);

    const countResult = await (db as any)
      .select({ count: sql`count(*)` })
      .from(crossModuleInsights)
      .where(whereClause)
      .get();
    const total = Number(countResult?.count ?? 0);

    const rows: any[] = await (db as any)
      .select()
      .from(crossModuleInsights)
      .where(whereClause)
      .orderBy(desc(crossModuleInsights.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    let items = rows.map((r: any) => this._rowToInsight(r));

    if (filters.sourceModules?.length) {
      items = items.filter((i) => i.sourceModules.some((m) => filters.sourceModules!.includes(m)));
      return { items, total: items.length };
    }

    return { items, total };
  }

  async getInsightById(insightId: string): Promise<CrossModuleInsight | null> {
    const row = await (db as any)
      .select()
      .from(crossModuleInsights)
      .where(eq(crossModuleInsights.id, insightId))
      .get();

    return row ? this._rowToInsight(row) : null;
  }

  async markInsightViewed(insightId: string): Promise<void> {
    await (db as any)
      .update(crossModuleInsights)
      .set({ status: 'viewed' })
      .where(eq(crossModuleInsights.id, insightId))
      .run();
  }

  async actOnInsight(insightId: string, _action?: string): Promise<void> {
    await (db as any)
      .update(crossModuleInsights)
      .set({ status: 'acted_on', actedOnAt: new Date().toISOString() })
      .where(eq(crossModuleInsights.id, insightId))
      .run();
  }

  async dismissInsight(insightId: string): Promise<void> {
    await (db as any)
      .update(crossModuleInsights)
      .set({ status: 'dismissed' })
      .where(eq(crossModuleInsights.id, insightId))
      .run();
  }

  // --------------------------------------------------------------------------
  // PRIVATE: Insight Scanners
  // --------------------------------------------------------------------------

  /**
   * Detect anomalies that cascade across modules.
   * E.g., reconciliation alerts + overdue BAS + low-confidence transactions.
   */
  private async _scanAnomalyCascades(
    userId: string,
    timeRange: TimeRange,
  ): Promise<CrossModuleInsight[]> {
    const insights: CrossModuleInsight[] = [];

    try {
      const alerts: any[] = await (db as any)
        .select()
        .from(reconciliationAlerts)
        .where(
          and(
            eq(reconciliationAlerts.userId, userId),
            gte(reconciliationAlerts.createdAt, timeRange.start),
            eq(reconciliationAlerts.isResolved, false),
          ),
        )
        .all();

      if (alerts.length === 0) return insights;

      const overdueBasPeriods: any[] = await (db as any)
        .select()
        .from(basPeriods)
        .where(and(eq(basPeriods.userId, userId), eq(basPeriods.status, 'overdue')))
        .all();

      const lowConfResult = await (db as any)
        .select({ count: sql`count(*)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
            lte(transactions.confidenceScore, 0.5),
          ),
        )
        .get();

      const lowConfCount = Number(lowConfResult?.count ?? 0);

      if (alerts.length >= 2 || (alerts.length >= 1 && overdueBasPeriods.length > 0)) {
        const modules = ['anomaly_detection', 'transactions'];
        if (overdueBasPeriods.length > 0) modules.push('bas');

        insights.push(
          this._buildInsight(
            'anomaly_cascade',
            `Cascading anomalies detected across ${modules.length} modules`,
            `${alerts.length} unresolved reconciliation alerts${overdueBasPeriods.length > 0 ? `, ${overdueBasPeriods.length} overdue BAS periods` : ''}${lowConfCount > 0 ? `, ${lowConfCount} low-confidence transactions` : ''}. These may be related issues requiring coordinated investigation.`,
            {
              alertCount: alerts.length,
              overdueBasCount: overdueBasPeriods.length,
              lowConfidenceTxCount: lowConfCount,
              alertTypes: alerts.map((a: any) => a.alertType ?? a.alert_type),
            },
            modules,
            Math.min(0.5 + alerts.length * 0.1 + overdueBasPeriods.length * 0.15, 0.95),
            alerts.length >= 3 || overdueBasPeriods.length >= 2 ? 'critical' : 'warning',
            userId,
            timeRange,
          ),
        );
      }
    } catch {
      /* scanner failure */
    }

    return insights;
  }

  /**
   * Find aligned trends across modules (revenue growth, expense tracking).
   */
  private async _scanTrendAlignments(
    userId: string,
    timeRange: TimeRange,
  ): Promise<CrossModuleInsight[]> {
    const insights: CrossModuleInsight[] = [];

    try {
      const monthlyTx: any[] = await (db as any)
        .select({
          month: sql`substr(${transactions.date}, 1, 7)`,
          totalIncome: sql`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
          totalExpense: sql`sum(case when ${transactions.amount} < 0 then abs(${transactions.amount}) else 0 end)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
          ),
        )
        .groupBy(sql`substr(${transactions.date}, 1, 7)`)
        .orderBy(sql`substr(${transactions.date}, 1, 7)`)
        .all();

      if (monthlyTx.length < 3) return insights;

      const incomes = monthlyTx.map((m: any) => Number(m.totalIncome ?? m.total_income ?? 0));
      let growthMonths = 0;
      for (let i = 1; i < incomes.length; i++) {
        if (incomes[i] > incomes[i - 1]) growthMonths++;
      }

      if (growthMonths >= Math.max(2, incomes.length * 0.6)) {
        const growthRate =
          incomes.length >= 2 && incomes[0] > 0
            ? ((incomes[incomes.length - 1] - incomes[0]) / incomes[0]) * 100
            : 0;

        insights.push(
          this._buildInsight(
            'trend_alignment',
            'Revenue growth trend detected',
            `Income trending upward for ${growthMonths} of ${incomes.length - 1} months (${growthRate.toFixed(1)}% overall growth).`,
            {
              growthMonths,
              totalMonths: incomes.length,
              growthRate: Math.round(growthRate * 100) / 100,
            },
            ['transactions', 'analytics'],
            Math.min(0.6 + growthMonths * 0.05, 0.95),
            'info',
            userId,
            timeRange,
          ),
        );
      }

      // Expense outpacing income
      const expenses = monthlyTx.map((m: any) => Number(m.totalExpense ?? m.total_expense ?? 0));
      if (incomes.length >= 3 && expenses.length >= 3) {
        const incomeGrowth =
          incomes[0] > 0 ? (incomes[incomes.length - 1] - incomes[0]) / incomes[0] : 0;
        const expenseGrowth =
          expenses[0] > 0 ? (expenses[expenses.length - 1] - expenses[0]) / expenses[0] : 0;

        if (expenseGrowth > incomeGrowth + 0.1 && expenseGrowth > 0.1) {
          insights.push(
            this._buildInsight(
              'trend_alignment',
              'Expenses growing faster than income',
              `Expense growth (${(expenseGrowth * 100).toFixed(1)}%) outpacing income growth (${(incomeGrowth * 100).toFixed(1)}%).`,
              {
                incomeGrowth: Math.round(incomeGrowth * 10000) / 100,
                expenseGrowth: Math.round(expenseGrowth * 10000) / 100,
              },
              ['transactions', 'analytics', 'forecasting'],
              0.75,
              'warning',
              userId,
              timeRange,
            ),
          );
        }
      }
    } catch {
      /* scanner failure */
    }

    return insights;
  }

  /**
   * Identify compliance risks from cross-module signals.
   */
  private async _scanComplianceRisks(
    userId: string,
    timeRange: TimeRange,
  ): Promise<CrossModuleInsight[]> {
    const insights: CrossModuleInsight[] = [];

    try {
      const overdueBasRows: any[] = await (db as any)
        .select()
        .from(basPeriods)
        .where(and(eq(basPeriods.userId, userId), eq(basPeriods.status, 'overdue')))
        .all();

      const uncatResult = await (db as any)
        .select({ count: sql`count(*)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
            sql`${transactions.category} IS NULL`,
          ),
        )
        .get();
      const uncategorizedCount = Number(uncatResult?.count ?? 0);

      const missingGstResult = await (db as any)
        .select({ count: sql`count(*)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.gstApplicable, true),
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
            sql`(${transactions.gstAmount} IS NULL OR ${transactions.gstAmount} = 0)`,
          ),
        )
        .get();
      const missingGstCount = Number(missingGstResult?.count ?? 0);

      const riskFactors: string[] = [];
      const modules = ['compliance'];

      if (overdueBasRows.length > 0) {
        riskFactors.push(`${overdueBasRows.length} overdue BAS period(s)`);
        modules.push('bas');
      }
      if (uncategorizedCount > 10) {
        riskFactors.push(`${uncategorizedCount} uncategorized transactions`);
        modules.push('transactions');
      }
      if (missingGstCount > 5) {
        riskFactors.push(`${missingGstCount} transactions missing GST amounts`);
        if (!modules.includes('transactions')) modules.push('transactions');
        modules.push('tax');
      }

      if (riskFactors.length >= 2) {
        insights.push(
          this._buildInsight(
            'compliance_risk',
            `Compliance risk: ${riskFactors.length} factors identified`,
            `Risk factors: ${riskFactors.join('; ')}. Addressing these reduces ATO audit risk.`,
            {
              overdueBasCount: overdueBasRows.length,
              uncategorizedTxCount: uncategorizedCount,
              missingGstCount,
              riskFactors,
            },
            modules,
            Math.min(0.6 + riskFactors.length * 0.1, 0.95),
            overdueBasRows.length > 0 && (uncategorizedCount > 20 || missingGstCount > 10)
              ? 'critical'
              : 'warning',
            userId,
            timeRange,
            'Review and address each compliance risk factor: categorize transactions, calculate GST amounts, and lodge overdue BAS.',
          ),
        );
      }
    } catch {
      /* scanner failure */
    }

    return insights;
  }

  /**
   * Find when forecasts diverge from actual data.
   */
  private async _scanForecastDeviations(
    userId: string,
    timeRange: TimeRange,
  ): Promise<CrossModuleInsight[]> {
    const insights: CrossModuleInsight[] = [];

    try {
      const scenarios: any[] = await (db as any)
        .select()
        .from(forecastScenarios)
        .where(and(eq(forecastScenarios.userId, userId), eq(forecastScenarios.status, 'active')))
        .all();

      if (scenarios.length === 0) return insights;

      for (const scenario of scenarios) {
        const periods: any[] = await (db as any)
          .select()
          .from(forecastPeriods)
          .where(eq(forecastPeriods.scenarioId, scenario.id))
          .all();

        if (periods.length === 0) continue;

        const actuals: any[] = await (db as any)
          .select({
            month: sql`substr(${transactions.date}, 1, 7)`,
            total: sql`sum(${transactions.amount})`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              gte(transactions.date, timeRange.start),
              lte(transactions.date, timeRange.end),
            ),
          )
          .groupBy(sql`substr(${transactions.date}, 1, 7)`)
          .all();

        const actualMap = new Map(actuals.map((a: any) => [a.month, Number(a.total ?? 0)]));
        let deviations = 0;
        let totalDeviation = 0;

        for (const period of periods) {
          const forecastAmt = period.forecastAmount ?? period.forecast_amount ?? 0;
          const actual = actualMap.get(period.period);
          if (actual == null || forecastAmt === 0) continue;

          const deviation = Math.abs((actual - forecastAmt) / forecastAmt);
          if (deviation > 0.25) {
            deviations++;
            totalDeviation += deviation;
          }
        }

        if (deviations >= 2) {
          const avgDeviation = totalDeviation / deviations;
          insights.push(
            this._buildInsight(
              'forecast_deviation',
              `Forecast "${scenario.name}" diverging from reality`,
              `${deviations} periods show >25% deviation (avg ${(avgDeviation * 100).toFixed(1)}% off). Consider updating assumptions.`,
              {
                scenarioId: scenario.id,
                scenarioName: scenario.name,
                deviationCount: deviations,
                averageDeviation: Math.round(avgDeviation * 10000) / 100,
              },
              ['forecasting', 'transactions'],
              Math.min(0.6 + deviations * 0.08, 0.95),
              avgDeviation > 0.5 ? 'warning' : 'suggestion',
              userId,
              timeRange,
              'Review forecast assumptions and update the scenario with current data.',
            ),
          );
        }
      }
    } catch {
      /* scanner failure */
    }

    return insights;
  }

  /**
   * Discover tax optimization opportunities from cross-module data.
   */
  private async _scanTaxOpportunities(
    userId: string,
    timeRange: TimeRange,
  ): Promise<CrossModuleInsight[]> {
    const insights: CrossModuleInsight[] = [];

    try {
      const taxSummaries: any[] = await (db as any)
        .select()
        .from(taxYearSummary)
        .where(eq(taxYearSummary.userId, userId))
        .orderBy(desc(taxYearSummary.taxYear))
        .all();

      if (taxSummaries.length === 0) return insights;

      const latestTax = taxSummaries[0];
      const grossIncome = latestTax.grossIncome ?? latestTax.gross_income ?? 0;
      const totalDeductions = latestTax.totalDeductions ?? latestTax.total_deductions ?? 0;
      const deductionRatio = grossIncome > 0 ? totalDeductions / grossIncome : 0;

      // Low deduction ratio for businesses earning > $50k
      if (deductionRatio < 0.15 && grossIncome > 5000000) {
        const expenseResult = await (db as any)
          .select({ total: sql`sum(abs(${transactions.amount}))` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              sql`${transactions.amount} < 0`,
              gte(transactions.date, timeRange.start),
              lte(transactions.date, timeRange.end),
            ),
          )
          .get();

        const expenseTotal = Number(expenseResult?.total ?? 0);

        if (expenseTotal > totalDeductions * 1.5) {
          insights.push(
            this._buildInsight(
              'tax_opportunity',
              'Potential unclaimed deductions detected',
              `Deduction ratio (${(deductionRatio * 100).toFixed(1)}%) is below typical benchmarks. Expenses ($${(expenseTotal / 100).toFixed(2)}) exceed claimed deductions ($${(totalDeductions / 100).toFixed(2)}).`,
              {
                deductionRatio: Math.round(deductionRatio * 10000) / 100,
                grossIncome,
                totalDeductions,
                totalExpenses: expenseTotal,
              },
              ['tax', 'transactions'],
              0.7,
              'suggestion',
              userId,
              timeRange,
              'Review uncategorized expenses for potential business deductions including depreciation, home office, and vehicle claims.',
            ),
          );
        }
      }

      // EOFY approaching (April-June)
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      if (currentMonth >= 4 && currentMonth <= 6) {
        insights.push(
          this._buildInsight(
            'tax_opportunity',
            'EOFY approaching — time for tax planning',
            'The Australian financial year ends June 30. Review deductions, prepay expenses, and manage capital gains/losses.',
            {
              daysUntilEofy: Math.ceil(
                (new Date(now.getFullYear(), 5, 30).getTime() - now.getTime()) / 86_400_000,
              ),
              currentMonth,
            },
            ['tax', 'compliance', 'transactions'],
            0.85,
            'suggestion',
            userId,
            timeRange,
            'Prepay insurance/subscriptions, purchase needed assets, defer income where legal, and gather deduction evidence.',
          ),
        );
      }
    } catch {
      /* scanner failure */
    }

    return insights;
  }

  /**
   * Identify notable spending patterns across accounts and time.
   */
  private async _scanSpendingPatterns(
    userId: string,
    timeRange: TimeRange,
  ): Promise<CrossModuleInsight[]> {
    const insights: CrossModuleInsight[] = [];

    try {
      // Spending by category per month
      const categoryMonthly: any[] = await (db as any)
        .select({
          category: transactions.category,
          month: sql`substr(${transactions.date}, 1, 7)`,
          total: sql`sum(abs(${transactions.amount}))`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            sql`${transactions.amount} < 0`,
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
            sql`${transactions.category} IS NOT NULL`,
          ),
        )
        .groupBy(transactions.category, sql`substr(${transactions.date}, 1, 7)`)
        .orderBy(transactions.category, sql`substr(${transactions.date}, 1, 7)`)
        .all();

      // Group by category → totals array
      const categoryMap = new Map<string, number[]>();
      for (const row of categoryMonthly) {
        const cat = row.category;
        if (!cat) continue;
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(Number(row.total ?? 0));
      }

      // Detect spending spikes per category
      for (const [category, totals] of categoryMap) {
        if (totals.length < 3) continue;

        const recent = totals.slice(-2);
        const earlier = totals.slice(0, -2);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const earlierAvg =
          earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : 0;

        if (earlierAvg > 0 && recentAvg > earlierAvg * 1.5 && recentAvg > 10000) {
          const increasePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
          insights.push(
            this._buildInsight(
              'spending_pattern',
              `Spending spike in "${category}"`,
              `Recent spending ($${(recentAvg / 100).toFixed(2)}/month avg) is ${increasePercent.toFixed(0)}% above earlier average ($${(earlierAvg / 100).toFixed(2)}/month).`,
              {
                category,
                recentAvg: Math.round(recentAvg),
                earlierAvg: Math.round(earlierAvg),
                increasePercent: Math.round(increasePercent),
              },
              ['transactions', 'analytics'],
              0.7,
              increasePercent > 200 ? 'warning' : 'suggestion',
              userId,
              timeRange,
            ),
          );
        }
      }

      // Account concentration — one account dominates spending
      const accountSpend: any[] = await (db as any)
        .select({
          accountId: transactions.accountId,
          total: sql`sum(abs(${transactions.amount}))`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            sql`${transactions.amount} < 0`,
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
            sql`${transactions.accountId} IS NOT NULL`,
          ),
        )
        .groupBy(transactions.accountId)
        .all();

      if (accountSpend.length >= 2) {
        const totals = accountSpend.map((a: any) => Number(a.total ?? 0));
        const grandTotal = totals.reduce((a, b) => a + b, 0);
        const maxSpend = Math.max(...totals);

        if (grandTotal > 0 && maxSpend / grandTotal > 0.85) {
          insights.push(
            this._buildInsight(
              'spending_pattern',
              'High account concentration in spending',
              `Over ${((maxSpend / grandTotal) * 100).toFixed(0)}% of spending flows through a single account. Consider diversifying for better tracking.`,
              {
                accountBreakdown: accountSpend.map((a: any) => ({
                  accountId: a.accountId ?? a.account_id,
                  total: Number(a.total ?? 0),
                })),
              },
              ['accounts', 'transactions'],
              0.6,
              'info',
              userId,
              timeRange,
            ),
          );
        }
      }
    } catch {
      /* scanner failure */
    }

    return insights;
  }

  // --------------------------------------------------------------------------
  // PRIVATE: Helpers
  // --------------------------------------------------------------------------

  /**
   * Pearson correlation coefficient with t-distribution p-value approximation.
   * Formula: r = Σ((xi-x̄)(yi-ȳ)) / √(Σ(xi-x̄)² × Σ(yi-ȳ)²)
   * P-value from t = r√(n-2)/√(1-r²), using t-distribution CDF.
   */
  _calculatePearsonCorrelation(x: number[], y: number[]): { coefficient: number; pValue: number } {
    const n = Math.min(x.length, y.length);
    if (n < 3) return { coefficient: 0, pValue: 1 };

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    if (sumX2 === 0 || sumY2 === 0) return { coefficient: 0, pValue: 1 };

    const r = sumXY / Math.sqrt(sumX2 * sumY2);
    const rSquared = r * r;

    // t-statistic: t = r * sqrt(n-2) / sqrt(1 - r²)
    const df = n - 2;
    const t = (r * Math.sqrt(df)) / Math.sqrt(1 - rSquared + 1e-15);

    // Approximate two-tailed p-value
    const pValue = this._tDistPValue(Math.abs(t), df);

    return {
      coefficient: Math.round(r * 1e10) / 1e10,
      pValue: Math.round(pValue * 1e10) / 1e10,
    };
  }

  /**
   * Approximate two-tailed p-value from t-distribution.
   * Uses normal approximation for large df, beta function series for small df.
   */
  private _tDistPValue(t: number, df: number): number {
    if (df > 100) {
      // Normal approximation (Abramowitz & Stegun 26.2.17)
      const x = t / Math.sqrt(2);
      const ax = Math.abs(x);
      const tVal = 1 / (1 + 0.3275911 * ax);
      const poly =
        ((((1.061405429 * tVal - 1.453152027) * tVal + 1.421413741) * tVal - 0.284496736) * tVal +
          0.254829592) *
        tVal;
      const erf = 1 - poly * Math.exp(-ax * ax);
      const normalCdf = 0.5 * (1 + (x >= 0 ? erf : -erf));
      return 2 * (1 - normalCdf);
    }

    // Regularized incomplete beta: p = I_x(df/2, 1/2) where x = df/(df+t²)
    const xVal = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;
    const lnBeta = this._lnGamma(a) + this._lnGamma(b) - this._lnGamma(a + b);
    const prefix = Math.exp(a * Math.log(xVal) + b * Math.log(1 - xVal) - lnBeta) / a;

    let term = 1;
    let result = 1;
    for (let k = 1; k <= 200; k++) {
      term *= (xVal * (a + b + k - 1) * (a + k - 1)) / ((a + 2 * k - 1) * (a + 2 * k));
      if (!isFinite(term)) break;
      result += term;
      if (Math.abs(term) < 1e-10) break;
    }

    return Math.min(1, Math.max(0, prefix * result));
  }

  /** Lanczos approximation of the log-gamma function. */
  private _lnGamma(z: number): number {
    if (z <= 0) return 0;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
      1.5056327351493116e-7,
    ];

    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - this._lnGamma(1 - z);
    }

    z -= 1;
    let x = c[0];
    for (let i = 1; i < 9; i++) {
      x += c[i] / (z + i);
    }
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  /** Factory method: build a CrossModuleInsight with generated ID and timestamps. */
  private _buildInsight(
    type: string,
    title: string,
    description: string,
    evidence: Record<string, unknown>,
    modules: string[],
    confidence: number,
    severity: string,
    userId: string,
    timeRange?: TimeRange,
    recommendedAction?: string,
  ): CrossModuleInsight {
    return {
      id: randomUUID(),
      userId,
      insightType: type,
      title,
      description,
      severity: severity as CrossModuleInsight['severity'],
      sourceModules: modules,
      relatedEntities: [],
      timeRangeStart: timeRange?.start,
      timeRangeEnd: timeRange?.end,
      confidence: Math.round(confidence * 1000) / 1000,
      evidence,
      recommendedAction,
      status: 'new',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
  }

  /** Remove near-duplicate insights by comparing type + modules + time range. */
  private _deduplicateInsights(insights: CrossModuleInsight[]): CrossModuleInsight[] {
    const seen = new Set<string>();
    const deduped: CrossModuleInsight[] = [];

    for (const insight of insights) {
      const key = [
        insight.insightType,
        insight.sourceModules.sort().join(','),
        insight.timeRangeStart ?? '',
        insight.timeRangeEnd ?? '',
      ].join('|');

      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(insight);
      }
    }

    return deduped;
  }

  /** Fetch time-series metrics from a specific module for correlation analysis. */
  private async _getModuleMetrics(
    userId: string,
    module: string,
    timeRange: TimeRange,
  ): Promise<Record<string, number[]>> {
    const metrics: Record<string, number[]> = {};

    try {
      switch (module) {
        case 'transactions': {
          const monthly: any[] = await (db as any)
            .select({
              month: sql`substr(${transactions.date}, 1, 7)`,
              totalIncome: sql`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
              totalExpense: sql`sum(case when ${transactions.amount} < 0 then abs(${transactions.amount}) else 0 end)`,
              netFlow: sql`sum(${transactions.amount})`,
              txCount: sql`count(*)`,
              avgAmount: sql`avg(abs(${transactions.amount}))`,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.userId, userId),
                gte(transactions.date, timeRange.start),
                lte(transactions.date, timeRange.end),
              ),
            )
            .groupBy(sql`substr(${transactions.date}, 1, 7)`)
            .orderBy(sql`substr(${transactions.date}, 1, 7)`)
            .all();

          metrics['income'] = monthly.map((m: any) => Number(m.totalIncome ?? m.total_income ?? 0));
          metrics['expense'] = monthly.map((m: any) =>
            Number(m.totalExpense ?? m.total_expense ?? 0),
          );
          metrics['net_flow'] = monthly.map((m: any) => Number(m.netFlow ?? m.net_flow ?? 0));
          metrics['tx_count'] = monthly.map((m: any) => Number(m.txCount ?? m.tx_count ?? 0));
          metrics['avg_amount'] = monthly.map((m: any) => Number(m.avgAmount ?? m.avg_amount ?? 0));
          break;
        }

        case 'tax': {
          const summaries: any[] = await (db as any)
            .select()
            .from(taxYearSummary)
            .where(eq(taxYearSummary.userId, userId))
            .orderBy(taxYearSummary.taxYear)
            .all();

          metrics['gross_income'] = summaries.map((s: any) =>
            Number(s.grossIncome ?? s.gross_income ?? 0),
          );
          metrics['total_deductions'] = summaries.map((s: any) =>
            Number(s.totalDeductions ?? s.total_deductions ?? 0),
          );
          metrics['net_tax'] = summaries.map((s: any) => Number(s.netTax ?? s.net_tax ?? 0));
          metrics['taxable_income'] = summaries.map((s: any) =>
            Number(s.taxableIncome ?? s.taxable_income ?? 0),
          );
          break;
        }

        case 'bas': {
          const basRows: any[] = await (db as any).select().from(basCalculations).all();

          metrics['gst_collected'] = basRows.map((b: any) => Number(b.labelG1 ?? b.label_g1 ?? 0));
          metrics['gst_paid'] = basRows.map((b: any) => Number(b.labelG11 ?? b.label_g11 ?? 0));
          metrics['amount_owing'] = basRows.map((b: any) =>
            Number(b.amountOwing ?? b.amount_owing ?? 0),
          );
          break;
        }

        case 'analytics': {
          const kpis: any[] = await (db as any)
            .select()
            .from(kpiMetrics)
            .where(
              and(
                eq(kpiMetrics.userId, userId),
                gte(kpiMetrics.period, timeRange.start.slice(0, 7)),
                lte(kpiMetrics.period, timeRange.end.slice(0, 7)),
              ),
            )
            .orderBy(kpiMetrics.period)
            .all();

          const metricGroups = new Map<string, number[]>();
          for (const kpi of kpis) {
            const name = kpi.metricName ?? kpi.metric_name;
            if (!metricGroups.has(name)) metricGroups.set(name, []);
            metricGroups.get(name)!.push(Number(kpi.metricValue ?? kpi.metric_value ?? 0));
          }
          for (const [name, values] of metricGroups) {
            metrics[name] = values;
          }
          break;
        }

        case 'forecasting': {
          const scenarios: any[] = await (db as any)
            .select()
            .from(forecastScenarios)
            .where(eq(forecastScenarios.userId, userId))
            .all();

          for (const sc of scenarios) {
            const periods: any[] = await (db as any)
              .select()
              .from(forecastPeriods)
              .where(eq(forecastPeriods.scenarioId, sc.id))
              .all();

            metrics[`forecast_${sc.name ?? 'unnamed'}`] = periods.map((p: any) =>
              Number(p.forecastAmount ?? p.forecast_amount ?? 0),
            );
          }
          break;
        }

        default:
          break;
      }
    } catch {
      /* module metrics unavailable */
    }

    return metrics;
  }

  /** Convert a raw DB row into a CrossModuleInsight object. */
  private _rowToInsight(r: any): CrossModuleInsight {
    return {
      id: r.id,
      userId: r.userId ?? r.user_id,
      insightType: r.insightType ?? r.insight_type,
      title: r.title,
      description: r.description,
      severity: r.severity,
      sourceModules: this._parseJson(r.sourceModules ?? r.source_modules, []),
      relatedEntities: this._parseJson(r.relatedEntities ?? r.related_entities, []),
      timeRangeStart: r.timeRangeStart ?? r.time_range_start,
      timeRangeEnd: r.timeRangeEnd ?? r.time_range_end,
      confidence: Number(r.confidence ?? 0.5),
      evidence: this._parseJson(r.evidence, {}),
      recommendedAction: r.recommendedAction ?? r.recommended_action,
      status: r.status,
      actedOnAt: r.actedOnAt ?? r.acted_on_at,
      createdAt: r.createdAt ?? r.created_at,
      expiresAt: r.expiresAt ?? r.expires_at,
    };
  }

  /** Safe JSON parse with fallback. */
  private _parseJson<T>(value: string | T, fallback: T): T {
    if (typeof value !== 'string') return value ?? fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
}
