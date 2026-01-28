/**
 * Category constants aligned with server's chart of accounts
 * @see server/src/services/ledger.ts - STANDARD_CHART_OF_ACCOUNTS and mapCategoryToAccount
 */

export interface CategoryDefinition {
  name: string;
  accountCode: string;
  type: 'revenue' | 'expense' | 'cogs' | 'system';
  taxCode: 'GST' | 'FRE' | 'N-T' | 'EXP';
  keywords: string[];
}

/**
 * All categories aligned with server's STANDARD_CHART_OF_ACCOUNTS
 * and mapCategoryToAccount function
 */
export const CATEGORIES: CategoryDefinition[] = [
  // Revenue (4-xxxx)
  {
    name: 'Sales Revenue',
    accountCode: '4-0100',
    type: 'revenue',
    taxCode: 'GST',
    keywords: ['sale', 'sales'],
  },
  {
    name: 'Service Revenue',
    accountCode: '4-0200',
    type: 'revenue',
    taxCode: 'GST',
    keywords: ['service'],
  },
  {
    name: 'Interest Income',
    accountCode: '4-0300',
    type: 'revenue',
    taxCode: 'FRE',
    keywords: ['interest'],
  },
  {
    name: 'Other Income',
    accountCode: '4-0400',
    type: 'revenue',
    taxCode: 'GST',
    keywords: ['other', 'income'],
  },
  {
    name: 'Export Revenue',
    accountCode: '4-0500',
    type: 'revenue',
    taxCode: 'EXP',
    keywords: ['export'],
  },

  // Cost of Sales (5-xxxx)
  {
    name: 'Cost of Goods Sold',
    accountCode: '5-0100',
    type: 'cogs',
    taxCode: 'GST',
    keywords: ['cogs', 'cost of goods'],
  },
  {
    name: 'Direct Labour',
    accountCode: '5-0200',
    type: 'cogs',
    taxCode: 'N-T',
    keywords: ['direct labour', 'labor'],
  },
  {
    name: 'Freight Costs',
    accountCode: '5-0300',
    type: 'cogs',
    taxCode: 'GST',
    keywords: ['freight', 'shipping'],
  },

  // Expenses (6-xxxx)
  {
    name: 'Advertising & Marketing',
    accountCode: '6-0100',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['advertising', 'marketing'],
  },
  {
    name: 'Bank Fees',
    accountCode: '6-0200',
    type: 'expense',
    taxCode: 'FRE',
    keywords: ['bank', 'fee'],
  },
  {
    name: 'Computer & IT',
    accountCode: '6-0300',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['computer', 'software', 'it'],
  },
  {
    name: 'Depreciation',
    accountCode: '6-0400',
    type: 'expense',
    taxCode: 'N-T',
    keywords: ['depreciation'],
  },
  {
    name: 'Entertainment',
    accountCode: '6-0500',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['entertainment', 'meal'],
  },
  {
    name: 'Insurance',
    accountCode: '6-0600',
    type: 'expense',
    taxCode: 'FRE',
    keywords: ['insurance'],
  },
  {
    name: 'Interest Expense',
    accountCode: '6-0700',
    type: 'expense',
    taxCode: 'FRE',
    keywords: ['interest'],
  },
  {
    name: 'Motor Vehicle Expenses',
    accountCode: '6-0800',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['vehicle', 'fuel', 'car'],
  },
  {
    name: 'Office Supplies',
    accountCode: '6-0900',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['office', 'stationery'],
  },
  {
    name: 'Professional Fees',
    accountCode: '6-1000',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['professional', 'legal', 'accounting'],
  },
  {
    name: 'Rent',
    accountCode: '6-1100',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['rent', 'lease'],
  },
  {
    name: 'Repairs & Maintenance',
    accountCode: '6-1200',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['repair', 'maintenance'],
  },
  {
    name: 'Subscriptions',
    accountCode: '6-1300',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['subscription'],
  },
  {
    name: 'Telephone & Internet',
    accountCode: '6-1400',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['phone', 'internet', 'telecom'],
  },
  {
    name: 'Travel',
    accountCode: '6-1500',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['travel', 'flight', 'accommodation'],
  },
  {
    name: 'Utilities',
    accountCode: '6-1600',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['utility', 'electric', 'gas', 'water'],
  },
  {
    name: 'Wages & Salaries',
    accountCode: '6-1700',
    type: 'expense',
    taxCode: 'N-T',
    keywords: ['wage', 'salary', 'payroll'],
  },
  {
    name: 'Superannuation',
    accountCode: '6-1800',
    type: 'expense',
    taxCode: 'N-T',
    keywords: ['super', 'superannuation'],
  },
  {
    name: 'Work from Home Expenses',
    accountCode: '6-1900',
    type: 'expense',
    taxCode: 'N-T',
    keywords: ['wfh', 'home office'],
  },
  {
    name: 'Miscellaneous',
    accountCode: '6-2000',
    type: 'expense',
    taxCode: 'GST',
    keywords: ['miscellaneous', 'misc', 'other'],
  },

  // System
  {
    name: 'Uncategorized',
    accountCode: '',
    type: 'system',
    taxCode: 'GST',
    keywords: [],
  },
];

/**
 * Category names sorted alphabetically for dropdowns,
 * with 'Uncategorized' at the end
 */
export const CATEGORY_NAMES: string[] = [
  ...CATEGORIES
    .filter((c) => c.type !== 'system')
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b)),
  'Uncategorized',
];

/**
 * Find a category by its name
 */
export function getCategoryByName(name: string): CategoryDefinition | undefined {
  return CATEGORIES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Find a category by its account code
 */
export function getCategoryByAccountCode(code: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.accountCode === code);
}
