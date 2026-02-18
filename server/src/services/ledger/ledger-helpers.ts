/**
 * Ledger Helpers — generateEntryNumber and mapCategoryToAccount
 */

import { db, journalEntries } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function generateEntryNumber(userId: string): Promise<string> {
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId));
  const nextNumber = (countResult[0]?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  return `JE-${year}-${String(nextNumber).padStart(5, '0')}`;
}

export function mapCategoryToAccount(category: string | null, type: 'revenue' | 'expense'): string {
  if (!category) return type === 'revenue' ? '4-0400' : '6-2000';
  const categoryLower = category.toLowerCase();
  if (type === 'revenue') {
    if (categoryLower.includes('sale')) return '4-0100';
    if (categoryLower.includes('service')) return '4-0200';
    if (categoryLower.includes('interest')) return '4-0300';
    if (categoryLower.includes('export')) return '4-0500';
    return '4-0400';
  }
  if (categoryLower.includes('advertising') || categoryLower.includes('marketing')) return '6-0100';
  if (categoryLower.includes('bank') || categoryLower.includes('fee')) return '6-0200';
  if (
    categoryLower.includes('computer') ||
    categoryLower.includes('software') ||
    categoryLower.includes('it')
  )
    return '6-0300';
  if (categoryLower.includes('entertainment') || categoryLower.includes('meal')) return '6-0500';
  if (categoryLower.includes('insurance')) return '6-0600';
  if (categoryLower.includes('interest')) return '6-0700';
  if (
    categoryLower.includes('vehicle') ||
    categoryLower.includes('fuel') ||
    categoryLower.includes('car')
  )
    return '6-0800';
  if (categoryLower.includes('office') || categoryLower.includes('stationery')) return '6-0900';
  if (
    categoryLower.includes('professional') ||
    categoryLower.includes('legal') ||
    categoryLower.includes('accounting')
  )
    return '6-1000';
  if (categoryLower.includes('rent') || categoryLower.includes('lease')) return '6-1100';
  if (categoryLower.includes('repair') || categoryLower.includes('maintenance')) return '6-1200';
  if (categoryLower.includes('subscription')) return '6-1300';
  if (
    categoryLower.includes('phone') ||
    categoryLower.includes('internet') ||
    categoryLower.includes('telecom')
  )
    return '6-1400';
  if (
    categoryLower.includes('travel') ||
    categoryLower.includes('flight') ||
    categoryLower.includes('accommodation')
  )
    return '6-1500';
  if (
    categoryLower.includes('utility') ||
    categoryLower.includes('electric') ||
    categoryLower.includes('gas') ||
    categoryLower.includes('water')
  )
    return '6-1600';
  if (
    categoryLower.includes('wage') ||
    categoryLower.includes('salary') ||
    categoryLower.includes('payroll')
  )
    return '6-1700';
  if (categoryLower.includes('super')) return '6-1800';
  if (categoryLower.includes('wfh') || categoryLower.includes('home office')) return '6-1900';
  return '6-2000';
}
