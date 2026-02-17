/**
 * Bank reconciliation rule management — self-contained implementation.
 * Uses rawQuery from data-access for database operations.
 */
import crypto from 'crypto';
import type { BankReconRule, MatchType } from './types.js';
import { VALID_MATCH_TYPES, MAX_REGEX_LENGTH, NESTED_QUANTIFIER_PATTERN } from './types.js';
import { rawQuery } from './data-access.js';
import { getErrorMessage } from '../../utils/error.js';

export async function getMatchRules(userId: string): Promise<BankReconRule[]> {
  return rawQuery.getRules(userId);
}

export async function createMatchRule(
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

export async function deleteMatchRule(ruleId: string, userId: string): Promise<void> {
  await rawQuery.updateRule(ruleId, userId, { isActive: false });
}

export async function seedDefaultRules(userId: string): Promise<void> {
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
