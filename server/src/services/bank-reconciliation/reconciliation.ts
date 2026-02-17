/**
 * Bank Reconciliation — Orchestrator Class
 *
 * Main BankReconciliationService class that composes session management,
 * auto-matching, match operations, and rule management into a single facade.
 */

import { transactions } from '../../schema.js';
import type {
  BankReconSession,
  BankReconMatch,
  BankReconRule,
  LedgerEntryCandidate,
  MatchType,
} from './types.js';
import { evaluateRule } from './matching.js';
import { suggestMatches } from './suggestions.js';
import {
  startSession,
  getSession,
  listSessions,
  completeSession,
  abandonSession,
} from './balance-check.js';
import {
  confirmMatch,
  rejectMatch,
  undoMatch,
  createManualMatch,
} from './match-operations.js';
import {
  getMatchRules,
  createMatchRule,
  updateMatchRule,
  deleteMatchRule,
  seedDefaultRules,
} from './rules.js';
import { runAutoMatch } from './auto-match.js';

export class BankReconciliationService {
  // -- Session Management (delegates to balance-check module) --

  async startSession(
    userId: string, accountId: string, periodStart: string, periodEnd: string,
    statementBalanceCents?: number,
  ): Promise<BankReconSession> {
    return startSession(userId, accountId, periodStart, periodEnd, statementBalanceCents);
  }

  async getSession(
    sessionId: string, userId: string,
  ): Promise<(BankReconSession & { matches: BankReconMatch[] }) | null> {
    return getSession(sessionId, userId);
  }

  async listSessions(
    userId: string, filters?: { accountId?: string; status?: string },
  ): Promise<BankReconSession[]> {
    return listSessions(userId, filters);
  }

  async completeSession(sessionId: string, userId: string): Promise<BankReconSession | null> {
    return completeSession(sessionId, userId);
  }

  async abandonSession(sessionId: string, userId: string): Promise<void> {
    return abandonSession(sessionId, userId);
  }

  // -- Auto-Matching Engine (delegates to auto-match module) --

  async autoMatch(
    sessionId: string, userId: string,
  ): Promise<{ matched: number; suggested: number; unmatched: number }> {
    return runAutoMatch(sessionId, userId);
  }

  async suggestMatches(
    sessionId: string, bankTransactionId: string,
  ): Promise<Array<{ ledgerEntryId: string; confidence: number; matchReasons: string[] }>> {
    return suggestMatches(sessionId, bankTransactionId);
  }

  // -- Match Operations (delegates to match-operations module) --

  async confirmMatch(matchId: string, userId: string): Promise<BankReconMatch | null> {
    return confirmMatch(matchId, userId);
  }

  async rejectMatch(matchId: string, userId: string): Promise<void> {
    return rejectMatch(matchId, userId);
  }

  async undoMatch(matchId: string, userId: string): Promise<void> {
    return undoMatch(matchId, userId);
  }

  async createManualMatch(
    sessionId: string, bankTransactionId: string, ledgerEntryId: string, userId: string,
  ): Promise<BankReconMatch> {
    return createManualMatch(sessionId, bankTransactionId, ledgerEntryId, userId);
  }

  // -- Rule Management (delegates to rules module) --

  evaluateRule(
    matchType: MatchType,
    bankTx: typeof transactions.$inferSelect,
    ledgerEntry: LedgerEntryCandidate,
    config: Record<string, unknown>,
  ): { confidence: number; reasons: string[] } {
    return evaluateRule(matchType, bankTx, ledgerEntry, config);
  }

  async getMatchRules(userId: string): Promise<BankReconRule[]> {
    return getMatchRules(userId);
  }

  async createMatchRule(
    userId: string,
    data: {
      name: string; description?: string; matchType: string;
      matchConfig: object; autoConfirm?: boolean; priority?: number;
    },
  ): Promise<BankReconRule> {
    return createMatchRule(userId, data);
  }

  async updateMatchRule(
    ruleId: string, userId: string,
    updates: Partial<{
      name: string; description: string; matchType: string;
      matchConfig: object; autoConfirm: boolean; priority: number;
    }>,
  ): Promise<BankReconRule | null> {
    return updateMatchRule(ruleId, userId, updates);
  }

  async deleteMatchRule(ruleId: string, userId: string): Promise<void> {
    return deleteMatchRule(ruleId, userId);
  }

  async seedDefaultRules(userId: string): Promise<void> {
    return seedDefaultRules(userId);
  }
}

export const bankReconciliationService = new BankReconciliationService();
