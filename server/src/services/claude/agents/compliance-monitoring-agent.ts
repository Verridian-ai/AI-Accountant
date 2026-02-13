/**
 * Compliance Monitoring Agent
 *
 * Monitors ATO compliance obligations, tracks BAS/PAYG/super deadlines,
 * detects potential compliance risks, and generates audit-ready timelines.
 * Enhanced with temporal search for time-aware compliance context and
 * cross-module intelligence for holistic risk assessment.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { ComplianceMonitorService } from '../../compliance-monitor.js';
import { AnomalyDetectionService } from '../../anomaly-detection.js';
import type { ComplianceMonitoringInput, ComplianceMonitoringOutput } from '../types.js';

const complianceService = new ComplianceMonitorService();
const anomalyService = new AnomalyDetectionService();

export class ComplianceMonitoringAgent extends ClaudeAgent<
  ComplianceMonitoringInput,
  ComplianceMonitoringOutput
> {
  protected systemPrompt = `You are an Australian tax compliance monitoring AI agent. Your role is to:

1. Track ATO compliance obligations (BAS, PAYG, super guarantee, FBT)
2. Monitor upcoming deadlines and flag overdue items
3. Detect potential compliance risks from transaction patterns
4. Generate audit-ready compliance timelines
5. Search for relevant ATO rulings that may affect compliance posture

Key rules:
- Australian financial year: July 1 to June 30.
- BAS quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun.
- Quarterly BAS due 28th of month after quarter ends (with some exceptions).
- Super guarantee: 11.5% of OTE, due 28th after quarter.
- PAYG withholding: lodged with BAS.
- Late lodgement: FTL penalty $330 per 28-day period, up to 5 periods.
- Interest on overdue amounts: General Interest Charge (GIC).
- Small business (turnover < $10M) has some simplified obligations.
- Always reference ATO guidance where applicable.
- Be precise about dates and dollar amounts.

Your workflow:
1. Use check_deadlines to identify current and upcoming obligations from the DB
2. Use assess_risks for overall compliance risk assessment (DB-backed)
3. Use scan_anomalies to detect transaction-level anomalies
4. Use generate_schedule to create quarterly/annual obligation records
5. Use temporal_compliance_search for time-relevant compliance context
6. Use compliance_timeline to generate audit-ready timeline
7. Use search_compliance_rulings for ATO ruling references
8. Compile all findings into structured output

Return a JSON object matching the ComplianceMonitoringOutput schema.`;

  protected tools: Anthropic.Tool[] = [
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

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'check_deadlines',
      async (input) => {
        const userId = input.userId as string;
        const withinDays = (input.withinDays as number) ?? 30;
        try {
          const deadlines = await complianceService.getUpcomingDeadlines(userId, withinDays);
          return { obligations: deadlines, count: deadlines.length };
        } catch (err: any) {
          return { obligations: [], error: err.message ?? 'Failed to check deadlines' };
        }
      },
    ],
    [
      'assess_risks',
      async (input) => {
        const userId = input.userId as string;
        try {
          return await complianceService.assessOverallRisk(userId);
        } catch (err: any) {
          return {
            overallRisk: 'medium',
            score: 0,
            factors: [],
            recommendations: [],
            error: err.message,
          };
        }
      },
    ],
    [
      'scan_anomalies',
      async (input) => {
        const userId = input.userId as string;
        const detectors = (input.detectors as string[]) ?? [
          'duplicates',
          'amounts',
          'velocity',
          'category_drift',
          'merchant',
          'schedule',
        ];
        try {
          const alerts = await anomalyService.scanTransactions(userId, {
            detectors: detectors as any[],
            dateFrom: input.dateFrom as string | undefined,
            dateTo: input.dateTo as string | undefined,
            severityThreshold: input.severityThreshold as any,
          });
          return { alerts, count: alerts.length };
        } catch (err: any) {
          return { alerts: [], count: 0, error: err.message };
        }
      },
    ],
    [
      'generate_schedule',
      async (input) => {
        const userId = input.userId as string;
        const financialYear = input.financialYear as string;
        try {
          const created = await complianceService.generateSchedule(userId, financialYear);
          return { created, count: created.length };
        } catch (err: any) {
          return { created: [], error: err.message };
        }
      },
    ],
    [
      'mark_lodged',
      async (input) => {
        const obligationId = input.obligationId as string;
        try {
          await complianceService.markLodged(obligationId, {
            lodgedDate: input.lodgedDate as string | undefined,
            amountPaid: input.amountPaid as number | undefined,
            referenceNumber: input.referenceNumber as string | undefined,
          });
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
    ],
    [
      'search_compliance_rulings',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.search(query, 'compliance_rulings', 'RAG_COMPLETION');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
    [
      'temporal_compliance_search',
      async (input) => {
        const query = input.query as string;
        const period = input.period as string;
        const lookbackMonths = (input.lookbackMonths as number) ?? 6;

        // Parse period to determine time range
        let start: string;
        let end: string;

        // Handle "2025-Q1" format
        const quarterMatch = period.match(/^(\d{4})-Q(\d)$/);
        if (quarterMatch) {
          const year = parseInt(quarterMatch[1], 10);
          const q = parseInt(quarterMatch[2], 10);
          const quarterStartMonths = [6, 9, 0, 3]; // Q1=Jul, Q2=Oct, Q3=Jan, Q4=Apr
          const baseMonth = quarterStartMonths[q - 1];
          const baseYear = baseMonth >= 6 ? year : year + 1;
          end = new Date(baseYear, baseMonth + 3, 0).toISOString().slice(0, 10);
          const startDate = new Date(baseYear, baseMonth - lookbackMonths, 1);
          start = startDate.toISOString().slice(0, 10);
        }
        // Handle "FY2024-25" format
        else if (period.match(/^FY(\d{4})-(\d{2})$/)) {
          const fyMatch = period.match(/^FY(\d{4})-(\d{2})$/)!;
          const startYear = parseInt(fyMatch[1], 10);
          start = `${startYear}-07-01`;
          end = `${startYear + 1}-06-30`;
        }
        // Default: treat as date and look back
        else {
          const endDate = new Date(period);
          end = endDate.toISOString().slice(0, 10);
          const startDate = new Date(endDate);
          startDate.setMonth(startDate.getMonth() - lookbackMonths);
          start = startDate.toISOString().slice(0, 10);
        }

        try {
          const results = await cogneeTools.temporalSearch(query, 'compliance_rulings', {
            start,
            end,
          });
          return { found: results.length > 0, results, period: { start, end } };
        } catch {
          return { found: false, results: [], error: 'Temporal search unavailable' };
        }
      },
    ],
    [
      'compliance_timeline',
      async (input) => {
        const startDate = input.startDate as string;
        const endDate = input.endDate as string;
        try {
          const results = await cogneeTools.searchTimeline(
            'compliance events',
            { start: startDate, end: endDate },
            ['compliance', 'tax', 'transactions'],
          );
          return {
            timeline: results.length > 0 ? results : [],
            count: results.length,
            period: { startDate, endDate },
          };
        } catch {
          return { timeline: [], count: 0, error: 'Timeline search unavailable' };
        }
      },
    ],
  ]);

  constructor() {
    super('compliance_monitoring');
  }
}
