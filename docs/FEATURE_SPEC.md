# Feature Specification: CBA Statements Parse v2.0

> Comprehensive feature specification for BAS automation, multi-account intelligence,
> analytics dashboards, and advanced GST classification.

---

## Table of Contents

1. [Core GST Features](#1-core-gst-features)
2. [BAS Automation](#2-bas-automation)
3. [Multi-Account Intelligence](#3-multi-account-intelligence)
4. [Analytics & Dashboards](#4-analytics--dashboards)
5. [UI/UX Design System](#5-uiux-design-system)
6. [Data Model Changes](#6-data-model-changes)
7. [API Endpoints](#7-api-endpoints)

---

## 1. Core GST Features

### 1.1 Automatic GST Classification [P0]

**User Story:** As a small business owner, I want every transaction automatically classified for GST purposes so I don't have to manually determine the GST treatment of each purchase and sale.

**Acceptance Criteria:**
- Every transaction receives a GST category on import (taxable_10, gst_free, input_taxed, export, capital, private, no_abn)
- Classification uses description pattern matching, category mapping, and AI-assisted analysis
- Default confidence threshold for auto-classification: 0.7 (70%)
- Transactions below confidence threshold are flagged for manual review
- Classification considers both the transaction description AND the assigned category
- Category-to-tax-code mapping uses the `categories.ts` single source of truth

**UI Mockup:**
```
Each transaction row shows:
┌─────────────────────────────────────────────────────────────┐
│ [Date] [Description]        [Amount]  [GST Badge] [Category]│
│                                        GST $30    Office Sup │
│                                        ───────              │
│                                        10% ●                │
└─────────────────────────────────────────────────────────────┘

GST Badge states:
  - Green pill "GST $X.XX" → Taxable at 10%, credit claimable
  - Gray pill "FRE" → GST-free
  - Orange pill "INP" → Input-taxed (no credit)
  - Blue pill "EXP" → Export
  - Red pill "N-T" → Not reportable
  - Yellow pill "?" → Low confidence, needs review
```

**Implementation:**
1. On statement parse, run each transaction through `categorize_transaction()` in `gst_rules.py`
2. Cross-reference with the category's `taxCode` from `categories.ts`
3. If category tax code and pattern-based GST disagree, lower confidence and flag
4. Store `gstCategory`, `gstAmount`, `gstConfidence` on each transaction

**API Endpoints:**
- `GET /api/transactions/:id/gst` - Get GST classification for a transaction
- `PATCH /api/transactions/:id/gst` - Override GST classification
- `POST /api/transactions/gst/bulk-classify` - Re-classify all transactions in a period

**Data Model Changes:**
```sql
ALTER TABLE transactions ADD COLUMN gst_confidence REAL DEFAULT 0.6;
ALTER TABLE transactions ADD COLUMN gst_override BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN gst_override_reason TEXT;
```

---

### 1.2 GST Confidence Scoring [P0]

**User Story:** As a bookkeeper, I want to see how confident the system is about each GST classification so I can focus my review time on uncertain transactions.

**Acceptance Criteria:**
- Each transaction has a confidence score from 0.0 to 1.0
- Scores are based on: description pattern match strength, category alignment, historical corrections, AI analysis
- Transactions with confidence < 0.7 are flagged with a yellow "?" badge
- Confidence improves over time as user makes corrections (learning loop)
- Dashboard shows count of "needs review" transactions per period

**Confidence Scoring Formula:**
```
Base score from pattern matching:        0.0 - 0.4
Category tax code alignment bonus:       +0.2 if matches
Historical correction alignment:         +0.2 if matches past corrections
AI analysis confirmation:                +0.1 if AI agrees
Description specificity bonus:           +0.1 if strong keyword match

Total capped at 1.0
```

**UI Mockup:**
```
Review Queue Panel (sidebar or modal):
┌──────────────────────────────────────────┐
│ ⚠ 12 transactions need GST review       │
│                                          │
│ ● "BUNNINGS WAREHOUSE"    -$247.00  63%  │
│   Suggested: GST 10%  [✓] [✗] [Edit]    │
│                                          │
│ ● "TRANSFER FROM SAVINGS"  $5,000   45%  │
│   Suggested: Private   [✓] [✗] [Edit]   │
│                                          │
│ [Review All] [Auto-accept >70%]          │
└──────────────────────────────────────────┘
```

---

### 1.3 Manual Override with Learning [P1]

**User Story:** As a user, I want to correct GST classifications and have the system learn from my corrections to improve future classifications.

**Acceptance Criteria:**
- User can override any GST classification via dropdown or quick-action
- Override stores the reason (optional) and new classification
- System tracks correction patterns: "description X was corrected from Y to Z"
- Future transactions matching the same pattern automatically get the corrected classification
- Learning rules are stored per-user and can be exported/imported
- Admin can view and manage learning rules

**Data Model:**
```sql
CREATE TABLE gst_learning_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description_pattern TEXT NOT NULL,  -- regex or keyword match
  original_category TEXT,
  corrected_category TEXT NOT NULL,
  corrected_gst_category TEXT NOT NULL,
  correction_count INTEGER DEFAULT 1,
  confidence_boost REAL DEFAULT 0.2,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**API Endpoints:**
- `GET /api/gst/learning-rules` - List all learning rules
- `POST /api/gst/learning-rules` - Create manual learning rule
- `DELETE /api/gst/learning-rules/:id` - Remove a learning rule

---

### 1.4 GST Summary Per Period [P0]

**User Story:** As a business owner, I want a clear summary of GST collected and paid for each reporting period so I can understand my GST position at a glance.

**Acceptance Criteria:**
- Summary shows: total GST collected (1A), total GST credits (1B), net GST position
- Breakdown by GST category (taxable, GST-free, input-taxed, capital, private)
- Period selectable: monthly, quarterly, annual
- Comparison with previous period (% change)
- Export to CSV/PDF

**UI Mockup:**
```
┌─ GST Summary: Q2 FY2024-25 (Oct-Dec 2024) ─────────────────┐
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ GST Collected│  │ GST Credits  │  │ Net GST Position │    │
│  │   $4,364     │  │   $2,300     │  │  $2,064 PAYABLE  │    │
│  │   ▲ 12%      │  │   ▲ 8%       │  │  ▲ 18%           │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
│                                                               │
│  Breakdown:                                                   │
│  ● Taxable (10%):  $48,000 sales / $22,000 purchases        │
│  ● GST-Free:       $2,000 sales  / $3,000 purchases         │
│  ● Input-Taxed:    $1,200 (bank fees, interest)              │
│  ● Capital:        $3,300 (equipment)                        │
│  ● Private:        $800 (excluded)                           │
│                                                               │
│  Transactions: 342 classified | 12 need review               │
│                                                               │
│  [View Details] [Export CSV] [Generate BAS Draft]            │
└───────────────────────────────────────────────────────────────┘
```

---

### 1.5 Input Tax Credit Tracking [P1]

**User Story:** As a GST-registered business, I want to track all my claimable input tax credits to ensure I'm claiming everything I'm entitled to and not over-claiming.

**Acceptance Criteria:**
- List of all claimable GST credits with tax invoice status
- Highlight credits missing tax invoices (required for > $82.50)
- Apportionment tracking for mixed-use items
- 4-year credit window tracking (flag credits about to expire)
- Total claimable vs total available comparison

**UI Mockup:**
```
┌─ Input Tax Credits: Q2 FY2024-25 ──────────────────┐
│                                                      │
│ Total Claimable: $2,300    Missing Invoices: 3       │
│                                                      │
│ ┌────────────────────────────────────────────┐       │
│ │ Category         GST Credits  Invoice  ✓   │       │
│ │ ────────────────────────────────────────── │       │
│ │ Office Supplies     $180.00    ✅         │       │
│ │ Professional Fees   $450.00    ✅         │       │
│ │ Motor Vehicle       $120.00    ⚠️ Missing │       │
│ │ Computer & IT       $200.00    ✅         │       │
│ │ Rent               $900.00    ✅         │       │
│ │ Subscriptions        $80.00    ⚠️ Missing │       │
│ └────────────────────────────────────────────┘       │
│                                                      │
│ ⚠ 3 credits ($230.00) may be disallowed without     │
│   valid tax invoices. Upload or mark as substantiated.│
└──────────────────────────────────────────────────────┘
```

---

## 2. BAS Automation

### 2.1 BAS Pre-Fill Report [P0]

**User Story:** As a business owner, I want the system to automatically generate a pre-filled BAS report from my transactions so I can review and lodge with minimal effort.

**Acceptance Criteria:**
- Generates all BAS labels (G1, G2, G3, G10, G11, 1A, 1B, W1, W2, 5A, 7C, 7D)
- Supports both Simpler BAS (G1, 1A, 1B only) and Full BAS
- Shows transaction drill-down for each label (click G11 to see all non-capital purchases)
- Highlights discrepancies or anomalies
- Draft status workflow: Draft → Review → Ready → Lodged
- Comparison with previous quarter's BAS

**UI Mockup:**
```
┌─ BAS Pre-Fill: Q2 FY2024-25 ─────────── [Simpler ▾] ────┐
│                                                            │
│  ┌─ SALES ──────────────────────────────────────────┐     │
│  │ G1  Total Sales                    $55,000.00    │     │
│  │     └─ 247 transactions                    [→]   │     │
│  │                                                   │     │
│  │ 1A  GST on Sales                   $4,363.64     │     │
│  │     └─ Calculated from taxable sales       [→]   │     │
│  └───────────────────────────────────────────────────┘     │
│                                                            │
│  ┌─ PURCHASES ──────────────────────────────────────┐     │
│  │ 1B  GST on Purchases               $2,300.00    │     │
│  │     └─ 95 creditable purchases             [→]   │     │
│  └───────────────────────────────────────────────────┘     │
│                                                            │
│  ┌─ PAYG WITHHOLDING ───────────────────────────────┐     │
│  │ W1  Gross Wages                    $30,000.00    │     │
│  │ W2  Amounts Withheld               $7,500.00     │     │
│  └───────────────────────────────────────────────────┘     │
│                                                            │
│  ┌─ SUMMARY ────────────────────────────────────────┐     │
│  │ Net GST (1A - 1B):                 $2,063.64     │     │
│  │ PAYG Withheld:                     $7,500.00     │     │
│  │ ─────────────────────────────────────────────    │     │
│  │ TOTAL PAYABLE:                     $9,563.64     │     │
│  │                                                   │     │
│  │ Due: 28 February 2025          Status: [Draft ▾] │     │
│  └───────────────────────────────────────────────────┘     │
│                                                            │
│  ⚠ 12 transactions need GST review before finalizing      │
│  ⚠ 3 purchases missing tax invoices                       │
│                                                            │
│  [Review Transactions] [Save Draft] [Mark Ready]          │
└────────────────────────────────────────────────────────────┘
```

**API Endpoints:**
- `GET /api/bas/calculate/:quarter` - Calculate BAS for a quarter
- `POST /api/bas/save/:quarter` - Save BAS draft
- `PATCH /api/bas/status/:quarter` - Update BAS status (draft/ready/lodged)
- `GET /api/bas/drill-down/:quarter/:label` - Get transactions for a specific BAS label

---

### 2.2 BAS Period Selection [P0]

**User Story:** As a user, I want to select different BAS periods and switch between monthly, quarterly, and annual views.

**Acceptance Criteria:**
- Period picker with quarter selector (Q1-Q4) and financial year
- Monthly option for businesses reporting monthly
- Annual option for annual GST reporters
- Auto-detect available periods based on uploaded transactions
- Highlight current period and upcoming lodgement deadline

**Existing implementation** in `BASDashboard.tsx` already has quarter selection. Enhancement needed:
- Add monthly/annual toggle
- Show lodgement countdown
- Highlight overdue periods in red

---

### 2.3 Draft BAS Review Workflow [P1]

**User Story:** As a business owner, I want a workflow to review, approve, and track the lodgement of my BAS returns.

**Acceptance Criteria:**
- Status flow: `draft` → `review` → `ready` → `lodged` → `amended`
- Review checklist: all transactions classified, no missing invoices, reconciled totals
- Lock period after lodgement (prevent edits without amendment)
- Lodgement date recording
- Notes/comments per BAS period

**Data Model Enhancement:**
```sql
ALTER TABLE bas_periods ADD COLUMN review_notes TEXT;
ALTER TABLE bas_periods ADD COLUMN reviewed_by TEXT;
ALTER TABLE bas_periods ADD COLUMN reviewed_at TEXT;
ALTER TABLE bas_periods ADD COLUMN locked BOOLEAN DEFAULT FALSE;
```

---

### 2.4 Historical BAS Comparison [P1]

**User Story:** As a user, I want to compare the current BAS with previous periods to identify trends and anomalies.

**Acceptance Criteria:**
- Side-by-side comparison of any two BAS periods
- Variance highlighting (>20% change in any label = amber, >50% = red)
- Trend chart showing GST collected/paid over last 8 quarters
- Average comparison (current vs rolling average)

**UI Mockup:**
```
┌─ BAS Comparison ────────────────────────────────┐
│                Q2 2024-25   Q1 2024-25   Change │
│ G1  Sales     $55,000      $48,000       +14.6% │
│ 1A  GST Sales  $4,364       $3,818       +14.3% │
│ 1B  GST Purch  $2,300       $1,900       ⚠+21%  │
│ Net GST        $2,064       $1,918        +7.6% │
│ W2  PAYG       $7,500       $7,500        0.0%  │
│ TOTAL          $9,564       $9,418        +1.5% │
└──────────────────────────────────────────────────┘
```

---

### 2.5 BAS Lodgement Deadline Reminders [P2]

**User Story:** As a busy business owner, I want reminders about upcoming BAS lodgement deadlines so I never miss a due date.

**Acceptance Criteria:**
- Dashboard notification 14 days before deadline
- Urgent notification 3 days before deadline
- Overdue notification after deadline
- Optional email/push notifications (future)
- Calendar integration suggestion

---

## 3. Multi-Account Intelligence

### 3.1 Multi-Account Upload [P0]

**User Story:** As a user with multiple bank accounts, I want to upload statements from 5+ different banks and see all transactions in a unified view.

**Acceptance Criteria:**
- Support for CBA, ANZ, Westpac, NAB, St. George, Macquarie, Bendigo, ING statements
- Each account tracked with: bank name, account number (masked), account type, nickname
- Unified transaction list with account filter
- Account-specific balances and summaries
- Drag-and-drop multi-file upload

**Existing support:** Parsers already exist for all major banks in `server/src/services/parsers/banks/`.

**Data Model:**
The existing `accounts` table handles this. Enhancement:
```sql
ALTER TABLE accounts ADD COLUMN nickname TEXT;
ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT 'transaction';
ALTER TABLE accounts ADD COLUMN color TEXT;  -- UI color coding
```

---

### 3.2 Cross-Account Transaction Matching [P0]

**User Story:** As a user, I want the system to automatically detect when a transfer from one of my accounts appears in another account's statement, so I can eliminate duplicate counting.

**Acceptance Criteria:**
- Auto-detect transfer pairs across accounts (debit in A = credit in B)
- Matching based on: amount (exact or within $5 tolerance), date proximity (0-3 days), description keywords
- Confidence scoring on each match
- Manual confirm/reject of matches
- Excluded from income/expense calculations once matched
- Visual indicator on matched transactions

**Existing implementation:** `TransferDetector` in `server/src/services/transfers/detector.ts` already handles this well. Enhancements needed:
- UI to display matches and confirm/reject
- Batch confirmation workflow
- Better handling of fees (e.g., $1000 sent, $997 received after fee)

---

### 3.3 Money Flow Visualization [P1]

**User Story:** As a user, I want to see a visual map of how money flows between my accounts (Account A → B → C) to understand my financial patterns.

**Acceptance Criteria:**
- Sankey diagram or flow chart showing money movement between accounts
- Filterable by date range
- Shows net flow direction and total amounts
- Identifies circular flows (A → B → A)
- Color-coded by account
- Click on flow to see underlying transactions

**UI Mockup:**
```
┌─ Money Flow: Oct-Dec 2024 ────────────────────────┐
│                                                     │
│  CBA Everyday ──── $3,200 ────→ CBA Savings        │
│       │                              │              │
│       │── $1,500 ──→ NAB Business    │              │
│       │                 │            │              │
│       │                 │── $800 ──→ CBA Savings    │
│       │                                             │
│  ANZ Visa ──── $2,100 ────→ CBA Everyday           │
│                                                     │
│  Net flows:                                         │
│  CBA Everyday: -$2,600 net outflow                 │
│  CBA Savings:  +$4,000 net inflow                  │
│  NAB Business: +$700 net inflow                    │
│  ANZ Visa:     -$2,100 net outflow                 │
│                                                     │
│  [Change Period] [Export] [Full Screen]             │
└─────────────────────────────────────────────────────┘
```

**Technology:** React Flow, D3.js Sankey, or a custom SVG implementation.

---

### 3.4 Circular Transaction Detection [P1]

**User Story:** As a user, I want to be alerted when money moves in circular patterns between my accounts, which may indicate unnecessary transactions or potential issues.

**Acceptance Criteria:**
- Detect patterns: A → B → A, or A → B → C → A
- Alert when circular flow exceeds $1,000 in a period
- Show total amount circulated and net effect
- Differentiate between: legitimate (savings cycle), wasteful (unnecessary transfers), suspicious

**Existing implementation:** `TransferDetector.detectMultiHopTransfers()` provides the foundation.

---

### 3.5 Regular Transfer Identification [P1]

**User Story:** As a user, I want the system to identify recurring transfers between my accounts so I can manage my automated payments and savings plans.

**Acceptance Criteria:**
- Detect recurring transfers: same amount, same accounts, regular interval
- Show frequency: weekly, fortnightly, monthly
- Group by transfer type: savings, bills, loan repayments
- Alert when a regular transfer is missing (expected but didn't occur)
- Show total annual cost of each recurring transfer

---

### 3.6 Net Position Calculator [P1]

**User Story:** As a user, I want to see the net position between any two accounts over a period to understand the relationship between them.

**Acceptance Criteria:**
- Select two accounts and date range
- Show: total from A→B, total from B→A, net position
- Chart showing cumulative net position over time
- Useful for: tracking loan repayments between accounts, understanding cash flow patterns

---

### 3.7 Account Relationship Graph [P2]

**User Story:** As a user, I want a visual network graph showing all my accounts and the relationships between them.

**Acceptance Criteria:**
- Node for each account (sized by balance or transaction volume)
- Edges showing transfer relationships (thickness = volume)
- Interactive: click node to see account details, click edge to see transfers
- Filter by period
- Identify hub accounts (most connected)

---

## 4. Analytics & Dashboards

### 4.1 Budget vs Actual Dashboard [P1]

**User Story:** As a business owner, I want to set budgets per category and track actual spending against them throughout the period.

**Acceptance Criteria:**
- Set monthly/quarterly/annual budgets per category
- Real-time progress bar showing budget utilization
- Over-budget alerts (amber at 80%, red at 100%)
- Variance analysis: $ and % over/under budget
- Budget templates (copy from previous period)
- Category-level and total-level budgets

**UI Mockup:**
```
┌─ Budget vs Actual: December 2024 ──────────────────┐
│                                                      │
│  Category          Budget    Actual    Var    Status  │
│  ──────────────────────────────────────────────────  │
│  Office Supplies   $500      $320     -$180   ████░░ │
│  Professional Fees $2,000    $1,800   -$200   █████░ │
│  Travel            $1,500    $1,890   +$390   ██████ │
│  Motor Vehicle     $800      $750     -$50    █████░ │
│  Rent              $3,000    $3,000    $0     ██████ │
│  ──────────────────────────────────────────────────  │
│  TOTAL             $12,000   $10,960  -$1,040  ████░ │
│                                                      │
│  [Set Budgets] [Copy from Last Month] [Export]       │
└──────────────────────────────────────────────────────┘
```

**Data Model:**
```sql
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  period_type TEXT NOT NULL,  -- 'monthly' | 'quarterly' | 'annual'
  period_start TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 4.2 Spending Trend Analysis [P1]

**User Story:** As a user, I want to see spending trends over time by category to identify where my money is going and how patterns change.

**Acceptance Criteria:**
- Line chart showing spending per category over 6-12 months
- Stacked area chart showing total spending composition
- Month-over-month and year-over-year comparison
- Trend indicators (rising, falling, stable)
- Anomaly highlighting (spending outside 2 standard deviations)

**UI Mockup:**
```
┌─ Spending Trends ─────────────────────────────────────┐
│  [6M ▾] [Category: All ▾] [Chart: Line ▾]           │
│                                                       │
│  $5K │            ╱╲                                  │
│      │    ╱──╲  ╱    ╲  ╱╲                            │
│  $3K │  ╱     ╲╱       ╲╱  ╲                          │
│      │╱                       ╲                       │
│  $1K │                                                │
│      └──────────────────────────────────────          │
│       Jul  Aug  Sep  Oct  Nov  Dec                    │
│                                                       │
│  ── Office Supplies  ── Travel  ── Professional       │
│                                                       │
│  Top Insights:                                        │
│  • Travel spending up 45% vs last quarter             │
│  • Office Supplies trending down (-12% MoM)           │
│  • ⚠ Professional Fees spike in November              │
└───────────────────────────────────────────────────────┘
```

---

### 4.3 Anomaly Detection [P1]

**User Story:** As a user, I want the system to flag unusual transactions or spending patterns that might indicate errors, fraud, or opportunities.

**Acceptance Criteria:**
- Flag transactions significantly larger than the category average (>3x)
- Detect unusual frequency (e.g., 5 transactions to same merchant in one day)
- Identify first-time merchants with large amounts
- Weekend/after-hours transaction alerts (for business accounts)
- Duplicate transaction detection (same amount, same day, same merchant)
- Notification with severity: info, warning, critical

**Detection Rules:**
```
1. Amount anomaly:    amount > mean + 3*stddev for category
2. Frequency anomaly: >3 transactions to same merchant in 24h
3. New merchant:      first transaction to merchant > $500
4. Duplicate suspect: same amount ± $0.01, same day, same merchant
5. Round number:      exact round numbers ($1000, $5000) in unusual context
6. Time anomaly:      transaction at unusual hour for the merchant type
```

---

### 4.4 Recurring Payment Identification [P0]

**User Story:** As a user, I want to see all my recurring payments in one place so I can manage subscriptions and regular expenses.

**Acceptance Criteria:**
- Auto-detect recurring payments: same merchant, similar amount, regular interval
- Group by frequency: weekly, fortnightly, monthly, quarterly, annual
- Show: merchant, amount, frequency, next expected date, annual cost
- Alert when a recurring payment changes amount
- Alert when a recurring payment is missed
- Total recurring cost per month/year

**UI Mockup:**
```
┌─ Recurring Payments ──────────────────────────────────┐
│                                                        │
│  Monthly (12 items)               Annual: $14,400      │
│  ┌────────────────────────────────────────────┐       │
│  │ Netflix           $22.99/mo   Next: 15 Mar │       │
│  │ Spotify           $12.99/mo   Next: 1 Mar  │       │
│  │ Office 365       $139.00/yr   Next: Jul 25 │       │
│  │ Domain Hosting    $29.95/mo   Next: 5 Mar  │       │
│  │ Insurance        $180.00/mo   Next: 1 Mar  │       │
│  │ ⚠ Gym           $79.99/mo   MISSED Feb     │       │
│  └────────────────────────────────────────────┘       │
│                                                        │
│  ⚠ 1 missed payment    △ 2 price changes detected    │
│                                                        │
│  [View All] [Export] [Set Alerts]                     │
└────────────────────────────────────────────────────────┘
```

**Data Model:**
```sql
CREATE TABLE recurring_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id INTEGER,
  merchant_pattern TEXT NOT NULL,
  typical_amount_cents INTEGER NOT NULL,
  amount_variance_cents INTEGER DEFAULT 100,
  frequency TEXT NOT NULL,  -- 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'
  last_occurrence TEXT,
  next_expected TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  category TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 4.5 Cash Flow Forecasting [P2]

**User Story:** As a business owner, I want to forecast my cash flow for the next 3-6 months based on recurring payments and historical trends.

**Acceptance Criteria:**
- Project future cash flow based on: recurring income, recurring expenses, seasonal patterns, historical averages
- Show projected balance over time
- Highlight months where cash flow may go negative
- Confidence bands (best case, expected, worst case)
- Adjustable: add/remove expected future transactions

**UI Mockup:**
```
┌─ Cash Flow Forecast ────────────────────────────────┐
│  [3 Months ▾]  [Account: All ▾]                     │
│                                                      │
│  $20K │    ╱╲      Projected                        │
│       │  ╱    ╲  ╱────────╲                         │
│  $10K │╱        ╲╱          ╲───────                │
│       │     ░░░░░░░░░░░░░░░░░░  Confidence band     │
│   $0K │─────────────────────────────────             │
│       │                    ⚠ Low point              │
│  -$5K │                                              │
│       └──────────────────────────────────            │
│        Mar    Apr    May    Jun    Jul               │
│                                                      │
│  ⚠ Cash may drop below $2,000 in May               │
│  ℹ Based on 6 months of historical data             │
└──────────────────────────────────────────────────────┘
```

---

### 4.6 Category Breakdown Charts [P0]

**User Story:** As a user, I want visual charts showing my income and expenses broken down by category.

**Acceptance Criteria:**
- Donut/pie chart for expense breakdown by category
- Bar chart for income vs expenses by month
- Treemap for proportional spending visualization
- Interactive: click segment to drill down
- Period selectable: month, quarter, year
- Show top 5 categories with "other" grouping

**UI Mockup:**
```
┌─ Category Breakdown: Q2 FY2024-25 ─────────────────┐
│                                                      │
│  Expenses by Category          Income by Source      │
│  ┌──────────────┐              ┌──────────────┐     │
│  │    ╭───╮     │              │    ╭───╮     │     │
│  │  ╭╯ R  ╰╮   │              │  ╭╯ SV ╰╮   │     │
│  │ ╭╯ 28%  ╰╮  │              │ ╭╯ 65%  ╰╮  │     │
│  │ │ PF 18% │  │              │ │ SR 25% │  │     │
│  │ ╰╮MV 12%╭╯  │              │ ╰╮OI 10%╭╯  │     │
│  │  ╰╮    ╭╯   │              │  ╰╮    ╭╯   │     │
│  │    ╰───╯     │              │    ╰───╯     │     │
│  └──────────────┘              └──────────────┘     │
│                                                      │
│  R = Rent, PF = Prof Fees, MV = Motor Vehicle       │
│  SV = Service Revenue, SR = Sales, OI = Other       │
└──────────────────────────────────────────────────────┘
```

---

### 4.7 Year-over-Year Comparison [P2]

**User Story:** As a user, I want to compare my financial data across years to understand long-term trends.

**Acceptance Criteria:**
- Compare any two financial years side by side
- Show: total income, total expenses, net profit, GST position
- Category-level comparison
- Growth/decline indicators
- Seasonal pattern visualization

---

## 5. UI/UX Design System

### 5.1 Mobile-First Responsive Design [P0]

**Design Principles:**
- Mobile-first: design for 375px width first, then scale up
- Touch-friendly: minimum 44px touch targets
- Progressive disclosure: show summary first, details on demand
- Bottom navigation on mobile
- Swipe gestures for quick actions

**Breakpoints:**
```
Mobile:  375px - 640px    (single column, stacked cards)
Tablet:  641px - 1024px   (two columns, side panels)
Desktop: 1025px+          (full layout, multi-column)
```

### 5.2 Dark Neumorphic Theme (Existing)

**Design Tokens:**
```css
/* Existing design system */
--bg-primary: #1a1a2e;        /* Dark background */
--bg-card: #16213e;           /* Card background */
--accent: #FFCC00;            /* Gold accent */
--text-primary: #e0e0e0;      /* Primary text */
--text-secondary: #a0a0a0;    /* Secondary text */

/* Neumorphic classes */
.neu-raised: box-shadow inset dark/light
.neu-inset: box-shadow inset pressed effect

/* GST-specific colors */
--gst-taxable: #22c55e;       /* Green - GST claimable */
--gst-free: #6b7280;          /* Gray - GST-free */
--gst-input-taxed: #f59e0b;   /* Amber - Input-taxed */
--gst-export: #3b82f6;        /* Blue - Export */
--gst-private: #ef4444;       /* Red - Private/excluded */
--gst-review: #eab308;        /* Yellow - Needs review */
```

### 5.3 Inline GST Indicators [P0]

Each transaction row displays:
- Small colored pill showing GST status
- GST amount in small text
- Confidence dot (green >0.8, yellow 0.5-0.8, red <0.5)

### 5.4 Swipe Actions (Mobile) [P1]

- Swipe left: Quick categorize (shows category picker)
- Swipe right: Mark as reviewed / confirm GST
- Long press: Multi-select mode

### 5.5 Dashboard Cards with Drill-Down [P0]

All summary cards support:
- Tap to expand inline details
- "View all" link to full detail page
- Sparkline mini-chart showing trend
- Comparison badge (% change vs previous period)

---

## 6. Data Model Changes

### New Tables

```sql
-- GST learning rules (user corrections that improve classification)
CREATE TABLE gst_learning_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description_pattern TEXT NOT NULL,
  original_gst_category TEXT,
  corrected_gst_category TEXT NOT NULL,
  correction_count INTEGER DEFAULT 1,
  confidence_boost REAL DEFAULT 0.2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Budget tracking
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recurring payment patterns
CREATE TABLE recurring_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id INTEGER,
  merchant_pattern TEXT NOT NULL,
  typical_amount_cents INTEGER NOT NULL,
  amount_variance_cents INTEGER DEFAULT 100,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annual')),
  interval_days INTEGER,
  last_occurrence TEXT,
  next_expected TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  category TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Anomaly detections
CREATE TABLE anomalies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT,
  anomaly_type TEXT NOT NULL,  -- 'amount' | 'frequency' | 'duplicate' | 'new_merchant' | 'time'
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Cross-account transfer links
CREATE TABLE transfer_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_transaction_id TEXT NOT NULL,
  target_transaction_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  match_reasons TEXT,  -- JSON array
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Table Alterations

```sql
-- Enhanced transaction GST tracking
ALTER TABLE transactions ADD COLUMN gst_confidence REAL DEFAULT 0.6;
ALTER TABLE transactions ADD COLUMN gst_override BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN gst_override_reason TEXT;
ALTER TABLE transactions ADD COLUMN gst_learning_rule_id TEXT;

-- Enhanced accounts
ALTER TABLE accounts ADD COLUMN nickname TEXT;
ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT 'transaction';
ALTER TABLE accounts ADD COLUMN color TEXT;

-- Enhanced BAS periods
ALTER TABLE bas_periods ADD COLUMN review_notes TEXT;
ALTER TABLE bas_periods ADD COLUMN reviewed_by TEXT;
ALTER TABLE bas_periods ADD COLUMN reviewed_at TEXT;
ALTER TABLE bas_periods ADD COLUMN locked BOOLEAN DEFAULT FALSE;
ALTER TABLE bas_periods ADD COLUMN reporting_method TEXT DEFAULT 'simpler';
```

---

## 7. API Endpoints

### GST Endpoints

| Method | Path | Description | Priority |
|---|---|---|---|
| GET | `/api/transactions/:id/gst` | Get GST classification for a transaction | P0 |
| PATCH | `/api/transactions/:id/gst` | Override GST classification | P0 |
| POST | `/api/transactions/gst/bulk-classify` | Re-classify transactions in a period | P0 |
| GET | `/api/gst/summary/:period` | GST summary for a period | P0 |
| GET | `/api/gst/review-queue` | Transactions needing GST review | P0 |
| POST | `/api/gst/review-queue/bulk-approve` | Bulk approve GST classifications | P1 |
| GET | `/api/gst/learning-rules` | List GST learning rules | P1 |
| POST | `/api/gst/learning-rules` | Create a learning rule | P1 |
| DELETE | `/api/gst/learning-rules/:id` | Delete a learning rule | P1 |
| GET | `/api/gst/input-credits/:period` | Input tax credit summary | P1 |

### BAS Endpoints

| Method | Path | Description | Priority |
|---|---|---|---|
| GET | `/api/bas/calculate/:quarter` | Calculate BAS for a quarter | P0 |
| GET | `/api/bas/calculate/:quarter?method=simpler` | Calculate Simpler BAS | P0 |
| POST | `/api/bas/save/:quarter` | Save BAS draft | P0 |
| PATCH | `/api/bas/status/:quarter` | Update status (draft/review/ready/lodged) | P0 |
| GET | `/api/bas/drill-down/:quarter/:label` | Transactions for a BAS label | P0 |
| GET | `/api/bas/history` | BAS lodgement history | P0 |
| GET | `/api/bas/compare/:q1/:q2` | Compare two BAS periods | P1 |
| GET | `/api/bas/deadlines` | Upcoming lodgement deadlines | P2 |
| GET | `/api/bas/available-quarters` | Quarters with transaction data | P0 |

### Multi-Account Endpoints

| Method | Path | Description | Priority |
|---|---|---|---|
| GET | `/api/accounts` | List all accounts | P0 |
| PATCH | `/api/accounts/:id` | Update account (nickname, color, type) | P0 |
| GET | `/api/transfers/detect` | Run transfer detection | P0 |
| GET | `/api/transfers/matches` | Get detected transfer matches | P0 |
| POST | `/api/transfers/confirm` | Confirm a transfer match | P0 |
| DELETE | `/api/transfers/reject/:id` | Reject a transfer match | P0 |
| GET | `/api/transfers/flow/:period` | Money flow data for visualization | P1 |
| GET | `/api/transfers/circular/:period` | Circular transaction detection | P1 |
| GET | `/api/transfers/recurring` | Recurring transfer patterns | P1 |
| GET | `/api/transfers/net-position/:a/:b` | Net position between two accounts | P1 |

### Analytics Endpoints

| Method | Path | Description | Priority |
|---|---|---|---|
| GET | `/api/analytics/category-breakdown/:period` | Category breakdown data | P0 |
| GET | `/api/analytics/trends/:months` | Spending trends over N months | P1 |
| GET | `/api/analytics/anomalies` | Detected anomalies | P1 |
| PATCH | `/api/analytics/anomalies/:id/dismiss` | Dismiss an anomaly | P1 |
| GET | `/api/analytics/recurring-payments` | Recurring payment list | P0 |
| POST | `/api/analytics/recurring-payments/:id/alert` | Set alert for recurring payment | P1 |
| GET | `/api/analytics/forecast/:months` | Cash flow forecast | P2 |
| GET | `/api/budgets/:period` | Get budgets for a period | P1 |
| POST | `/api/budgets` | Create/update a budget | P1 |
| GET | `/api/budgets/vs-actual/:period` | Budget vs actual comparison | P1 |
| GET | `/api/analytics/yoy/:year1/:year2` | Year-over-year comparison | P2 |

---

## Priority Summary

| Priority | Features | Effort |
|---|---|---|
| **P0** (Must Have) | GST auto-classification, confidence scoring, GST summary, BAS pre-fill, BAS period selection, multi-account upload, cross-account matching, recurring payments, category charts, inline GST indicators, dashboard drill-down | High |
| **P1** (Should Have) | Manual override + learning, input credit tracking, BAS review workflow, historical comparison, money flow viz, circular detection, regular transfers, net position, budget vs actual, spending trends, anomaly detection, swipe actions | Medium |
| **P2** (Nice to Have) | BAS deadline reminders, cash flow forecast, account relationship graph, year-over-year comparison | Low |

---

*Last updated: February 2026*
*Version: 2.0 Draft*
