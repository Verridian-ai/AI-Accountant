/**
 * Payroll Agent tool definitions — Anthropic tool schemas.
 *
 * Extracted from payroll-agent.ts to comply with the 300-line enterprise standard.
 */

import Anthropic from '@anthropic-ai/sdk';

export const PAYROLL_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'detect_wage_payment',
    description: 'Analyze a transaction to determine if it is a wage payment and extract details.',
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
    description: 'Search Cognee for previously learned payroll patterns and employee information.',
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
