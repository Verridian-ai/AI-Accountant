/**
 * Owner Equity Service — Type Definitions & Constants
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DetectedEquityEvent {
  transactionId: string;
  amount: number; // cents (always positive)
  date: string;
  sourceAccount: string;
  description: string;
  confidence: number;
}

export interface EquityEventParams {
  userId: string;
  accountId?: string;
  transactionId?: string;
  eventType: 'contribution' | 'drawing';
  amount: number; // cents
  financialYear: string;
  notes?: string;
  detectedBy?: 'ai' | 'manual' | 'rule';
}

export interface EquitySummary {
  financialYear: string;
  totalContributions: number; // cents
  totalDrawings: number; // cents
  netEquityChange: number; // cents
  monthlyBreakdown: Array<{
    month: string; // YYYY-MM
    contributions: number; // cents
    drawings: number; // cents
    net: number; // cents
  }>;
  eventCount: number;
}

/** Minimum transfer amount to flag as potential contribution (cents) */
export const CONTRIBUTION_THRESHOLD_CENTS = 100_000; // $1,000

/** Categories that indicate personal expenses (drawings when from business account) */
export const PERSONAL_EXPENSE_CATEGORIES = [
  'Personal',
  'Groceries',
  'Entertainment',
  'Clothing',
  'Health & Fitness',
  'Hobbies',
  'Gifts',
  'Donations',
  'Personal Care',
];

/** Description patterns that indicate ATM withdrawals */
export const ATM_PATTERNS = [
  /\bATM\b/i,
  /\bCASH\s+W(?:ITH)?D(?:RAWAL)?\b/i,
  /\bWITHDRAW(?:AL)?\b/i,
];
