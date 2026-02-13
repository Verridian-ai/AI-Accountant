# Agent 4: CDR Product Agent Builder

## Role
Build a Claude agent specialized in CDR Open Banking product analysis, rate comparison, and loan scenario modeling with access to crawled product data and Cognee knowledge base.

## Priority: WAVE 18 (After Agents 1, 3, 6)

## Wait Condition
Check for `.agent-done-W18-01`, `.agent-done-W18-03`, `.agent-done-W18-06` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/cdr-product-agent.ts`
**Purpose**: AI agent for banking product analysis and comparison
**Pattern**: Follow `server/src/services/claude/agents/transaction-categorizer.ts` exactly

- [ ] Create `CdrProductAgent extends ClaudeAgent<CdrProductInput, CdrProductOutput>`:

- [ ] Define input/output types:
  ```typescript
  interface CdrProductInput {
    query: string;
    context?: {
      currentProducts?: Array<{ category: string; rate: number; balance: number; provider: string }>;
      financialGoals?: string[];
      riskProfile?: 'conservative' | 'balanced' | 'growth';
      entityType?: 'personal' | 'business';
    };
  }

  interface CdrProductOutput {
    analysis: string;
    recommendations: Array<{
      productId: string;
      productName: string;
      dataHolder: string;
      rate: number;
      comparisonRate: number | null;
      reason: string;
      estimatedSaving: number | null;
    }>;
    comparisons?: Array<{
      metric: string;
      values: Record<string, string | number>;
    }>;
    warnings: string[];
  }
  ```

- [ ] System prompt:
  ```
  You are an Australian banking product specialist with deep knowledge of CDR Open Banking data. You help users find the best banking products by analyzing real-time rate data from Australian financial institutions.

  Your capabilities:
  - Search and filter banking products across all CDR data holders
  - Compare rates, fees, and features between products
  - Calculate loan scenarios with real market rates
  - Identify potential savings opportunities
  - Search indexed product knowledge for detailed insights

  Rules:
  - Always use real CDR data, never fabricate rates or product names
  - Include comparison rates when available (ASIC requirement)
  - Warn about introductory/honeymoon rates vs ongoing rates
  - Note eligibility restrictions that may apply
  - Disclaimer: This is general information, not financial advice
  - All rates are from public CDR APIs and may not reflect negotiated rates
  ```

- [ ] Define 5 tools:

  **Tool 1: `search_products`**
  ```typescript
  {
    name: 'search_products',
    description: 'Search CDR banking products by category, rate type, features, and data holder. Returns matching products with rates.',
    input_schema: {
      type: 'object',
      properties: {
        productCategory: { type: 'string', enum: ['RESIDENTIAL_MORTGAGES', 'TRANS_AND_SAVINGS_ACCOUNTS', 'TERM_DEPOSITS', 'CREDIT_CARDS', 'PERSONAL_LOANS', 'BUSINESS_LOANS'] },
        rateType: { type: 'string', enum: ['FIXED', 'VARIABLE', 'INTRODUCTORY'] },
        maxRate: { type: 'number' },
        minRate: { type: 'number' },
        features: { type: 'array', items: { type: 'string' } },
        loanPurpose: { type: 'string', enum: ['OWNER_OCCUPIED', 'INVESTMENT'] },
        searchText: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  }
  ```
  - Handler calls `cdrProductService.searchProducts()`

  **Tool 2: `compare_rates`**
  ```typescript
  {
    name: 'compare_rates',
    description: 'Compare detailed product information including rates, fees, features, and eligibility for up to 5 products.',
    input_schema: {
      type: 'object',
      properties: {
        productIds: { type: 'array', items: { type: 'string' }, maxItems: 5 }
      },
      required: ['productIds']
    }
  }
  ```
  - Handler calls `cdrProductService.compareProducts()`

  **Tool 3: `calculate_loan_scenario`**
  ```typescript
  {
    name: 'calculate_loan_scenario',
    description: 'Calculate loan repayments, total interest, and comparison with alternative products using real CDR rates.',
    input_schema: {
      type: 'object',
      properties: {
        loanAmount: { type: 'number' },
        termYears: { type: 'number' },
        interestRate: { type: 'number', description: 'Annual rate as percentage (e.g. 6.5)' },
        repaymentType: { type: 'string', enum: ['PRINCIPAL_AND_INTEREST', 'INTEREST_ONLY'] },
        interestOnlyPeriodYears: { type: 'number' },
        extraRepaymentMonthly: { type: 'number' },
        offsetBalance: { type: 'number' }
      },
      required: ['loanAmount', 'termYears', 'interestRate']
    }
  }
  ```
  - Handler calls loan calculation logic (reuse from `loan-calculator.ts`)

  **Tool 4: `find_savings`**
  ```typescript
  {
    name: 'find_savings',
    description: 'Find potential savings by comparing current product rates against best available CDR rates.',
    input_schema: {
      type: 'object',
      properties: {
        currentRate: { type: 'number' },
        currentBalance: { type: 'number' },
        currentMonthlyRepayment: { type: 'number' },
        remainingTermMonths: { type: 'number' },
        productCategory: { type: 'string' }
      },
      required: ['currentRate', 'currentBalance', 'productCategory']
    }
  }
  ```
  - Handler calls `cdrProductService.calculateSavings()`

  **Tool 5: `search_product_knowledge`**
  ```typescript
  {
    name: 'search_product_knowledge',
    description: 'Search indexed CDR product knowledge base for detailed product information, rate history, and market analysis.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        datasets: { type: 'array', items: { type: 'string' } }
      },
      required: ['query']
    }
  }
  ```
  - Handler calls `cogneeTools.search()` with datasets `['cdr_products', 'cdr_rates', 'banking_product_knowledge']`

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
- [ ] Add `'cdr_product_agent'` to the `AgentType` union type
- [ ] Add `CdrProductInput` and `CdrProductOutput` interfaces

### 3. `server/src/services/claude/config.ts`
- [ ] Add `cdr_product_agent` to `AGENT_TOKEN_BUDGETS`: `{ maxInputTokens: 80000, maxOutputTokens: 8000 }`
- [ ] Add `cdr_product_agent` to `AGENT_MODELS`: use Sonnet model (same as tax_strategy)

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Import `CdrProductAgent` and register in agent registry
- [ ] Add routing logic: queries about banking products, rates, loans, mortgages route to `cdr_product_agent`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] CdrProductAgent can be instantiated without errors
- [ ] Agent correctly routes `search_products` tool calls to CdrProductService
- [ ] Agent includes ASIC comparison rate disclaimer in responses
- [ ] Create marker file: `.agent-done-W18-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W18-01`), Agent 3 (`.agent-done-W18-03`), Agent 6 (`.agent-done-W18-06`)
- **Reuses**: ClaudeAgent base class, cognee-tools.ts, loan-calculator.ts
