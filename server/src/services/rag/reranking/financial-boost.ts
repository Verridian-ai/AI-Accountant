/**
 * Financial Domain Boost Scoring Module
 *
 * Applies domain-specific score adjustments for financial transaction retrieval.
 * Boosts scores based on merchant matches, category relevance, and recency.
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
// FINANCIAL BOOSTER CLASS
// ============================================================================

export class FinancialBooster {
  private config: FinancialBoostConfig;

  constructor(config?: Partial<FinancialBoostConfig>) {
    this.config = { ...DEFAULT_FINANCIAL_BOOST_CONFIG, ...config };
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Apply financial domain boosts to document scores
   */
  applyBoosts(documents: BoostInput[], context: FinancialContext): FinancialBoostResult {
    const startTime = Date.now();

    if (documents.length === 0) {
      return {
        results: [],
        processingTimeMs: 0,
        contextUsed: context,
        stats: this.emptyStats(),
      };
    }

    const results: BoostOutput[] = documents.map((doc) => {
      const breakdown = this.calculateBoosts(doc, context);
      const totalBoost = this.sumBoosts(breakdown);
      const boostedScore = this.combineScores(doc.score, totalBoost);

      return {
        id: doc.id,
        originalScore: doc.score,
        boostedScore,
        totalBoost,
        boostBreakdown: breakdown,
      };
    });

    // Sort by boosted score descending
    results.sort((a, b) => b.boostedScore - a.boostedScore);

    const stats = this.calculateStats(results);

    return {
      results,
      processingTimeMs: Date.now() - startTime,
      contextUsed: context,
      stats,
    };
  }

  /**
   * Extract financial context from a query string
   */
  extractContextFromQuery(query: string): FinancialContext {
    const context: FinancialContext = {
      queryDate: new Date(),
      queryKeywords: [],
    };

    const lowerQuery = query.toLowerCase();

    // Extract merchants (simple pattern matching)
    context.queryMerchants = this.extractMerchants(lowerQuery);

    // Extract categories
    context.queryCategories = this.extractCategories(lowerQuery);

    // Extract amount ranges
    context.queryAmountRange = this.extractAmountRange(query);

    // Extract keywords
    context.queryKeywords = this.extractKeywords(lowerQuery);

    return context;
  }

  /**
   * Get current configuration
   */
  getConfig(): FinancialBoostConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<FinancialBoostConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ========================================================================
  // BOOST CALCULATIONS
  // ========================================================================

  private calculateBoosts(doc: BoostInput, context: FinancialContext): BoostBreakdown {
    const metadata = doc.financialMetadata;

    if (!metadata) {
      return this.zeroBreakdown();
    }

    return {
      merchantBoost: this.calculateMerchantBoost(metadata, context),
      categoryBoost: this.calculateCategoryBoost(metadata, context),
      recencyBoost: this.calculateRecencyBoost(metadata, context),
      amountBoost: this.calculateAmountBoost(metadata, context),
      accountBoost: this.calculateAccountBoost(metadata, context),
    };
  }

  private calculateMerchantBoost(
    metadata: DocumentFinancialMetadata,
    context: FinancialContext,
  ): number {
    if (!metadata.merchantNormalized || !context.queryMerchants?.length) {
      return 0;
    }

    const docMerchant = metadata.merchantNormalized.toLowerCase();

    for (const queryMerchant of context.queryMerchants) {
      // Exact match
      if (docMerchant === queryMerchant) {
        return this.config.merchantMatchBoost;
      }

      // Partial match (contains)
      if (docMerchant.includes(queryMerchant) || queryMerchant.includes(docMerchant)) {
        return this.config.merchantMatchBoost * 0.7;
      }

      // Fuzzy match using word overlap
      const docWords = docMerchant.split(/\s+/);
      const queryWords = queryMerchant.split(/\s+/);
      const overlap = docWords.filter((w) => queryWords.includes(w)).length;

      if (overlap > 0) {
        const overlapRatio = overlap / Math.max(docWords.length, queryWords.length);
        return this.config.merchantMatchBoost * overlapRatio * 0.5;
      }
    }

    // Check against keywords
    if (context.queryKeywords?.length) {
      for (const keyword of context.queryKeywords) {
        if (docMerchant.includes(keyword)) {
          return this.config.merchantMatchBoost * 0.3;
        }
      }
    }

    return 0;
  }

  private calculateCategoryBoost(
    metadata: DocumentFinancialMetadata,
    context: FinancialContext,
  ): number {
    if (!metadata.category || !context.queryCategories?.length) {
      return 0;
    }

    const docCategory = metadata.category.toLowerCase();

    for (const queryCategory of context.queryCategories) {
      // Exact match
      if (docCategory === queryCategory) {
        return this.config.categoryMatchBoost;
      }

      // Partial match (contains)
      if (docCategory.includes(queryCategory) || queryCategory.includes(docCategory)) {
        return this.config.categoryMatchBoost * 0.7;
      }
    }

    // Check category against keywords
    if (context.queryKeywords?.length) {
      for (const keyword of context.queryKeywords) {
        if (docCategory.includes(keyword)) {
          return this.config.categoryMatchBoost * 0.4;
        }
      }
    }

    return 0;
  }

  private calculateRecencyBoost(
    metadata: DocumentFinancialMetadata,
    context: FinancialContext,
  ): number {
    if (!metadata.dateStart && !metadata.dateEnd) {
      return 0;
    }

    const queryDate = context.queryDate || new Date();

    // Use the most recent date from the document
    const docDateStr = metadata.dateEnd || metadata.dateStart;
    if (!docDateStr) return 0;

    const docDate = new Date(docDateStr);
    const daysDiff = Math.abs((queryDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));

    // Full boost for very recent transactions
    if (daysDiff <= this.config.recencyFullBoostDays) {
      return this.config.maxRecencyBoost;
    }

    // No boost for very old transactions
    if (daysDiff >= this.config.recencyZeroBoostDays) {
      return 0;
    }

    // Linear decay between thresholds
    const range = this.config.recencyZeroBoostDays - this.config.recencyFullBoostDays;
    const position = daysDiff - this.config.recencyFullBoostDays;
    const decayRatio = 1 - position / range;

    return this.config.maxRecencyBoost * decayRatio;
  }

  private calculateAmountBoost(
    metadata: DocumentFinancialMetadata,
    context: FinancialContext,
  ): number {
    if (!context.queryAmountRange) {
      return 0;
    }

    const amount = metadata.totalAmount ?? metadata.amount;
    if (amount === undefined) {
      return 0;
    }

    const { min, max } = context.queryAmountRange;
    const absAmount = Math.abs(amount);

    // Check if within range
    if (min !== undefined && max !== undefined) {
      if (absAmount >= min && absAmount <= max) {
        return this.config.amountRangeBoost;
      }
      // Close to range (within 20%)
      const margin = (max - min) * 0.2;
      if (absAmount >= min - margin && absAmount <= max + margin) {
        return this.config.amountRangeBoost * 0.5;
      }
    } else if (min !== undefined) {
      if (absAmount >= min) {
        return this.config.amountRangeBoost;
      }
    } else if (max !== undefined) {
      if (absAmount <= max) {
        return this.config.amountRangeBoost;
      }
    }

    return 0;
  }

  private calculateAccountBoost(
    metadata: DocumentFinancialMetadata,
    context: FinancialContext,
  ): number {
    if (!metadata.accountId || !context.queryAccountIds?.length) {
      return 0;
    }

    if (context.queryAccountIds.includes(metadata.accountId)) {
      return this.config.accountMatchBoost;
    }

    return 0;
  }

  // ========================================================================
  // CONTEXT EXTRACTION
  // ========================================================================

  private extractMerchants(query: string): string[] {
    const merchants: string[] = [];

    // Common patterns for merchant names
    const patterns = [
      /(?:at|from|to|for)\s+([a-z0-9]+(?:\s+[a-z0-9]+)*)/gi,
      /(?:paid|spent|bought|purchased)\s+(?:at|from)?\s*([a-z0-9]+(?:\s+[a-z0-9]+)*)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const merchant = match[1].trim().toLowerCase();
        if (merchant.length > 2 && !STOP_WORDS.has(merchant)) {
          merchants.push(merchant);
        }
      }
    }

    return [...new Set(merchants)];
  }

  private extractCategories(query: string): string[] {
    const categories: string[] = [];

    // Common financial categories
    const categoryKeywords = [
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

    for (const keyword of categoryKeywords) {
      if (query.includes(keyword)) {
        categories.push(keyword);
      }
    }

    return categories;
  }

  private extractAmountRange(query: string): { min?: number; max?: number } | undefined {
    const parseAmount = (s: string): number => {
      const cleaned = s.replace(/,/g, '');
      return Math.round(parseFloat(cleaned) * 100); // Convert to cents
    };

    // Try patterns in order of specificity

    // "between $X and $Y"
    const betweenMatch = query.match(
      /between\s+\$?([\d,]+(?:\.\d{2})?)\s+and\s+\$?([\d,]+(?:\.\d{2})?)/i,
    );
    if (betweenMatch) {
      return {
        min: parseAmount(betweenMatch[1]),
        max: parseAmount(betweenMatch[2]),
      };
    }

    // "over $X" or "more than $X"
    const overMatch = query.match(
      /(?:over|more\s+than|above|exceeding)\s+\$?([\d,]+(?:\.\d{2})?)/i,
    );
    if (overMatch) {
      return { min: parseAmount(overMatch[1]) };
    }

    // "under $X" or "less than $X"
    const underMatch = query.match(/(?:under|less\s+than|below)\s+\$?([\d,]+(?:\.\d{2})?)/i);
    if (underMatch) {
      return { max: parseAmount(underMatch[1]) };
    }

    // "around $X" or "about $X"
    const aroundMatch = query.match(/(?:around|about|approximately)\s+\$?([\d,]+(?:\.\d{2})?)/i);
    if (aroundMatch) {
      const amount = parseAmount(aroundMatch[1]);
      return { min: amount * 0.8, max: amount * 1.2 };
    }

    // Just "$X" - don't match as it's too greedy
    // The user should be more specific about what they want

    return undefined;
  }

  private extractKeywords(query: string): string[] {
    // Simple tokenization and filtering
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    return [...new Set(words)];
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private sumBoosts(breakdown: BoostBreakdown): number {
    return (
      breakdown.merchantBoost +
      breakdown.categoryBoost +
      breakdown.recencyBoost +
      breakdown.amountBoost +
      breakdown.accountBoost
    );
  }

  private combineScores(originalScore: number, totalBoost: number): number {
    // Combine original score with boost using configured weight
    // Boost is additive, capped at boosting the score by at most 100%
    const maxBoost = 1.0;
    const cappedBoost = Math.min(totalBoost, maxBoost);

    // Apply boost weight to determine how much the boost affects final score
    const boostedScore = originalScore + cappedBoost * this.config.boostWeight;

    // Ensure score stays in valid range (0-2 for combined scores)
    return Math.min(Math.max(boostedScore, 0), 2);
  }

  private calculateStats(results: BoostOutput[]): BoostStats {
    if (results.length === 0) {
      return this.emptyStats();
    }

    const boostedDocs = results.filter((r) => r.totalBoost > 0);
    const totalBoost = results.reduce((sum, r) => sum + r.totalBoost, 0);
    const maxBoost = Math.max(...results.map((r) => r.totalBoost));

    const boostsByType = {
      merchant: 0,
      category: 0,
      recency: 0,
      amount: 0,
      account: 0,
    };

    for (const result of results) {
      if (result.boostBreakdown.merchantBoost > 0) boostsByType.merchant++;
      if (result.boostBreakdown.categoryBoost > 0) boostsByType.category++;
      if (result.boostBreakdown.recencyBoost > 0) boostsByType.recency++;
      if (result.boostBreakdown.amountBoost > 0) boostsByType.amount++;
      if (result.boostBreakdown.accountBoost > 0) boostsByType.account++;
    }

    return {
      documentsBosted: boostedDocs.length,
      averageBoost: totalBoost / results.length,
      maxBoost,
      boostsByType,
    };
  }

  private zeroBreakdown(): BoostBreakdown {
    return {
      merchantBoost: 0,
      categoryBoost: 0,
      recencyBoost: 0,
      amountBoost: 0,
      accountBoost: 0,
    };
  }

  private emptyStats(): BoostStats {
    return {
      documentsBosted: 0,
      averageBoost: 0,
      maxBoost: 0,
      boostsByType: {
        merchant: 0,
        category: 0,
        recency: 0,
        amount: 0,
        account: 0,
      },
    };
  }
}

// ============================================================================
// STOP WORDS
// ============================================================================

const STOP_WORDS = new Set([
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
// SINGLETON INSTANCE
// ============================================================================

export const financialBooster = new FinancialBooster();
