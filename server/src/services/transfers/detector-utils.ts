/**
 * Inter-Account Transfer Detection — Utility Functions
 *
 * Standalone convenience functions for transfer detection,
 * filtering, and report generation.
 */

import { TransferDetector } from './detector.js';
import type { TransferCandidate, AccountContext, TransferMatch } from './detector-types.js';

/**
 * Convenience function for quick transfer detection
 */
export function detectTransfers(
  transactions: TransferCandidate[],
  accounts: AccountContext[],
  existingLinks?: Array<{ sourceId: number; targetId: number }>,
): TransferMatch[] {
  const detector = new TransferDetector();
  return detector.detectTransfers(transactions, accounts, existingLinks);
}

/**
 * Filter out transfer transactions from a list
 */
export function excludeTransfers(
  transactions: TransferCandidate[],
  transferMatches: TransferMatch[],
): TransferCandidate[] {
  const transferIds = new Set<number>();
  for (const match of transferMatches) {
    transferIds.add(match.sourceTransaction.id);
    transferIds.add(match.targetTransaction.id);
  }
  return transactions.filter((tx) => !transferIds.has(tx.id));
}

/**
 * Generate transfer report for display
 */
export function generateTransferReport(matches: TransferMatch[]): string {
  const lines: string[] = [];

  lines.push('=== Inter-Account Transfer Detection Report ===');
  lines.push(`Total Matches: ${matches.length}`);
  lines.push('');

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    lines.push(`Transfer ${i + 1}:`);
    lines.push(`  From: ${match.sourceTransaction.description}`);
    lines.push(`  Amount: $${(Math.abs(match.sourceTransaction.amount) / 100).toFixed(2)}`);
    lines.push(`  To: ${match.targetTransaction.description}`);
    lines.push(`  Confidence: ${(match.confidence * 100).toFixed(0)}%`);
    lines.push(`  Reasons: ${match.matchReasons.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
