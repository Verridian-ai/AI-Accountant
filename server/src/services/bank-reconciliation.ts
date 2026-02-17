/**
 * Bank Reconciliation Service
 *
 * Multi-strategy matching engine that reconciles bank transactions against ledger
 * entries with confidence scoring, session management, and configurable rules.
 */

import { db, transactions } from '../schema.js';
import { eq, and, gte, lte, sql, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { getErrorMessage } from '../utils/error.js';

// ============================================================================
// LOCAL TYPE FALLBACKS
// Schema tables (bankReconSessions, bankReconMatches, bankReconRules) may not
// exist yet — Agent 1 creates them. We define local interfaces so this service
// compiles. When tables exist, these should be replaced with drizzle-orm types.
// ============================================================================

interface LedgerEntryCandidate {
  id: string;
  entryId: string;
  debit: number;
  credit: number;
  description: string;
  entryDate: string;
  reference: string;
  journalDescription: string;
}

export interface BankReconSession {
  id: string;
  userId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  status: string; // 'open' | 'completed' | 'abandoned'
  statementBalanceCents: number | null;
  ledgerBalanceCents: number | null;
  differenceCents: number | null;
  totalTransactions: number;
  totalMatched: number;
  autoMatched: number;
  manualMatched: number;
  totalUnmatched: number;
  totalSuggested: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface BankReconMatch {
  id: string;
  sessionId: string;
  bankTransactionId: string;
  ledgerEntryId: string;
  matchType: string; // 'auto' | 'suggested' | 'manual'
  matchRuleId: string | null;
  confidence: number;
  matchReasons: string; // JSON array
  status: string; // 'pending' | 'confirmed' | 'rejected' | 'undone'
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface BankReconRule {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  matchType: string; // 'amount_exact' | 'amount_date' | 'reference_number' | 'description_pattern' | 'combined'
  matchConfig: string; // JSON
  autoConfirm: boolean;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// We'll use raw SQL via db for the recon tables since schema definitions
// may not exist yet. These helpers build queries against expected table names.
const rawQuery = {
  async insertSession(session: BankReconSession): Promise<void> {
    await db.run(sql`INSERT INTO bank_recon_sessions (
      id, user_id, account_id, period_start, period_end, status,
      statement_balance_cents, ledger_balance_cents, difference_cents,
      total_transactions, total_matched, auto_matched, manual_matched,
      total_unmatched, total_suggested, created_at, updated_at, completed_at
    ) VALUES (
      ${session.id}, ${session.userId}, ${session.accountId},
      ${session.periodStart}, ${session.periodEnd}, ${session.status},
      ${session.statementBalanceCents}, ${session.ledgerBalanceCents},
      ${session.differenceCents}, ${session.totalTransactions},
      ${session.totalMatched}, ${session.autoMatched}, ${session.manualMatched},
      ${session.totalUnmatched}, ${session.totalSuggested},
      ${session.createdAt}, ${session.updatedAt}, ${session.completedAt}
    )`);
  },

  async getSession(sessionId: string, userId: string): Promise<BankReconSession | undefined> {
    return db.get(sql`SELECT
      id, user_id as "userId", account_id as "accountId",
      period_start as "periodStart", period_end as "periodEnd", status,
      statement_balance_cents as "statementBalanceCents",
      ledger_balance_cents as "ledgerBalanceCents",
      difference_cents as "differenceCents",
      total_transactions as "totalTransactions",
      total_matched as "totalMatched", auto_matched as "autoMatched",
      manual_matched as "manualMatched", total_unmatched as "totalUnmatched",
      total_suggested as "totalSuggested",
      created_at as "createdAt", updated_at as "updatedAt",
      completed_at as "completedAt"
    FROM bank_recon_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}`);
  },

  async listSessions(
    userId: string,
    filters?: { accountId?: string; status?: string },
  ): Promise<BankReconSession[]> {
    let query = sql`SELECT
      id, user_id as "userId", account_id as "accountId",
      period_start as "periodStart", period_end as "periodEnd", status,
      statement_balance_cents as "statementBalanceCents",
      ledger_balance_cents as "ledgerBalanceCents",
      difference_cents as "differenceCents",
      total_transactions as "totalTransactions",
      total_matched as "totalMatched", auto_matched as "autoMatched",
      manual_matched as "manualMatched", total_unmatched as "totalUnmatched",
      total_suggested as "totalSuggested",
      created_at as "createdAt", updated_at as "updatedAt",
      completed_at as "completedAt"
    FROM bank_recon_sessions WHERE user_id = ${userId}`;

    if (filters?.accountId) {
      query = sql`${query} AND account_id = ${filters.accountId}`;
    }
    if (filters?.status) {
      query = sql`${query} AND status = ${filters.status}`;
    }
    query = sql`${query} ORDER BY created_at DESC`;

    return db.all(query) as Promise<BankReconSession[]>;
  },

  async updateSession(
    sessionId: string,
    userId: string,
    updates: Partial<BankReconSession>,
  ): Promise<void> {
    const now = new Date().toISOString();
    // Build SET clause dynamically
    const setClauses: SQL[] = [];
    if (updates.status !== undefined) setClauses.push(sql`status = ${updates.status}`);
    if (updates.totalMatched !== undefined)
      setClauses.push(sql`total_matched = ${updates.totalMatched}`);
    if (updates.autoMatched !== undefined)
      setClauses.push(sql`auto_matched = ${updates.autoMatched}`);
    if (updates.manualMatched !== undefined)
      setClauses.push(sql`manual_matched = ${updates.manualMatched}`);
    if (updates.totalUnmatched !== undefined)
      setClauses.push(sql`total_unmatched = ${updates.totalUnmatched}`);
    if (updates.totalSuggested !== undefined)
      setClauses.push(sql`total_suggested = ${updates.totalSuggested}`);
    if (updates.completedAt !== undefined)
      setClauses.push(sql`completed_at = ${updates.completedAt}`);
    if (updates.ledgerBalanceCents !== undefined)
      setClauses.push(sql`ledger_balance_cents = ${updates.ledgerBalanceCents}`);
    if (updates.differenceCents !== undefined)
      setClauses.push(sql`difference_cents = ${updates.differenceCents}`);
    setClauses.push(sql`updated_at = ${now}`);

    if (setClauses.length === 0) return;

    // Join SET clauses with commas using sql.join
    const setFragment = sql.join(setClauses, sql`, `);
    await db.run(
      sql`UPDATE bank_recon_sessions SET ${setFragment} WHERE id = ${sessionId} AND user_id = ${userId}`,
    );
  },

  async insertMatch(match: BankReconMatch): Promise<void> {
    await db.run(sql`INSERT INTO bank_recon_matches (
      id, session_id, bank_transaction_id, ledger_entry_id,
      match_type, match_rule_id, confidence, match_reasons,
      status, confirmed_by, confirmed_at, created_at
    ) VALUES (
      ${match.id}, ${match.sessionId}, ${match.bankTransactionId},
      ${match.ledgerEntryId}, ${match.matchType}, ${match.matchRuleId},
      ${match.confidence}, ${match.matchReasons}, ${match.status},
      ${match.confirmedBy}, ${match.confirmedAt}, ${match.createdAt}
    )`);
  },

  async getMatch(matchId: string): Promise<BankReconMatch | undefined> {
    return db.get(sql`SELECT
      id, session_id as "sessionId", bank_transaction_id as "bankTransactionId",
      ledger_entry_id as "ledgerEntryId", match_type as "matchType",
      match_rule_id as "matchRuleId", confidence,
      match_reasons as "matchReasons", status,
      confirmed_by as "confirmedBy", confirmed_at as "confirmedAt",
      created_at as "createdAt"
    FROM bank_recon_matches WHERE id = ${matchId}`);
  },

  async getMatchesBySession(sessionId: string): Promise<BankReconMatch[]> {
    return db.all(sql`SELECT
      id, session_id as "sessionId", bank_transaction_id as "bankTransactionId",
      ledger_entry_id as "ledgerEntryId", match_type as "matchType",
      match_rule_id as "matchRuleId", confidence,
      match_reasons as "matchReasons", status,
      confirmed_by as "confirmedBy", confirmed_at as "confirmedAt",
      created_at as "createdAt"
    FROM bank_recon_matches WHERE session_id = ${sessionId}
    ORDER BY confidence DESC`) as Promise<BankReconMatch[]>;
  },

  async updateMatch(matchId: string, updates: Partial<BankReconMatch>): Promise<void> {
    const setClauses: SQL[] = [];
    if (updates.status !== undefined) setClauses.push(sql`status = ${updates.status}`);
    if (updates.confirmedBy !== undefined)
      setClauses.push(sql`confirmed_by = ${updates.confirmedBy}`);
    if (updates.confirmedAt !== undefined)
      setClauses.push(sql`confirmed_at = ${updates.confirmedAt}`);
    if (setClauses.length === 0) return;
    const setFragment = sql.join(setClauses, sql`, `);
    await db.run(sql`UPDATE bank_recon_matches SET ${setFragment} WHERE id = ${matchId}`);
  },

  async getMatchedBankTxIds(sessionId: string): Promise<string[]> {
    const rows = (await db.all(sql`SELECT bank_transaction_id as "bankTransactionId"
      FROM bank_recon_matches
      WHERE session_id = ${sessionId} AND status IN ('confirmed', 'pending')`)) as {
      bankTransactionId: string;
    }[];
    return rows.map((r) => r.bankTransactionId);
  },

  async getMatchedLedgerIds(sessionId: string): Promise<string[]> {
    const rows = (await db.all(sql`SELECT ledger_entry_id as "ledgerEntryId"
      FROM bank_recon_matches
      WHERE session_id = ${sessionId} AND status IN ('confirmed', 'pending')`)) as {
      ledgerEntryId: string;
    }[];
    return rows.map((r) => r.ledgerEntryId);
  },

  // Rule queries
  async getRules(userId: string): Promise<BankReconRule[]> {
    return db.all(sql`SELECT
      id, user_id as "userId", name, description,
      match_type as "matchType", match_config as "matchConfig",
      auto_confirm as "autoConfirm", priority,
      is_active as "isActive",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM bank_recon_rules WHERE user_id = ${userId} AND is_active = true
    ORDER BY priority DESC`) as Promise<BankReconRule[]>;
  },

  async getRule(ruleId: string, userId: string): Promise<BankReconRule | undefined> {
    return db.get(sql`SELECT
      id, user_id as "userId", name, description,
      match_type as "matchType", match_config as "matchConfig",
      auto_confirm as "autoConfirm", priority,
      is_active as "isActive",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM bank_recon_rules WHERE id = ${ruleId} AND user_id = ${userId}`);
  },

  async insertRule(rule: BankReconRule): Promise<void> {
    await db.run(sql`INSERT INTO bank_recon_rules (
      id, user_id, name, description, match_type, match_config,
      auto_confirm, priority, is_active, created_at, updated_at
    ) VALUES (
      ${rule.id}, ${rule.userId}, ${rule.name}, ${rule.description},
      ${rule.matchType}, ${rule.matchConfig}, ${rule.autoConfirm},
      ${rule.priority}, ${rule.isActive}, ${rule.createdAt}, ${rule.updatedAt}
    )`);
  },

  async updateRule(ruleId: string, userId: string, updates: Partial<BankReconRule>): Promise<void> {
    const setClauses: SQL[] = [];
    const now = new Date().toISOString();
    if (updates.name !== undefined) setClauses.push(sql`name = ${updates.name}`);
    if (updates.description !== undefined)
      setClauses.push(sql`description = ${updates.description}`);
    if (updates.matchType !== undefined) setClauses.push(sql`match_type = ${updates.matchType}`);
    if (updates.matchConfig !== undefined)
      setClauses.push(sql`match_config = ${updates.matchConfig}`);
    if (updates.autoConfirm !== undefined)
      setClauses.push(sql`auto_confirm = ${updates.autoConfirm}`);
    if (updates.priority !== undefined) setClauses.push(sql`priority = ${updates.priority}`);
    if (updates.isActive !== undefined) setClauses.push(sql`is_active = ${updates.isActive}`);
    setClauses.push(sql`updated_at = ${now}`);
    const setFragment = sql.join(setClauses, sql`, `);
    await db.run(
      sql`UPDATE bank_recon_rules SET ${setFragment} WHERE id = ${ruleId} AND user_id = ${userId}`,
    );
  },

  async countRules(userId: string): Promise<number> {
    const row = (await db.get(
      sql`SELECT COUNT(*) as count FROM bank_recon_rules WHERE user_id = ${userId}`,
    )) as { count: number };
    return row?.count ?? 0;
  },
};

// ============================================================================
// VALID MATCH TYPES
// ============================================================================

const VALID_MATCH_TYPES = [
  'amount_exact',
  'amount_date',
  'reference_number',
  'description_pattern',
  'combined',
] as const;
type MatchType = (typeof VALID_MATCH_TYPES)[number];

// ReDoS prevention: max regex pattern length
const MAX_REGEX_LENGTH = 256;
// Patterns with nested quantifiers that could cause catastrophic backtracking
const NESTED_QUANTIFIER_PATTERN = /(\+|\*|\?|\{)\s*(\+|\*|\?|\{)/;

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class BankReconciliationService {
  // --------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // --------------------------------------------------------------------------

  async startSession(
    userId: string,
    accountId: string,
    periodStart: string,
    periodEnd: string,
    statementBalanceCents?: number,
  ): Promise<BankReconSession> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Count unmatched transactions for the account in date range
    const txRows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd),
        ),
      )
      .all();
    const totalTransactions = txRows.length;

    // Calculate ledger balance from journal entry lines for the account's period
    let ledgerBalanceCents: number | null = null;
    try {
      const balanceRow = (await db.get(sql`
        SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as balance
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.entry_id
        WHERE je.user_id = ${userId}
          AND je.entry_date >= ${periodStart}
          AND je.entry_date <= ${periodEnd}
          AND je.status = 'posted'
      `)) as { balance: number };
      ledgerBalanceCents = balanceRow?.balance ?? 0;
    } catch {
      // Journal entries table may not have data yet
      ledgerBalanceCents = 0;
    }

    const differenceCents =
      statementBalanceCents != null && ledgerBalanceCents != null
        ? statementBalanceCents - ledgerBalanceCents
        : null;

    const session: BankReconSession = {
      id,
      userId,
      accountId,
      periodStart,
      periodEnd,
      status: 'open',
      statementBalanceCents: statementBalanceCents ?? null,
      ledgerBalanceCents,
      differenceCents,
      totalTransactions,
      totalMatched: 0,
      autoMatched: 0,
      manualMatched: 0,
      totalUnmatched: totalTransactions,
      totalSuggested: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    await rawQuery.insertSession(session);
    return session;
  }

  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<(BankReconSession & { matches: BankReconMatch[] }) | null> {
    const session = await rawQuery.getSession(sessionId, userId);
    if (!session) return null;
    const matches = await rawQuery.getMatchesBySession(sessionId);
    return { ...session, matches };
  }

  async listSessions(
    userId: string,
    filters?: { accountId?: string; status?: string },
  ): Promise<BankReconSession[]> {
    return rawQuery.listSessions(userId, filters);
  }

  async completeSession(sessionId: string, userId: string): Promise<BankReconSession | null> {
    const session = await rawQuery.getSession(sessionId, userId);
    if (!session) return null;

    const matches = await rawQuery.getMatchesBySession(sessionId);
    const confirmed = matches.filter((m) => m.status === 'confirmed');
    const pending = matches.filter((m) => m.status === 'pending');

    const totalMatched = confirmed.length;
    const autoCount = confirmed.filter((m) => m.matchType === 'auto').length;
    const manualCount = confirmed.filter((m) => m.matchType === 'manual').length;
    const now = new Date().toISOString();

    await rawQuery.updateSession(sessionId, userId, {
      status: 'completed',
      totalMatched,
      autoMatched: autoCount,
      manualMatched: manualCount,
      totalUnmatched: session.totalTransactions - totalMatched,
      totalSuggested: pending.length,
      completedAt: now,
    });

    return rawQuery.getSession(sessionId, userId) as Promise<BankReconSession>;
  }

  async abandonSession(sessionId: string, userId: string): Promise<void> {
    const session = await rawQuery.getSession(sessionId, userId);
    if (!session) return;

    // Undo all pending matches
    const matches = await rawQuery.getMatchesBySession(sessionId);
    for (const match of matches) {
      if (match.status === 'pending') {
        await rawQuery.updateMatch(match.id, { status: 'undone' });
      }
    }

    await rawQuery.updateSession(sessionId, userId, {
      status: 'abandoned',
    });
  }

  // --------------------------------------------------------------------------
  // AUTO-MATCHING ENGINE
  // --------------------------------------------------------------------------

  async autoMatch(
    sessionId: string,
    userId: string,
  ): Promise<{ matched: number; suggested: number; unmatched: number }> {
    const session = await rawQuery.getSession(sessionId, userId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // 1. Load unmatched bank transactions for the session's account and date range
    const alreadyMatchedBankTxIds = await rawQuery.getMatchedBankTxIds(sessionId);
    const allBankTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, session.accountId),
          gte(transactions.date, session.periodStart),
          lte(transactions.date, session.periodEnd),
        ),
      )
      .all();
    const unmatchedBankTx = allBankTx.filter(
      (tx: typeof transactions.$inferSelect) => !alreadyMatchedBankTxIds.includes(tx.id),
    );

    // 2. Load unmatched ledger entries (journal_entry_lines with journal_entries)
    const alreadyMatchedLedgerIds = await rawQuery.getMatchedLedgerIds(sessionId);
    let allLedgerEntries: LedgerEntryCandidate[] = [];
    try {
      allLedgerEntries = (await db.all(sql`
        SELECT
          jel.id,
          jel.entry_id as "entryId",
          jel.debit,
          jel.credit,
          jel.description,
          je.entry_date as "entryDate",
          je.reference,
          je.description as "journalDescription"
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.entry_id
          AND je.status = 'posted'
      `)) as LedgerEntryCandidate[];
    } catch {
      // If journal tables don't exist or are empty, no ledger entries to match
      allLedgerEntries = [];
    }
    const unmatchedLedger = allLedgerEntries.filter(
      (le) => !alreadyMatchedLedgerIds.includes(le.id),
    );

    // 3. Load active match rules
    const rules = await rawQuery.getRules(userId);
    // If no rules exist, seed defaults
    if (rules.length === 0) {
      await this.seedDefaultRules(userId);
      const seeded = await rawQuery.getRules(userId);
      rules.push(...seeded);
    }

    // Sort rules by priority descending
    rules.sort((a, b) => b.priority - a.priority);

    // Track results
    let matched = 0;
    let suggested = 0;
    const now = new Date().toISOString();
    const usedLedgerIds = new Set<string>();

    // 4. For each bank transaction, run rules in priority order
    for (const bankTx of unmatchedBankTx) {
      let bestMatch: {
        ledgerEntry: LedgerEntryCandidate;
        confidence: number;
        reasons: string[];
        ruleId: string | null;
      } | null = null;

      for (const rule of rules) {
        const config = this.parseConfig(rule.matchConfig);
        const candidates = unmatchedLedger.filter((le) => !usedLedgerIds.has(le.id));

        for (const ledgerEntry of candidates) {
          const result = this.evaluateRule(
            rule.matchType as MatchType,
            bankTx,
            ledgerEntry,
            config,
          );
          if (result.confidence > 0 && (!bestMatch || result.confidence > bestMatch.confidence)) {
            bestMatch = {
              ledgerEntry,
              confidence: result.confidence,
              reasons: result.reasons,
              ruleId: rule.id,
            };
          }
        }

        // If we found a high-confidence match on this rule, stop checking lower-priority rules
        if (bestMatch && bestMatch.confidence >= 0.95) break;
      }

      if (!bestMatch) continue;

      // 5. Apply confidence thresholds
      const isAutoConfirm = bestMatch.confidence >= 0.95;
      const isSuggestion = bestMatch.confidence >= 0.7;

      if (!isSuggestion) continue; // Skip low-confidence matches

      const matchRecord: BankReconMatch = {
        id: crypto.randomUUID(),
        sessionId,
        bankTransactionId: bankTx.id,
        ledgerEntryId: bestMatch.ledgerEntry.id,
        matchType: isAutoConfirm ? 'auto' : 'suggested',
        matchRuleId: bestMatch.ruleId,
        confidence: Math.round(bestMatch.confidence * 10000) / 10000,
        matchReasons: JSON.stringify(bestMatch.reasons),
        status: isAutoConfirm ? 'confirmed' : 'pending',
        confirmedBy: isAutoConfirm ? 'system' : null,
        confirmedAt: isAutoConfirm ? now : null,
        createdAt: now,
      };

      await rawQuery.insertMatch(matchRecord);
      usedLedgerIds.add(bestMatch.ledgerEntry.id);

      if (isAutoConfirm) {
        matched++;
      } else {
        suggested++;
      }
    }

    const totalUnmatched = session.totalTransactions - (session.totalMatched + matched);

    // 6. Update session stats
    await rawQuery.updateSession(sessionId, userId, {
      autoMatched: session.autoMatched + matched,
      totalMatched: session.totalMatched + matched,
      totalUnmatched: Math.max(0, totalUnmatched),
      totalSuggested: session.totalSuggested + suggested,
    });

    return {
      matched,
      suggested,
      unmatched: Math.max(0, totalUnmatched),
    };
  }

  async suggestMatches(
    sessionId: string,
    bankTransactionId: string,
  ): Promise<Array<{ ledgerEntryId: string; confidence: number; matchReasons: string[] }>> {
    const session = await rawQuery.getSession(sessionId, '');
    // We pass '' for userId since we look up by sessionId; the session was already validated
    if (!session) return [];

    const bankTxRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, bankTransactionId))
      .all();
    const bankTx = bankTxRows[0];
    if (!bankTx) return [];

    const alreadyMatchedLedgerIds = await rawQuery.getMatchedLedgerIds(sessionId);

    let ledgerEntries: LedgerEntryCandidate[] = [];
    try {
      ledgerEntries = (await db.all(sql`
        SELECT
          jel.id,
          jel.entry_id as "entryId",
          jel.debit,
          jel.credit,
          jel.description,
          je.entry_date as "entryDate",
          je.reference,
          je.description as "journalDescription"
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.entry_id
        WHERE je.user_id = ${session.userId}
          AND je.entry_date >= ${session.periodStart}
          AND je.entry_date <= ${session.periodEnd}
          AND je.status = 'posted'
      `)) as LedgerEntryCandidate[];
    } catch {
      return [];
    }

    const unmatched = ledgerEntries.filter((le) => !alreadyMatchedLedgerIds.includes(le.id));

    // Score all unmatched ledger entries using combined scoring
    const defaultWeights = { amount: 0.4, date: 0.3, description: 0.3 };
    const scored: Array<{ ledgerEntryId: string; confidence: number; matchReasons: string[] }> = [];

    for (const le of unmatched) {
      const ledgerAmountCents = (le.debit ?? 0) - (le.credit ?? 0);
      const amountScore = this.scoreAmountMatch(bankTx.amount, ledgerAmountCents, 100);
      const dateScore = this.scoreDateMatch(bankTx.date, le.entryDate, 7);
      const descScore = this.scoreDescriptionMatch(
        bankTx.description ?? '',
        le.reference ?? le.description ?? le.journalDescription ?? '',
      );
      const combined = this.scoreCombined(amountScore, dateScore, descScore, defaultWeights);

      if (combined > 0.1) {
        const reasons: string[] = [];
        if (amountScore > 0.5) reasons.push(`amount_proximity:${amountScore.toFixed(2)}`);
        if (dateScore > 0.5) reasons.push(`date_proximity:${dateScore.toFixed(2)}`);
        if (descScore > 0.3) reasons.push(`description_similarity:${descScore.toFixed(2)}`);

        scored.push({
          ledgerEntryId: le.id,
          confidence: Math.round(combined * 10000) / 10000,
          matchReasons: reasons,
        });
      }
    }

    // Sort by confidence descending, return top 5
    scored.sort((a, b) => b.confidence - a.confidence);
    return scored.slice(0, 5);
  }

  // --------------------------------------------------------------------------
  // MATCH SCORING (private)
  // --------------------------------------------------------------------------

  private scoreAmountMatch(
    bankAmountCents: number,
    ledgerAmountCents: number,
    toleranceCents: number,
  ): number {
    const diff = Math.abs(bankAmountCents - ledgerAmountCents);
    if (diff === 0) return 1.0;
    if (toleranceCents <= 0) return diff === 0 ? 1.0 : 0;
    if (diff >= toleranceCents) return 0;
    return 1.0 - diff / toleranceCents;
  }

  private scoreDateMatch(bankDate: string, ledgerDate: string, windowDays: number): number {
    const bankMs = new Date(bankDate).getTime();
    const ledgerMs = new Date(ledgerDate).getTime();
    if (isNaN(bankMs) || isNaN(ledgerMs)) return 0;
    const diffDays = Math.abs(bankMs - ledgerMs) / (1000 * 60 * 60 * 24);
    if (diffDays === 0) return 1.0;
    if (windowDays <= 0) return diffDays === 0 ? 1.0 : 0;
    if (diffDays >= windowDays) return 0;
    return 1.0 - diffDays / windowDays;
  }

  private scoreDescriptionMatch(bankDescription: string, ledgerReference: string): number {
    const normBank = this.normalizeDescription(bankDescription);
    const normLedger = this.normalizeDescription(ledgerReference);

    if (!normBank || !normLedger) return 0;

    // Bonus for exact substring match
    if (normBank.includes(normLedger) || normLedger.includes(normBank)) {
      return 0.95;
    }

    // Levenshtein-based score
    const maxLen = Math.max(normBank.length, normLedger.length);
    if (maxLen === 0) return 0;
    const distance = this.levenshteinDistance(normBank, normLedger);
    return Math.max(0, 1.0 - distance / maxLen);
  }

  private scoreCombined(
    amountScore: number,
    dateScore: number,
    descriptionScore: number,
    weights: { amount: number; date: number; description: number },
  ): number {
    return (
      amountScore * weights.amount +
      dateScore * weights.date +
      descriptionScore * weights.description
    );
  }

  // --------------------------------------------------------------------------
  // RULE EVALUATION (private)
  // --------------------------------------------------------------------------

  evaluateRule(
    matchType: MatchType,
    bankTx: typeof transactions.$inferSelect,
    ledgerEntry: LedgerEntryCandidate,
    config: Record<string, unknown>,
  ): { confidence: number; reasons: string[] } {
    const ledgerAmountCents = (ledgerEntry.debit ?? 0) - (ledgerEntry.credit ?? 0);
    const reasons: string[] = [];

    switch (matchType) {
      case 'amount_exact': {
        const diff = Math.abs(bankTx.amount - ledgerAmountCents);
        if (diff === 0) {
          reasons.push('exact_amount_match');
          return { confidence: 1.0, reasons };
        }
        return { confidence: 0, reasons };
      }

      case 'amount_date': {
        const windowDays = Number(config.date_window_days ?? 3);
        const amountScore = this.scoreAmountMatch(bankTx.amount, ledgerAmountCents, 0);
        if (amountScore < 1.0) return { confidence: 0, reasons }; // amounts must be exact

        const dateScore = this.scoreDateMatch(bankTx.date, ledgerEntry.entryDate, windowDays);
        if (dateScore <= 0) return { confidence: 0, reasons };

        reasons.push('exact_amount_match', `date_within_${windowDays}_days`);
        // Confidence = date proximity (amount already exact)
        return { confidence: 0.9 + dateScore * 0.1, reasons };
      }

      case 'reference_number': {
        const bankDesc = this.normalizeDescription(bankTx.description ?? '');
        const ledgerRef = this.normalizeDescription(ledgerEntry.reference ?? '');
        if (!bankDesc || !ledgerRef) return { confidence: 0, reasons };

        if (bankDesc.includes(ledgerRef)) {
          reasons.push(`reference_found:${ledgerRef}`);
          return { confidence: 0.9, reasons };
        }
        return { confidence: 0, reasons };
      }

      case 'description_pattern': {
        const pattern = config.pattern as string;
        if (!pattern) return { confidence: 0, reasons };
        try {
          const regex = new RegExp(pattern, 'i');
          const bankDesc = bankTx.description ?? '';
          const ledgerDesc = ledgerEntry.description ?? ledgerEntry.journalDescription ?? '';
          if (regex.test(bankDesc) && regex.test(ledgerDesc)) {
            reasons.push(`pattern_match:${pattern}`);
            // Also check amount proximity for better confidence
            const amtScore = this.scoreAmountMatch(bankTx.amount, ledgerAmountCents, 100);
            return { confidence: 0.7 + amtScore * 0.2, reasons };
          }
        } catch {
          // Invalid regex
        }
        return { confidence: 0, reasons };
      }

      case 'combined': {
        const weights = {
          amount: Number(config.weight_amount ?? 0.4),
          date: Number(config.weight_date ?? 0.3),
          description: Number(config.weight_description ?? 0.3),
        };
        const tolerance = Number(config.amount_tolerance_cents ?? 100);
        const windowDays = Number(config.date_window_days ?? 7);

        const amtScore = this.scoreAmountMatch(bankTx.amount, ledgerAmountCents, tolerance);
        const dateScore = this.scoreDateMatch(bankTx.date, ledgerEntry.entryDate, windowDays);
        const descScore = this.scoreDescriptionMatch(
          bankTx.description ?? '',
          ledgerEntry.reference ?? ledgerEntry.description ?? ledgerEntry.journalDescription ?? '',
        );

        const combined = this.scoreCombined(amtScore, dateScore, descScore, weights);

        if (combined > 0) {
          if (amtScore > 0.5) reasons.push(`amount_proximity:${amtScore.toFixed(2)}`);
          if (dateScore > 0.5) reasons.push(`date_proximity:${dateScore.toFixed(2)}`);
          if (descScore > 0.3) reasons.push(`description_similarity:${descScore.toFixed(2)}`);
        }

        return { confidence: combined, reasons };
      }

      default:
        return { confidence: 0, reasons };
    }
  }

  private parseConfig(configStr: string): Record<string, unknown> {
    try {
      return JSON.parse(configStr);
    } catch {
      return {};
    }
  }

  // --------------------------------------------------------------------------
  // MATCH OPERATIONS
  // --------------------------------------------------------------------------

  async confirmMatch(matchId: string, userId: string): Promise<BankReconMatch | null> {
    const match = await rawQuery.getMatch(matchId);
    if (!match) return null;

    const now = new Date().toISOString();
    await rawQuery.updateMatch(matchId, {
      status: 'confirmed',
      confirmedBy: userId,
      confirmedAt: now,
    });

    // Update session stats
    const session = await rawQuery.getSession(match.sessionId, userId);
    if (session) {
      await rawQuery.updateSession(match.sessionId, userId, {
        totalMatched: session.totalMatched + 1,
        totalUnmatched: Math.max(0, session.totalUnmatched - 1),
        totalSuggested: Math.max(0, session.totalSuggested - (match.status === 'pending' ? 1 : 0)),
      });
    }

    return rawQuery.getMatch(matchId) as Promise<BankReconMatch>;
  }

  async rejectMatch(matchId: string, userId: string): Promise<void> {
    const match = await rawQuery.getMatch(matchId);
    if (!match) return;

    await rawQuery.updateMatch(matchId, { status: 'rejected' });

    // Update session suggested count if it was pending
    if (match.status === 'pending') {
      const session = await rawQuery.getSession(match.sessionId, userId);
      if (session) {
        await rawQuery.updateSession(match.sessionId, userId, {
          totalSuggested: Math.max(0, session.totalSuggested - 1),
        });
      }
    }
  }

  async undoMatch(matchId: string, userId: string): Promise<void> {
    const match = await rawQuery.getMatch(matchId);
    if (!match) return;

    await rawQuery.updateMatch(matchId, {
      status: 'undone',
      confirmedBy: undefined,
      confirmedAt: undefined,
    });

    // Decrement session match counts
    if (match.status === 'confirmed') {
      const session = await rawQuery.getSession(match.sessionId, userId);
      if (session) {
        await rawQuery.updateSession(match.sessionId, userId, {
          totalMatched: Math.max(0, session.totalMatched - 1),
          totalUnmatched: session.totalUnmatched + 1,
        });
      }
    }
  }

  async createManualMatch(
    sessionId: string,
    bankTransactionId: string,
    ledgerEntryId: string,
    userId: string,
  ): Promise<BankReconMatch> {
    const now = new Date().toISOString();

    const match: BankReconMatch = {
      id: crypto.randomUUID(),
      sessionId,
      bankTransactionId,
      ledgerEntryId,
      matchType: 'manual',
      matchRuleId: null,
      confidence: 1.0,
      matchReasons: JSON.stringify(['manual_match']),
      status: 'confirmed',
      confirmedBy: userId,
      confirmedAt: now,
      createdAt: now,
    };

    await rawQuery.insertMatch(match);

    // Update session stats
    const session = await rawQuery.getSession(sessionId, userId);
    if (session) {
      await rawQuery.updateSession(sessionId, userId, {
        totalMatched: session.totalMatched + 1,
        manualMatched: session.manualMatched + 1,
        totalUnmatched: Math.max(0, session.totalUnmatched - 1),
      });
    }

    return match;
  }

  // --------------------------------------------------------------------------
  // RULE MANAGEMENT
  // --------------------------------------------------------------------------

  async getMatchRules(userId: string): Promise<BankReconRule[]> {
    return rawQuery.getRules(userId);
  }

  async createMatchRule(
    userId: string,
    data: {
      name: string;
      description?: string;
      matchType: string;
      matchConfig: object;
      autoConfirm?: boolean;
      priority?: number;
    },
  ): Promise<BankReconRule> {
    // Validate matchType
    if (!VALID_MATCH_TYPES.includes(data.matchType as MatchType)) {
      throw new Error(
        `Invalid matchType: ${data.matchType}. Must be one of: ${VALID_MATCH_TYPES.join(', ')}`,
      );
    }

    // ReDoS prevention for description_pattern rules
    if (data.matchType === 'description_pattern') {
      const config = data.matchConfig as Record<string, unknown>;
      const pattern = config?.pattern as string;
      if (pattern) {
        if (pattern.length > MAX_REGEX_LENGTH) {
          throw new Error(`Regex pattern exceeds maximum length of ${MAX_REGEX_LENGTH} characters`);
        }
        if (NESTED_QUANTIFIER_PATTERN.test(pattern)) {
          throw new Error(
            'Regex pattern contains nested quantifiers which may cause catastrophic backtracking',
          );
        }
        // Validate that the regex compiles
        try {
          new RegExp(pattern);
        } catch (e: unknown) {
          throw new Error(`Invalid regex pattern: ${getErrorMessage(e)}`);
        }
      }
    }

    const now = new Date().toISOString();
    const rule: BankReconRule = {
      id: crypto.randomUUID(),
      userId,
      name: data.name,
      description: data.description ?? null,
      matchType: data.matchType,
      matchConfig: JSON.stringify(data.matchConfig),
      autoConfirm: data.autoConfirm ?? false,
      priority: data.priority ?? 50,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await rawQuery.insertRule(rule);
    return rule;
  }

  async updateMatchRule(
    ruleId: string,
    userId: string,
    updates: Partial<{
      name: string;
      description: string;
      matchType: string;
      matchConfig: object;
      autoConfirm: boolean;
      priority: number;
    }>,
  ): Promise<BankReconRule | null> {
    const existing = await rawQuery.getRule(ruleId, userId);
    if (!existing) return null;

    if (updates.matchType && !VALID_MATCH_TYPES.includes(updates.matchType as MatchType)) {
      throw new Error(`Invalid matchType: ${updates.matchType}`);
    }

    const dbUpdates: Partial<BankReconRule> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.matchType !== undefined) dbUpdates.matchType = updates.matchType;
    if (updates.matchConfig !== undefined)
      dbUpdates.matchConfig = JSON.stringify(updates.matchConfig);
    if (updates.autoConfirm !== undefined) dbUpdates.autoConfirm = updates.autoConfirm;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;

    await rawQuery.updateRule(ruleId, userId, dbUpdates);
    return rawQuery.getRule(ruleId, userId) as Promise<BankReconRule>;
  }

  async deleteMatchRule(ruleId: string, userId: string): Promise<void> {
    await rawQuery.updateRule(ruleId, userId, { isActive: false });
  }

  async seedDefaultRules(userId: string): Promise<void> {
    const existingCount = await rawQuery.countRules(userId);
    if (existingCount > 0) return;

    const now = new Date().toISOString();
    const defaults: BankReconRule[] = [
      {
        id: crypto.randomUUID(),
        userId,
        name: 'Exact Amount Match',
        description: 'Match transactions with identical amounts',
        matchType: 'amount_exact',
        matchConfig: JSON.stringify({}),
        autoConfirm: true,
        priority: 100,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId,
        name: 'Amount + Date Match',
        description: 'Match transactions with same amount within 3-day window',
        matchType: 'amount_date',
        matchConfig: JSON.stringify({ date_window_days: 3 }),
        autoConfirm: false,
        priority: 90,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId,
        name: 'Combined Scoring',
        description: 'Weighted match using amount (40%), date (30%), description (30%)',
        matchType: 'combined',
        matchConfig: JSON.stringify({
          weight_amount: 0.4,
          weight_date: 0.3,
          weight_description: 0.3,
          amount_tolerance_cents: 100,
          date_window_days: 7,
        }),
        autoConfirm: false,
        priority: 50,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const rule of defaults) {
      await rawQuery.insertRule(rule);
    }
  }

  // --------------------------------------------------------------------------
  // HELPER UTILITIES (private)
  // --------------------------------------------------------------------------

  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Use single-row optimization for O(min(m,n)) space
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = new Array(n + 1);
    let curr = new Array(n + 1);

    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1, // insertion
          prev[j] + 1, // deletion
          prev[j - 1] + cost, // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  private normalizeDescription(desc: string): string {
    if (!desc) return '';
    return desc
      .toLowerCase()
      .replace(
        /\b(eftpos|direct debit|direct credit|bpay|osko|pay anyone|transfer|int'l|international)\b/gi,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const bankReconciliationService = new BankReconciliationService();
