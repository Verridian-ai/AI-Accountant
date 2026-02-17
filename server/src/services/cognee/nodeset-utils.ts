/**
 * F5: NodeSet Tagging Strategy — 3-Dimensional Tagging
 *
 * Every piece of data ingested into Cognee gets tagged with NodeSets across 3 dimensions:
 * 1. Temporal — FY2024-25, Q1-Q4, YYYY-MM
 * 2. Categorical — tax_deductions, gst_applicable, gst_free, income, expenses
 * 3. Account — account_123456
 *
 * Based on docs/COGNEE_INTEGRATION_PLAN.md Section 7.
 */

/**
 * Calculate BAS quarter from date (Australian FY: Jul-Jun)
 * Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
 */
export function getBASQuarter(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 7 && month <= 9) return 'Q1';
  if (month >= 10 && month <= 12) return 'Q2';
  if (month >= 1 && month <= 3) return 'Q3';
  if (month >= 4 && month <= 6) return 'Q4';
  return 'Q1'; // fallback
}

/**
 * Calculate Australian Financial Year from date
 * e.g. 2025-01-15 → FY2024-25
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 7) {
    // Jul-Dec → FY2024-25
    return `FY${year}-${(year + 1).toString().slice(2)}`;
  } else {
    // Jan-Jun → FY2023-24
    return `FY${year - 1}-${year.toString().slice(2)}`;
  }
}

/**
 * Generate temporal NodeSet tags for a date
 * Returns: [FY2024-25, Q3, 2025-01]
 */
export function getTemporalNodeSets(date: Date | string): string[] {
  const d = typeof date === 'string' ? new Date(date) : date;
  const fy = getFinancialYear(d);
  const basQ = getBASQuarter(d);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return [fy, basQ, month];
}

/**
 * Generate categorical NodeSet tags based on transaction properties
 */
export function getCategoricalNodeSets(props: {
  category?: string;
  gstApplicable?: boolean;
  isDebit?: boolean;
  claimType?: string;
}): string[] {
  const tags: string[] = [];

  // Category tag (normalized)
  if (props.category) {
    tags.push(props.category.toLowerCase().replace(/\s+/g, '_'));
  }

  // GST tags
  if (props.gstApplicable) {
    tags.push('gst_applicable');
  } else {
    tags.push('gst_free');
  }

  // Income vs Expense
  if (props.isDebit) {
    tags.push('expenses');
  } else {
    tags.push('income');
  }

  // Tax deduction tags
  if (props.claimType) {
    tags.push('tax_deductions');
    tags.push(props.claimType.toLowerCase().replace(/\s+/g, '_'));
  }

  return tags;
}

/**
 * Generate account NodeSet tag
 */
export function getAccountNodeSet(accountId: number | string): string {
  return `account_${accountId}`;
}

/**
 * Generate complete NodeSet array for a transaction
 *
 * @example
 * ```ts
 * const tags = generateTransactionNodeSets({
 *   date: '2025-01-15',
 *   category: 'Office Supplies',
 *   gstApplicable: true,
 *   isDebit: true,
 *   accountId: 123456,
 *   claimType: 'work-related'
 * });
 * // Returns: ['FY2024-25', 'Q3', '2025-01', 'office_supplies', 'gst_applicable',
 * //           'expenses', 'tax_deductions', 'work-related', 'account_123456']
 * ```
 */
export function generateTransactionNodeSets(props: {
  date: Date | string;
  category?: string;
  gstApplicable?: boolean;
  isDebit?: boolean;
  accountId?: number | string;
  claimType?: string;
}): string[] {
  const temporal = getTemporalNodeSets(props.date);
  const categorical = getCategoricalNodeSets({
    category: props.category,
    gstApplicable: props.gstApplicable,
    isDebit: props.isDebit,
    claimType: props.claimType,
  });
  const account = props.accountId ? [getAccountNodeSet(props.accountId)] : [];

  return [...temporal, ...categorical, ...account];
}

/**
 * Generate NodeSet tags for BAS period data
 */
export function generateBASNodeSets(props: {
  quarter: string; // Q1-Q4
  financialYear: string; // 2024-25
}): string[] {
  return [`FY${props.financialYear}`, props.quarter, 'bas_period'];
}

/**
 * Generate NodeSet tags for merchant data
 */
export function generateMerchantNodeSets(props: {
  category?: string;
  industry?: string;
  gstRegistered?: boolean;
}): string[] {
  const tags: string[] = ['merchant_data'];

  if (props.category) {
    tags.push(props.category.toLowerCase().replace(/\s+/g, '_'));
  }
  if (props.industry) {
    tags.push(`industry_${props.industry.toLowerCase().replace(/\s+/g, '_')}`);
  }
  if (props.gstRegistered) {
    tags.push('gst_registered');
  }

  return tags;
}

/**
 * Generate NodeSet tags for deduction/tax data
 */
export function generateDeductionNodeSets(props: {
  atoCategory: string; // D1-D15
  financialYear: string; // 2024-25
  deductionType?: string;
}): string[] {
  const tags = [
    `FY${props.financialYear}`,
    'tax_deductions',
    props.atoCategory.toLowerCase(),
  ];

  if (props.deductionType) {
    tags.push(props.deductionType.toLowerCase().replace(/\s+/g, '_'));
  }

  return tags;
}
