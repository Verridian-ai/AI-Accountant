/**
 * Vercel AI SDK — Categorizer Validator
 *
 * Post-categorization validation and legacy reconciliation utilities.
 */

import type { CategorizerOutput } from '../../../types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCategorization(output: CategorizerOutput): ValidationResult {
  const errors: string[] = [];

  for (const result of output.results) {
    if (result.confidence < 0 || result.confidence > 1) {
      errors.push(
        `Transaction ${result.transactionId}: confidence ${result.confidence} out of range [0,1]`,
      );
    }
    if (!result.category) {
      errors.push(`Transaction ${result.transactionId}: missing category`);
    }
    if (!result.gstCategory) {
      errors.push(`Transaction ${result.transactionId}: missing gstCategory`);
    }
  }

  // Check for duplicate transaction IDs
  const ids = output.results.map((r) => r.transactionId);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    errors.push('Duplicate transaction IDs in output');
  }

  return { valid: errors.length === 0, errors };
}

export interface ComparisonResult {
  matches: number;
  mismatches: number;
  details: Array<{ transactionId: number; vercelCategory: string; legacyCategory: string }>;
}

export function reconcileWithLegacy(
  vercelOutput: CategorizerOutput,
  legacyOutput: CategorizerOutput,
): ComparisonResult {
  let matches = 0;
  let mismatches = 0;
  const details: ComparisonResult['details'] = [];

  for (const vr of vercelOutput.results) {
    const lr = legacyOutput.results.find((r) => r.transactionId === vr.transactionId);
    if (!lr) continue;
    if (vr.category === lr.category) {
      matches++;
    } else {
      mismatches++;
      details.push({
        transactionId: vr.transactionId,
        vercelCategory: vr.category,
        legacyCategory: lr.category,
      });
    }
  }

  return { matches, mismatches, details };
}
