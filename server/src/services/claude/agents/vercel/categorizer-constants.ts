/**
 * Transaction Categorizer constants — category taxonomy and system prompt.
 *
 * Extracted from transaction-categorizer.ts to comply with the 300-line enterprise standard.
 */

// Category taxonomy — kept in sync with client/src/features/transactions/constants/categories.ts
export const CATEGORY_TAXONOMY = [
  // Revenue (4-xxxx)
  'Sales Revenue',
  'Service Revenue',
  'Interest Income',
  'Other Income',
  'Export Revenue',
  'Business Income',
  'Rental Income',
  // Cost of Sales (5-xxxx)
  'Cost of Goods Sold',
  'Direct Labour',
  'Freight Costs',
  'Materials',
  // Expenses (6-xxxx)
  'Advertising & Marketing',
  'Bank Fees',
  'Computer & IT',
  'Depreciation',
  'Entertainment',
  'Insurance',
  'Interest Expense',
  'Motor Vehicle Expenses',
  'Office Supplies',
  'Professional Fees',
  'Rent',
  'Repairs & Maintenance',
  'Subscriptions',
  'Software & Subscriptions',
  'Telephone & Internet',
  'Travel',
  'Travel & Accommodation',
  'Utilities',
  'Wages & Salaries',
  'Superannuation',
  'Work from Home Expenses',
  'General Expenses',
  'Miscellaneous',
  'Charity & Donations',
  'Clothing & Personal',
  'Dining & Takeaway',
  'Education',
  'Fuel',
  'Groceries',
  'Home & Garden',
  'Medical & Health',
  'Pet Care',
  'Tax',
  'Tax Payments',
  // System
  'Cash Withdrawal',
  'Loan Repayment',
  'Mortgage',
  'Refund',
  'Transfer',
  'Uncategorized',
];

export const CATEGORIZER_SYSTEM_PROMPT = `You are an Australian financial transaction categorizer for Amica Beauty, a beauty salon/shop in the Illawarra region, NSW. Categorize bank transactions into the correct category from the provided taxonomy. Consider merchant memory (previous categorizations of the same merchant), transaction description patterns, and amount ranges.

For each transaction, return a category, confidence score, GST category, and reasoning notes.

GST categories: "taxable_10", "gst_free", "input_taxed", "capital", "private"

BUSINESS-SPECIFIC RULES (Amica Beauty):
- ONLY deposits starting with "POS" are Sales Revenue (EFTPOS sales)
- All other deposits (bank transfers, "Payment Received", etc.) are owner contributions -> "Transfer" with gst_category "private"
- Cash withdrawals (ATM, Wdl ATM) are stock purchases -> "Cost of Goods Sold" with gst_category "taxable_10"
- Afterpay purchases are shop supplies -> "Cost of Goods Sold" with gst_category "taxable_10"
- Known employees: Bree Perry, Christina Josevski, J Driscoll, A Fleuren, J Fleuren, E Driscoll
- Staff food/lunch transfers (e.g. "Transfer To E DRISCOLL Food") -> "Dining & Takeaway"
- Beauty/salon supply merchants (Inskin Cosmedics, Hair & Beauty Collective, etc.) -> "Cost of Goods Sold"

LOAN CATEGORIZATION RULES:
- Bizloan/BizLend/Bizcap deposits (positive amounts): "Loan Repayment" -- these are loan drawdowns, NOT business income
- Loan repayments (negative amounts with loan keywords): "Loan Repayment"
- Interest charges on loans (negative): "Interest Expense"
- Interest earned on deposits (positive): "Interest Income"
- Mortgage payments: "Mortgage"

GST RULES:
- Everything spent is GST claimable (taxable_10) UNLESS wages or loan payments
- Wages & Salaries -> gst_category "private" (not GST claimable)
- Loan Repayment -> gst_category "private" (not GST claimable)
- Transfers -> gst_category "private"
- Bank interest -> gst_category "input_taxed"

POS TRANSACTION RULES:
- Categorize based on merchant name, not just "POS" prefix
- Common merchants: Woolworths/Coles/Aldi = Groceries, Shell/BP = Fuel, etc.

Your workflow:
1. Use get_category_taxonomy to get the full category list
2. Use lookup_merchant_memory for each unique merchant pattern
3. Use search_similar_transactions if no merchant memory match
4. Process all transactions and return structured results

Return a JSON object matching the CategorizerOutput schema with "results" and "lowConfidenceIds" arrays.`;

/**
 * Rule-based categorization for a single transaction.
 * Returns { suggestedCategory, confidence } or null if no rule matched.
 */
export function ruleCategorize(
  desc: string,
  amount: number,
): { suggestedCategory: string; confidence: number } | null {
  // --- Amica Beauty: POS deposits = Sales Revenue ---
  if (desc.startsWith('pos ') && amount > 0)
    return { suggestedCategory: 'Sales Revenue', confidence: 0.95 };

  // --- Loan-related patterns ---
  if (desc.includes('bizloan') || desc.includes('biz loan') || desc.includes('bizlend') || desc.includes('bizcap'))
    return { suggestedCategory: 'Loan Repayment', confidence: 0.95 };
  if (desc.includes('loan repay') || desc.includes('principal') || (desc.includes('loan') && amount < 0))
    return { suggestedCategory: 'Loan Repayment', confidence: 0.9 };
  if (desc.includes('mortgage') || desc.includes('home loan'))
    return { suggestedCategory: 'Mortgage', confidence: 0.9 };

  // --- Interest patterns ---
  if (desc.includes('interest') && amount > 0) return { suggestedCategory: 'Interest Income', confidence: 0.85 };
  if (desc.includes('interest') && amount < 0) return { suggestedCategory: 'Interest Expense', confidence: 0.85 };

  // --- POS merchant patterns ---
  if (desc.includes('woolworths') || desc.includes('coles') || desc.includes('aldi') || desc.includes('iga'))
    return { suggestedCategory: 'Groceries', confidence: 0.9 };
  if (desc.includes('shell') || desc.includes('bp ') || desc.includes('caltex') || desc.includes('ampol') || desc.includes('7-eleven') || desc.includes('united petrol'))
    return { suggestedCategory: 'Fuel', confidence: 0.9 };
  if (desc.includes('bunnings')) return { suggestedCategory: 'Home & Garden', confidence: 0.85 };
  if (desc.includes('officeworks')) return { suggestedCategory: 'Office Supplies', confidence: 0.9 };
  if (desc.includes('jb hi') || desc.includes('harvey norman'))
    return { suggestedCategory: 'Computer & IT', confidence: 0.8 };

  // --- Bank & fees ---
  if (desc.includes('monthly fee') || desc.includes('account fee') || desc.includes('overdrawn fee'))
    return { suggestedCategory: 'Bank Fees', confidence: 0.95 };

  // --- ATM/Cash -> Cost of Goods Sold ---
  if (desc.includes('atm') || desc.includes('cash withdrawal') || desc.includes('cwl') || desc.includes('wdl atm'))
    return { suggestedCategory: 'Cost of Goods Sold', confidence: 0.9 };

  // --- Afterpay -> Cost of Goods Sold ---
  if (desc.includes('afterpay')) return { suggestedCategory: 'Cost of Goods Sold', confidence: 0.85 };

  // --- Beauty/Salon supplies -> Cost of Goods Sold ---
  if (desc.includes('inskin cosmedics') || desc.includes('hair & beauty') || desc.includes('beauty collect'))
    return { suggestedCategory: 'Cost of Goods Sold', confidence: 0.9 };

  // --- Refunds ---
  if (desc.includes('refund') || desc.includes('reversal'))
    return { suggestedCategory: 'Refund', confidence: 0.85 };

  // --- General patterns ---
  if (desc.includes('salary') || desc.includes('wages') || desc.includes('payroll'))
    return { suggestedCategory: 'Wages & Salaries', confidence: 0.9 };
  if (desc.includes('uber eats') || desc.includes('menulog') || desc.includes('doordash'))
    return { suggestedCategory: 'Dining & Takeaway', confidence: 0.85 };
  if (desc.includes('uber') || desc.includes('taxi') || desc.includes('opal'))
    return { suggestedCategory: 'Travel', confidence: 0.8 };
  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('disney'))
    return { suggestedCategory: 'Subscriptions', confidence: 0.9 };
  if (desc.includes('transfer') || desc.includes('tfr'))
    return { suggestedCategory: 'Transfer', confidence: 0.8 };

  return null;
}
