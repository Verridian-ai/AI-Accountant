/**
 * Owner Equity Service — Ledger & Summary Operations
 * Create, confirm, and summarize equity events.
 */

import { db, ownerEquityEvents } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { EquityEventParams, EquitySummary } from './types.js';

/**
 * Create an equity event (contribution or drawing) in the ledger.
 */
export async function createEquityEvent(params: EquityEventParams): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db
    .insert(ownerEquityEvents)
    .values({
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
    })
    .run();

  return id;
}

/**
 * Confirm or reject an equity event.
 */
export async function confirmEquityEvent(eventId: string, confirmed: boolean): Promise<void> {
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
export async function getEquitySummary(
  userId: string,
  financialYear: string,
): Promise<EquitySummary> {
  // Get all confirmed events for this year
  const events = await db
    .select()
    .from(ownerEquityEvents)
    .where(
      and(
        eq(ownerEquityEvents.userId, userId),
        eq(ownerEquityEvents.financialYear, financialYear),
        eq(ownerEquityEvents.confirmed, true),
      ),
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
