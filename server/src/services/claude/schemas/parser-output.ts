/**
 * Zod schema for StatementParser agent output.
 * Matches StatementParserOutput from types.ts.
 *
 * Note: BankId and AccountInfo are re-expressed as Zod schemas here
 * rather than importing from parsers/types.ts (which has no Zod counterpart).
 */
import { z } from 'zod';

export const BankIdSchema = z.enum([
  'cba',
  'anz',
  'westpac',
  'nab',
  'stgeorge',
  'bendigo',
  'ing',
  'macquarie',
  'bankwest',
  'suncorp',
  'unknown',
]);

export const AccountTypeSchema = z.enum([
  'transaction',
  'savings',
  'credit',
  'business',
  'offset',
  'loan',
  'term_deposit',
  'unknown',
]);

export const AccountInfoSchema = z.object({
  accountNumber: z.string(),
  accountName: z.string().optional(),
  accountType: AccountTypeSchema,
  bsb: z.string().optional(),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
  statementPeriod: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

export const ParsedTransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  balance: z.number().optional(),
  reference: z.string().optional(),
  category: z.string().optional(),
  merchantName: z.string().optional(),
  rawDate: z.string().optional(),
  rawAmount: z.string().optional(),
  rawDescription: z.string().optional(),
  lineNumber: z.number().optional(),
  parserVersion: z.string().optional(),
  extractionHash: z.string().optional(),
});

export const StatementParserOutputSchema = z.object({
  bankId: BankIdSchema,
  bankConfidence: z.number().min(0).max(1),
  accountInfo: AccountInfoSchema,
  transactions: z.array(ParsedTransactionSchema),
  parseMethod: z.enum(['bank_parser', 'ai_vision', 'ai_text']),
  warnings: z.array(z.string()),
});

export type StatementParserOutputValidated = z.infer<typeof StatementParserOutputSchema>;
