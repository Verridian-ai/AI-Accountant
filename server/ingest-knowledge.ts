/**
 * Cognee Knowledge Ingestion Script
 *
 * Ingests all domain knowledge for the bank statement parser into Cognee.
 * Run: npx tsx server/ingest-knowledge.ts
 */

const COGNEE_URL = 'http://localhost:9010';
const USERNAME = 'admin@cognee-cba.dev';
const PASSWORD = 'CbaAdmin2026';

async function getToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append('username', USERNAME);
  params.append('password', PASSWORD);
  const res = await fetch(`${COGNEE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function addData(token: string, dataset: string, content: string): Promise<void> {
  const formData = new FormData();
  formData.append('data', new Blob([content], { type: 'text/plain' }), `${dataset}.txt`);
  formData.append('datasetName', dataset);

  const res = await fetch(`${COGNEE_URL}/api/v1/add`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  FAILED ${dataset}: ${res.status} ${body}`);
  } else {
    console.log(`  OK ${dataset}`);
  }
}

async function cognify(token: string, datasets: string[]): Promise<void> {
  const res = await fetch(`${COGNEE_URL}/api/v1/cognify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ datasets }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  Cognify FAILED: ${res.status} ${body}`);
  } else {
    console.log(`  Cognify triggered for: ${datasets.join(', ')}`);
  }
}

// ============== KNOWLEDGE DATASETS ==============

const CATEGORIES_KNOWLEDGE = `
# Australian Business Transaction Categories (Chart of Accounts)

## Revenue Categories (4-xxxx)
- Sales Revenue (4-0100): GST applicable, keywords: sale, sales, revenue
- Service Revenue (4-0200): GST applicable, keywords: service, consulting, professional
- Interest Income (4-0300): GST-free (FRE), keywords: interest earned, interest income
- Other Income (4-0400): GST applicable, keywords: other income, miscellaneous income
- Export Revenue (4-0500): GST-free export (EXP), keywords: export, overseas sale

## Cost of Goods Sold (5-xxxx)
- Cost of Goods Sold (5-0100): GST applicable, keywords: cogs, cost of goods, stock purchase
- Direct Labour (5-0200): Non-taxable (N-T), keywords: direct labour, labor
- Freight Costs (5-0300): GST applicable, keywords: freight, shipping, postage

## Operating Expenses (6-xxxx)
- Advertising & Marketing (6-0100): GST applicable, keywords: advertising, marketing, google ads, facebook ads
- Bank Fees (6-0200): GST-free (FRE), keywords: bank fee, account fee, monthly fee, overdraft fee
- Computer & IT (6-0300): GST applicable, keywords: computer, software, SaaS, hosting, AWS, Azure
- Depreciation (6-0400): Non-taxable (N-T), keywords: depreciation, amortization
- Entertainment (6-0500): GST applicable (50% deductible), keywords: entertainment, meal, staff lunch
- Insurance (6-0600): GST-free (FRE), keywords: insurance, premium, indemnity
- Interest Expense (6-0700): GST-free (FRE), keywords: interest charged, loan interest
- Motor Vehicle Expenses (6-0800): GST applicable, keywords: fuel, petrol, rego, car service
- Office Supplies (6-0900): GST applicable, keywords: office, stationery, printer, paper
- Professional Fees (6-1000): GST applicable, keywords: legal, accounting, audit, consulting
- Rent (6-1100): GST applicable, keywords: rent, lease, commercial property
- Repairs & Maintenance (6-1200): GST applicable, keywords: repair, maintenance, fix
- Subscriptions (6-1300): GST applicable, keywords: subscription, membership, Netflix, Spotify
- Telephone & Internet (6-1400): GST applicable, keywords: phone, internet, Telstra, Optus, NBN
- Travel (6-1500): GST applicable, keywords: travel, flight, accommodation, hotel
- Utilities (6-1600): GST applicable, keywords: electricity, gas, water, power
- Wages & Salaries (6-1700): Non-taxable (N-T), keywords: wage, salary, payroll, PAYG
- Superannuation (6-1800): Non-taxable (N-T), keywords: super, superannuation
- Work from Home Expenses (6-1900): Non-taxable (N-T), keywords: WFH, home office
- Miscellaneous (6-2000): GST applicable, keywords: miscellaneous, sundry, other

## GST Tax Codes
- GST: 10% Goods and Services Tax — standard rate
- FRE: GST-free supplies — bank fees, insurance, interest, medical, education, food (basic)
- N-T: Non-taxable — wages, super, depreciation, personal transfers
- EXP: Export — 0% GST on exports

## GST Calculation Rules
- GST-inclusive to GST amount: Amount / 11
- GST-exclusive to GST-inclusive: Amount * 1.1
- Input tax credits: Only business purchases with valid tax invoice
- Tax invoice threshold: $82.50 (GST-inclusive) — above this requires ABN on invoice
- Motor vehicle cap: $68,108 (2024-25 FY) — GST credit capped at this value / 11
- Entertainment: Only 50% of GST is claimable
- Mixed-use: Apportion by business use percentage
`;

const GST_RULES_KNOWLEDGE = `
# Australian GST Rules and BAS Reporting Guide

## BAS Labels Explained
- G1: Total sales (including GST)
- G2: Export sales (GST-free)
- G3: Other GST-free sales
- G10: Capital purchases (business assets > $1,000 GST-exclusive)
- G11: Non-capital purchases (operating expenses with GST)
- 1A: GST on sales (G1 / 11)
- 1B: GST on purchases (input tax credits from G10 + G11)
- W1: Total salaries, wages, and other payments
- W2: Amounts withheld from payments (PAYG withholding)
- 5A: PAYG income tax instalment
- 7C: Fuel tax credits
- 7D: Wine equalisation tax

## GST Category Classifications
### Taxable at 10% (Standard Rate)
- Most business purchases and sales
- Advertising, computer equipment, office supplies, professional fees
- Rent (commercial), repairs, subscriptions, telecom, travel, utilities, entertainment

### GST-Free Supplies
- Basic food (bread, milk, meat, fruit, vegetables — NOT restaurant food)
- Medical services, hospital services, medicine
- Education (tuition fees, school supplies)
- Water and sewerage charges
- Childcare and aged care
- Charitable activities
- Bank fees and financial services (input-taxed)
- Insurance premiums

### Input-Taxed Supplies
- Financial supplies: interest, bank fees, brokerage, financial advice
- Residential rent
- Life insurance, health insurance premiums
- Superannuation management fees
- NOTE: No GST credit can be claimed on input-taxed purchases

### Private / Out-of-Scope (Not on BAS)
- Wages, salaries, PAYG
- Superannuation contributions
- ATM withdrawals, cash deposits
- Internal transfers between own accounts
- Dividends
- Depreciation (non-cash)

### Capital Acquisitions (G10)
- Business assets with GST-exclusive value > $1,000
- Equipment, vehicles, machinery, computers (over threshold)
- Furniture, fixtures, fit-outs
- Motor vehicle cap: $68,108 GST-inclusive
- Very large purchases (> $20,000) are presumed capital

## Australian Financial Year
- July 1 to June 30
- BAS quarters: Q1 (Jul-Sep), Q2 (Oct-Dec), Q3 (Jan-Mar), Q4 (Apr-Jun)
- BAS due: 28 days after quarter end (e.g., Q1 due October 28)
- Annual BAS: lodged with income tax return

## PAYG Withholding Tax Brackets (2024-25)
- $0 - $18,200: Nil
- $18,201 - $45,000: 19%
- $45,001 - $120,000: 32.5%
- $120,001 - $180,000: 37%
- $180,001+: 45%
- Medicare Levy: 2% additional
`;

const BANK_FORMATS_KNOWLEDGE = `
# Australian Bank Statement Formats

## CBA (Commonwealth Bank of Australia) — Business Transaction Account
- Date format: DD MMM (e.g., "01 Oct") — NO year in date column
- Year comes from statement period header
- Debit line: {date}{description}{amount}$${'{'}balance{'}'}CR — double-dollar separator
- Credit line: {date}{description}${'{'}amount{'}'}${'{'}balance{'}'}CR — single dollar before each
- Opening balance: "01 Oct2023 OPENING BALANCE$747.03CR"
- Closing balance: "30 Dec 2023 CLOSING BALANCE$367.33CR"
- Multi-line transactions: description on first line, Card/Value Date on continuation
- Value Date format: "Value Date: 30/09/2023"
- Reference numbers concatenate with amounts (e.g., "100015641,372.76")
- Balance-based correction: amount = current_balance - previous_balance (fixes regex errors)
- CR suffix indicates credit balance

## ANZ (Australia and New Zealand Banking Group)
- CSV and PDF formats supported
- Date format: DD/MM/YYYY
- Columns: Date, Description, Debit, Credit, Balance
- Clearly separated debit/credit columns

## Westpac (Westpac Banking Corporation)
- Date format: DD/MM/YYYY
- Transaction type column (e.g., "ATM", "EFTPOS", "Direct Debit")
- Columns: Date, Transaction Type, Description, Debit, Credit, Balance

## NAB (National Australia Bank)
- Date format: DD MMM YY
- Columns: Date, Description, Debit, Credit, Balance
- BSB prefix in descriptions

## Bendigo Bank
- Date format: DD/MM/YYYY
- Columns: Date, Description, Amount, Balance
- Positive = credit, Negative = debit

## ING
- Date format: DD/MM/YYYY
- Columns: Date, Description, Credit, Debit, Balance
- Clean CSV format

## Macquarie Bank
- Date format: DD/MM/YYYY
- Columns: Date, Description, Amount, Balance
- Often investment/savings accounts

## St George Bank
- Similar to Westpac (same parent group)
- Date format: DD/MM/YYYY
- Columns: Date, Description, Debit, Credit, Balance

## Common Australian Transaction Patterns
- BPAY: "BPAY {biller_name} REF:{reference}"
- Direct Debit: "D/D {merchant} {reference}"
- EFTPOS: "EFTPOS {merchant} {location} {date}"
- ATM: "ATM {location} {date}"
- Transfer: "Transfer to/from {account_name} BSB:{bsb} ACC:{account}"
- Osko: "OSKO {description}"
- PayID: "PayID {phone/email}"
- International: "VISA PURCHASE {merchant} {country} {amount} {currency}"
`;

const MERCHANT_PATTERNS_KNOWLEDGE = `
# Australian Merchant Patterns and Abbreviations

## Major Retailers
- WOOLWORTHS, WW, WOOLW → Woolworths Group Ltd (Groceries, GST: Yes)
- COLES, COLES EXP → Coles Group Ltd (Groceries, GST: Yes)
- ALDI → ALDI Stores Australia (Groceries, GST: Yes)
- BUNNINGS → Bunnings Group Ltd (Home & Garden, GST: Yes)
- KMART → Kmart Australia Ltd (Shopping, GST: Yes)
- TARGET → Target Australia Pty Ltd (Shopping, GST: Yes)
- BIG W → Big W (Woolworths Group) (Shopping, GST: Yes)
- OFFICEWORKS → Officeworks Superstores (Office Supplies, GST: Yes)
- JB HI-FI, JB HIFI → JB Hi-Fi Group (Electronics, GST: Yes)
- HARVEY NORMAN → Harvey Norman Holdings (Electronics/Furniture, GST: Yes)
- CHEMIST WAREHOUSE → Chemist Warehouse (Health/Pharmacy, GST: Mixed)
- PRICELINE → Priceline Pharmacy (Health/Pharmacy, GST: Mixed)

## Fuel & Transport
- SHELL → Shell Company of Australia (Fuel, GST: Yes)
- BP → BP Australia Pty Ltd (Fuel, GST: Yes)
- CALTEX, AMPOL → Ampol Ltd (Fuel, GST: Yes)
- 7-ELEVEN, 7 ELEVEN → 7-Eleven Australia (Fuel/Convenience, GST: Yes)
- UBER → Uber Australia (Transport/Delivery, GST: Yes)
- DIDI → DiDi Australia (Transport, GST: Yes)
- OPAL → Transport for NSW (Transport, GST: Yes)
- MYKI → Public Transport Victoria (Transport, GST: Yes)

## Telecommunications
- TELSTRA → Telstra Corporation (Telecom, GST: Yes)
- OPTUS → Singtel Optus (Telecom, GST: Yes)
- VODAFONE → TPG/Vodafone (Telecom, GST: Yes)
- TPG → TPG Telecom (Telecom, GST: Yes)
- BELONG → Telstra subsidiary (Telecom, GST: Yes)

## Food & Dining
- MCDONALD, MACCA → McDonald's Australia (Fast Food, GST: Yes)
- KFC → KFC Australia (Fast Food, GST: Yes)
- HUNGRY JACK → Hungry Jack's (Fast Food, GST: Yes)
- SUBWAY → Subway Australia (Fast Food, GST: Yes)
- UBER EATS → Uber Eats (Food Delivery, GST: Yes)
- DOORDASH → DoorDash (Food Delivery, GST: Yes)
- MENULOG → Menulog (Food Delivery, GST: Yes)

## Subscriptions & Digital
- NETFLIX → Netflix International B.V. (Streaming, GST: Yes)
- SPOTIFY → Spotify AB (Streaming, GST: Yes)
- DISNEY+ → The Walt Disney Company (Streaming, GST: Yes)
- APPLE, APPLE.COM → Apple (Digital/Hardware, GST: Yes)
- GOOGLE → Google/Alphabet (Digital, GST: Yes)
- AMAZON, AMZN → Amazon (Shopping/Digital, GST: Yes)
- MICROSOFT → Microsoft (Software, GST: Yes)

## Insurance & Financial
- NRMA → NRMA Insurance (Insurance, GST-free)
- ALLIANZ → Allianz Insurance (Insurance, GST-free)
- SUNCORP → Suncorp Group (Insurance/Banking, GST-free)
- QBE → QBE Insurance (Insurance, GST-free)
- MEDIBANK → Medibank Private (Health Insurance, GST-free)
- AIA → AIA Australia (Life Insurance, GST-free)

## Payment Processor Prefixes
- SQ * → Square POS (small business, varies)
- STRIPE → Stripe payment (online business, varies)
- PAYPAL * → PayPal (online/international, varies)
- SUMUP → SumUp POS (small business, varies)
- EWAY → eWAY (Australian payment gateway, varies)

## Government & Utilities
- ATO → Australian Taxation Office (Government, N-T)
- CENTRELINK → Services Australia (Government, N-T)
- COUNCIL → Local council rates (Government, GST-free)
- ORIGIN, ORIGIN ENERGY → Origin Energy (Utilities, GST: Yes)
- AGL → AGL Energy (Utilities, GST: Yes)
- ENERGYAUSTRALIA → EnergyAustralia (Utilities, GST: Yes)
- SYDNEY WATER → Sydney Water (Water, GST-free)
`;

const AGENT_KNOWLEDGE = `
# CBA Statement Parser Agent Capabilities

## 7 Specialized AI Agents

### 1. Statement Parser Agent
- Purpose: Parse PDF/text bank statements into structured transactions
- Input: PDF text, bank name, parser hints
- Output: Extracted transactions (date, description, amount, balance)
- Uses: Bank-specific regex patterns, AI fallback for unknown formats
- Cognee integration: Queries bank_formats dataset for parsing patterns

### 2. Transaction Categorizer Agent
- Purpose: Auto-categorize transactions into 30+ categories
- Input: Transaction list, merchant memory
- Output: Category, confidence score, GST category, reasoning
- Uses: Merchant memory lookup, Cognee similarity search, pattern matching
- Cognee integration: Searches bank_transactions for similar past transactions, stores high-confidence results back to merchant_mappings

### 3. GST Calculator Agent
- Purpose: Calculate GST amounts and generate BAS labels
- Input: Categorized transactions, quarter/period
- Output: GST amounts per transaction, BAS label totals (G1-G11, 1A, 1B, W1-W2)
- Uses: ATO GST rules, category-based classification, capital acquisition detection
- Cognee integration: Queries gst_rules dataset for edge cases and ATO rulings

### 4. Account Reconciler Agent
- Purpose: Reconcile parsed vs expected balances
- Input: Transactions, opening/closing balances
- Output: Discrepancies, suggested corrections
- Uses: Running balance validation, duplicate detection
- Cognee integration: Can query past reconciliation patterns

### 5. Budget Analyzer Agent
- Purpose: Analyze spending vs budgets, identify trends
- Input: Categorized transactions, budget targets
- Output: Budget variance, trend analysis, alerts
- Uses: Time series analysis, category aggregation
- Cognee integration: Queries historical spending patterns

### 6. Cross-Account Tracer Agent
- Purpose: Trace money flows between accounts
- Input: Transactions from multiple accounts
- Output: Transfer matches, net positions, flow diagram data
- Uses: Date+amount matching, description correlation
- Cognee integration: Queries transfer_patterns for known flows

### 7. Merchant Intelligence Agent
- Purpose: Resolve abbreviated merchant names, check ABN/GST
- Input: Transaction descriptions
- Output: Canonical names, ABN, GST status, industry, category
- Uses: Pattern matching, Cognee merchant memory, ABN lookup
- Cognee integration: Primary consumer — searches and stores merchant_mappings

## Cognee Datasets Used by Agents
- bank_formats: Bank statement parsing patterns
- bank_transactions: Historical categorized transactions for similarity search
- merchant_mappings: Merchant name → canonical mapping + metadata
- merchant_corrections: User corrections for learning
- gst_rules: ATO GST rulings and guidance
- transfer_patterns: Cross-account flow patterns
- knowledge_base: General domain knowledge

## Pipeline Flow
1. PDF Upload → Text Extraction (pdf-parse)
2. Bank Detection → Parser Selection (registry)
3. Regex Parsing → Transaction Extraction
4. AI Fallback (if regex fails) → Vision Parsing
5. Transaction Categorization (Categorizer Agent + Cognee)
6. GST Calculation (GST Agent + Cognee rules)
7. Transfer Detection (Cross-Account Agent)
8. Merchant Intelligence (stores to Cognee)
9. Save to DB → Index in Cognee
10. Available for search, analytics, BAS reporting
`;

async function main() {
  console.log('=== Cognee Knowledge Ingestion ===\n');

  console.log('1. Authenticating...');
  const token = await getToken();
  console.log('   Token obtained\n');

  console.log('2. Ingesting domain knowledge...');

  const datasets = [
    { name: 'categories', content: CATEGORIES_KNOWLEDGE },
    { name: 'gst_rules', content: GST_RULES_KNOWLEDGE },
    { name: 'bank_formats', content: BANK_FORMATS_KNOWLEDGE },
    { name: 'merchant_mappings', content: MERCHANT_PATTERNS_KNOWLEDGE },
    { name: 'agent_capabilities', content: AGENT_KNOWLEDGE },
  ];

  for (const ds of datasets) {
    await addData(token, ds.name, ds.content);
  }

  console.log('\n3. Triggering cognify for all datasets...');
  await cognify(token, datasets.map(d => d.name));

  console.log('\n=== Done! Knowledge graph will build in background. ===');
  console.log('Use cognify_status to check progress.');
}

main().catch(console.error);
