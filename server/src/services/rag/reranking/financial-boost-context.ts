/**
 * Financial Context Extraction
 *
 * Extracts financial context (merchants, categories, amounts, keywords)
 * from user queries for domain-specific boost scoring.
 */

import type { FinancialContext } from './financial-boost-types.js';
import { STOP_WORDS, CATEGORY_KEYWORDS } from './financial-boost-types.js';

// ============================================================================
// CONTEXT EXTRACTION
// ============================================================================

/**
 * Extract financial context from a query string
 */
export function extractContextFromQuery(query: string): FinancialContext {
  const context: FinancialContext = {
    queryDate: new Date(),
    queryKeywords: [],
  };

  const lowerQuery = query.toLowerCase();

  context.queryMerchants = extractMerchants(lowerQuery);
  context.queryCategories = extractCategories(lowerQuery);
  context.queryAmountRange = extractAmountRange(query);
  context.queryKeywords = extractKeywords(lowerQuery);

  return context;
}

/**
 * Extract merchant names from query
 */
export function extractMerchants(query: string): string[] {
  const merchants: string[] = [];

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

/**
 * Extract categories from query
 */
export function extractCategories(query: string): string[] {
  const categories: string[] = [];

  for (const keyword of CATEGORY_KEYWORDS) {
    if (query.includes(keyword)) {
      categories.push(keyword);
    }
  }

  return categories;
}

/**
 * Extract amount range from query
 */
export function extractAmountRange(query: string): { min?: number; max?: number } | undefined {
  const parseAmount = (s: string): number => {
    const cleaned = s.replace(/,/g, '');
    return Math.round(parseFloat(cleaned) * 100);
  };

  // "between $X and $Y"
  const betweenMatch = query.match(
    /between\s+\$?([\d,]+(?:\.\d{2})?)\s+and\s+\$?([\d,]+(?:\.\d{2})?)/i,
  );
  if (betweenMatch) {
    return { min: parseAmount(betweenMatch[1]), max: parseAmount(betweenMatch[2]) };
  }

  // "over $X" or "more than $X"
  const overMatch = query.match(/(?:over|more\s+than|above|exceeding)\s+\$?([\d,]+(?:\.\d{2})?)/i);
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

  return undefined;
}

/**
 * Extract keywords from query
 */
export function extractKeywords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  return [...new Set(words)];
}
