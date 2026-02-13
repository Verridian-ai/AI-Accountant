The plan is now fully updated and aligned with the master architecture document docs/COMPREHENSIVE_ARCHITECTURE.md. Here's a summary of what was added/changed:
                                                                                                                                                                               ★ Insight ─────────────────────────────────────                                                                                                                              Key alignments with the master architecture doc:

  1. Section 22 (Tax Optimization Engine): Added 3 new Claude agents (TaxStrategyAgent, PersonalTaxClaimsAgent, FinancialPlannerAgent) with exact token budgets and model      assignments from the master doc. Added claim_type/claim_amount/claim_method/substantiation_status columns to transactions table per §22.3.
  2. Section 22.2 (ATO Brackets): Updated tax constants to match master doc exactly — including SMSF rates, CGT rules with small business concessions, Medicare levy
  thresholds for both FY2024-25 and FY2025-26, and the 88c/km motor vehicle rate.
  3. Section 22.4 (Budget & Savings): Added debt repayment plans (avalanche vs snowball) and wealth projections with 4 risk profiles from the master doc.
  4. Section 24 (Financial Calculators): Expanded loan types to 6 (including business, SMSF LRBA), added refinance savings calculator and borrowing capacity calculator per  
  §24.1.
  5. PART B (Future): Full reference to §23 trading agent swarm (5 agents, multi-model), 9 data sources, 7 Cognee datasets, and 7 trading strategies with risk controls.
  ─────────────────────────────────────────────────

─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Ready to code?
                                                                                                                                                                              Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 GoldLedger — Tax Returns, Tax Optimization, Loan Calculators, Smart Budgeting & Future Investment Architecture

 Master Plan Reference: This implementation plan is aligned with and derived from docs/COMPREHENSIVE_ARCHITECTURE.md — specifically Section 22 (Australian Tax Optimization  
 Engine), Section 23 (Investment & Trading Intelligence — future hooks), and Section 24 (Financial Product Comparison & Calculators). All agent types, token budgets, model  
 assignments, Cognee datasets, and schema additions follow the master architecture.

 Context

 This transforms GoldLedger from a transaction tracker into a full AI-powered financial intelligence platform — better than an accountant at finding legal strategies to
 reduce tax, maximize claims, and optimize finances. The platform serves all Australian entity types (sole trader, company, trust, individual, partnership, SMSF) with deep  
 ATO knowledge baked into every calculation.

 Amica Beauty is the immediate use case (sole trader, husband contributes equity), but the system will be entity-agnostic and production-grade for any Australian taxpayer.  

 Future vision (architecture hooks only, not built now — per master doc §23): Multi-model AI swarms (Claude Opus 4.6 + Gemini Pro Preview + Kimi K2), crypto/CommSec trading
  bots via Claude Agent SDK, news pattern analysis, Cognee knowledge graph for market intelligence, Redis-backed agent message bus.

 ---

Master Architecture Alignment Map
 ┌────────────────────────┬─────────────────────────────┬─────────────────────────────────────────────────────────────────┐
 │       Plan Phase       │     Master Doc Section      │                         Key References                          │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 1: Schema        │ §22.3, §22.1                │ claim_type/claim_amount cols, entity types table                │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 2: Tax Engine    │ §22.2                       │ ATO brackets FY2024-25/2025-26, CGT rules, SMSF rates           │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 3: Tax Optimizer │ §22.1, §22.3                │ TaxStrategyAgent, PersonalTaxClaimsAgent tools                  │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 4: Loan Calcs    │ §24.1                       │ LoanComparisonAgent, rate aggregation, refinance/capacity calcs │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 5: Economic Data │ §24.1 (rate sources), §23.2 │ RBA/ABS feeds, economic_data_cache                              │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 6: Owner Equity  │ §22.1 (entity structure)    │ Owner contribution tracking, equity events                      │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 7: Budgeting     │ §22.4                       │ FinancialPlannerAgent, debt repayment, wealth projection        │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 8: API Routes    │ All sections                │ ~28 new endpoints                                               │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 9: Client API    │ All sections                │ TypeScript interfaces matching master doc types                 │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 10: Tax UI       │ §22.1, §22.3                │ Entity tabs, deduction substantiation UI                        │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 11: Loan UI      │ §24.1                       │ Calculators, refinance, borrowing capacity                      │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ Phase 12: Analytics UI │ §22.4                       │ Projections, bill alerts, spending hints                        │
 ├────────────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 │ PART B: Future         │ §23 (full)                  │ Trading swarm, market data, Cognee datasets                     │
 └────────────────────────┴─────────────────────────────┴─────────────────────────────────────────────────────────────────┘
 ---

 PART A: IMPLEMENTABLE NOW (This Sprint)

 ---
 Phase 1: Schema & Migration

 New file: docker/migrations/0012_tax_return_platform.sql
 Modify: server/src/schema.ts

 Per master doc §22.1: Entity types include Individual, Company (Base/Standard), Family Trust, Unit Trust, Partnership, SMSF (Accumulation/Pension)
 Per master doc §22.3: Transactions get claim_type, claim_amount, claim_method, substantiation_status columns

 Extend taxYearSummary

 entityType TEXT DEFAULT 'sole_trader'     -- sole_trader | individual | company | trust | partnership | smsf
 ownerContributions INTEGER DEFAULT 0      -- cents
 ownerDrawings INTEGER DEFAULT 0           -- cents
 netBusinessIncome INTEGER DEFAULT 0       -- cents
 companyTaxRate REAL                        -- 0.25 or 0.30
 frankingCredits INTEGER DEFAULT 0         -- cents
 superContributions INTEGER DEFAULT 0      -- cents (concessional)
 superDeduction INTEGER DEFAULT 0          -- cents
 sbitoOffset INTEGER DEFAULT 0            -- Small Business Income Tax Offset cents

 Extend transactions table (per §22.3)

 ALTER TABLE transactions ADD COLUMN claim_type VARCHAR(50);
 -- Values: 'work_related', 'investment', 'home_office', 'self_education',
 --         'charitable', 'medical', 'income_protection', 'rental_property', NULL

 ALTER TABLE transactions ADD COLUMN claim_amount INTEGER;  -- cents
 ALTER TABLE transactions ADD COLUMN claim_method VARCHAR(30);
 -- Values: 'logbook', 'cents_per_km', 'fixed_rate', 'actual_cost', NULL

 ALTER TABLE transactions ADD COLUMN substantiation_status VARCHAR(20) DEFAULT 'pending';
 -- Values: 'pending', 'substantiated', 'needs_receipt', 'ineligible'

 New table: owner_equity_events

 id, userId, transactionId (FK), transferLinkId (FK)
 eventType TEXT  -- 'contribution' | 'drawing'
 amount INTEGER  -- cents, always positive
 eventDate TEXT
 sourceAccountId, destinationAccountId (FK)
 sourceAccountNumber TEXT  -- displayed to user for identification
 description TEXT
 isConfirmed BOOLEAN DEFAULT false
 financialYear TEXT

 New table: tax_strategies

 AI-generated tax optimization suggestions:
 id, userId, financialYear
 strategyType TEXT  -- 'super_sacrifice' | 'prepayment' | 'instant_writeoff' | 'structure_change' | 'negative_gearing' | 'income_splitting' | 'carry_forward_super' |
 'sbcgt_concession' | 'wfh_deduction' | 'vehicle_method'
 title TEXT, description TEXT
 estimatedSavingsCents INTEGER
 currentTaxCents INTEGER, optimizedTaxCents INTEGER
 confidence REAL  -- 0-1
 isApplied BOOLEAN DEFAULT false
 details TEXT  -- JSON with strategy-specific data
 atoRulingRef TEXT  -- ATO ruling reference (e.g., "TR 2024/1")

 New table: loan_scenarios

 id, userId
 loanType TEXT  -- 'home_owner' | 'home_investment' | 'car' | 'personal' | 'business' | 'chattel_mortgage' | 'novated_lease' | 'smsf_lrba'
 principal INTEGER  -- cents
 interestRate REAL  -- annual %
 termMonths INTEGER
 offsetBalance INTEGER DEFAULT 0  -- cents (for home loans)
 extraRepayment INTEGER DEFAULT 0 -- cents/month
 frequency TEXT DEFAULT 'monthly' -- weekly | fortnightly | monthly
 comparisonRate REAL  -- for comparison
 totalInterest INTEGER  -- calculated
 totalRepayments INTEGER -- calculated
 monthlyRepayment INTEGER
 balloonPayment INTEGER DEFAULT 0  -- for car loans
 interestOnlyMonths INTEGER DEFAULT 0  -- for investment loans

 New table: budget_templates

 id, userId, name
 entityType TEXT  -- 'sole_trader' | 'personal' | 'company'
 categories TEXT  -- JSON [{category, amountCents}]
 isActive BOOLEAN

 New table: economic_data_cache

 id, dataSource TEXT  -- 'rba_cash_rate' | 'abs_cpi' | 'rba_lending_rates' | 'abs_employment'
 dataKey TEXT, value REAL, period TEXT
 fetchedAt TEXT

 ---
 Phase 2: Expert Tax Engine (Backend)

 New file: server/src/services/tax-return.ts

 Per master doc §22.2: Full ATO bracket data for FY2024-25 and FY2025-26, company rates, SMSF rates, CGT rules with SBC concessions

 This is the brain — entity-aware tax calculation with embedded ATO knowledge.

 Australian Tax Constants (Comprehensive — aligned with §22.2)

 // Already in tax.ts — REUSE:
 TAX_BRACKETS_2024_25, PAYG_COEFFICIENTS_*, HELP_REPAYMENT_THRESHOLDS
 calculateIncomeTax(), calculateMedicareLevy(), calculateLITO()
 calculatePAYGWithholding(), calculateAnnualHelpRepayment()
 getFinancialYearDates()

 // NEW constants (matching master doc §22.2 exactly):
 COMPANY_TAX_RATES = { base_rate_entity: 0.25, standard: 0.30 }
 SMSF_TAX_RATES = { accumulation: 0.15, pension: 0.00, cgt_discount: 1/3 }
 TRUST_UNDISTRIBUTED_RATE = 0.47
 CGT_RULES = {
   individual_discount: 0.50,
   smsf_discount: 1/3,
   company_discount: 0,
   trust_discount: 0.50,
   small_business_concessions: {
     active_asset_reduction: 0.50,
     retirement_exemption: 500_000,
     rollover_period_years: 2,
     fifteen_year_exemption: true,
   }
 }
 MEDICARE_LEVY = { rate: 0.02, thresholds: {
   'FY2024-25': { single: 26_000, family: 43_846, perChild: 4_027 },
   'FY2025-26': { single: 27_222, family: 45_907, perChild: 4_216 },
 }}
 SBITO_CAP = 100000                   // $1000 cap in cents
 SBITO_RATE = 0.08                    // 8% of tax on business income
 SUPER_CONCESSIONAL_CAP = 3000000     // $30,000 in cents (2024-25)
 SUPER_NON_CONCESSIONAL_CAP = 12000000 // $120,000 in cents
 SUPER_TAX_RATE = 0.15               // 15% contributions tax
 DIVISION_293_THRESHOLD = 25000000    // $250,000
 DIVISION_293_RATE = 0.15            // Additional 15%
 INSTANT_WRITEOFF_THRESHOLD = 2000000 // $20,000 per asset
 INSTANT_WRITEOFF_TURNOVER_LIMIT = 1000000000 // $10M aggregated
 WFH_FIXED_RATE = 67                 // 67 cents/hour (FY2025: $0.67/hr)
 MOTOR_VEHICLE_CENTS_PER_KM = 88     // 88c/km (FY2025 per §22.3)
 MOTOR_VEHICLE_MAX_KM = 5000
 CAR_DEPRECIATION_LIMIT = 6967400    // $69,674 in cents
 MEDICARE_SURCHARGE_TIER1 = 0.01     // $93k-$108k
 MEDICARE_SURCHARGE_TIER2 = 0.0125   // $108k-$144k
 MEDICARE_SURCHARGE_TIER3 = 0.015    // $144k+

 calculateSoleTraderReturn(userId, taxYear)

 1. Get FY dates via existing getFinancialYearDates() from tax.ts
 2. Query business-account txns (accounts.ownershipTag = 'business')
 3. Exclude isTransfer = true AND isOwnerContribution = true
 4. Classify by category type from categories.ts:

- Revenue = codes 4-xxxx
- COGS = codes 5-xxxx, Expenses = codes 6-xxxx

 1. Sum owner contributions/drawings from owner_equity_events
 2. Calculate Small Business Income Tax Offset (SBITO): 8% of tax on biz income, capped at $1,000
 3. Apply super deductions (personal concessional contributions)
 4. Calculate tax via existing calculateIncomeTax(), calculateMedicareLevy(), calculateLITO()
 5. Include deductions from deductions table
 6. Returns: SoleTraderTaxReturn { grossRevenue, revenueByCategory[], totalExpenses, expensesByCategory[], netBusinessIncome, ownerContributions, ownerDrawings,
 superDeduction, taxableIncome, incomeTax, medicareLevy, sbitoOffset, litoOffset, totalTax, effectiveRate, marginalRate }

 calculatePersonalReturn(userId, taxYear)

 1. Employment income from wagePayments table
 2. Business income = sole trader netBusinessIncome (pass-through per ATO)
 3. Interest income, Rental income, Other income from personal-account txns
 4. Salary sacrifice super reduces taxable employment income
 5. Personal deductions: work-related car (cents/km or logbook), WFH ($0.67/hr), uniforms, tools, self-education, union fees, professional memberships
 6. Negative gearing loss from rental properties (if applicable)
 7. Apply tax brackets + Medicare + HELP + offsets
 8. Tax withheld from PAYG → refund or owing

 calculateCompanyReturn(userId, taxYear)

 1. Query company-tagged account transactions
 2. Determine base rate entity: turnover < $50M AND ≤80% passive income → 25%, else 30%
 3. Net Profit × rate = company tax
 4. Franking credits = company tax paid ÷ (1 - tax rate) × tax rate
 5. Dividend distribution tracking
 6. Returns: CompanyTaxReturn { grossRevenue, totalExpenses, netProfit, isBaseRateEntity, taxRate, companyTax, frankingCredits, totalDividends, frankedAmount,
 unfrankedAmount }

 calculateTrustReturn(userId, taxYear)

 1. Trust income and expenses from trust-tagged accounts
 2. Distribution to beneficiaries (configurable split)
 3. Each beneficiary taxed at their marginal rate
 4. Undistributed income taxed at 47% (top rate)
 5. Capital gains distributed with CGT discount maintained
 6. Family Trust Distribution Tax warning if outside family group

 calculatePartnershipReturn(userId, taxYear)

 1. Partnership income/expenses
 2. Split by partner share percentages
 3. Each partner declares their share on personal return

 ---
 Phase 3: Tax Optimization AI Advisor (Backend)

 New file: server/src/services/tax-optimizer.ts
 New agents (per master doc §22.1, §22.3, §22.4):

- server/src/services/claude/agents/tax-strategy.ts — TaxStrategyAgent extends ClaudeAgent<TaxStrategyInput, TaxStrategyOutput>
- server/src/services/claude/agents/personal-tax-claims.ts — PersonalTaxClaimsAgent extends ClaudeAgent
- server/src/services/claude/agents/financial-planner.ts — FinancialPlannerAgent extends ClaudeAgent

 Modify server/src/services/claude/types.ts — Add to AgentType union:
 | 'tax_strategy' | 'personal_tax_claims' | 'financial_planner'

 Modify server/src/services/claude/config.ts — Token budgets & models (per §22.1):
 tax_strategy:        { maxInput: 100K, maxOutput: 16K, maxTools: 15 } → claude-sonnet-4-5
 personal_tax_claims: { maxInput: 50K,  maxOutput: 8K,  maxTools: 10 } → claude-haiku-4-5
 financial_planner:   { maxInput: 50K,  maxOutput: 12K, maxTools: 12 } → claude-sonnet-4-5

 TaxStrategyAgent Tools (per §22.1):
 ┌──────────────────────────────────┬─────────────────────────────────────────┐
 │               Tool               │           Cognee Search Type            │
 ├──────────────────────────────────┼─────────────────────────────────────────┤
 │ search_ato_rulings               │ GRAPH_COMPLETION on ato_rulings dataset │
 ├──────────────────────────────────┼─────────────────────────────────────────┤
 │ calculate_entity_tax             │ Local computation (reuse tax.ts)        │
 ├──────────────────────────────────┼─────────────────────────────────────────┤
 │ identify_deduction_opportunities │ CHUNKS_LEXICAL → GRAPH_COMPLETION       │
 ├──────────────────────────────────┼─────────────────────────────────────────┤
 │ optimize_structure               │ GRAPH_COMPLETION_COT                    │
 ├──────────────────────────────────┼─────────────────────────────────────────┤
 │ calculate_cgt_strategies         │ GRAPH_COMPLETION                        │
 ├──────────────────────────────────┼─────────────────────────────────────────┤
 │ check_division_7a                │ CYPHER                                  │
 └──────────────────────────────────┴─────────────────────────────────────────┘
 PersonalTaxClaimsAgent scans ALL transactions and flags claimable deductions per §22.3 detection patterns:
 ┌──────────────────────┬──────────────────────────────────┬───────────────────────────────────┐
 │       Category       │        Detection Pattern         │        ATO Substantiation         │
 ├──────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
 │ Work-related car     │ Fuel, tolls, parking near work   │ Logbook (5000+ km) or 88c/km      │
 ├──────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
 │ Home office          │ Internet, electricity, furniture │ Fixed rate $0.67/hr or actual     │
 ├──────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
 │ Self-education       │ Course fees, textbooks           │ Must relate to current employment │
 ├──────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
 │ Charitable donations │ DGR-endorsed charities           │ Receipts for ≥$2                  │
 ├──────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
 │ Income protection    │ Insurance premiums               │ Policy documents                  │
 ├──────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
 │ Professional subs    │ Industry memberships             │ Receipts                          │
 └──────────────────────┴──────────────────────────────────┴───────────────────────────────────┘
 The killer feature — an AI-powered advisor that analyzes the user's financial position and generates legal tax reduction strategies with estimated savings.

 generateTaxStrategies(userId, taxYear)

 Analyzes the user's data and generates strategies from this ruleset:

 Strategy 1: Superannuation Salary Sacrifice

- If taxable income > $45,000, every dollar sacrificed saves (marginal rate - 15%)
- Check carry-forward unused concessional cap from prior 5 years (total super balance < $500k)
- Calculate: current tax vs tax after max sacrifice
- E.g., "Salary sacrifice $10,000 to super → save $1,700 in tax"

 Strategy 2: Prepaid Expenses (12-Month Rule)

- Small business can prepay up to 12 months of expenses before June 30
- Identify recurring bills (rent, insurance, subscriptions) that could be prepaid
- Calculate deduction timing benefit

 Strategy 3: Instant Asset Write-Off

- Any business asset < $20,000 (aggregated turnover < $10M)
- Scan transactions for asset purchases that could qualify
- Flag items not yet claimed as depreciation

 Strategy 4: Work From Home Deduction

- If any WFH hours logged, calculate fixed rate ($0.67/hr) vs actual cost method
- Recommend the better method
- Typical: 1,500 hrs × $0.67 = $1,005 deduction

 Strategy 5: Vehicle Deduction Method

- Compare cents-per-km (85c × up to 5,000km = $4,250 max) vs logbook method
- If business use > 50%, logbook likely better
- Car depreciation limit: $69,674

 Strategy 6: Structure Change Analysis

- If sole trader income > $100k, compare: sole trader vs company (25%) vs trust (income splitting)
- Show tax payable under each structure
- Flag: company retains earnings at 25% vs sole trader at 37-45%

 Strategy 7: Negative Gearing Opportunity

- If rental income exists and < rental expenses → loss offsets other income
- Calculate net benefit at user's marginal rate
- Include non-cash depreciation benefits

 Strategy 8: Small Business CGT Concessions

- 4 concessions: 15-year exemption, 50% active asset reduction, retirement exemption, rollover
- Eligibility: aggregated turnover < $2M or net CGT assets < $6M
- Flag if any CGT events could qualify

 Strategy 9: SBITO (Small Business Income Tax Offset)

- Auto-calculate 8% of tax on business income, capped at $1,000
- Already applied in sole trader return, but show as explicit saving

 Strategy 10: Income Timing

- If approaching a bracket boundary, suggest deferring/accelerating income
- E.g., "You're $3,000 from the 37% bracket — consider deferring that invoice to next FY"

 Each strategy persisted to tax_strategies table with estimated savings.

 ---
 Phase 4: Loan Calculators (Backend)

 New file: server/src/services/loan-calculator.ts

 Per master doc §24.1: LoanComparisonAgent with 6 loan types, 4 tools (calculate_loan_repayment, compare_loan_products, calculate_refinance_savings,
 calculate_borrowing_capacity). Rate aggregation from Canstar/RateCity/Finder/Mozo/RBA into Cognee loan_products dataset.

 Loan Types (per §24.1):
 ┌───────────────────────┬─────────────────────────────────────────────────┬──────────────────────────────────────────┐
 │         Type          │                 Key Parameters                  │            Comparison Metrics            │
 ├───────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ Home (Owner-Occupied) │ Principal, LVR, fixed/variable, offset, redraw  │ Comparison rate, total interest, monthly │
 ├───────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ Home (Investment)     │ Principal, LVR, interest-only, negative gearing │ After-tax cost, cash flow, depreciation  │
 ├───────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ Car Loan              │ Amount, term, balloon, secured/unsecured        │ Total cost, effective rate, residual     │
 ├───────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ Personal Loan         │ Amount, term, secured/unsecured                 │ Total interest, comparison rate          │
 ├───────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ Business Loan         │ Amount, term, security, turnover                │ Effective rate, fees                     │
 ├───────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ SMSF Loan (LRBA)      │ Property value, LVR (max 80%), bare trust       │ Compliance cost, fund cash flow          │
 └───────────────────────┴─────────────────────────────────────────────────┴──────────────────────────────────────────┘
 Core Functions:

 calculateHomeLoan(params) — Standard amortization: M = P × [r(1+r)^n] / [(1+r)^n - 1]

- Supports weekly/fortnightly/monthly frequency
- Offset account reduces interest basis each period
- Extra repayments + lump sum payments
- Full amortization schedule generation
- Comparison rate calc including fees
- Returns: regularPayment, totalInterest, loanTermActual, interestSaved, timeSaved, amortizationSchedule[]

 calculateCarLoan(params)

- 3-way comparison: personal loan vs chattel mortgage vs novated lease
- Chattel mortgage: interest deductible, claim GST, depreciation (car limit $69,674)
- Novated lease: pre-tax salary sacrifice, GST saving up to $6,334
- After-tax cost at user's marginal rate for each option
- Balloon/residual value support

 calculatePersonalLoan(params) — Simple amortization + comparison rate + early repayment

 calculateRefinanceSavings(params) (per §24.1)

- Current balance/rate/remaining term vs new rate
- Include switching costs (discharge + application fees)
- Break-even period calculation
- Net savings over remaining term

 calculateBorrowingCapacity(params) (per §24.1)

- Gross income, other income, monthly expenses, existing debts, dependents
- Assessment rate buffer (+3% per APRA guidelines)
- Returns maximum loan amount

 loanComparison(scenarios[])

- Side-by-side comparison of multiple scenarios
- Total cost, monthly payment, total interest
- Tax deductibility analysis (business vs personal use %)

 ---
 Phase 5: Economic Data Feeds (Backend)

 New file: server/src/services/economic-data.ts

 Data Sources

 1. RBA Cash Rate: Scrape <https://www.rba.gov.au/statistics/cash-rate/> or use CSV from statistical tables
 2. RBA Lending Rates: <https://www.rba.gov.au/statistics/tables/xls/f05hist.xls> (bank lending rates)
 3. ABS API (SDMX): <https://data.api.abs.gov.au/rest/data/> — CPI, employment, wages growth
 4. ATO Benchmark Rate: 8.37% for 2025-26 (fringe benefits tax)

 fetchAndCacheRates()

- Daily cron or on-demand fetch
- Parse CSV/SDMX JSON responses
- Cache in economic_data_cache table
- Return structured data: cash rate, variable rate, fixed rates (1yr, 3yr, 5yr), CPI, wage growth

 getAggregatedRates()

- Combines: RBA cash rate + average bank variable rate + average fixed rates
- Shows trend (last 12 months)
- For loan calculators: auto-fill current market rates

 ---
 Phase 6: Owner Equity Service (Backend)

 New file: server/src/services/owner-equity.ts

 scanContributions(userId, financialYear)

 1. Load ALL accounts for user (business and personal)
 2. Query transactions in FY date range
 3. Contribution detection: credits >$1000 on business accounts with transfer keywords (transfer, tfr, osko, direct credit, pay anyone, internet transfer, mobile transfer)  
 4. Drawing detection: debits from business accounts transferring to personal accounts
 5. Present detected events with full account numbers and amounts for user identification
 6. Uses existing TransferDetector.detectOwnerContributions() from transfers/detector.ts
 7. Persist to owner_equity_events table

 confirmEvent(id) / rejectEvent(id)

- Sets isConfirmed and updates linked transaction isOwnerContribution

 getEquitySummary(userId, financialYear)

- Totals, net equity change, monthly breakdown, event list

 ---
 Phase 7: Enhanced Budgeting Service (Backend)

 New file: server/src/services/budget-enhanced.ts

 Per master doc §22.4: FinancialPlannerAgent with analyze_cash_flow, recommend_savings_allocation, calculate_compound_growth, optimize_debt_repayment tools. Risk-profiled
 investment projections (Conservative 4-5%, Balanced 6-7%, Growth 8-10%, Aggressive 10-12%).

 getSmartProjections(userId, entityType, months)

 1. Last 12 months of txns grouped by category × month
 2. 3-month weighted moving average per category (weights: 0.5, 0.3, 0.2)
 3. Linear regression slope for trend detection
 4. Confidence bands: ±1 standard deviation
 5. Entity-aware: filter by account ownershipTag

 getRecurringBillAlerts(userId)

 1. Build on existing BudgetAnalyzerAgent.identify_recurring logic
 2. Add: next-due-date prediction, missed payment flagging (>7 days overdue)
 3. Amount change alert: >15% deviation from typical
 4. Annual cost rollup per recurring item
 5. Sort by next-due-date

 getSpendingHints(userId, entityType)

 Uses Claude AI (via FinancialPlannerAgent) to generate plain-English insights:

 1. Compare current month/quarter to prior 3-month average
 2. Flag categories with >10% change
 3. Examples: "Materials spending up 15% this quarter — check supplier pricing"
 4. Sole trader hints: focus on deductible business expenses
 5. Personal hints: focus on discretionary spending
 6. Savings opportunities: "Your insurance is $200/mo — compare market rates"

 getEntitySplitBudget(userId)

 1. Separate budget tracking per entity type
 2. Cross-entity summary: total inflows, outflows, net position
 3. Business: compare revenue vs expense budgets
 4. Personal: compare income vs spending budgets
 5. Transfer view: money flowing between entities

 getIncomeProjection(userId, months)

 1. Analyze revenue patterns (seasonal, cyclical, trend)
 2. Weighted projection with confidence bands
 3. Flag: "Revenue typically drops 20% in January" (seasonal)

 getDebtRepaymentPlan(userId) (per §22.4)

 1. Scan loan transactions to identify active debts
 2. Avalanche strategy (highest interest first) vs snowball (smallest balance first)
 3. Calculate months-to-free and total interest under each strategy
 4. Recommend optimal allocation of surplus cash

 getWealthProjection(userId, years, riskProfile) (per §22.4)

 1. Calculate current monthly surplus from cash flow analysis
 2. Model compound growth at risk-profiled rates:

- Conservative: 4-5% (70% bonds, 20% shares, 10% cash)
- Balanced: 6-7% (40% bonds, 50% shares, 10% property)
- Growth: 8-10% (10% bonds, 70% shares, 20% property)
- Aggressive: 10-12% (80% shares, 10% property, 10% alternatives)

 1. Show 5/10/20-year projections with confidence bands
 2. Include emergency fund target (3-6 months essential expenses)

 Reuses existing:

- BudgetAnalyzerAgent tools: identify_recurring, calculate_monthly_averages, find_anomalies
- /api/analytics/recurring-payments, /api/analytics/budget-vs-actual, /api/analytics/cash-flow-forecast

 ---
 Phase 8: API Endpoints

 Modify: server/src/index.ts (add after existing tax routes ~line 3320)

 Tax Return Routes (5)

 GET  /api/tax/return/sole-trader/:year
 GET  /api/tax/return/personal/:year
 GET  /api/tax/return/company/:year
 GET  /api/tax/return/trust/:year
 GET  /api/tax/return/partnership/:year

 Tax Optimization Routes (3)

 GET  /api/tax/strategies/:year           → list generated strategies
 POST /api/tax/strategies/generate/:year  → run AI optimizer
 POST /api/tax/strategies/:id/apply       → mark strategy as applied

 Owner Equity Routes (5)

 GET  /api/tax/equity/:year
 POST /api/tax/equity/scan/:year
 GET  /api/tax/equity/events/:year
 POST /api/tax/equity/events/:id/confirm
 POST /api/tax/equity/events/:id/reject

 Loan Calculator Routes (6) — per §24.1

 POST /api/loans/calculate/home
 POST /api/loans/calculate/car
 POST /api/loans/calculate/personal
 POST /api/loans/calculate/business
 POST /api/loans/refinance-savings
 POST /api/loans/borrowing-capacity
 POST /api/loans/compare

 Economic Data Routes (2)

 GET  /api/economic/rates              → current rates + trends
 POST /api/economic/refresh            → force refresh from RBA/ABS

 Enhanced Budget Routes (7) — per §22.4

 GET  /api/analytics/smart-projections
 GET  /api/analytics/bill-alerts
 GET  /api/analytics/spending-hints
 GET  /api/analytics/entity-budget
 GET  /api/analytics/income-projection
 GET  /api/analytics/debt-repayment-plan
 GET  /api/analytics/wealth-projection

 Total: ~28 new endpoints

 ---
 Phase 9: Client API Layer

 Modify: client/src/api.ts

 Add to taxApi:

- calculateSoleTraderReturn(year), calculatePersonalReturn(year), calculateCompanyReturn(year), calculateTrustReturn(year), calculatePartnershipReturn(year)
- getStrategies(year), generateStrategies(year), applyStrategy(id)
- getEquitySummary(year), scanEquityEvents(year), getEquityEvents(year), confirmEquityEvent(id), rejectEquityEvent(id)

 New loanApi:

- calculateHomeLoan(params), calculateCarLoan(params), calculatePersonalLoan(params), compareLoanScenarios(scenarios[])

 New economicApi:

- getCurrentRates(), refreshRates()

 Add to analyticsApi:

- fetchSmartProjections(entityType, months), fetchBillAlerts(), fetchSpendingHints(entityType), fetchEntityBudget(), fetchIncomeProjection(months)

 Add TypeScript interfaces for all response types.

 ---
 Phase 10: Tax Dashboard Restructure (Frontend)

 Modify: client/src/features/tax/components/TaxDashboard.tsx

 New structure:

 Tax Return
 ├── [Top-level entity tabs]: Sole Trader | Personal | Company | Trust
 │   ├── SoleTraderReturn.tsx      ← Primary (Amica Beauty)
 │   ├── PersonalReturn.tsx
 │   ├── CompanyReturn.tsx
 │   └── TrustReturn.tsx
 ├── [Cross-cutting tabs]:
 │   ├── Tax Optimizer             ← AI strategies panel
 │   ├── Deductions (filtered by entity)
 │   ├── Capital Gains
 │   └── Depreciation
 ├── FY year selector (auto-detect all years with data)
 └── Entity type auto-detect from businessProfiles

 New components:

 SoleTraderReturn.tsx

- Section 1: Business P&L — Revenue by category, Expenses by category, Net Business Income
- Section 2: Owner Equity — Contributions/Drawings totals, "Scan" button, OwnerEquityPanel
- Section 3: Tax Calculation — Income Tax, Medicare, SBITO, LITO, Total Tax, Effective Rate
- Section 4: Plain-English Summary — "Your business made $X profit. You drew $Y. Tax: $T at R%."

 PersonalReturn.tsx

- Employment income, Business income (from sole trader), Interest, Rental, Other
- Salary sacrifice super deduction
- Work-related deductions (WFH, car, tools, uniforms, self-education)
- Tax calc with PAYG withheld → Refund or Owing
- HELP repayment if applicable

 CompanyReturn.tsx

- Revenue/Expenses/Net Profit
- Base rate entity toggle (25% vs 30%)
- Company tax, Franking credits
- Dividend distribution panel

 TrustReturn.tsx

- Trust income/expenses
- Beneficiary distribution table (name, share %, amount, their marginal rate)
- Effective family group tax vs undistributed penalty
- Section 100A warning

 TaxOptimizerPanel.tsx — The headline feature

- List of AI-generated strategies with estimated savings
- Each card shows: strategy name, description, estimated saving, "Apply" button
- Total potential savings highlight at top
- Confidence indicator per strategy
- Expandable details with ATO rule references

 OwnerEquityPanel.tsx

- Detected contributions with account numbers + amounts for identification
- Confirm/Reject per event
- Running totals, monthly breakdown

 TaxReturnSummaryCard.tsx — Reusable stat card

 ---
 Phase 11: Loan Calculators (Frontend)

 New feature folder: client/src/features/loans/

 New nav tab: "Loans" in main navigation

 LoanDashboard.tsx — Tabbed interface:

- Home Loan | Car Finance | Personal Loan | Compare

 HomeLoanCalculator.tsx

- Inputs: principal, rate, term, frequency, offset balance, extra repayments
- Results: regular payment, total interest, time saved, interest saved
- Amortization chart (custom SVG — balance curve over time)
- Offset impact visualization
- Auto-fill current RBA-derived market rates

 CarFinanceCalculator.tsx

- 3-way comparison: personal loan vs chattel mortgage vs novated lease
- Tax benefit calculation at user's marginal rate
- GST claim display for chattel mortgage
- Salary sacrifice benefit for novated lease
- After-tax total cost comparison

 PersonalLoanCalculator.tsx

- Simple calculator with comparison rate
- Fee impact on effective rate
- Early repayment scenario

 LoanComparisonPanel.tsx

- Side-by-side comparison of saved scenarios
- Total cost, monthly payment, total interest
- Visual chart comparing options

 ---
 Phase 12: Enhanced Analytics (Frontend)

 Modify: client/src/features/analytics/components/AnalyticsDashboard.tsx

 Add tabs: Projections, Bill Alerts

 New: BudgetProjections.tsx

- Revenue/expense projection charts (custom SVG matching CashFlowForecast pattern)
- Entity type selector
- Confidence bands on projections
- Income trend indicator

 New: BillAlerts.tsx

- Upcoming bills sorted by next-due-date
- Overdue highlights (red), amount-change warnings (amber)
- Annual cost summary
- Dismiss/snooze per alert

 Modify: BudgetVsActual.tsx

- Add "Prior Period" column
- Entity type filter
- Spending hint badges per category row

 Modify: SpendingTrends.tsx

- AI spending hints panel below chart
- Entity-aware filtering

 ---
 PART B: FUTURE ARCHITECTURE (Hooks & Notes Only)

 Full specification in master doc §23 (Investment & Trading Intelligence) and §24.1 (Rate Aggregation).
 These are NOT built now — just architectural decisions to keep in mind during implementation.

 Trading Agent Swarm (per §23.1)

 5-agent autonomous swarm with multi-model strategy:
 ┌───────────────────────┬───────────────────┬─────────────────────────────────────────┐
 │         Agent         │       Model       │                  Role                   │
 ├───────────────────────┼───────────────────┼─────────────────────────────────────────┤
 │ MarketAnalystAgent    │ Claude Opus 4.6   │ Macro analysis, fundamental valuation   │
 ├───────────────────────┼───────────────────┼─────────────────────────────────────────┤
 │ NewsIntelligenceAgent │ Gemini 2.0 Flash  │ Real-time news parsing, sentiment       │
 ├───────────────────────┼───────────────────┼─────────────────────────────────────────┤
 │ TechnicalAnalystAgent │ Claude Sonnet 4.5 │ Chart patterns, RSI/MACD/Bollinger      │
 ├───────────────────────┼───────────────────┼─────────────────────────────────────────┤
 │ RiskManagerAgent      │ Claude Sonnet 4.5 │ Position sizing, stop-loss, correlation │
 ├───────────────────────┼───────────────────┼─────────────────────────────────────────┤
 │ ExecutionAgent        │ Kimi K2           │ Order placement, execution timing       │
 └───────────────────────┴───────────────────┴─────────────────────────────────────────┘
 Communication via Redis message bus + shared Cognee knowledge graph.

 Data Sources (per §23.2)
 ┌───────────────────┬─────────────────────┬───────────────┐
 │      Source       │       Dataset       │   Frequency   │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ ASX Market Data   │ asx_market          │ 15-min        │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ CommSec API       │ commsec_portfolio   │ Real-time     │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ CoinGecko         │ crypto_market       │ 5-min         │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ Reuters/AFP       │ market_news         │ 15-min        │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ AFR/SMH           │ au_financial_news   │ 30-min        │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ RBA               │ rba_data            │ Daily         │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ ABS               │ economic_indicators │ Monthly       │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ ASX Announcements │ asx_announcements   │ Real-time RSS │
 ├───────────────────┼─────────────────────┼───────────────┤
 │ Reddit/X          │ social_sentiment    │ 10-min        │
 └───────────────────┴─────────────────────┴───────────────┘
 Cognee Datasets for Trading (per §23.3)

- asx_market — Cognify on >2% moves, search via TEMPORAL + GRAPH_COMPLETION
- crypto_market — Cognify on >5% moves, TEMPORAL + CHUNKS
- market_news — Always cognify (entity extraction), RAG_COMPLETION + CHUNKS_LEXICAL
- trade_history — Cognify + Memify (pattern learning), TEMPORAL + FEEDBACK
- social_sentiment — Cognify with sentiment scoring

 Trading Strategies (per §23.4)

 7 strategies: Momentum, Mean Reversion, Dividend Capture, Sector Rotation, Crypto Arbitrage, Crypto Momentum, DCA. Risk controls: max 5% per position, 2% stop-loss, 20%
 min cash reserve, circuit breakers on 3 consecutive losses or 8% weekly loss.

 Rate Aggregation (per §24.1 — future enhancement)

 Scrape Canstar, RateCity, Finder, Mozo daily into Cognee loan_products dataset. Compare home/car/personal/business loan products automatically.

 Architecture Hooks to Implement Now

 1. economic_data_cache table — already supports future data types via dataSource + dataKey
 2. Cognee dataset structure — financial_knowledge namespace ready for market data
 3. Agent framework in server/src/services/claude/ — extensible for trading agents (add to AgentType union)
 4. businessProfiles.entityType — already supports all entity types including SMSF
 5. Redis service in docker-compose.yml — ready for agent message bus (add but don't wire)
 6. New agent types registered in types.ts — leave stubs for future trading agents

 ---
 Critical Files Summary

Backend — New Services
 ┌────────────────────────────────────────────────┬────────┬─────────────────────────────────────────┐
 │                      File                      │ Action │                 Purpose                 │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ docker/migrations/0012_tax_return_platform.sql │ CREATE │ Migration (schema + ALTER TABLE)        │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/schema.ts                           │ MODIFY │ New tables + columns (claim_type, etc.) │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/services/tax-return.ts              │ CREATE │ 5 entity tax return calculators         │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/services/tax-optimizer.ts           │ CREATE │ AI tax strategy generation              │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/services/loan-calculator.ts         │ CREATE │ 6 loan types + refinance + capacity     │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/services/economic-data.ts           │ CREATE │ RBA/ABS data feeds + caching            │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/services/owner-equity.ts            │ CREATE │ Contribution/drawing tracking           │
 ├────────────────────────────────────────────────┼────────┼─────────────────────────────────────────┤
 │ server/src/services/budget-enhanced.ts         │ CREATE │ Smart budgeting + wealth projection     │
 └────────────────────────────────────────────────┴────────┴─────────────────────────────────────────┘
 Backend — New Agents (per master doc §22)
 ┌──────────────────────────────────────────────────────────┬────────┬───────────────────────────────────┐
 │                           File                           │ Action │              Purpose              │
 ├──────────────────────────────────────────────────────────┼────────┼───────────────────────────────────┤
 │ server/src/services/claude/agents/tax-strategy.ts        │ CREATE │ TaxStrategyAgent (§22.1)          │
 ├──────────────────────────────────────────────────────────┼────────┼───────────────────────────────────┤
 │ server/src/services/claude/agents/personal-tax-claims.ts │ CREATE │ PersonalTaxClaimsAgent (§22.3)    │
 ├──────────────────────────────────────────────────────────┼────────┼───────────────────────────────────┤
 │ server/src/services/claude/agents/financial-planner.ts   │ CREATE │ FinancialPlannerAgent (§22.4)     │
 ├──────────────────────────────────────────────────────────┼────────┼───────────────────────────────────┤
 │ server/src/services/claude/types.ts                      │ MODIFY │ Add 3 new AgentType entries       │
 ├──────────────────────────────────────────────────────────┼────────┼───────────────────────────────────┤
 │ server/src/services/claude/config.ts                     │ MODIFY │ Token budgets + model assignments │
 └──────────────────────────────────────────────────────────┴────────┴───────────────────────────────────┘
 Backend — Reused
 ┌────────────────────────────────────────────┬────────┬──────────────────────────────────────────┐
 │                    File                    │ Action │                 Purpose                  │
 ├────────────────────────────────────────────┼────────┼──────────────────────────────────────────┤
 │ server/src/services/tax.ts                 │ REUSE  │ Tax brackets, calculateIncomeTax(), etc. │
 ├────────────────────────────────────────────┼────────┼──────────────────────────────────────────┤
 │ server/src/services/transfers/detector.ts  │ REUSE  │ detectOwnerContributions()               │
 ├────────────────────────────────────────────┼────────┼──────────────────────────────────────────┤
 │ server/src/services/cognee_client.ts       │ REUSE  │ Cognee search/add for agent tools        │
 ├────────────────────────────────────────────┼────────┼──────────────────────────────────────────┤
 │ server/src/services/claude/cognee-tools.ts │ REUSE  │ Agent Cognee tool wrappers               │
 ├────────────────────────────────────────────┼────────┼──────────────────────────────────────────┤
 │ server/src/services/claude/base-agent.ts   │ REUSE  │ ClaudeAgent base class                   │
 ├────────────────────────────────────────────┼────────┼──────────────────────────────────────────┤
 │ server/src/index.ts                        │ MODIFY │ ~28 new API routes                       │
 └────────────────────────────────────────────┴────────┴──────────────────────────────────────────┘
 Frontend
 ┌─────────────────────────────────────────────────────────────────┬────────┬─────────────────────────────────────┐
 │                              File                               │ Action │               Purpose               │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/api.ts                                               │ MODIFY │ API methods + TypeScript interfaces │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/TaxDashboard.tsx             │ MODIFY │ Entity tabs restructure             │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/SoleTraderReturn.tsx         │ CREATE │ Sole trader P&L + tax               │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/PersonalReturn.tsx           │ CREATE │ Personal deductions + refund        │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/CompanyReturn.tsx            │ CREATE │ Company tax + franking              │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/TrustReturn.tsx              │ CREATE │ Trust distributions                 │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/TaxOptimizerPanel.tsx        │ CREATE │ AI strategies + savings             │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/tax/components/OwnerEquityPanel.tsx         │ CREATE │ Equity confirm/reject               │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/loans/components/LoanDashboard.tsx          │ CREATE │ Loan calc entry                     │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/loans/components/HomeLoanCalculator.tsx     │ CREATE │ Home loan + offset                  │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/loans/components/CarFinanceCalculator.tsx   │ CREATE │ Car finance 3-way compare           │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/loans/components/PersonalLoanCalculator.tsx │ CREATE │ Personal loan calc                  │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/loans/components/LoanComparisonPanel.tsx    │ CREATE │ Side-by-side compare                │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/analytics/components/BudgetProjections.tsx  │ CREATE │ Revenue/expense projections         │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/analytics/components/BillAlerts.tsx         │ CREATE │ Upcoming bill alerts                │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/analytics/components/WealthProjection.tsx   │ CREATE │ Compound growth model               │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/analytics/components/BudgetVsActual.tsx     │ MODIFY │ Prior period + hints                │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/analytics/components/SpendingTrends.tsx     │ MODIFY │ AI hints panel                      │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/features/analytics/components/AnalyticsDashboard.tsx │ MODIFY │ New tabs                            │
 ├─────────────────────────────────────────────────────────────────┼────────┼─────────────────────────────────────┤
 │ client/src/App.tsx                                              │ MODIFY │ Add "Loans" nav tab                 │
 └─────────────────────────────────────────────────────────────────┴────────┴─────────────────────────────────────┘
 ---

 Implementation Order (Recommended)

 Build backend services first (Phases 1-7), wire API routes (Phase 8), then build frontend (Phases 9-12). Within each phase, test via curl/httpie before building UI.

 1. Phase 1: Migration + schema — foundation for everything
 2. Phase 2: tax-return.ts — core calculations, depends on tax.ts (existing)
 3. Phase 3: tax-optimizer.ts + 3 new agents — depends on Phase 2
 4. Phase 6: owner-equity.ts — depends on Phase 1 schema
 5. Phase 4: loan-calculator.ts — independent, pure math
 6. Phase 5: economic-data.ts — independent, external feeds
 7. Phase 7: budget-enhanced.ts — depends on existing analytics
 8. Phase 8: API routes — wire all services
 9. Phase 9: Client API layer — TypeScript interfaces
 10. Phase 10: Tax dashboard UI — largest frontend work
 11. Phase 11: Loan calculator UI — independent frontend
 12. Phase 12: Enhanced analytics UI — extends existing

 Verification Plan

 1. Schema: Run migration, verify all new tables + columns via \dt and \d transactions
 2. Sole Trader Return: GET /api/tax/return/sole-trader/2024-25 — verify business txns only, transfers excluded, SBITO calculated, claim_type populated
 3. Owner Equity Scan: POST /api/tax/equity/scan/2024-25 — verify contributions >$1000 detected with account numbers visible
 4. Tax Optimizer: POST /api/tax/strategies/generate/2024-25 — verify strategies generated with estimated savings and ATO ruling refs
 5. Personal Tax Claims: Verify PersonalTaxClaimsAgent scans transactions and flags claimable deductions with substantiation requirements
 6. Home Loan Calculator: POST /api/loans/calculate/home — verify amortization math, offset impact, comparison rate
 7. Refinance Savings: POST /api/loans/refinance-savings — verify break-even period
 8. Borrowing Capacity: POST /api/loans/borrowing-capacity — verify APRA buffer applied
 9. Car Finance: Compare chattel mortgage vs novated lease at different marginal rates
 10. Economic Data: GET /api/economic/rates — verify RBA cash rate and lending rate data cached
 11. Personal Return: Verify business income flows from sole trader, PAYG withheld calculated, HELP repayment
 12. Company Return: Verify 25% base rate, franking credits = tax ÷ (1-rate) × rate
 13. Trust Return: Verify distribution splits, undistributed penalty at 47%, Section 100A warning
 14. Budget Projections: Verify trend detection on real data, confidence bands reasonable
 15. Bill Alerts: Verify next-due-date predictions, missed payment flagging
 16. Wealth Projection: Verify compound growth at 4 risk profiles over 5/10/20 years
 17. Debt Repayment: Verify avalanche vs snowball comparison output
 18. UI: Navigate all entity tabs, loan calculators, verify neumorphic styling matches existing
 19. Client build: cd client && npx tsc --noEmit passes clean
 20. Agent registration: Verify 3 new agents in types.ts + config.ts with correct models/budgets
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

 Claude has written up a plan and is ready to execute. Would you like to proceed?

 ❯ 1. Yes, clear context and bypass permissions
   2. Yes, and bypass permissions
   3. Yes, manually approve edits
   4. Type here to tell Claude what to change

 ctrl-g to edit in VS Code · ~/.claude/plans/cached-imagining-bonbon.md
