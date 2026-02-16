/**
 * StatementParser Agent
 *
 * Extracts structured transaction data from bank statement PDFs.
 * Wraps existing bank parsers as tools and adds AI reasoning.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { parserRegistry } from '../../parsers/registry.js';
import type { StatementParserInput, StatementParserOutput } from '../types.js';
import type { BankId } from '../../parsers/types.js';

export class StatementParserAgent extends ClaudeAgent<StatementParserInput, StatementParserOutput> {
  protected systemPrompt = `You are a specialist in parsing Australian bank statements. Given extracted text or images from a PDF bank statement, identify and extract all transactions with their dates, descriptions, amounts, and running balances. You understand the formats of all major Australian banks (CBA, ANZ, Westpac, NAB, St George, Bendigo, ING, Macquarie).

Your workflow:
1. First use detect_bank to identify which bank issued the statement
2. Then use parse_with_bank_parser to extract transactions using the appropriate parser
3. Use extract_account_info to get BSB, account number, etc.
4. Use validate_transactions to cross-check the extracted data
5. Optionally use search_cognee for historical patterns if detection confidence is low

Return your final result as a JSON object matching the StatementParserOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'detect_bank',
      description: 'Identify which Australian bank issued this statement from the text content.',
      input_schema: {
        type: 'object' as const,
        properties: {
          text: {
            type: 'string',
            description: 'Extracted text from the PDF statement',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'parse_with_bank_parser',
      description: 'Parse transactions from statement text using the bank-specific parser.',
      input_schema: {
        type: 'object' as const,
        properties: {
          text: {
            type: 'string',
            description: 'Statement text to parse',
          },
          bankId: {
            type: 'string',
            description:
              'Bank identifier (cba, anz, westpac, nab, stgeorge, bendigo, ing, macquarie)',
          },
        },
        required: ['text', 'bankId'],
      },
    },
    {
      name: 'extract_account_info',
      description: 'Extract account details (BSB, account number, name, type) from statement text.',
      input_schema: {
        type: 'object' as const,
        properties: {
          text: {
            type: 'string',
            description: 'Statement text',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'validate_transactions',
      description: 'Cross-check extracted transactions against the source text for accuracy.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            description: 'Parsed transactions to validate',
            items: { type: 'object' },
          },
          text: {
            type: 'string',
            description: 'Original text for cross-reference',
          },
        },
        required: ['transactions', 'text'],
      },
    },
    {
      name: 'search_cognee',
      description: 'Search Cognee knowledge graph for historical parsing patterns.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query' },
          datasetName: {
            type: 'string',
            description: 'Dataset to search (e.g. bank_formats)',
          },
        },
        required: ['query', 'datasetName'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'detect_bank',
      async (input) => {
        const text = input.text as string;
        const results = parserRegistry.detectBank(text);
        if (results.length === 0) {
          return { bankId: 'unknown', confidence: 0 };
        }
        return {
          bankId: results[0].bankId,
          confidence: results[0].confidence,
          bankName: results[0].bankName,
          matchedPatterns: results[0].matchedPatterns,
          allDetections: results.slice(0, 3),
        };
      },
    ],
    [
      'parse_with_bank_parser',
      async (input) => {
        const text = input.text as string;
        const bankId = input.bankId as BankId;
        const parser = parserRegistry.getParser(bankId);
        if (!parser) {
          return { error: `No parser for bank: ${bankId}`, transactions: [] };
        }
        const result = await parser.parse(text);
        return {
          transactions: result.transactions,
          accountInfo: result.accountInfo,
          warnings: result.parseWarnings,
          errors: result.parseErrors,
        };
      },
    ],
    [
      'extract_account_info',
      async (input) => {
        const text = input.text as string;
        // Use best-detected parser's extractAccountInfo
        const detections = parserRegistry.detectBank(text);
        if (detections.length > 0) {
          const parser = parserRegistry.getParser(detections[0].bankId);
          if (parser) {
            return parser.extractAccountInfo(text);
          }
        }
        return { accountNumber: 'UNKNOWN', accountType: 'unknown' };
      },
    ],
    [
      'validate_transactions',
      async (input) => {
        const transactions = input.transactions as Array<Record<string, unknown>>;
        const text = input.text as string;
        const issues: string[] = [];

        if (!transactions || transactions.length === 0) {
          issues.push('No transactions extracted');
        }

        // Check for reasonable date ranges
        const dates = transactions.map((t) => t.date as string).filter(Boolean);
        if (dates.length > 0) {
          const sorted = [...dates].sort();
          const start = sorted[0];
          // Basic sanity: check dates exist in text
          if (!text.includes((start || '').replace(/-/g, '/').substring(5))) {
            issues.push(`Start date ${start} not found in source text`);
          }
        }

        // Check for duplicate transactions
        const seen = new Set<string>();
        for (const tx of transactions) {
          const key = `${tx.date}-${tx.amount}-${tx.description}`;
          if (seen.has(key)) {
            issues.push(`Possible duplicate: ${key}`);
          }
          seen.add(key);
        }

        return {
          valid: issues.length === 0,
          issues,
          transactionCount: transactions.length,
        };
      },
    ],
    [
      'search_cognee',
      async (input) => {
        const query = input.query as string;
        const dataset = input.datasetName as string;
        return cogneeTools.search(query, dataset);
      },
    ],
  ]);

  constructor() {
    super('statement_parser');
  }
}
