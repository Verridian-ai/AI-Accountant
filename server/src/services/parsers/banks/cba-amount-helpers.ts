/**
 * CBA Amount Parsing Helpers
 *
 * Functions to extract debit/credit amounts and balances from CBA statement lines.
 * CBA pdf-parse output produces concatenated amount and balance columns without
 * clear delimiters, requiring specialized parsing.
 */

import { parseAmount } from '../base-parser';

const AMT = '(\\d{1,3}(?:,\\d{3}){0,2}\\.\\d{2})';

/** Try to extract debit amount+balance from a text ending in amount$$balanceCR/DR.
 *  Parses right-to-left: first extract $$balance, then find amount before $$.
 *  Uses lookbehind to prevent matching amounts concatenated with reference numbers.
 *  If lookbehind fails, falls back to extracting just the raw decimal number. */
export function tryDebitAmountBalance(
  text: string,
): { desc: string; amount: number; balance: number } | null {
  // Find $$ separator
  const ddIdx = text.lastIndexOf('$$');
  if (ddIdx < 0) return null;

  // Parse balance after $$
  const afterDD = text.substring(ddIdx + 2);
  const balMatch = afterDD.match(new RegExp(`^${AMT}(CR|DR)\\s*$`));
  if (!balMatch) return null;
  const balance = parseAmount(balMatch[1] + balMatch[2]);
  if (balance === null) return null;

  // Before $$ is "description + amount" — extract amount from end
  const beforeDD = text.substring(0, ddIdx);

  // First try: clean amount with non-digit boundary (best case)
  const cleanAmtMatch = beforeDD.match(/(?<!\d)(\d{1,3}(?:,\d{3}){0,2}\.\d{2})$/);
  if (cleanAmtMatch) {
    const amount = parseAmount(cleanAmtMatch[1]);
    if (amount !== null) {
      const desc = beforeDD.substring(0, beforeDD.length - cleanAmtMatch[0].length);
      return { desc, amount: -Math.abs(amount), balance };
    }
  }

  // Fallback: when reference number is concatenated with amount (e.g., "100015641,372.76")
  // Extract just the last decimal portion as the amount — everything before . that forms
  // a valid amount. Take the shortest valid amount (most conservative).
  const rawMatch = beforeDD.match(/(\d{1,3}\.\d{2})$/);
  if (rawMatch) {
    const amount = parseAmount(rawMatch[1]);
    if (amount !== null) {
      const desc = beforeDD.substring(0, beforeDD.length - rawMatch[0].length);
      return { desc, amount: -Math.abs(amount), balance };
    }
  }

  return null;
}

/** Try to extract credit amount+balance from a text ending in $amount$balanceCR/DR.
 *  Credit format has $ before amount and $ before balance. */
export function tryCreditAmountBalance(
  text: string,
): { desc: string; amount: number; balance: number } | null {
  // Match from the right: $balance(CR|DR) at end
  const balRe = new RegExp(`\\$${AMT}(CR|DR)\\s*$`);
  const balMatch = text.match(balRe);
  if (!balMatch || balMatch.index === undefined) return null;
  const balance = parseAmount(balMatch[1] + balMatch[2]);
  if (balance === null) return null;

  // Before the balance, find $amount
  const beforeBal = text.substring(0, balMatch.index);
  const amtRe = new RegExp(`\\$${AMT}$`);
  const amtMatch = beforeBal.match(amtRe);
  if (!amtMatch) return null;
  const amount = parseAmount(amtMatch[1]);
  if (amount === null) return null;

  const desc = beforeBal.substring(0, beforeBal.length - amtMatch[0].length);
  return { desc, amount: Math.abs(amount), balance };
}

/** Try to extract amount+balance from a line (debit first, then credit) */
export function tryAmountBalance(
  text: string,
): { desc: string; amount: number; balance: number } | null {
  // Check for $$ (debit indicator) first
  if (text.includes('$$')) {
    return tryDebitAmountBalance(text);
  }
  return tryCreditAmountBalance(text);
}
