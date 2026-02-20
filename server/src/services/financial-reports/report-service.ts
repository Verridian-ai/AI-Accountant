/**
 * Financial Reports Module — FinancialReportService class
 *
 * Generates P&L, Balance Sheet, Cash Flow, Trial Balance reports,
 * period comparisons, snapshot persistence, and KPI calculations.
 */

import {
  db,
  transactions,
  journalEntries,
  journalEntryLines,
  accounts,
  ownerEquityEvents,
  chartOfAccounts,
} from '../../schema.js';
import { eq, and, gte, lte, sql, type SQL } from 'drizzle-orm';
import type {
  ProfitAndLossReport,
  CategoryGroup,
  BalanceSheetReport,
  CashFlowReport,
  TrialBalanceReport,
  TrialBalanceEntry,
  PeriodComparison,
  KPIMetrics,
  ReportData,
} from './types.js';
import {
  REVENUE_CATEGORIES,
  COGS_CATEGORIES,
  SYSTEM_CATEGORIES,
  INVESTING_CATEGORIES,
  FINANCING_CATEGORIES,
  safeDivide,
} from './constants.js';
import { ReportAnalytics } from './report-analytics.js';

export class FinancialReportService {
  async generateProfitAndLoss(
    userId: string,
    periodStart: string,
    periodEnd: string,
    accountId?: string,
  ): Promise<ProfitAndLossReport> {
    const conditions: SQL<unknown>[] = [
      eq(transactions.userId, userId),
      gte(transactions.date, periodStart),
      lte(transactions.date, periodEnd),
      sql`${transactions.isTransfer} = false`,
    ];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));

    const rows = await db
      .select({
        category: transactions.category,
        totalAmount: sql<number>`SUM(${transactions.amount})`,
        txCount: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(transactions.category)
      .all();

    const revenue: CategoryGroup[] = [];
    const costOfGoodsSold: CategoryGroup[] = [];
    const expenses: CategoryGroup[] = [];
    let grossRevenue = 0,
      totalCOGS = 0,
      totalExpenses = 0,
      transactionCount = 0;

    for (const row of rows) {
      const cat = row.category ?? 'Uncategorized';
      const amount = Number(row.totalAmount) || 0;
      const count = Number(row.txCount) || 0;
      transactionCount += count;
      if (SYSTEM_CATEGORIES.includes(cat)) continue;

      if (REVENUE_CATEGORIES.includes(cat)) {
        // Revenue: use signed amount (positive = income, negative = net refund reduces revenue)
        const group: CategoryGroup = { category: cat, amount, transactionCount: count };
        revenue.push(group);
        grossRevenue += amount;
      } else if (COGS_CATEGORIES.includes(cat)) {
        // COGS: expense amounts are negative in DB, negate to get positive cost
        const displayAmount = -amount;
        const group: CategoryGroup = {
          category: cat,
          amount: displayAmount,
          transactionCount: count,
        };
        costOfGoodsSold.push(group);
        totalCOGS += displayAmount;
      } else {
        // Expenses: negative in DB, negate to get positive expense
        const displayAmount = -amount;
        const group: CategoryGroup = {
          category: cat,
          amount: displayAmount,
          transactionCount: count,
        };
        expenses.push(group);
        totalExpenses += displayAmount;
      }
    }

    revenue.sort((a, b) => b.amount - a.amount);
    costOfGoodsSold.sort((a, b) => b.amount - a.amount);
    expenses.sort((a, b) => b.amount - a.amount);

    const grossProfit = grossRevenue - totalCOGS;
    const netProfitOrLoss = grossProfit - totalExpenses;
    const grossMargin = safeDivide(grossProfit, grossRevenue) * 100;

    return {
      periodStart,
      periodEnd,
      revenue,
      expenses,
      costOfGoodsSold,
      grossRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfitOrLoss,
      grossMargin,
      transactionCount,
    };
  }

  async generateBalanceSheet(userId: string, asAtDate: string): Promise<BalanceSheetReport> {
    const userAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.accountName,
        type: accounts.accountType,
        balance: accounts.currentBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
      .all();

    const assetItems: Array<{ name: string; amount: number }> = [];
    const liabilityItems: Array<{ name: string; amount: number }> = [];
    let totalAssets = 0,
      totalLiabilities = 0;

    for (const acct of userAccounts) {
      const balance = Number(acct.balance) || 0;
      const item = { name: acct.name, amount: Math.abs(balance) };
      const acctType = (acct.type ?? '').toLowerCase();
      if (
        acctType === 'credit_card' ||
        acctType === 'loan' ||
        acctType === 'credit' ||
        balance < 0
      ) {
        liabilityItems.push(item);
        totalLiabilities += Math.abs(balance);
      } else {
        assetItems.push(item);
        totalAssets += balance;
      }
    }

    const equityEvents = await db
      .select({
        eventType: ownerEquityEvents.eventType,
        totalAmount: sql<number>`SUM(${ownerEquityEvents.amount})`,
      })
      .from(ownerEquityEvents)
      .where(and(eq(ownerEquityEvents.userId, userId), eq(ownerEquityEvents.confirmed, true)))
      .groupBy(ownerEquityEvents.eventType)
      .all();

    const equityItems: Array<{ name: string; amount: number }> = [];
    let totalContributions = 0,
      totalDrawings = 0;
    for (const ev of equityEvents) {
      const amount = Number(ev.totalAmount) || 0;
      if (ev.eventType === 'contribution') {
        totalContributions += amount;
        equityItems.push({ name: 'Owner Contributions', amount });
      } else if (ev.eventType === 'drawing') {
        totalDrawings += amount;
        equityItems.push({ name: 'Owner Drawings', amount: -amount });
      }
    }

    // Calculate retained earnings from P&L (cumulative net profit) — NOT as a plug figure
    const pnlResult = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          lte(transactions.date, asAtDate),
          eq(transactions.isTransfer, false),
        ),
      )
      .get();
    const retainedEarnings = Number(pnlResult?.totalAmount) || 0;
    equityItems.push({ name: 'Retained Earnings', amount: retainedEarnings });
    const totalEquity = totalContributions - totalDrawings + retainedEarnings;
    // Genuine balance check: A = L + E (not always true when derived independently)
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

    return {
      asAtDate,
      assets: { items: assetItems, total: totalAssets },
      liabilities: { items: liabilityItems, total: totalLiabilities },
      equity: { items: equityItems, total: totalEquity },
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
    };
  }

  async generateCashFlow(
    userId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<CashFlowReport> {
    const rows = await db
      .select({
        category: transactions.category,
        totalAmount: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd),
          eq(transactions.isTransfer, false),
        ),
      )
      .groupBy(transactions.category)
      .all();

    const operatingItems: Array<{ category: string; amount: number }> = [];
    const investingItems: Array<{ category: string; amount: number }> = [];
    const financingItems: Array<{ category: string; amount: number }> = [];
    let operatingTotal = 0,
      investingTotal = 0,
      financingTotal = 0;

    for (const row of rows) {
      const cat = row.category ?? 'Uncategorized';
      const amount = Number(row.totalAmount) || 0;
      if (cat === 'Transfer') continue;
      const item = { category: cat, amount };
      if (FINANCING_CATEGORIES.includes(cat) || cat === 'Cash Withdrawal') {
        financingItems.push(item);
        financingTotal += amount;
      } else if (INVESTING_CATEGORIES.includes(cat)) {
        investingItems.push(item);
        investingTotal += amount;
      } else {
        operatingItems.push(item);
        operatingTotal += amount;
      }
    }

    const equityEvents = await db
      .select({
        eventType: ownerEquityEvents.eventType,
        totalAmount: sql<number>`SUM(${ownerEquityEvents.amount})`,
      })
      .from(ownerEquityEvents)
      .where(
        and(
          eq(ownerEquityEvents.userId, userId),
          eq(ownerEquityEvents.confirmed, true),
          gte(ownerEquityEvents.createdAt, periodStart),
          lte(ownerEquityEvents.createdAt, periodEnd),
        ),
      )
      .groupBy(ownerEquityEvents.eventType)
      .all();

    for (const ev of equityEvents) {
      const amount = Number(ev.totalAmount) || 0;
      if (ev.eventType === 'contribution') {
        financingItems.push({ category: 'Owner Contributions', amount });
        financingTotal += amount;
      } else if (ev.eventType === 'drawing') {
        financingItems.push({ category: 'Owner Drawings', amount: -amount });
        financingTotal -= amount;
      }
    }

    const balanceQuery = await db
      .select({
        totalBalance: sql<number>`COALESCE(SUM(${accounts.currentBalance}), 0)`,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
      .get();

    const closingBalance = Number(balanceQuery?.totalBalance) || 0;
    const netCashChange = operatingTotal + investingTotal + financingTotal;
    const openingBalance = closingBalance - netCashChange;

    return {
      periodStart,
      periodEnd,
      operating: { items: operatingItems, total: operatingTotal },
      investing: { items: investingItems, total: investingTotal },
      financing: { items: financingItems, total: financingTotal },
      netCashChange,
      openingBalance,
      closingBalance,
    };
  }

  async generateTrialBalance(userId: string, asAtDate: string): Promise<TrialBalanceReport> {
    const coaEntries = await db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        type: chartOfAccounts.type,
        normalBalance: chartOfAccounts.normalBalance,
      })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.isActive, true)))
      .orderBy(chartOfAccounts.code)
      .all();

    // Fallback: generate synthetic trial balance from transaction categories
    if (coaEntries.length === 0) {
      return this._syntheticTrialBalance(userId, asAtDate);
    }

    const lineAggregates = await db
      .select({
        accountId: journalEntryLines.accountId,
        totalDebits: sql<number>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
        totalCredits: sql<number>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
      })
      .from(journalEntryLines)
      .leftJoin(journalEntries, eq(journalEntryLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.userId, userId),
          lte(journalEntries.entryDate, asAtDate),
          eq(journalEntries.status, 'posted'),
        ),
      )
      .groupBy(journalEntryLines.accountId)
      .all();

    const balanceMap = new Map<string, { debits: number; credits: number }>();
    for (const line of lineAggregates) {
      balanceMap.set(line.accountId, {
        debits: Number(line.totalDebits) || 0,
        credits: Number(line.totalCredits) || 0,
      });
    }

    let totalDebits = 0,
      totalCredits = 0;
    const entries: TrialBalanceEntry[] = [];

    for (const coa of coaEntries) {
      const bal = balanceMap.get(coa.id) ?? { debits: 0, credits: 0 };
      entries.push({
        accountCode: coa.code,
        accountName: coa.name,
        accountType: coa.type,
        debit: bal.debits,
        credit: bal.credits,
        netBalance: bal.debits - bal.credits,
      });
      totalDebits += bal.debits;
      totalCredits += bal.credits;
    }

    const difference = totalDebits - totalCredits;
    return {
      asAtDate,
      entries,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(difference) < 1,
      difference,
    };
  }

  private async _syntheticTrialBalance(
    userId: string,
    asAtDate: string,
  ): Promise<TrialBalanceReport> {
    const txRows = await db
      .select({
        category: transactions.category,
        totalAmount: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          lte(transactions.date, asAtDate),
          sql`${transactions.isTransfer} = false`,
        ),
      )
      .groupBy(transactions.category)
      .all();

    type TxRow = (typeof txRows)[number];
    const entries: TrialBalanceEntry[] = txRows
      .filter(
        (r: TxRow) => r.category && r.category !== 'Transfer' && r.category !== 'Uncategorized',
      )
      .map((r: TxRow) => {
        const amount = Number(r.totalAmount) || 0;
        return {
          accountCode: '',
          accountName: r.category ?? 'Other',
          accountType: amount > 0 ? 'revenue' : 'expense',
          debit: amount < 0 ? Math.abs(amount) : 0,
          credit: amount > 0 ? amount : 0,
          netBalance: amount,
        };
      });

    const totalDebits = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredits = entries.reduce((s, e) => s + e.credit, 0);
    const difference = totalDebits - totalCredits;
    return { asAtDate, entries, totalDebits, totalCredits, isBalanced: false, difference };
  }

  private _analytics = new ReportAnalytics(this);

  async comparePeriods(
    userId: string,
    currentStart: string,
    currentEnd: string,
    priorStart: string,
    priorEnd: string,
    reportType: string,
  ): Promise<PeriodComparison> {
    return this._analytics.comparePeriods(
      userId,
      currentStart,
      currentEnd,
      priorStart,
      priorEnd,
      reportType,
    );
  }

  async createSnapshot(
    templateId: string,
    reportData: ReportData,
    userId?: string,
    reportType?: string,
    periodStart?: string,
    periodEnd?: string,
  ): Promise<string> {
    return this._analytics.createSnapshot(
      templateId,
      reportData,
      userId,
      reportType,
      periodStart,
      periodEnd,
    );
  }

  async getKPIs(userId: string, period: string): Promise<KPIMetrics> {
    return this._analytics.getKPIs(userId, period);
  }
}
