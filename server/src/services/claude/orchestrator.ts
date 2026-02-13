/**
 * Claude Agent Framework — Orchestrator
 *
 * Central agent registry, context assembly, SSE progress events,
 * and dual-mode fallback (USE_CLAUDE_AGENTS toggle).
 */

import { events } from '../../events.js';
import { isClaudeAgentsEnabled, isAgentEnabled, VERCEL_MIGRATION_FLAGS } from './config.js';
import { AgentCircuitBreaker } from './retry.js';
import { CogneeTools } from './cognee-tools.js';
import { cogneeSessionService, type CogneeSessionContext } from '../cognee-sessions.js';
import { ClaudeAgent } from './base-agent.js';
import { StatementParserAgent } from './agents/statement-parser.js';
import { TransactionCategorizerAgent } from './agents/transaction-categorizer.js';
import { GSTCalculatorAgent } from './agents/gst-calculator.js';
import { AccountReconcilerAgent } from './agents/account-reconciler.js';
import { BudgetAnalyzerAgent } from './agents/budget-analyzer.js';
import { CrossAccountTracerAgent } from './agents/cross-account-tracer.js';
import { MerchantIntelligenceAgent } from './agents/merchant-intelligence.js';
import { MarketIntelligenceAgent } from './agents/market-intelligence-agent.js';
import { TenantRoutingAgent } from './agents/tenant-routing.js';
import { InvoiceAgent } from './agents/invoice-agent.js';
import { AccountsPayableAgent } from './agents/accounts-payable-agent.js';
import { VercelTransactionCategorizer } from './agents/vercel/transaction-categorizer.js';
import { VercelBudgetAnalyzer } from './agents/vercel/budget-analyzer.js';
import { VercelFinancialPlanner } from './agents/vercel/financial-planner.js';
import { VercelTaxStrategy } from './agents/vercel/tax-strategy.js';
import { VercelMerchantIntelligence } from './agents/vercel/merchant-intelligence.js';
import { ConfirmationFlowService } from './confirmation-flow.js';
import { MutationTools } from './mutation-tools.js';
import type {
  AgentType,
  StatementParserInput,
  StatementParserOutput,
  CategorizerInput,
  CategorizerOutput,
  GSTCalculatorInput,
  GSTCalculatorOutput,
  ReconcilerInput,
  ReconcilerOutput,
  BudgetAnalyzerInput,
  BudgetAnalyzerOutput,
  CrossAccountTracerInput,
  CrossAccountTracerOutput,
  MerchantIntelligenceInput,
  MerchantIntelligenceOutput,
  TaxStrategyInput,
  TaxStrategyOutput,
  FinancialPlannerInput,
  FinancialPlannerOutput,
  MarketIntelInput,
  MarketIntelOutput,
  TenantRoutingInput,
  TenantRoutingOutput,
  InvoiceAgentInput,
  InvoiceAgentOutput,
  AccountsPayableInput,
  AccountsPayableOutput,
  TokenUsage,
} from './types.js';

// Union of all agent I/O types
type AgentInputMap = {
  statement_parser: StatementParserInput;
  transaction_categorizer: CategorizerInput;
  gst_calculator: GSTCalculatorInput;
  account_reconciler: ReconcilerInput;
  budget_analyzer: BudgetAnalyzerInput;
  cross_account_tracer: CrossAccountTracerInput;
  merchant_intelligence: MerchantIntelligenceInput;
  tax_strategy: TaxStrategyInput;
  financial_planner: FinancialPlannerInput;
  market_intelligence: MarketIntelInput;
  tenant_routing: TenantRoutingInput;
  invoice_agent: InvoiceAgentInput;
  accounts_payable_agent: AccountsPayableInput;
  [key: string]: unknown;
};

type AgentOutputMap = {
  statement_parser: StatementParserOutput;
  transaction_categorizer: CategorizerOutput;
  gst_calculator: GSTCalculatorOutput;
  account_reconciler: ReconcilerOutput;
  budget_analyzer: BudgetAnalyzerOutput;
  cross_account_tracer: CrossAccountTracerOutput;
  merchant_intelligence: MerchantIntelligenceOutput;
  tax_strategy: TaxStrategyOutput;
  financial_planner: FinancialPlannerOutput;
  market_intelligence: MarketIntelOutput;
  tenant_routing: TenantRoutingOutput;
  invoice_agent: InvoiceAgentOutput;
  accounts_payable_agent: AccountsPayableOutput;
  [key: string]: unknown;
};

export class AgentOrchestrator {
  private agents: Map<AgentType, ClaudeAgent<unknown, unknown>> = new Map();
  private circuitBreakers: Map<AgentType, AgentCircuitBreaker> = new Map();
  private confirmationFlow?: ConfirmationFlowService;

  constructor() {
    this.registerAgents();
  }

  /**
   * Initialize the mutation framework.
   * Called once during server startup, after db is available.
   */
  initMutationFramework(db: any): void {
    this.confirmationFlow = new ConfirmationFlowService(db);
  }

  private registerAgents() {
    const agentDefs: Array<[AgentType, ClaudeAgent<unknown, unknown>]> = [
      ['statement_parser', new StatementParserAgent() as ClaudeAgent<unknown, unknown>],
      [
        'transaction_categorizer',
        new TransactionCategorizerAgent() as ClaudeAgent<unknown, unknown>,
      ],
      ['gst_calculator', new GSTCalculatorAgent() as ClaudeAgent<unknown, unknown>],
      ['account_reconciler', new AccountReconcilerAgent() as ClaudeAgent<unknown, unknown>],
      ['budget_analyzer', new BudgetAnalyzerAgent() as ClaudeAgent<unknown, unknown>],
      ['cross_account_tracer', new CrossAccountTracerAgent() as ClaudeAgent<unknown, unknown>],
      ['merchant_intelligence', new MerchantIntelligenceAgent() as ClaudeAgent<unknown, unknown>],
      ['market_intelligence', new MarketIntelligenceAgent() as ClaudeAgent<unknown, unknown>],
      ['tenant_routing', new TenantRoutingAgent() as ClaudeAgent<unknown, unknown>],
      ['invoice_agent', new InvoiceAgent() as ClaudeAgent<unknown, unknown>],
      ['accounts_payable_agent', new AccountsPayableAgent() as ClaudeAgent<unknown, unknown>],
    ];

    for (const [type, agent] of agentDefs) {
      this.agents.set(type, agent);
      this.circuitBreakers.set(type, new AgentCircuitBreaker());
    }
  }

  /**
   * Invoke an agent by type with typed input/output.
   */
  async invoke<T extends AgentType>(
    agentType: T,
    input: AgentInputMap[T],
  ): Promise<AgentOutputMap[T] & { usage: TokenUsage }> {
    if (!isClaudeAgentsEnabled()) {
      throw new Error('Claude agents are disabled (USE_CLAUDE_AGENTS != true)');
    }

    if (!isAgentEnabled(agentType)) {
      throw new Error(`Agent ${agentType} is disabled`);
    }

    // Vercel AI SDK migration: check if this agent should use Vercel path
    if (VERCEL_MIGRATION_FLAGS[agentType]) {
      if (agentType === 'transaction_categorizer') {
        const vercelAgent = new VercelTransactionCategorizer();
        const result = await vercelAgent.executeWithFallback(input as any);
        this.emitProgress(agentType, 'completed');
        return {
          ...result.output,
          usage: {
            inputTokens: result.tokenUsage?.promptTokens ?? 0,
            outputTokens: result.tokenUsage?.completionTokens ?? 0,
            toolCalls: 0,
          },
        } as any;
      }
      if (agentType === 'budget_analyzer') {
        const vercelAgent = new VercelBudgetAnalyzer();
        const result = await vercelAgent.executeWithFallback(input as any);
        this.emitProgress(agentType, 'completed');
        return {
          ...result.output,
          usage: {
            inputTokens: result.tokenUsage?.promptTokens ?? 0,
            outputTokens: result.tokenUsage?.completionTokens ?? 0,
            toolCalls: 0,
          },
        } as any;
      }
      if (agentType === 'financial_planner') {
        const vercelAgent = new VercelFinancialPlanner();
        const result = await vercelAgent.executeWithFallback(input as any);
        this.emitProgress(agentType, 'completed');
        return {
          ...result.output,
          usage: {
            inputTokens: result.tokenUsage?.promptTokens ?? 0,
            outputTokens: result.tokenUsage?.completionTokens ?? 0,
            toolCalls: 0,
          },
        } as any;
      }
      if (agentType === 'tax_strategy') {
        const vercelAgent = new VercelTaxStrategy();
        const result = await vercelAgent.executeWithFallback(input as any);
        this.emitProgress(agentType, 'completed');
        return {
          ...result.output,
          usage: {
            inputTokens: result.tokenUsage?.promptTokens ?? 0,
            outputTokens: result.tokenUsage?.completionTokens ?? 0,
            toolCalls: 0,
          },
        } as any;
      }
      if (agentType === 'merchant_intelligence') {
        const vercelAgent = new VercelMerchantIntelligence();
        const result = await vercelAgent.executeWithFallback(input as any);
        this.emitProgress(agentType, 'completed');
        return {
          ...result.output,
          usage: {
            inputTokens: result.tokenUsage?.promptTokens ?? 0,
            outputTokens: result.tokenUsage?.completionTokens ?? 0,
            toolCalls: 0,
          },
        } as any;
      }
    }

    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`);
    }

    // Inject MutationTools if mutation framework is active
    if (this.confirmationFlow) {
      try {
        const session = await this.confirmationFlow.getOrCreateSession({});
        const mutationTools = this.confirmationFlow.createMutationTools(session.id);
        agent.setMutationTools(mutationTools);
      } catch (err) {
        console.warn(`[Orchestrator] Could not inject MutationTools for ${agentType}:`, err);
      }
    }

    this.emitProgress(agentType, 'started');

    const breaker = this.circuitBreakers.get(agentType)!;

    try {
      const result = (await breaker.execute(
        () => agent.invoke(input),
        () => {
          throw new Error(`[${agentType}] Circuit breaker open — falling back`);
        },
      )) as AgentOutputMap[T] & { usage: TokenUsage };

      this.emitProgress(agentType, 'completed', {
        tokenUsage: result.usage,
      });

      return result;
    } catch (error) {
      this.emitProgress(agentType, 'error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process a full statement through the parsing → categorization → GST pipeline.
   *
   * @param tenantId - Optional tenant ID for tenant-scoped Cognee operations (Wave 23).
   */
  async processStatement(
    statementId: number,
    extractedText: string,
    fileName: string,
    merchantMemory: Array<{ pattern: string; category: string; gst: boolean }> = [],
    _tenantId?: string,
  ) {
    // 1. Parse statement
    const parsed = await this.invoke('statement_parser', {
      statementId,
      extractedText,
      fileName,
    });

    // 2. Categorize transactions
    const categorized = await this.invoke('transaction_categorizer', {
      transactions: parsed.transactions.map((tx, i) => ({
        id: i,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        accountId: 0,
        bankId: parsed.bankId,
      })),
      existingMerchantMemory: merchantMemory,
    });

    // 3. GST calculation (non-blocking, best-effort)
    let gst: (GSTCalculatorOutput & { usage: TokenUsage }) | null = null;
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const fyStart = month >= 7 ? year : year - 1;
      let quarter: 1 | 2 | 3 | 4;
      if (month >= 7 && month <= 9) quarter = 1;
      else if (month >= 10 && month <= 12) quarter = 2;
      else if (month >= 1 && month <= 3) quarter = 3;
      else quarter = 4;

      gst = await this.invoke('gst_calculator', {
        transactions: parsed.transactions.map((tx, i) => ({
          id: i,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: categorized.results[i]?.category,
          gstCategory: categorized.results[i]?.gstCategory,
        })),
        quarter: { year: fyStart, quarter },
      });
    } catch (gstErr) {
      console.warn('[Orchestrator] GST calculation failed:', gstErr);
    }

    return { parsed, categorized, gst };
  }

  /**
   * General analysis endpoint — routes to appropriate agent(s).
   */
  async analyze(
    query: string,
    options: { accountIds?: number[]; dateRange?: { start: string; end: string } },
  ) {
    // Use budget analyzer for general analysis
    return this.invoke('budget_analyzer', {
      accountIds: options.accountIds || [],
      dateRange: options.dateRange,
      includeProjections: true,
    });
  }

  /**
   * Check if Claude agents are enabled.
   */
  isEnabled(): boolean {
    return isClaudeAgentsEnabled();
  }

  /**
   * Get mutations for a specific session.
   */
  async getSessionMutations(sessionId: string): Promise<unknown[]> {
    if (!this.confirmationFlow) return [];
    return this.confirmationFlow.getPendingMutations(sessionId);
  }

  /**
   * Get the confirmation flow service instance.
   */
  getConfirmationFlow(): ConfirmationFlowService | undefined {
    return this.confirmationFlow;
  }

  /**
   * Wave 3: Build user-scoped CogneeTools instance.
   * When userId is provided, returns tools with per-user dataset prefix.
   * Falls back to default (unprefixed) tools for admin/anonymous access.
   */
  getUserCogneeTools(userId?: string): CogneeTools {
    return userId ? CogneeTools.forUser(userId) : new CogneeTools();
  }

  /**
   * Wave 3: Retrieve conversation history from a Cognee session.
   * Returns recent turns (last 5) as a formatted string for agent context.
   */
  async getSessionContext(sessionId?: string): Promise<string> {
    if (!sessionId) return '';
    const ctx = await cogneeSessionService.getCogneeSession(sessionId);
    if (!ctx || ctx.conversationHistory.length === 0) return '';
    return ctx.conversationHistory
      .slice(-5)
      .map((t) => `${t.role}: ${t.content}`)
      .join('\n');
  }

  private emitProgress(agentType: AgentType, status: string, data?: Record<string, unknown>) {
    events.emit('update', {
      type: 'agent_progress',
      agent: agentType,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }
}

export const orchestrator = new AgentOrchestrator();
