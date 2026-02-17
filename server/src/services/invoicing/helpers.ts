/**
 * Invoicing Service — Helpers
 */

import type { CreateLineItemInput } from './types.js';

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Calculate line-level amounts from input */
export function calculateLineAmounts(input: CreateLineItemInput) {
  const gstRate = input.gstRate ?? 0.1;
  const amount = Math.round(input.quantity * input.unitPriceCents);
  const gstAmount = Math.round(amount * gstRate);
  return { amount, gstAmount, gstRate };
}

/** Sum line amounts into invoice-level totals */
export function calculateInvoiceTotals(
  lines: Array<{ amount: number; gstAmount: number }>,
  existingAmountPaid: number = 0,
) {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const gstAmount = lines.reduce((sum, l) => sum + l.gstAmount, 0);
  const totalAmount = subtotal + gstAmount;
  const amountDue = totalAmount - existingAmountPaid;
  return { subtotal, gstAmount, totalAmount, amountDue };
}
