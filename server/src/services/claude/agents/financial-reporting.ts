/**
 * Financial Reporting Agent
 *
 * Generates professional-grade financial statements (P&L, Balance Sheet,
 * Cash Flow) and provides actionable analysis and trend interpretation
 * for Australian small businesses. Follows AASB standards.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { FinancialReportService } from '../../financial-reports.js';
import type { FinancialReportingInput, FinancialReportingOutput } from '../types.js';

const reportService = new FinancialReportService();

export class FinancialReportingAgent extends ClaudeAgent<
  FinancialReportingInput,
  FinancialReportingOutput
> {
  protected systemPrompt = `You are an expert financial reporting analyst for an Australian small business accounting platform.
You generate professional-grade financial statements (P&L, Balance Sheet, Cash Flow, Trial Balance)
and provide clear, actionable analysis of the results.

Key responsibilities:
- Generate accurate financial reports from transaction data
- Identify significant trends, anomalies, and patterns
- Explain variances between periods in plain English
- Flag potential issues (declining margins, cash flow problems, unusual expenses)
- Provide recommendations based on financial data
- All monetary values are in AUD
- Follow Australian Accounting Standards (AASB) where applicable

When returning results, provide a JSON object matching the FinancialReportingOutput schema with:
- report: The generated report data
- analysis: A narrative summary of key findings
- warnings: Any red flags or concerns identified
- recommendations: Actionable suggestions based on the data`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'generate_pnl',
      description:
        'Generate Profit & Loss statement for a date range. Returns revenue/expense categories and net profit.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID to generate report for' },
          periodStart: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          periodEnd: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          accountId: { type: 'string', description: 'Optional account ID to filter by' },
        },
        required: ['userId', 'periodStart', 'periodEnd'],
      },
    },
    {
      name: 'generate_balance_sheet',
      description:
        'Generate Balance Sheet as at a specific date. Returns assets, liabilities, equity sections and balance check.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID to generate report for' },
          asAtDate: { type: 'string', description: 'Date for the balance sheet (YYYY-MM-DD)' },
        },
        required: ['userId', 'asAtDate'],
      },
    },
    {
      name: 'generate_cash_flow',
      description:
        'Generate Cash Flow Statement for a date range. Returns operating, investing, financing sections.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID to generate report for' },
          periodStart: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          periodEnd: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        },
        required: ['userId', 'periodStart', 'periodEnd'],
      },
    },
    {
      name: 'analyze_trends',
      description:
        'Compare two periods and identify significant trends. Calculates per-category variances and flags changes > 10%.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID' },
          currentStart: { type: 'string', description: 'Current period start date (YYYY-MM-DD)' },
          currentEnd: { type: 'string', description: 'Current period end date (YYYY-MM-DD)' },
          priorStart: { type: 'string', description: 'Prior period start date (YYYY-MM-DD)' },
          priorEnd: { type: 'string', description: 'Prior period end date (YYYY-MM-DD)' },
          reportType: {
            type: 'string',
            description: 'Report type: profit_and_loss, balance_sheet, cash_flow, trial_balance',
          },
        },
        required: ['userId', 'currentStart', 'currentEnd', 'priorStart', 'priorEnd', 'reportType'],
      },
    },
    {
      name: 'explain_variance',
      description:
        'Provide structured variance data for AI interpretation. The agent LLM will generate the narrative explanation.',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: { type: 'string', description: 'Category name' },
          currentAmount: { type: 'number', description: 'Current period amount (cents)' },
          priorAmount: { type: 'number', description: 'Prior period amount (cents)' },
          variancePercent: { type: 'number', description: 'Variance as a percentage' },
        },
        required: ['category', 'currentAmount', 'priorAmount', 'variancePercent'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'generate_pnl',
      async (input) => {
        const userId = input.userId as string;
        const periodStart = input.periodStart as string;
        const periodEnd = input.periodEnd as string;
        const accountId = input.accountId as string | undefined;
        return await reportService.generateProfitAndLoss(userId, periodStart, periodEnd, accountId);
      },
    ],
    [
      'generate_balance_sheet',
      async (input) => {
        const userId = input.userId as string;
        const asAtDate = input.asAtDate as string;
        return await reportService.generateBalanceSheet(userId, asAtDate);
      },
    ],
    [
      'generate_cash_flow',
      async (input) => {
        const userId = input.userId as string;
        const periodStart = input.periodStart as string;
        const periodEnd = input.periodEnd as string;
        return await reportService.generateCashFlow(userId, periodStart, periodEnd);
      },
    ],
    [
      'analyze_trends',
      async (input) => {
        const userId = input.userId as string;
        const currentStart = input.currentStart as string;
        const currentEnd = input.currentEnd as string;
        const priorStart = input.priorStart as string;
        const priorEnd = input.priorEnd as string;
        const reportType = input.reportType as string;
        return await reportService.comparePeriods(
          userId,
          currentStart,
          currentEnd,
          priorStart,
          priorEnd,
          reportType,
        );
      },
    ],
    [
      'explain_variance',
      async (input) => {
        const category = input.category as string;
        const currentAmount = input.currentAmount as number;
        const priorAmount = input.priorAmount as number;
        const variancePercent = input.variancePercent as number;
        const varianceAmount = currentAmount - priorAmount;
        const direction =
          varianceAmount > 0 ? 'increase' : varianceAmount < 0 ? 'decrease' : 'unchanged';

        return {
          category,
          currentAmount,
          priorAmount,
          varianceAmount,
          variancePercent,
          direction,
          currentAmountDollars: currentAmount / 100,
          priorAmountDollars: priorAmount / 100,
          varianceAmountDollars: varianceAmount / 100,
          context: `The category "${category}" ${direction === 'unchanged' ? 'remained unchanged' : `${direction}d by ${Math.abs(variancePercent).toFixed(1)}%`} from $${(priorAmount / 100).toFixed(2)} to $${(currentAmount / 100).toFixed(2)}.`,
        };
      },
    ],
  ]);

  constructor() {
    super('financial_reporting');
  }
}
