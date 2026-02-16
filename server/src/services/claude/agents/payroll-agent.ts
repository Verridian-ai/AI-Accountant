/**
 * Payroll Agent
 *
 * Detects wage payments from bank transactions, calculates PAYG withholding
 * using ATO tax tables, and manages the wage payment ledger.
 * Integrates with Cognee for persistent payroll pattern learning.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { employeeService } from '../../employee.js';
import { payStructureService } from '../../pay-structures.js';
import type { PayrollAgentInput, PayrollAgentOutput } from '../types.js';

/**
 * Determine the current Australian financial year string.
 * AU FY runs July 1 → June 30. e.g. Feb 2026 → "2025-26".
 */
function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  if (month >= 7) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

/** Known wage payment description patterns */
const WAGE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bSALARY\b/i, type: 'salary' },
  { pattern: /\bWAGES?\b/i, type: 'wages' },
  { pattern: /\bPAYROLL\b/i, type: 'payroll' },
  { pattern: /\bADP\b/i, type: 'payroll_provider' },
  { pattern: /\bMYOB\s*PAYROLL\b/i, type: 'payroll_provider' },
  { pattern: /\bXERO\s*PAYROLL\b/i, type: 'payroll_provider' },
  { pattern: /\bKEYPAY\b/i, type: 'payroll_provider' },
  { pattern: /\bEMPLOYMENT\s*HERO\b/i, type: 'payroll_provider' },
  { pattern: /\bPAY\s*RUN\b/i, type: 'payroll' },
  { pattern: /\bSTAFF\s*PAY\b/i, type: 'wages' },
  { pattern: /\bSUPER(?:ANNUATION)?\s*(?:GUARANTEE|CONTRIB)/i, type: 'super' },
];

/** Known employee name patterns for Amica Beauty */
const KNOWN_EMPLOYEES: Record<string, { fullName: string; tfnDeclared: boolean }> = {
  'bree perry': { fullName: 'Bree Perry', tfnDeclared: true },
  christina: { fullName: 'Christina', tfnDeclared: true },
  josevski: { fullName: 'Josevski', tfnDeclared: true },
};

/**
 * Detect if a transaction description matches a wage payment pattern.
 */
function detectWagePattern(description: string): {
  isWage: boolean;
  type: string;
  confidence: number;
} {
  const desc = description.toLowerCase();
  for (const { pattern, type } of WAGE_PATTERNS) {
    if (pattern.test(desc)) {
      return { isWage: true, type, confidence: 0.9 };
    }
  }
  // Check for known employee names
  for (const name of Object.keys(KNOWN_EMPLOYEES)) {
    if (desc.includes(name)) {
      return { isWage: true, type: 'employee_name', confidence: 0.85 };
    }
  }
  return { isWage: false, type: 'none', confidence: 0 };
}

/**
 * Extract employee name from transaction description.
 */
function extractEmployeeName(description: string): string | undefined {
  const desc = description.toLowerCase();
  for (const [key, info] of Object.entries(KNOWN_EMPLOYEES)) {
    if (desc.includes(key)) return info.fullName;
  }
  // Try to extract name after common prefixes
  const nameMatch = description.match(/(?:WAGES?|SALARY|PAYROLL)\s*[-:]\s*(.+?)(?:\s*[-/]|$)/i);
  if (nameMatch) return nameMatch[1].trim();
  return undefined;
}

export class PayrollAgent extends ClaudeAgent<PayrollAgentInput, PayrollAgentOutput> {
  protected systemPrompt = `You are an Australian payroll specialist AI agent for a small business (Amica Beauty — a beauty salon). Your job is to:

1. Detect wage payments from bank transaction descriptions
2. Calculate PAYG withholding tax using ATO tax tables
3. Identify employees from transaction patterns
4. Manage the wage payment ledger
5. Look up employees by name or status
6. Check pay rates and structures
7. Calculate gross pay for a period
8. Verify super guarantee compliance

Key rules:
- All amounts are in CENTS (integer). $1,000.00 = 100000 cents.
- Bank transactions show NET pay (after tax). You must reverse-calculate GROSS pay.
- Use ATO marginal tax brackets + Medicare levy for the correct financial year.
- Financial years run July 1 to June 30 (e.g., FY 2024-25 = 1 Jul 2024 – 30 Jun 2025).
- Tax-free threshold is $18,200/year.
- Superannuation is typically 11% (FY 2023-24) or 11.5% (FY 2024-25) of ordinary time earnings.
- Known employees: Bree Perry, Christina, Josevski.
- Wage transactions are NEGATIVE amounts (debits from business account).
- Category 'Wages & Salaries' is the primary indicator.

For each detected wage payment, determine:
- Employee name
- Whether it's a bulk payment (multiple employees in one transaction)
- Net pay (from transaction amount)
- Gross pay (reverse-calculated using ATO tax tables)
- Tax withheld (gross - net)
- Pay frequency (weekly/fortnightly/monthly)

You can also help with employee management:
- Looking up employees by name or status (use lookup_employee)
- Checking pay rates and structures (use get_employee_pay_details)
- Calculating gross pay for a period (use calculate_gross_pay)
- Verifying super guarantee compliance (use check_super_compliance)

Return a JSON object matching the PayrollAgentOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'detect_wage_payment',
      description:
        'Analyze a transaction to determine if it is a wage payment and extract details.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactionId: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number', description: 'Amount in cents (negative = debit)' },
          date: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['transactionId', 'description', 'amount', 'date'],
      },
    },
    {
      name: 'calculate_payg_withholding',
      description:
        'Calculate PAYG withholding for an employee given their net pay and financial year.',
      input_schema: {
        type: 'object' as const,
        properties: {
          employeeName: { type: 'string' },
          netPayCents: { type: 'number', description: 'Net pay in cents for this payment' },
          annualNetCents: {
            type: 'number',
            description: 'Total annual net pay in cents for this employee',
          },
          financialYear: { type: 'string', description: 'e.g. 2024-25' },
          payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'monthly', 'irregular'] },
        },
        required: ['employeeName', 'netPayCents', 'annualNetCents', 'financialYear'],
      },
    },
    {
      name: 'search_payroll_history',
      description:
        'Search Cognee for previously learned payroll patterns and employee information.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query for payroll patterns' },
          userId: { type: 'string' },
        },
        required: ['query'],
      },
    },
    {
      name: 'store_payroll_pattern',
      description: 'Store a learned payroll pattern in Cognee for future reference.',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'The payroll pattern description to store' },
          userId: { type: 'string' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'lookup_employee',
      description:
        'Search for employees by name, email, or status. Use when the user asks about a specific employee or wants to list employees.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'The user/business owner ID' },
          search: { type: 'string', description: 'Search term (name or email)' },
          status: {
            type: 'string',
            enum: ['active', 'terminated', 'on_leave'],
            description: 'Filter by status',
          },
        },
        required: ['userId'],
      },
    },
    {
      name: 'get_employee_pay_details',
      description:
        'Get the full pay structure for an employee including rate, hours, and salary. Use when asked about pay rates or compensation.',
      input_schema: {
        type: 'object' as const,
        properties: {
          employeeId: { type: 'string', description: 'The employee ID' },
        },
        required: ['employeeId'],
      },
    },
    {
      name: 'calculate_gross_pay',
      description:
        'Calculate gross pay for an employee given hours worked. Returns breakdown by pay category.',
      input_schema: {
        type: 'object' as const,
        properties: {
          employeeId: { type: 'string', description: 'The employee ID' },
          hoursWorked: { type: 'number', description: 'Total hours worked in the period' },
        },
        required: ['employeeId', 'hoursWorked'],
      },
    },
    {
      name: 'check_super_compliance',
      description:
        "Check if an employee's super guarantee rate meets the minimum requirement. Rate is configurable via SUPER_GUARANTEE_RATE env var (changes annually). Use when asked about superannuation compliance.",
      input_schema: {
        type: 'object' as const,
        properties: {
          employeeId: { type: 'string', description: 'The employee ID' },
          financialYear: {
            type: 'string',
            description: 'Financial year to check (e.g. "2025-26"). Defaults to current FY.',
          },
        },
        required: ['employeeId'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'detect_wage_payment',
      async (input) => {
        const txId = input.transactionId as string;
        const description = input.description as string;
        const amount = input.amount as number;
        const category = input.category as string | undefined;

        // Check category first — most reliable signal
        if (category === 'Wages & Salaries') {
          const employeeName = extractEmployeeName(description);
          return {
            transactionId: txId,
            isWagePayment: true,
            confidence: 0.95,
            employeeName: employeeName || 'Unknown Employee',
            netPayCents: Math.abs(amount),
            source: 'detected',
            reasoning: `Category is 'Wages & Salaries'. Employee: ${employeeName || 'unknown'}.`,
          };
        }

        // Pattern-based detection
        const detection = detectWagePattern(description);
        if (detection.isWage) {
          const employeeName = extractEmployeeName(description);
          return {
            transactionId: txId,
            isWagePayment: true,
            confidence: detection.confidence,
            employeeName: employeeName || 'Unknown Employee',
            netPayCents: Math.abs(amount),
            source: 'detected',
            reasoning: `Matched pattern type '${detection.type}'. Employee: ${employeeName || 'unknown'}.`,
          };
        }

        return {
          transactionId: txId,
          isWagePayment: false,
          confidence: 0.1,
          netPayCents: 0,
          source: 'detected',
          reasoning: 'No wage payment patterns detected in description or category.',
        };
      },
    ],
    [
      'calculate_payg_withholding',
      async (input) => {
        const employeeName = input.employeeName as string;
        const netPayCents = input.netPayCents as number;
        const annualNetCents = input.annualNetCents as number;
        const financialYear = input.financialYear as string;
        const payFrequency = (input.payFrequency as string) || 'monthly';

        // Parse FY start year from '2024-25' format
        const fyStartYear = parseInt(financialYear.split('-')[0], 10);

        // Import tax functions dynamically to avoid circular deps
        const { grossFromNet } = await import('../../bas.js');

        const annualNetDollars = annualNetCents / 100;
        const annualGrossDollars = grossFromNet(annualNetDollars, fyStartYear);
        const annualTaxDollars = annualGrossDollars - annualNetDollars;
        const effectiveRate = annualGrossDollars > 0 ? annualTaxDollars / annualGrossDollars : 0;

        // Apply effective rate to this payment
        const netPayDollars = netPayCents / 100;
        const grossPayDollars = netPayDollars / (1 - effectiveRate);
        const taxWithheldDollars = grossPayDollars - netPayDollars;

        // Superannuation (11% for FY 2023-24, 11.5% for FY 2024-25)
        const superRate = fyStartYear >= 2024 ? 0.115 : 0.11;
        const superDollars = grossPayDollars * superRate;

        return {
          employeeName,
          netPayCents: Math.round(netPayDollars * 100),
          grossPayCents: Math.round(grossPayDollars * 100),
          taxWithheldCents: Math.round(taxWithheldDollars * 100),
          superannuationCents: Math.round(superDollars * 100),
          effectiveRate: Math.round(effectiveRate * 10000) / 100, // percentage with 2dp
          annualGrossDollars: Math.round(annualGrossDollars * 100) / 100,
          annualTaxDollars: Math.round(annualTaxDollars * 100) / 100,
          payFrequency,
          financialYear,
        };
      },
    ],
    [
      'search_payroll_history',
      async (input) => {
        const query = input.query as string;
        const userId = input.userId as string | undefined;
        const dataset = userId ? `payroll_user_${userId}` : 'payroll_patterns';
        try {
          const results = await cogneeTools.search(query, dataset, 'CHUNKS_LEXICAL');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
    [
      'store_payroll_pattern',
      async (input) => {
        const pattern = input.pattern as string;
        const userId = input.userId as string | undefined;
        const dataset = userId ? `payroll_user_${userId}` : 'payroll_patterns';
        try {
          await cogneeTools.index([pattern], dataset);
          return { stored: true };
        } catch {
          return { stored: false, error: 'Cognee indexing unavailable' };
        }
      },
    ],
    [
      'lookup_employee',
      async (input) => {
        const userId = input.userId as string;
        const search = input.search as string | undefined;
        const status = input.status as string | undefined;
        const result = await employeeService.listEmployees(userId, {
          search,
          status,
          limit: 20,
        });
        return result.data.map((e: any) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          email: e.email,
          status: e.status,
          employmentType: e.employmentType,
          startDate: e.startDate,
        }));
      },
    ],
    [
      'get_employee_pay_details',
      async (input) => {
        const employeeId = input.employeeId as string;
        const employee = await employeeService.getEmployee(employeeId);
        const payStructure = await payStructureService.getPayStructure(employeeId);
        const superFund = await employeeService.getSuperFund(employeeId);
        const taxDecl = await employeeService.getTaxDeclaration(employeeId);

        return {
          employee: employee
            ? {
                name: `${employee.firstName} ${employee.lastName}`,
                type: employee.employmentType,
                status: employee.status,
              }
            : null,
          payStructure,
          superFund,
          taxDeclaration: taxDecl,
        };
      },
    ],
    [
      'calculate_gross_pay',
      async (input) => {
        const employeeId = input.employeeId as string;
        const hoursWorked = input.hoursWorked as number;
        const result = await payStructureService.calculateGrossPay(employeeId, hoursWorked);
        return {
          grossPayCents: result.grossPay,
          grossPayDollars: (result.grossPay / 100).toFixed(2),
          breakdown: result.breakdown.map((b) => ({
            category: b.category,
            amountCents: b.amount,
            amountDollars: (b.amount / 100).toFixed(2),
          })),
        };
      },
    ],
    [
      'check_super_compliance',
      async (input) => {
        const employeeId = input.employeeId as string;
        const superFunds = await employeeService.getSuperFund(employeeId);

        // REVISION (D02 COMP-02): Configurable super rate — not hardcoded
        const MINIMUM_SUPER_RATE = parseFloat(process.env.SUPER_GUARANTEE_RATE ?? '11.5');
        const fy = (input.financialYear as string | undefined) ?? getCurrentFinancialYear();

        const results = superFunds.map((fund: any) => ({
          fundName: fund.fundName,
          contributionRate: fund.contributionRate,
          minimumRequired: MINIMUM_SUPER_RATE,
          financialYear: fy,
          isCompliant: fund.contributionRate >= MINIMUM_SUPER_RATE,
          shortfall:
            fund.contributionRate < MINIMUM_SUPER_RATE
              ? (MINIMUM_SUPER_RATE - fund.contributionRate).toFixed(1) + '%'
              : null,
        }));

        return {
          employeeId,
          superFunds: results,
          overallCompliant: results.every((r: any) => r.isCompliant),
          note: `Minimum super guarantee rate for ${fy} is ${MINIMUM_SUPER_RATE}% (configurable via SUPER_GUARANTEE_RATE env var)`,
        };
      },
    ],
  ]);

  constructor() {
    super('payroll_agent');
  }
}
