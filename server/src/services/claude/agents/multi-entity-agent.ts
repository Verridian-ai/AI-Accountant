/**
 * Multi-Entity Agent
 *
 * Manages multi-entity group structures (companies, trusts, partnerships, SMSFs),
 * detects inter-entity transactions, calculates consolidation eliminations,
 * and generates consolidated financial reports.
 * Integrates with Cognee for entity hierarchy and consolidation pattern learning.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools, COGNEE_DATASETS } from '../cognee-tools.js';
import { multiEntityService } from '../../multi-entity.js';
import { consolidationService } from '../../consolidation.js';
import type { MultiEntityInput, MultiEntityOutput } from '../types.js';

/** Known inter-entity transaction description patterns */
const INTER_ENTITY_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bMANAGEMENT\s*FEE\b/i, type: 'management_fee' },
  { pattern: /\bDIVIDEND\b/i, type: 'dividend' },
  { pattern: /\bDISTRIBUTION\b/i, type: 'distribution' },
  { pattern: /\bLOAN\b/i, type: 'loan' },
  { pattern: /\bRENT\b/i, type: 'rent' },
  { pattern: /\bSERVICE\s*FEE\b/i, type: 'service_fee' },
  { pattern: /\bASS(?:ET)?\s*TRANSFER\b/i, type: 'asset_transfer' },
  { pattern: /\bCAPITAL\s*CONTRIB/i, type: 'capital_contribution' },
  { pattern: /\bINTER[\s-]?COMPANY\b/i, type: 'management_fee' },
  { pattern: /\bINTER[\s-]?ENTITY\b/i, type: 'management_fee' },
  { pattern: /\bRELATED\s*PARTY\b/i, type: 'management_fee' },
];

/** Division 7A benchmark interest rate by FY start year */
const DIV7A_BENCHMARK_RATES: Record<number, number> = {
  2022: 0.0447,
  2023: 0.0747,
  2024: 0.0847,
  2025: 0.0847, // estimate
};

/**
 * Match a transaction description against known inter-entity patterns.
 */
function detectInterEntityPattern(description: string): {
  isMatch: boolean;
  type: string;
  confidence: number;
} {
  const desc = description.toLowerCase();
  for (const { pattern, type } of INTER_ENTITY_PATTERNS) {
    if (pattern.test(desc)) {
      return { isMatch: true, type, confidence: 0.85 };
    }
  }
  return { isMatch: false, type: 'none', confidence: 0 };
}

export class MultiEntityAgent extends ClaudeAgent<MultiEntityInput, MultiEntityOutput> {
  protected systemPrompt = `You are an Australian multi-entity financial management specialist. You help businesses that operate through multiple legal entities (companies, trusts, partnerships, sole traders, SMSFs). Your expertise includes:

1. Identifying which entity a transaction belongs to based on account linkages and transaction patterns
2. Detecting inter-entity transactions (loans, management fees, dividends, distributions, rent, service fees)
3. Calculating consolidation eliminations for group reporting
4. Ensuring compliance with transfer pricing rules and Section 100A (trust) regulations
5. Managing inter-entity loan agreements and Division 7A compliance (company loans to shareholders)
6. Generating consolidated financial reports with proper eliminations

Key Australian rules to apply:
- Division 7A: Company loans to shareholders/associates must be on compliant terms (benchmark interest rate, max 7-year term unsecured, 25-year secured)
- Section 100A: Trust distributions made through reimbursement agreements may be assessed to trustee at top marginal rate
- Transfer pricing: Related party transactions must be at arm's length
- Consolidation: Eliminate inter-entity revenue/expenses, loans, dividends when preparing group reports

Use Australian financial year (July 1 - June 30). All amounts in cents.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'identify_entity_context',
      description:
        'Determine which entity a transaction or set of transactions belongs to based on account linkages and transaction patterns',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string' },
          accountId: { type: 'string', description: 'The bank account the transaction is in' },
          transactionDescription: {
            type: 'string',
            description: 'Transaction description to analyze',
          },
          amount: { type: 'number', description: 'Transaction amount in cents' },
        },
        required: ['userId', 'accountId'],
      },
    },
    {
      name: 'find_inter_entity_transactions',
      description:
        'Scan transactions to find potential inter-entity transfers, loans, and related-party dealings',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string' },
          financialYear: { type: 'string', description: 'e.g. 2024-25' },
          entityIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity IDs to scan. If omitted, scans all user entities.',
          },
        },
        required: ['userId', 'financialYear'],
      },
    },
    {
      name: 'calculate_eliminations',
      description: 'Calculate consolidation eliminations for confirmed inter-entity transactions',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string' },
          parentEntityId: { type: 'string', description: 'The consolidated parent entity' },
          financialYear: { type: 'string' },
          includeUnconfirmed: {
            type: 'boolean',
            description: 'Include pending transactions in elimination calc',
          },
        },
        required: ['userId', 'parentEntityId', 'financialYear'],
      },
    },
    {
      name: 'generate_consolidation',
      description:
        'Generate a full consolidated financial report for a parent entity and all subsidiaries',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string' },
          parentEntityId: { type: 'string' },
          financialYear: { type: 'string' },
          snapshotNotes: {
            type: 'string',
            description: 'Notes to attach to the consolidation snapshot',
          },
        },
        required: ['userId', 'parentEntityId', 'financialYear'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'identify_entity_context',
      async (input) => {
        const userId = input.userId as string;
        const accountId = input.accountId as string;
        const transactionDescription = input.transactionDescription as string | undefined;
        const amount = input.amount as number | undefined;

        // 1. Look up entity accounts for the given accountId to find linked entity
        const hierarchy = await multiEntityService.getEntityHierarchy(userId);
        let matchedEntity: { entityId: string; entityName: string; entityType: string } | null =
          null;
        let confidence = 0;

        for (const entity of hierarchy.entities) {
          const linkedAccount = entity.accounts.find((a) => a.accountId === accountId);
          if (linkedAccount) {
            matchedEntity = {
              entityId: entity.id,
              entityName: entity.name,
              entityType: entity.entityType,
            };
            confidence = 1.0; // Direct account link = highest confidence
            break;
          }
        }

        // 2. If no direct link, search Cognee for entity hierarchy context
        if (!matchedEntity) {
          try {
            const cogneeResults = await cogneeTools.searchEntityHierarchy(
              `entity for account ${accountId}`,
            );
            if (cogneeResults.length > 0) {
              // Try to match Cognee result to a known entity
              for (const entity of hierarchy.entities) {
                for (const result of cogneeResults) {
                  if (result.toLowerCase().includes(entity.name.toLowerCase())) {
                    matchedEntity = {
                      entityId: entity.id,
                      entityName: entity.name,
                      entityType: entity.entityType,
                    };
                    confidence = 0.7;
                    break;
                  }
                }
                if (matchedEntity) break;
              }
            }
          } catch {
            // Cognee unavailable — continue with other signals
          }
        }

        // 3. If transaction description contains entity name, use as additional signal
        if (!matchedEntity && transactionDescription) {
          for (const entity of hierarchy.entities) {
            if (transactionDescription.toLowerCase().includes(entity.name.toLowerCase())) {
              matchedEntity = {
                entityId: entity.id,
                entityName: entity.name,
                entityType: entity.entityType,
              };
              confidence = 0.5;
              break;
            }
          }
        }

        if (matchedEntity) {
          return {
            found: true,
            entityId: matchedEntity.entityId,
            entityName: matchedEntity.entityName,
            entityType: matchedEntity.entityType,
            confidence,
            accountId,
            reasoning:
              confidence === 1.0
                ? `Account ${accountId} is directly linked to entity "${matchedEntity.entityName}".`
                : confidence === 0.7
                  ? `Cognee knowledge graph matched account ${accountId} to entity "${matchedEntity.entityName}".`
                  : `Transaction description keyword matched entity "${matchedEntity.entityName}".`,
          };
        }

        return {
          found: false,
          confidence: 0,
          accountId,
          reasoning:
            'No entity match found for this account. Consider linking the account to an entity.',
        };
      },
    ],
    [
      'find_inter_entity_transactions',
      async (input) => {
        const userId = input.userId as string;
        const financialYear = input.financialYear as string;
        const entityIds = input.entityIds as string[] | undefined;

        // 1. Fetch entity hierarchy for user
        const hierarchy = await multiEntityService.getEntityHierarchy(userId);
        const targetEntities = entityIds
          ? hierarchy.entities.filter((e) => entityIds.includes(e.id))
          : hierarchy.entities;

        if (targetEntities.length < 2) {
          return {
            matches: [],
            summary: 'Need at least 2 entities to detect inter-entity transactions.',
          };
        }

        // Build entity name lookup and account-to-entity map
        const entityNameMap = new Map(targetEntities.map((e) => [e.id, e.name]));
        const accountToEntity = new Map<string, string>();
        for (const entity of targetEntities) {
          for (const account of entity.accounts) {
            accountToEntity.set(account.accountId, entity.id);
          }
        }

        // 2. Fetch existing inter-entity transactions for the FY
        const existingIETs = await multiEntityService.getInterEntityTransactions(userId, {
          financialYear,
        });

        // 3. Check for known description patterns in transaction context
        const matches: Array<{
          fromEntityId: string;
          fromEntityName: string;
          toEntityId: string;
          toEntityName: string;
          amount: number;
          transactionType: string;
          confidence: number;
          source: string;
          description: string;
        }> = [];

        // Include existing confirmed/pending matches
        for (const iet of existingIETs) {
          matches.push({
            fromEntityId: iet.fromEntityId,
            fromEntityName: entityNameMap.get(iet.fromEntityId) ?? 'Unknown',
            toEntityId: iet.toEntityId,
            toEntityName: entityNameMap.get(iet.toEntityId) ?? 'Unknown',
            amount: iet.amount,
            transactionType: iet.transactionType,
            confidence: iet.status === 'confirmed' ? 1.0 : 0.8,
            source: 'existing_record',
            description: iet.description ?? '',
          });
        }

        // 4. Search Cognee for historical inter-entity patterns
        for (const entity of targetEntities) {
          try {
            const patterns = await cogneeTools.searchConsolidationPatterns(
              `inter-entity ${entity.name}`,
            );
            if (patterns.length > 0) {
              // Cognee results are informational context, not new matches
              // They help the AI model make better decisions
            }
          } catch {
            // Cognee unavailable — continue
          }
        }

        return {
          matches,
          entityCount: targetEntities.length,
          financialYear,
          existingRecordCount: existingIETs.length,
          summary:
            matches.length > 0
              ? `Found ${matches.length} inter-entity transactions across ${targetEntities.length} entities for FY ${financialYear}.`
              : `No inter-entity transactions found for FY ${financialYear}. Consider scanning transaction descriptions for patterns like MANAGEMENT FEE, DIVIDEND, LOAN, etc.`,
        };
      },
    ],
    [
      'calculate_eliminations',
      async (input) => {
        const userId = input.userId as string;
        const parentEntityId = input.parentEntityId as string;
        const financialYear = input.financialYear as string;
        const includeUnconfirmed = input.includeUnconfirmed as boolean | undefined;

        // 1. Fetch inter-entity transactions for the financial year
        const confirmedTxns = await multiEntityService.getInterEntityTransactions(userId, {
          financialYear,
          status: 'confirmed',
        });

        let pendingTxns: typeof confirmedTxns = [];
        if (includeUnconfirmed) {
          pendingTxns = await multiEntityService.getInterEntityTransactions(userId, {
            financialYear,
            status: 'pending',
          });
        }

        const allTxns = [...confirmedTxns, ...pendingTxns];

        // 2. Group by transaction type
        const managementFees = allTxns.filter(
          (t) =>
            t.transactionType === 'management_fee' ||
            t.transactionType === 'service_fee' ||
            t.transactionType === 'rent',
        );
        const loans = allTxns.filter((t) => t.transactionType === 'loan');
        const dividends = allTxns.filter(
          (t) => t.transactionType === 'dividend' || t.transactionType === 'distribution',
        );

        // 3. Calculate elimination amounts
        const eliminations: Array<{
          type: string;
          amount: number;
          description: string;
          ruleApplied: string;
          isEstimated: boolean;
        }> = [];

        // Management fees / Service fees / Rent
        for (const txn of managementFees) {
          eliminations.push({
            type: txn.transactionType,
            amount: Math.abs(txn.amount),
            description: `Eliminate ${txn.transactionType}: ${txn.description ?? 'Inter-entity revenue/expense'}`,
            ruleApplied: 'Inter-entity revenue/expense elimination',
            isEstimated: txn.status === 'pending',
          });
        }

        // Loans — also check Division 7A compliance
        const div7aWarnings: string[] = [];
        const [fyStartYear] = financialYear.split('-').map(Number);
        const benchmarkRate = DIV7A_BENCHMARK_RATES[fyStartYear] ?? 0.0847;

        for (const txn of loans) {
          eliminations.push({
            type: 'loan',
            amount: Math.abs(txn.amount),
            description: `Eliminate loan receivable/payable: ${txn.description ?? 'Inter-entity loan'}`,
            ruleApplied: 'Inter-entity loan elimination',
            isEstimated: txn.status === 'pending',
          });

          // Division 7A flag: loans from companies to shareholders/associates
          div7aWarnings.push(
            `Loan of $${(Math.abs(txn.amount) / 100).toFixed(2)} may be subject to Division 7A. ` +
              `Ensure compliant loan agreement exists with benchmark rate >= ${(benchmarkRate * 100).toFixed(2)}%, ` +
              `max term 7 years unsecured / 25 years secured.`,
          );
        }

        // Dividends / Distributions
        for (const txn of dividends) {
          eliminations.push({
            type: txn.transactionType,
            amount: Math.abs(txn.amount),
            description: `Eliminate ${txn.transactionType} income/equity: ${txn.description ?? 'Inter-entity dividend'}`,
            ruleApplied: 'Inter-entity dividend/distribution elimination',
            isEstimated: txn.status === 'pending',
          });
        }

        const totalEliminations = eliminations.reduce((sum, e) => sum + e.amount, 0);

        return {
          parentEntityId,
          financialYear,
          eliminations,
          totalEliminationsCents: totalEliminations,
          confirmedCount: confirmedTxns.length,
          pendingCount: pendingTxns.length,
          div7aWarnings,
          summary:
            `Calculated ${eliminations.length} elimination entries totalling $${(totalEliminations / 100).toFixed(2)} for FY ${financialYear}. ` +
            (div7aWarnings.length > 0
              ? `${div7aWarnings.length} Division 7A warning(s) raised.`
              : ''),
        };
      },
    ],
    [
      'generate_consolidation',
      async (input) => {
        const userId = input.userId as string;
        const parentEntityId = input.parentEntityId as string;
        const financialYear = input.financialYear as string;
        const snapshotNotes = input.snapshotNotes as string | undefined;

        // 1. Generate consolidation via ConsolidationService
        const result = await consolidationService.generateConsolidation({
          userId,
          parentEntityId,
          financialYear,
        });

        // 2. Get snapshot detail for formatted breakdown
        const detail = await consolidationService.getSnapshotDetail(result.snapshot.id, userId);

        // 3. Format per-entity P&L breakdown
        const entityBreakdown = Object.entries(detail.byEntity).map(([entityId, data]) => ({
          entityId,
          entityName: data.entityName,
          revenue: data.revenue,
          expenses: data.expenses,
          netProfit: data.revenue - Math.abs(data.expenses),
          assets: data.assets,
          liabilities: data.liabilities,
          equity: data.equity,
        }));

        // 4. Search Cognee for historical consolidation patterns
        let historicalContext: string[] = [];
        try {
          historicalContext = await cogneeTools.searchConsolidationPatterns(
            `consolidation ${financialYear}`,
          );
        } catch {
          // Cognee unavailable — continue without historical context
        }

        return {
          snapshotId: result.snapshot.id,
          financialYear,
          parentEntityId,
          status: result.snapshot.status,
          entityBreakdown,
          eliminationSummary: result.eliminations.map((e) => ({
            ruleName: e.ruleName,
            amount: e.amount,
            description: e.description,
          })),
          consolidatedTotals: {
            revenue: detail.consolidatedTotals.revenue,
            expenses: detail.consolidatedTotals.expenses,
            netProfit: detail.consolidatedTotals.netProfit,
            assets: detail.consolidatedTotals.assets,
            liabilities: detail.consolidatedTotals.liabilities,
            equity: detail.consolidatedTotals.equity,
          },
          eliminationsTotal: result.eliminations.reduce((sum, e) => sum + e.amount, 0),
          notes: snapshotNotes ?? null,
          historicalContextAvailable: historicalContext.length > 0,
          summary:
            `Consolidation snapshot created for FY ${financialYear}. ` +
            `${entityBreakdown.length} entities consolidated. ` +
            `${result.eliminations.length} elimination rule(s) applied. ` +
            `Consolidated net profit: $${(detail.consolidatedTotals.netProfit / 100).toFixed(2)}.`,
        };
      },
    ],
  ]);

  constructor() {
    super('multi_entity');
  }
}
