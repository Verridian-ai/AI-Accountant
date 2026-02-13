/**
 * Bank Parser Registry
 *
 * Central registry for all bank-specific parsers.
 * Handles parser registration and lookup.
 */

import {
  BankId,
  BankParser,
  ParserRegistryEntry,
  BankDetectionResult,
  StatementParseResult,
  ParseOptions,
} from './types';

// Import all bank parsers
import { CBAParser } from './banks/cba';
import { ANZParser } from './banks/anz';
import { WestpacParser } from './banks/westpac';
import { NABParser } from './banks/nab';
import { StGeorgeParser } from './banks/stgeorge';
import { BendigoParser } from './banks/bendigo';
import { INGParser } from './banks/ing';
import { MacquarieParser } from './banks/macquarie';

/**
 * Bank Parser Registry
 */
class BankParserRegistry {
  private parsers: Map<BankId, ParserRegistryEntry> = new Map();
  private initialized = false;

  /**
   * Initialize registry with all available parsers
   */
  initialize(): void {
    if (this.initialized) return;

    // Register parsers with priorities (higher = checked first)
    this.register(new CBAParser(), 100);
    this.register(new ANZParser(), 90);
    this.register(new WestpacParser(), 90);
    this.register(new NABParser(), 90);
    this.register(new StGeorgeParser(), 80);
    this.register(new BendigoParser(), 70);
    this.register(new INGParser(), 70);
    this.register(new MacquarieParser(), 70);

    this.initialized = true;
  }

  /**
   * Register a parser
   */
  register(parser: BankParser, priority: number = 50): void {
    this.parsers.set(parser.config.bankId, {
      bankId: parser.config.bankId,
      parser,
      priority,
    });
  }

  /**
   * Get a specific parser by bank ID
   */
  getParser(bankId: BankId): BankParser | undefined {
    this.ensureInitialized();
    return this.parsers.get(bankId)?.parser;
  }

  /**
   * Get all registered parsers sorted by priority
   */
  getAllParsers(): BankParser[] {
    this.ensureInitialized();
    return Array.from(this.parsers.values())
      .sort((a, b) => b.priority - a.priority)
      .map((entry) => entry.parser);
  }

  /**
   * Get list of supported bank IDs
   */
  getSupportedBanks(): BankId[] {
    this.ensureInitialized();
    return Array.from(this.parsers.keys());
  }

  /**
   * Get bank display information
   */
  getBankInfo(): Array<{ bankId: BankId; bankName: string; displayName: string }> {
    this.ensureInitialized();
    return Array.from(this.parsers.values()).map((entry) => ({
      bankId: entry.bankId,
      bankName: entry.parser.config.bankName,
      displayName: entry.parser.config.displayName,
    }));
  }

  /**
   * Detect bank from PDF text
   */
  detectBank(pdfText: string): BankDetectionResult[] {
    this.ensureInitialized();

    const results: BankDetectionResult[] = [];

    for (const parser of this.getAllParsers()) {
      const detection = parser.detect(pdfText);
      if (detection.confidence > 0) {
        results.push(detection);
      }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Parse a statement with auto-detection or forced parser
   */
  async parseStatement(pdfText: string, options: ParseOptions = {}): Promise<StatementParseResult> {
    this.ensureInitialized();

    const { forceBankId, minConfidence = 0.4, fallbackToAI = true } = options;

    // If bank ID is forced, use that parser directly
    if (forceBankId) {
      const parser = this.getParser(forceBankId);
      if (!parser) {
        return {
          success: false,
          bankId: 'unknown',
          bankName: 'Unknown',
          accountInfo: { accountNumber: 'UNKNOWN', accountType: 'unknown' },
          transactions: [],
          parseWarnings: [],
          parseErrors: [`No parser found for bank: ${forceBankId}`],
          detectionConfidence: 0,
          parserUsed: 'none',
          processingTimeMs: 0,
        };
      }
      return parser.parse(pdfText);
    }

    // Auto-detect bank
    const detections = this.detectBank(pdfText);

    if (detections.length === 0 || detections[0].confidence < minConfidence) {
      // No confident detection
      if (fallbackToAI) {
        return {
          success: false,
          bankId: 'unknown',
          bankName: 'Unknown',
          accountInfo: { accountNumber: 'UNKNOWN', accountType: 'unknown' },
          transactions: [],
          parseWarnings: [
            `No bank detected with sufficient confidence (best: ${
              detections[0]?.confidence.toFixed(2) || 0
            })`,
          ],
          parseErrors: ['Requires AI fallback parsing'],
          detectionConfidence: detections[0]?.confidence || 0,
          parserUsed: 'ai_required',
          processingTimeMs: 0,
        };
      }

      // Try best match anyway
      if (detections.length > 0) {
        const parser = this.getParser(detections[0].bankId);
        if (parser) {
          const result = await parser.parse(pdfText);
          result.parseWarnings.unshift(
            `Low confidence detection: ${detections[0].confidence.toFixed(2)}`,
          );
          return result;
        }
      }

      return {
        success: false,
        bankId: 'unknown',
        bankName: 'Unknown',
        accountInfo: { accountNumber: 'UNKNOWN', accountType: 'unknown' },
        transactions: [],
        parseWarnings: [],
        parseErrors: ['Could not detect bank and no fallback available'],
        detectionConfidence: 0,
        parserUsed: 'none',
        processingTimeMs: 0,
      };
    }

    // Use the best matching parser
    const bestMatch = detections[0];
    const parser = this.getParser(bestMatch.bankId);

    if (!parser) {
      return {
        success: false,
        bankId: bestMatch.bankId,
        bankName: bestMatch.bankName,
        accountInfo: { accountNumber: 'UNKNOWN', accountType: 'unknown' },
        transactions: [],
        parseWarnings: [],
        parseErrors: [`Parser not found for detected bank: ${bestMatch.bankId}`],
        detectionConfidence: bestMatch.confidence,
        parserUsed: 'none',
        processingTimeMs: 0,
      };
    }

    return parser.parse(pdfText);
  }

  /**
   * Ensure registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }
}

// Export singleton instance
export const parserRegistry = new BankParserRegistry();

// Export types for convenience
export type { BankParser, BankParserConfig, ParseOptions } from './types';
