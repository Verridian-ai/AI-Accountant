/**
 * Financial Boost Types and Constants
 *
 * Type definitions and configuration for the financial domain boost scoring module.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FinancialBoostConfig {
  /** Score boost for merchant name match (0-1) */
  merchantMatchBoost: number;
  /** Score boost for category match (0-1) */
  categoryMatchBoost: number;
  /** Maximum recency boost (0-1) */
  maxRecencyBoost: number;
  /** Days threshold for full recency boost */
  recencyFullBoostDays: number;
  /** Days threshold where recency boost drops to zero */
  recencyZeroBoostDays: number;
  /** Score boost for amount range match (0-1) */
  amountRangeBoost: number;
  /** Score boost for account match (0-1) */
  accountMatchBoost: number;
  /** Weight for combining boosted score with original score (0-1) */
  boostWeight: number;
}

export interface FinancialContext {
  /** Merchant names/patterns mentioned in query */
  queryMerchants?: string[];
  /** Categories mentioned in query */
  queryCategories?: string[];
  /** Date of query (for recency calculation) */
  queryDate?: Date;
  /** Amount range mentioned in query */
  queryAmountRange?: {
    min?: number;
    max?: number;
  };
  /** Account IDs mentioned in query */
  queryAccountIds?: string[];
  /** Keywords extracted from query */
  queryKeywords?: string[];
}

export interface DocumentFinancialMetadata {
  /** Normalized merchant name */
  merchantNormalized?: string;
  /** Transaction category */
  category?: string;
  /** Transaction date or date range */
  dateStart?: string;
  dateEnd?: string;
  /** Transaction amount in cents */
  amount?: number;
  /** Total amount for grouped transactions */
  totalAmount?: number;
  /** Account ID */
  accountId?: string;
  /** Number of transactions in chunk */
  transactionCount?: number;
}

export interface BoostInput {
  /** Document identifier */
  id: string;
  /** Current score (before boosting) */
  score: number;
  /** Financial metadata for boost calculation */
  financialMetadata?: DocumentFinancialMetadata;
}

export interface BoostOutput {
  /** Document identifier */
  id: string;
  /** Original score */
  originalScore: number;
  /** Score after boosting */
  boostedScore: number;
  /** Total boost applied */
  totalBoost: number;
  /** Breakdown of individual boosts */
  boostBreakdown: BoostBreakdown;
}

export interface BoostBreakdown {
  merchantBoost: number;
  categoryBoost: number;
  recencyBoost: number;
  amountBoost: number;
  accountBoost: number;
}

export interface FinancialBoostResult {
  /** Documents with boosted scores */
  results: BoostOutput[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Context that was used for boosting */
  contextUsed: FinancialContext;
  /** Statistics about boosts applied */
  stats: BoostStats;
}

export interface BoostStats {
  /** Number of documents boosted */
  documentsBosted: number;
  /** Average boost applied */
  averageBoost: number;
  /** Maximum boost applied */
  maxBoost: number;
  /** Boost distribution by type */
  boostsByType: {
    merchant: number;
    category: number;
    recency: number;
    amount: number;
    account: number;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_FINANCIAL_BOOST_CONFIG: FinancialBoostConfig = {
  merchantMatchBoost: 0.3,
  categoryMatchBoost: 0.2,
  maxRecencyBoost: 0.2,
  recencyFullBoostDays: 30,
  recencyZeroBoostDays: 365,
  amountRangeBoost: 0.15,
  accountMatchBoost: 0.15,
  boostWeight: 0.5, // 50% original score, 50% boosted
};

// ============================================================================
// STOP WORDS
// ============================================================================

export const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'must',
  'shall',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'what',
  'which',
  'who',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'show',
  'me',
  'find',
  'get',
  'list',
  'give',
  'tell',
  'display',
  'see',
  'look',
  'search',
  'query',
]);

// ============================================================================
// CATEGORY KEYWORDS
// ============================================================================

export const CATEGORY_KEYWORDS = [
  'groceries',
  'food',
  'dining',
  'restaurant',
  'cafe',
  'transport',
  'uber',
  'taxi',
  'fuel',
  'petrol',
  'gas',
  'utilities',
  'electricity',
  'water',
  'internet',
  'phone',
  'entertainment',
  'subscription',
  'streaming',
  'shopping',
  'retail',
  'clothing',
  'electronics',
  'health',
  'medical',
  'pharmacy',
  'doctor',
  'insurance',
  'rent',
  'mortgage',
  'travel',
  'hotel',
  'flight',
  'accommodation',
  'office',
  'supplies',
  'equipment',
  'professional',
  'fees',
  'services',
  'income',
  'salary',
  'wages',
  'transfer',
];
