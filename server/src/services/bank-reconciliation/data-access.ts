/**
 * Bank Reconciliation — Data Access Layer
 *
 * Raw SQL query helpers for the bank reconciliation service. Uses raw SQL
 * because the schema tables (bankReconSessions, bankReconMatches,
 * bankReconRules) may not exist yet.
 */

import { db } from '../../schema.js';
import { sql, type SQL } from 'drizzle-orm';
import type { BankReconSession, BankReconMatch, BankReconRule } from './types.js';

// ============================================================================
// RAW SQL QUERY HELPERS
// ============================================================================

// We use raw SQL via db for the recon tables since schema definitions
// may not exist yet. These helpers build queries against expected table names.
export const rawQuery = {
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
