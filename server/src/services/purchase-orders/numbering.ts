/**
 * PO Number Generation — Sequential numbering for purchase orders.
 *
 * Format: PO-NNNNNN (zero-padded 6 digits, sequential per user).
 */

import { db, purchaseOrders } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Generate the next PO number for a user.
 * Format: PO-NNNNNN (zero-padded 6 digits, sequential).
 */
export async function getNextPONumber(userId: string): Promise<string> {
  const result = await db
    .select({ maxPO: sql<string>`MAX(${purchaseOrders.poNumber})` })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.userId, userId))
    .get();

  const maxPO = result?.maxPO;
  let nextNum = 1;

  if (maxPO) {
    // Parse "PO-000042" -> 42, then increment
    const match = maxPO.match(/PO-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `PO-${String(nextNum).padStart(6, '0')}`;
}
