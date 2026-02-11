/**
 * Bank Statement Detector
 *
 * Detects which bank a statement belongs to based on content analysis.
 * Returns detection results with confidence scores for parser selection.
 * Also detects credit card vs transaction statements.
 */

import { parserRegistry } from './registry';
import {
  BankId,
  BankDetectionResult,
  StatementParseResult,
  ParseOptions,
} from './types';
import { detectCreditCardStatement } from './documents/credit-card/index';

/**
 * Detection threshold levels
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.7, // Use bank-specific parser directly
  MEDIUM: 0.4, // Use parser with AI assistance
  LOW: 0.2, // Fall back to pure AI parsing
} as const;

/**
 * Detect the bank from PDF text content
 */
export function detectBank(pdfText: string): BankDetectionResult[] {
  return parserRegistry.detectBank(pdfText);
}

/**
 * Get the best matching bank for the statement
 */
export function getBestBankMatch(pdfText: string): BankDetectionResult | null {
  const results = detectBank(pdfText);
  return results.length > 0 ? results[0] : null;
}

/**
 * Check if detection confidence is high enough for direct parsing
 */
export function isConfidentDetection(
  detection: BankDetectionResult | null
): boolean {
  return (detection?.confidence ?? 0) >= CONFIDENCE_THRESHOLDS.HIGH;
}

/**
 * Check if detection needs AI assistance
 */
export function needsAIAssistance(
  detection: BankDetectionResult | null
): boolean {
  const confidence = detection?.confidence ?? 0;
  return (
    confidence >= CONFIDENCE_THRESHOLDS.LOW &&
    confidence < CONFIDENCE_THRESHOLDS.HIGH
  );
}

/**
 * Parse statement with automatic bank detection
 */
export async function parseStatementAuto(
  pdfText: string,
  options: ParseOptions = {}
): Promise<StatementParseResult> {
  return parserRegistry.parseStatement(pdfText, options);
}

/**
 * Parse statement with a specific bank parser
 */
export async function parseStatementWithBank(
  pdfText: string,
  bankId: BankId
): Promise<StatementParseResult> {
  return parserRegistry.parseStatement(pdfText, { forceBankId: bankId });
}

/**
 * Get list of supported banks
 */
export function getSupportedBanks(): Array<{
  bankId: BankId;
  bankName: string;
  displayName: string;
}> {
  return parserRegistry.getBankInfo();
}

/**
 * Get bank name for display
 */
export function getBankDisplayName(bankId: BankId): string {
  const info = parserRegistry.getBankInfo().find((b) => b.bankId === bankId);
  return info?.displayName || info?.bankName || bankId;
}

/**
 * Detect if a statement is a credit card statement
 */
export function isCreditCardStatement(pdfText: string): {
  isCreditCard: boolean;
  bankId: string | null;
  confidence: number;
  cardType?: string;
} {
  return detectCreditCardStatement(pdfText);
}

/**
 * Credit card detection patterns for quick classification
 */
const CREDIT_CARD_PATTERNS = [
  /credit\s*card\s*statement/i,
  /credit\s*limit/i,
  /minimum\s*(?:payment|amount)\s*(?:due|required)/i,
  /interest\s*charged/i,
  /available\s*credit/i,
  /closing\s*balance.*(?:cr|dr)/i,
  /payment\s*due\s*date/i,
  /cash\s*advance/i,
  /annual\s*(?:card\s*)?fee/i,
  /(?:visa|mastercard|amex)\s*(?:card|platinum|gold|diamond)/i,
];

/**
 * Quick check if text has credit card indicators
 */
export function hasCreditCardIndicators(pdfText: string): {
  isLikely: boolean;
  matchedPatterns: string[];
  score: number;
} {
  const matchedPatterns: string[] = [];
  for (const pattern of CREDIT_CARD_PATTERNS) {
    if (pattern.test(pdfText)) {
      matchedPatterns.push(pattern.source);
    }
  }
  const score = matchedPatterns.length / CREDIT_CARD_PATTERNS.length;
  return {
    isLikely: matchedPatterns.length >= 2,
    matchedPatterns,
    score,
  };
}

/**
 * Analyze statement for detection metadata
 */
export function analyzeStatement(pdfText: string): {
  detections: BankDetectionResult[];
  bestMatch: BankDetectionResult | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  recommendedAction: 'direct_parse' | 'ai_assisted' | 'ai_only' | 'manual';
  hasAccountNumber: boolean;
  hasTransactionSection: boolean;
  estimatedTransactionCount: number;
  isCreditCard: boolean;
  creditCardBankId: string | null;
  creditCardConfidence: number;
} {
  const detections = detectBank(pdfText);
  const bestMatch = detections.length > 0 ? detections[0] : null;

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (bestMatch) {
    if (bestMatch.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      confidence = 'high';
    } else if (bestMatch.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      confidence = 'medium';
    } else if (bestMatch.confidence >= CONFIDENCE_THRESHOLDS.LOW) {
      confidence = 'low';
    }
  }

  // Determine recommended action
  let recommendedAction: 'direct_parse' | 'ai_assisted' | 'ai_only' | 'manual';
  switch (confidence) {
    case 'high':
      recommendedAction = 'direct_parse';
      break;
    case 'medium':
      recommendedAction = 'ai_assisted';
      break;
    case 'low':
      recommendedAction = 'ai_only';
      break;
    default:
      recommendedAction = 'manual';
  }

  // Check for account number presence
  const hasAccountNumber =
    /(?:BSB|Account|Acc)[\s:#]*\d{3,}/i.test(pdfText);

  // Check for transaction section
  const hasTransactionSection =
    /(?:Date\s+Transaction|Transaction\s+Details|Date\s+Description)/i.test(
      pdfText
    );

  // Estimate transaction count by looking for date patterns
  const dateMatches = pdfText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
  const estimatedTransactionCount = dateMatches
    ? Math.max(0, dateMatches.length - 5) // Subtract header/footer dates
    : 0;

  // Credit card detection
  const ccDetection = detectCreditCardStatement(pdfText);

  return {
    detections,
    bestMatch,
    confidence,
    recommendedAction,
    hasAccountNumber,
    hasTransactionSection,
    estimatedTransactionCount,
    isCreditCard: ccDetection.isCreditCard,
    creditCardBankId: ccDetection.bankId,
    creditCardConfidence: ccDetection.confidence,
  };
}

/**
 * Generate detection report for logging/debugging
 */
export function generateDetectionReport(pdfText: string): string {
  const analysis = analyzeStatement(pdfText);
  const lines: string[] = [];

  lines.push('=== Bank Statement Detection Report ===');
  lines.push('');

  if (analysis.bestMatch) {
    lines.push(`Best Match: ${analysis.bestMatch.bankName}`);
    lines.push(
      `Confidence: ${(analysis.bestMatch.confidence * 100).toFixed(1)}%`
    );
    lines.push(`Matched Patterns: ${analysis.bestMatch.matchedPatterns.length}`);
    lines.push('');
  } else {
    lines.push('No bank detected');
    lines.push('');
  }

  lines.push(`Confidence Level: ${analysis.confidence}`);
  lines.push(`Recommended Action: ${analysis.recommendedAction}`);
  lines.push('');

  lines.push('Document Analysis:');
  lines.push(`  Has Account Number: ${analysis.hasAccountNumber}`);
  lines.push(`  Has Transaction Section: ${analysis.hasTransactionSection}`);
  lines.push(
    `  Estimated Transactions: ~${analysis.estimatedTransactionCount}`
  );
  lines.push('');

  if (analysis.detections.length > 1) {
    lines.push('Other Matches:');
    for (const det of analysis.detections.slice(1, 4)) {
      lines.push(
        `  ${det.bankName}: ${(det.confidence * 100).toFixed(1)}%`
      );
    }
  }

  lines.push('');
  lines.push('Credit Card Detection:');
  lines.push(`  Is Credit Card: ${analysis.isCreditCard}`);
  if (analysis.isCreditCard) {
    lines.push(`  Bank: ${analysis.creditCardBankId}`);
    lines.push(`  Confidence: ${(analysis.creditCardConfidence * 100).toFixed(1)}%`);
  }

  return lines.join('\n');
}
