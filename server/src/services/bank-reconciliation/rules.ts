/**
 * Bank reconciliation rule management — delegates to parent service.
 */
import { BankReconciliationService } from '../bank-reconciliation.js';

const _svc = new BankReconciliationService();

export async function getMatchRules(userId: string) {
  return _svc.getMatchRules(userId);
}

export async function createMatchRule(
  userId: string,
  rule: {
    name: string;
    description?: string;
    matchType: string;
    matchConfig: object;
    autoConfirm?: boolean;
    priority?: number;
  },
) {
  return _svc.createMatchRule(userId, rule);
}

export async function updateMatchRule(
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
) {
  return _svc.updateMatchRule(ruleId, userId, updates);
}

export async function deleteMatchRule(ruleId: string, userId: string) {
  return _svc.deleteMatchRule(ruleId, userId);
}

export async function seedDefaultRules(userId: string) {
  return _svc.seedDefaultRules(userId);
}
