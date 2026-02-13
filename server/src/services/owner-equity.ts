/**
 * Owner Equity Service
 * Tracks owner contributions and drawings for sole trader/partnership entities.
 *
 * Contributions: personal → business transfers (increases equity)
 * Drawings: business → personal transfers, ATM withdrawals from business
 *           accounts, personal expense payments from business accounts
 *
 * These events don't affect P&L but are critical for:
 *   - Correct balance sheet reporting
 *   - BAS accuracy (contributions ≠ income)
 *   - Tax return equity reconciliation
 */

import { db, ownerEquityEvents, transactions, accounts } from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { TransferDetector } from './transfers/detector.js';
import type { TransferCandidate, AccountContext } from './transfers/detector.js';
import { getFinancialYearDates } from './tax.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DetectedEquityEvent {
  transactionId: string;
  amount: number;          // cents (always positive)
  date: string;
  sourceAccount: string;
  description: string;
  confidence: number;
}

export interface EquityEventParams {
  userId: string;
  accountId?: string;
  transactionId?: string;
  eventType: 'contribution' | 'drawing';
  amount: number;          // cents
  financialYear: string;
  notes?: string;
  detectedBy?: 'ai' | 'manual' | 'rule';
}

export interface EquitySummary {
  financialYear: string;
  totalContributions: number;  // cents
  totalDrawings: number;       // cents
  netEquityChange: number;     // cents
  monthlyBreakdown: Array<{
    month: string;             // YYYY-MM
    contributions: number;     // cents
    drawings: number;          // cents
    net: number;               // cents
  }>;
  eventCount: number;
}

/** Minimum transfer amount to flag as potential contribution (cents) */
const CONTRIBUTION_THRESHOLD_CENTS = 100_000; // $1,000

/** Categories that indicate personal expenses (drawings when from business account) */
const PERSONAL_EXPENSE_CATEGORIES = [
  'Personal',
  'Groceries',
  'Entertainment',
  'Clothing',
  'Health & Fitness',
  'Hobbies',
  'Gifts',
  'Donations',
  'Personal Care',
];

/** Description patterns that indicate ATM withdrawals */
const ATM_PATTERNS = [
  /\bATM\b/i,
  /\bCASH\s+W(?:ITH)?D(?:RAWAL)?\b/i,
  /\bWITHDRAW(?:AL)?\b/i,
];


// ============================================================================
// SERVICE CLASS
// ============================================================================

export class OwnerEquityService {

  /**
   * Scan for potential owner contributions (personal → business transfers)
   * Uses TransferDetector to match cross-account transfers.
   */
  async scanForContributions(userId: string, financialYear: string): Promise<DetectedEquityEvent[]> {
    const { start, end } = getFinancialYearDates(financialYear);

    // Load accounts
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .all();

    // Load transactions in the financial year
    const txRows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, start),
          lte(transactions.date, end),
        )
      )
      .all();

    // Map to TransferDetector format
    const candidates: TransferCandidate[] = txRows.map((tx: any, i: number) => ({
      id: i,
      accountId: userAccounts.findIndex((a: any) => a.id === tx.accountId),
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
    }));

    const accountContexts: AccountContext[] = userAccounts.map((a: any, i: number) => ({
      id: i,
      accountNumber: a.accountNumber ?? '',
      bankId: a.bankName ?? 'CBA',
      accountName: a.accountName,
      accountType: a.accountType,
      ownershipTag: a.ownershipTag ?? 'business',
    }));

    // Detect contributions using TransferDetector
    const detector = new TransferDetector();
    const contributionIndices = detector.detectOwnerContributions(candidates, accountContexts);

    // Map back to detected events, filtering by threshold
    const events: DetectedEquityEvent[] = [];
    for (const idx of contributionIndices) {
      const candidate = candidates[idx];
      const tx = txRows[candidate ? candidates.indexOf(candidate) : -1];
      if (!tx) continue;

      const amount = Math.abs(tx.amount);
      if (amount < CONTRIBUTION_THRESHOLD_CENTS) continue;

      const sourceAccountIdx = candidate.accountId;
      const sourceAccount = userAccounts[sourceAccountIdx];

      events.push({
        transactionId: tx.id,
        amount,
        date: tx.date,
        sourceAccount: sourceAccount?.accountName ?? 'Unknown',
        description: tx.description,
        confidence: 0.8,
      });
    }

    return events;
  }

  /**
   * Scan for potential owner drawings (business → personal transfers,
   * ATM withdrawals from business accounts, personal expenses from business accounts)
   */
  async scanForDrawings(userId: string, financialYear: string): Promise<DetectedEquityEvent[]> {
    const { start, end } = getFinancialYearDates(financialYear);

    // Load business accounts
    const businessAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          sql`${accounts.ownershipTag} = 'business'`
        )
      )
      .all();

    if (businessAccounts.length === 0) return [];

    const businessAccountIds = new Set(businessAccounts.map((a: any) => a.id));

    // Load business account transactions in the financial year
    const txRows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, start),
          lte(transactions.date, end),
          sql`${transactions.amount} < 0`,
        )
      )
      .all();

    const events: DetectedEquityEvent[] = [];

    for (const tx of txRows as any[]) {
      // Only consider transactions from business accounts
      if (!tx.accountId || !businessAccountIds.has(tx.accountId)) continue;

      const amount = Math.abs(tx.amount);
      const desc = tx.description ?? '';

      // Check for ATM withdrawals
      const isATM = ATM_PATTERNS.some(p => p.test(desc));
      if (isATM) {
        const account = businessAccounts.find((a: any) => a.id === tx.accountId);
        events.push({
          transactionId: tx.id,
          amount,
          date: tx.date,
          sourceAccount: account?.accountName ?? 'Business Account',
          description: desc,
          confidence: 0.9,
        });
        continue;
      }

      // Check for personal expense categories
      const isPersonalExpense = PERSONAL_EXPENSE_CATEGORIES.includes(tx.category ?? '');
      if (isPersonalExpense) {
        const account = businessAccounts.find((a: any) => a.id === tx.accountId);
        events.push({
          transactionId: tx.id,
          amount,
          date: tx.date,
          sourceAccount: account?.accountName ?? 'Business Account',
          description: desc,
          confidence: 0.7,
        });
        continue;
      }

      // Check for transfers to personal accounts (isTransfer + isOwnerContribution inverse)
      if (tx.isTransfer && amount >= CONTRIBUTION_THRESHOLD_CENTS) {
        const account = businessAccounts.find((a: any) => a.id === tx.accountId);
        events.push({
          transactionId: tx.id,
          amount,
          date: tx.date,
          sourceAccount: account?.accountName ?? 'Business Account',
          description: desc,
          confidence: 0.75,
        });
      }
    }

    return events;
  }

  /**
   * Create an equity event (contribution or drawing) in the ledger.
   */
  async createEquityEvent(params: EquityEventParams): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.insert(ownerEquityEvents).values({
      id,
      userId: params.userId,
      accountId: params.accountId ?? null,
      transactionId: params.transactionId ?? null,
      eventType: params.eventType,
      amount: params.amount,
      detectedBy: params.detectedBy ?? 'manual',
      confirmed: false,
      financialYear: params.financialYear,
      notes: params.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }).run();

    return id;
  }

  /**
   * Confirm or reject an equity event.
   */
  async confirmEquityEvent(eventId: string, confirmed: boolean): Promise<void> {
    await db
      .update(ownerEquityEvents)
      .set({
        confirmed,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ownerEquityEvents.id, eventId))
      .run();
  }

  /**
   * Get equity summary for a financial year.
   * Only includes confirmed events.
   */
  async getEquitySummary(userId: string, financialYear: string): Promise<EquitySummary> {
    // Get all confirmed events for this year
    const events = await db
      .select()
      .from(ownerEquityEvents)
      .where(
        and(
          eq(ownerEquityEvents.userId, userId),
          eq(ownerEquityEvents.financialYear, financialYear),
          eq(ownerEquityEvents.confirmed, true),
        )
      )
      .all();

    let totalContributions = 0;
    let totalDrawings = 0;
    const monthlyMap = new Map<string, { contributions: number; drawings: number }>();

    for (const event of events as any[]) {
      const amount = Math.abs(event.amount);

      // Extract month from associated transaction or use createdAt
      const dateStr = event.createdAt ?? new Date().toISOString();
      const month = dateStr.slice(0, 7); // YYYY-MM

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { contributions: 0, drawings: 0 });
      }
      const monthEntry = monthlyMap.get(month)!;

      if (event.eventType === 'contribution') {
        totalContributions += amount;
        monthEntry.contributions += amount;
      } else {
        totalDrawings += amount;
        monthEntry.drawings += amount;
      }
    }

    // Sort monthly breakdown chronologically
    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        contributions: data.contributions,
        drawings: data.drawings,
        net: data.contributions - data.drawings,
      }));

    return {
      financialYear,
      totalContributions,
      totalDrawings,
      netEquityChange: totalContributions - totalDrawings,
      monthlyBreakdown,
      eventCount: events.length,
    };
  }
}

export const ownerEquityService = new OwnerEquityService();
