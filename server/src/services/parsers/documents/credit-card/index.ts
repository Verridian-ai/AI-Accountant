/**
 * Credit Card Statement Parsers
 *
 * Export all credit card-specific parsers and types.
 */

// Import parsers first for use in factory functions
import { CBACreditCardParser } from './cba-credit';

// Import types
import type { CreditCardParser, CreditCardStatementParseResult } from './base-credit-parser';

// Base credit card parser and types
export {
  BaseCreditCardParser,
  parseForeignAmount,
  parseConversionRate,
  parseDate,
  parseAmount,
} from './base-credit-parser';

// Types
export type {
  CreditCardTransactionType,
  CreditCardTransaction,
  CreditCardAccountInfo,
  CreditCardStatementParseResult,
  CreditCardParserConfig,
  CreditCardParser,
  CreditCardDetectionResult,
} from './base-credit-parser';

// Bank-specific credit card parsers
export { CBACreditCardParser };

/**
 * Factory function to get a credit card parser by bank ID
 */
export function getCreditCardParser(bankId: string): CreditCardParser | null {
  switch (bankId.toLowerCase()) {
    case 'cba':
    case 'commbank':
    case 'commonwealth':
      return new CBACreditCardParser();
    default:
      return null;
  }
}

/**
 * Detect if a PDF text is a credit card statement and which bank it belongs to
 */
export function detectCreditCardStatement(pdfText: string): {
  isCreditCard: boolean;
  bankId: string | null;
  confidence: number;
  cardType?: string;
} {
  // List of available credit card parsers
  const parsers = [
    new CBACreditCardParser(),
    // Add more parsers here as they are implemented
  ];

  let bestMatch: {
    isCreditCard: boolean;
    bankId: string | null;
    confidence: number;
    cardType?: string;
  } = {
    isCreditCard: false,
    bankId: null,
    confidence: 0,
  };

  for (const parser of parsers) {
    const detection = parser.detect(pdfText);

    // Calculate combined confidence (bank match + credit card indicators)
    const combinedConfidence = detection.confidence * 0.5 + detection.creditCardConfidence * 0.5;

    if (detection.isCreditCardStatement && combinedConfidence > bestMatch.confidence) {
      bestMatch = {
        isCreditCard: true,
        bankId: detection.bankId,
        confidence: combinedConfidence,
        cardType: detection.detectedCardType,
      };
    }
  }

  return bestMatch;
}

/**
 * Parse a credit card statement automatically detecting the bank
 */
export async function parseCreditCardStatement(pdfText: string): Promise<{
  success: boolean;
  result?: CreditCardStatementParseResult;
  error?: string;
}> {
  const detection = detectCreditCardStatement(pdfText);

  if (!detection.isCreditCard || !detection.bankId) {
    return {
      success: false,
      error: 'Could not detect credit card statement or unsupported bank',
    };
  }

  const parser = getCreditCardParser(detection.bankId);

  if (!parser) {
    return {
      success: false,
      error: `No parser available for bank: ${detection.bankId}`,
    };
  }

  try {
    const result = await parser.parse(pdfText);
    return {
      success: result.success,
      result,
    };
  } catch (err) {
    return {
      success: false,
      error: `Parsing failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Get list of supported credit card issuers
 */
export function getSupportedCreditCardIssuers(): Array<{
  bankId: string;
  bankName: string;
  supportedCards: string[];
}> {
  return [
    {
      bankId: 'cba',
      bankName: 'Commonwealth Bank',
      supportedCards: ['Visa', 'Mastercard', 'Low Rate', 'Awards', 'Diamond'],
    },
    // Add more as parsers are implemented
  ];
}
