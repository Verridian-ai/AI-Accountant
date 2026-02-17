/**
 * Compliance Monitoring Agent — Tool Definitions
 *
 * Anthropic tool schemas for deadline checking, risk assessment,
 * anomaly scanning, schedule generation, lodgement marking,
 * Cognee searches, and compliance timeline generation.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const complianceMonitoringTools: Anthropic.Tool[] = [
  {
    name: 'check_deadlines',
    description:
      'Check current and upcoming ATO compliance deadlines from the DB, including overdue items (up to 90 days back).',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID' },
        withinDays: { type: 'number', description: 'Days ahead to look (default 30)' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'assess_risks',
    description:
      'Assess overall compliance risk for a user — scores overdue items, upcoming deadlines, and missing schedules.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'scan_anomalies',
    description:
      'Run anomaly detectors on user transactions to find duplicates, outliers, velocity spikes, category drift, unusual merchants, and schedule deviations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID' },
        detectors: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['duplicates', 'amounts', 'velocity', 'category_drift', 'merchant', 'schedule'],
          },
          description: 'Which detectors to run (default: all)',
        },
        dateFrom: { type: 'string', description: 'Start date filter (ISO)' },
        dateTo: { type: 'string', description: 'End date filter (ISO)' },
        severityThreshold: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Minimum severity to return',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'generate_schedule',
    description:
      'Generate compliance obligations for a financial year based on configured schedules (creates DB records).',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID' },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2025-26")' },
      },
      required: ['userId', 'financialYear'],
    },
  },
  {
    name: 'mark_lodged',
    description: 'Mark a compliance obligation as lodged.',
    input_schema: {
      type: 'object' as const,
      properties: {
        obligationId: { type: 'string', description: 'The obligation ID to mark as lodged' },
        lodgedDate: { type: 'string', description: 'Date lodged (ISO, default today)' },
        amountPaid: { type: 'number', description: 'Amount paid in cents' },
        referenceNumber: { type: 'string', description: 'ATO reference number' },
      },
      required: ['obligationId'],
    },
  },
  {
    name: 'search_compliance_rulings',
    description: 'Search Cognee for ATO compliance rulings, guidance, and precedents.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Compliance ruling query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'temporal_compliance_search',
    description:
      'Find time-relevant compliance context and ATO ruling changes for a specific period.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Compliance query' },
        period: {
          type: 'string',
          description: 'Period identifier (e.g., "2025-Q1", "FY2024-25")',
        },
        lookbackMonths: {
          type: 'number',
          description: 'Months to look back for context (default 6)',
        },
      },
      required: ['query', 'period'],
    },
  },
  {
    name: 'compliance_timeline',
    description:
      'Generate a compliance-focused timeline for audit preparation. Searches across compliance, tax, and BAS modules.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: { type: 'string', description: 'Timeline start date (ISO format)' },
        endDate: { type: 'string', description: 'Timeline end date (ISO format)' },
      },
      required: ['startDate', 'endDate'],
    },
  },
];
