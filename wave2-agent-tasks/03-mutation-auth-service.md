# Agent 3: Mutation Auth Service

## Role
Create the authorization layer that determines which agents can mutate which tables, and under what conditions mutations can auto-execute without user confirmation.

## Priority: SUB-WAVE 1 (No dependencies)

## Files to CREATE

### 1. `server/src/services/claude/mutation-auth.ts`
**Purpose**: Authorization rules engine for agent-proposed mutations

```typescript
import type { AgentType } from './types.js';

/**
 * Authorization decision for a proposed mutation.
 */
export interface MutationAuthDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

/**
 * Table-level permission for an agent.
 */
interface TablePermission {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * Auto-execution rule — when can a mutation skip user confirmation?
 */
interface AutoExecuteRule {
  agentType: AgentType;
  mutationType: string;
  targetTable: string;
  minConfidence: number;
}

/**
 * MutationAuthService enforces a permission matrix that controls:
 * 1. Which agents can propose mutations to which tables
 * 2. Which mutations can auto-execute without user confirmation
 * 3. Confidence thresholds for auto-execution
 *
 * Design:
 * - Haiku agents (fast, cheaper) always require confirmation for writes
 * - Sonnet agents can auto-execute categorization with confidence > 0.9
 * - Financial mutations (GST, BAS, tax) ALWAYS require confirmation
 * - Delete operations ALWAYS require confirmation
 */
export class MutationAuthService {
  /**
   * Check if an agent is allowed to propose a mutation to a given table.
   */
  canPropose(
    agentType: AgentType,
    targetTable: string,
    mutationType: 'create' | 'update' | 'delete' | 'batch_update'
  ): MutationAuthDecision {
    const permissions = this.getTablePermissions(agentType, targetTable);

    if (!permissions) {
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: `Agent '${agentType}' has no permissions for table '${targetTable}'`,
      };
    }

    const opKey = mutationType === 'batch_update' ? 'update' : mutationType;
    if (!permissions[opKey as keyof TablePermission]) {
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: `Agent '${agentType}' cannot ${mutationType} on '${targetTable}'`,
      };
    }

    return {
      allowed: true,
      requiresConfirmation: true, // Default — canAutoExecute() may override
    };
  }

  /**
   * Determine if a mutation can skip user confirmation.
   * Returns false by default — only specific high-confidence scenarios auto-execute.
   */
  canAutoExecute(
    agentType: AgentType,
    mutationType: string,
    targetTable: string,
    confidence: number
  ): boolean {
    // Rule 1: Delete operations NEVER auto-execute
    if (mutationType === 'delete') return false;

    // Rule 2: Financial tables NEVER auto-execute
    if (this.isFinancialTable(targetTable)) return false;

    // Rule 3: Check specific auto-execute rules
    const rule = this.autoExecuteRules.find(
      (r) =>
        r.agentType === agentType &&
        r.mutationType === mutationType &&
        r.targetTable === targetTable
    );

    if (!rule) return false;

    // Rule 4: Confidence threshold must be met
    return confidence >= rule.minConfidence;
  }

  /**
   * Get the full permission matrix for an agent.
   */
  getAgentPermissions(
    agentType: AgentType
  ): Record<string, TablePermission> {
    return this.permissionMatrix[agentType] ?? {};
  }

  // ── Permission Matrix ────────────────────────────────

  /**
   * Agent → Table permission matrix.
   * Only agents with explicit permissions can propose mutations.
   */
  private getTablePermissions(
    agentType: AgentType,
    targetTable: string
  ): TablePermission | null {
    const agentPerms = this.permissionMatrix[agentType];
    if (!agentPerms) return null;

    // Check for exact match first
    if (agentPerms[targetTable]) return agentPerms[targetTable];

    // Check for wildcard pattern (e.g., 'transactions' matches any agent with transactions access)
    return null;
  }

  private readonly permissionMatrix: Partial<
    Record<AgentType, Record<string, TablePermission>>
  > = {
    // ── Categorization agents ──
    transaction_categorizer: {
      transactions: { read: true, create: false, update: true, delete: false },
      merchant_memory: { read: true, create: true, update: true, delete: false },
      pending_categorization: { read: true, create: true, update: true, delete: true },
    },

    // ── GST agent ──
    gst_calculator: {
      transactions: { read: true, create: false, update: true, delete: false },
      bas_calculations: { read: true, create: true, update: true, delete: false },
      bas_periods: { read: true, create: true, update: true, delete: false },
    },

    // ── Statement parser ──
    statement_parser: {
      transactions: { read: true, create: true, update: false, delete: false },
      statements: { read: true, create: false, update: true, delete: false },
      accounts: { read: true, create: true, update: true, delete: false },
    },

    // ── Reconciliation ──
    account_reconciler: {
      transactions: { read: true, create: false, update: true, delete: false },
      reconciliation_alerts: { read: true, create: true, update: true, delete: false },
      transfer_links: { read: true, create: true, update: false, delete: false },
    },

    // ── Cross-account tracer ──
    cross_account_tracer: {
      transfer_links: { read: true, create: true, update: true, delete: false },
      transactions: { read: true, create: false, update: true, delete: false },
    },

    // ── Merchant intelligence ──
    merchant_intelligence: {
      merchant_memory: { read: true, create: true, update: true, delete: false },
      transactions: { read: true, create: false, update: true, delete: false },
    },

    // ── Budget analyzer ──
    budget_analyzer: {
      transactions: { read: true, create: false, update: false, delete: false },
    },

    // ── Payroll ──
    payroll_agent: {
      wage_payments: { read: true, create: true, update: true, delete: false },
      transactions: { read: true, create: false, update: true, delete: false },
    },

    // ── Tax strategy ──
    tax_strategy: {
      tax_strategies: { read: true, create: true, update: true, delete: false },
      deductions: { read: true, create: true, update: true, delete: false },
    },

    // ── Personal tax claims ──
    personal_tax_claims: {
      deductions: { read: true, create: true, update: true, delete: false },
      transactions: { read: true, create: false, update: true, delete: false },
    },

    // ── Financial planner ──
    financial_planner: {
      transactions: { read: true, create: false, update: false, delete: false },
    },

    // ── Financial reporting ──
    financial_reporting: {
      report_snapshots: { read: true, create: true, update: false, delete: false },
      kpi_metrics: { read: true, create: true, update: true, delete: false },
    },

    // ── Budgeting ──
    budgeting: {
      budgets: { read: true, create: true, update: true, delete: false },
      budget_lines: { read: true, create: true, update: true, delete: true },
      budget_vs_actual: { read: true, create: true, update: true, delete: false },
    },

    // ── Forecasting ──
    forecasting: {
      forecast_scenarios: { read: true, create: true, update: true, delete: false },
      forecast_periods: { read: true, create: true, update: true, delete: false },
    },

    // ── Compliance monitoring ──
    compliance_monitoring: {
      transactions: { read: true, create: false, update: false, delete: false },
    },

    // ── OCR Processing ──
    ocr_processing: {
      ocr_documents: { read: true, create: true, update: true, delete: false },
      ocr_line_items: { read: true, create: true, update: true, delete: true },
    },

    // ── Payment matching ──
    payment_matching: {
      payment_matches: { read: true, create: true, update: true, delete: false },
      payment_match_rules: { read: true, create: true, update: true, delete: false },
    },

    // ── Inventory ──
    inventory_agent: {
      inventory_items: { read: true, create: true, update: true, delete: false },
      inventory_stock: { read: true, create: true, update: true, delete: false },
      inventory_movements: { read: true, create: true, update: false, delete: false },
    },

    // ── Bank reconciler ──
    bank_reconciler_agent: {
      bank_recon_matches: { read: true, create: true, update: true, delete: false },
      bank_recon_rules: { read: true, create: true, update: true, delete: false },
      bank_recon_sessions: { read: true, create: true, update: true, delete: false },
    },

    // ── Asset management ──
    asset_management: {
      fixed_assets: { read: true, create: true, update: true, delete: false },
      asset_depreciation: { read: true, create: true, update: true, delete: false },
      asset_disposals: { read: true, create: true, update: false, delete: false },
    },

    // ── Multi-entity ──
    multi_entity: {
      inter_entity_transactions: { read: true, create: true, update: true, delete: false },
      consolidation_snapshots: { read: true, create: true, update: false, delete: false },
      consolidation_snapshot_lines: { read: true, create: true, update: false, delete: false },
    },
  };

  // ── Auto-Execute Rules ───────────────────────────────

  /**
   * Specific scenarios where mutations can auto-execute.
   * These are intentionally conservative — financial safety matters.
   */
  private readonly autoExecuteRules: AutoExecuteRule[] = [
    // Transaction categorization with high confidence
    {
      agentType: 'transaction_categorizer' as AgentType,
      mutationType: 'update',
      targetTable: 'transactions',
      minConfidence: 0.9,
    },
    // Merchant memory updates (learning from user corrections)
    {
      agentType: 'merchant_intelligence' as AgentType,
      mutationType: 'create',
      targetTable: 'merchant_memory',
      minConfidence: 0.85,
    },
    {
      agentType: 'merchant_intelligence' as AgentType,
      mutationType: 'update',
      targetTable: 'merchant_memory',
      minConfidence: 0.85,
    },
    // Transfer link detection with high confidence
    {
      agentType: 'cross_account_tracer' as AgentType,
      mutationType: 'create',
      targetTable: 'transfer_links',
      minConfidence: 0.95,
    },
    // Batch categorization updates
    {
      agentType: 'transaction_categorizer' as AgentType,
      mutationType: 'batch_update',
      targetTable: 'transactions',
      minConfidence: 0.9,
    },
  ];

  // ── Financial Table Detection ────────────────────────

  /**
   * Financial-sensitive tables where mutations ALWAYS require confirmation.
   * Even if an auto-execute rule exists, financial tables override it.
   */
  private isFinancialTable(table: string): boolean {
    const financialTables = new Set([
      'bas_calculations',
      'bas_periods',
      'tax_year_summary',
      'deductions',
      'cgt_assets',
      'cgt_events',
      'tax_offsets',
      'capital_losses',
      'tax_strategies',
      'journal_entries',
      'journal_entry_lines',
      'account_balances',
      'wage_payments',
    ]);
    return financialTables.has(table);
  }
}
```

#### Key Design Decisions:
- [ ] Permission matrix covers ALL 21 existing agent types
- [ ] Haiku agents have limited write permissions (no financial tables)
- [ ] Auto-execute rules are conservative: only categorization (0.9) and merchant memory (0.85)
- [ ] Financial tables (BAS, tax, journal entries) ALWAYS require confirmation
- [ ] Delete operations ALWAYS require confirmation
- [ ] Agents not in the matrix get denied by default (allowlist pattern)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `MutationAuthService` class is exported
- [ ] `MutationAuthDecision` interface is exported
- [ ] `canPropose('transaction_categorizer', 'transactions', 'update')` returns `{ allowed: true }`
- [ ] `canPropose('budget_analyzer', 'transactions', 'update')` returns `{ allowed: false }` (read-only agent)
- [ ] `canAutoExecute('transaction_categorizer', 'update', 'transactions', 0.95)` returns `true`
- [ ] `canAutoExecute('gst_calculator', 'update', 'bas_calculations', 0.99)` returns `false` (financial table)
- [ ] `canAutoExecute('transaction_categorizer', 'delete', 'transactions', 1.0)` returns `false` (delete never auto-executes)
- [ ] No modifications to any existing files
- [ ] Create marker file: `.agent-done-W02-03` (REVISION: zero-padded per D04/D05)

## Dependencies
- **Requires**: Nothing — Sub-Wave 1 task
- **Blocks**: Agent 4 (ConfirmationFlow needs auth decisions)
