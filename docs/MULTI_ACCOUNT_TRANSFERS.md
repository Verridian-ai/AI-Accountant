# Multi-Account & Transfer Intelligence

## Overview

GoldLedger supports multiple bank accounts with intelligent cross-account transfer detection, personal/business separation, money flow visualization, and account balance tracking.

## Features

### 1. Multi-Account Management

**Schema**: `accounts` table with fields:
- `accountNumber`, `accountName`, `accountType` (checking/savings/credit_card/loan/other)
- `bankName`, `currentBalance`, `interestRate`, `creditLimit`
- `ownershipTag` — `'personal'` or `'business'` (default: `'business'`)
- `isActive` — soft-delete support

**Account Detection**: The pipeline automatically detects accounts from statement text via AI or regex parsing. When a new account number is found, it auto-creates the account record and links the statement.

**Account Switching**: The `AccountSwitcher` component allows filtering all views (ledger, analytics, GST) by account. "All Accounts" shows a unified view.

### 2. Smart Transfer Detection

**Location**: `server/src/services/transfers/detector.ts`

The `TransferDetector` class identifies inter-account transfers using multi-signal matching:

| Signal | Weight | Description |
|--------|--------|-------------|
| Exact amount match | +0.40 | Debit and credit amounts match exactly |
| Amount within tolerance | +0.30 | Within $5 tolerance (for bank fees) |
| Same day | +0.25 | Both transactions on the same date |
| Next day | +0.20 | 1 business day apart |
| Both have transfer keywords | +0.20 | Keywords like "transfer", "tfr", "osko", "bpay" |
| One has transfer keyword | +0.10 | Only one side has a keyword |
| Cross-references account number | +0.15 | Description mentions the other account's last 4 digits |
| Same bank | +0.10 | Both accounts at the same institution |
| Credit card payment | +0.15 | Debit matches credit on a credit card account |
| Owner contribution | +0.10 | Transfer from personal to business account |

**Minimum confidence**: 0.6 (60%) to qualify as a match.

**Match window**: Up to 3 business days between the debit and credit.

#### Transfer Keywords
`transfer`, `tfr`, `trf`, `internal`, `osko`, `pay anyone`, `bpay`, `direct credit`, `direct debit`, `internet transfer`, `mobile transfer`, `credit card`, `cc payment`, `card payment`, `visa payment`, `mastercard`, `sweep`, `auto save`, `automatic transfer`, `scheduled transfer`

### 3. Transfer Persistence

**Location**: `server/src/services/transfers/persistence.ts`

Detected transfers are persisted to the `transfer_links` table:
- `sourceTransactionId` / `destinationTransactionId` — the matched pair
- `sourceAccountId` / `destinationAccountId` — account references
- `amount` — transfer amount in cents
- `confidence` — match confidence score (0.0–1.0)
- `isUserConfirmed` — whether the user has verified the match

Both transactions are marked with `isTransfer = true` and `transferLinkId` pointing to the link record. Category is set to `'Transfer'`.

**Pipeline Integration**: Transfer detection runs automatically after every statement processing in `pipeline.ts`. It:
1. Loads all user transactions and accounts
2. Runs the `TransferDetector` to find matches
3. Persists matches via `persistTransferMatches()`
4. Detects owner contributions (personal → business) and marks them
5. Emits a `transfers_updated` SSE event

### 4. Personal vs Business Separation

Each account has an `ownershipTag` field:
- **Business** (default): Included in BAS/GST calculations
- **Personal**: Excluded from BAS/GST calculations

**Owner Contributions**: Transfers from a personal account to a business account are automatically detected and the destination transaction is marked with `isOwnerContribution = true`. These are treated as equity injections, not income.

**UI**: The `AccountManager` component includes a personal/business toggle. The `AccountSwitcher` shows ownership badges.

### 5. Money Flow Visualization

**Location**: `client/src/features/transfers/components/MoneyFlowDiagram.tsx`

An interactive SVG-based flow diagram showing:
- Account nodes sized by flow volume
- Directional edges (bezier curves) with thickness proportional to transfer amounts
- Hover to reveal transfer amounts and counts
- Time period selector (1M, 3M, 6M, 12M)

### 6. Account Balance Timeline

**Location**: `client/src/features/accounts/components/AccountBalanceTimeline.tsx`

A multi-line SVG chart showing:
- Balance over time per account (from `account_balance_history` table)
- Toggle individual account visibility
- Time period selector (1M, 3M, 6M, 1Y, All)
- Color-coded per account with interactive legend

### 7. Account Summary Cards

**Location**: `client/src/features/accounts/components/AccountSummaryCards.tsx`

Per-account cards displaying:
- Current balance
- Income / Expenses totals
- Transaction count
- Last activity date
- Ownership tag (personal/business)

## API Endpoints

### Accounts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/accounts` | List user accounts |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/:id` | Update account (name, type, ownershipTag, etc.) |
| GET | `/api/accounts/:id/balance-history` | Balance history for account |
| GET | `/api/accounts/:id/credit-analytics` | Credit card analytics |
| GET | `/api/accounts/consolidated` | Consolidated multi-account summary |

### Transfers
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transfers` | List transfer links with joined transactions |
| POST | `/api/transfers` | Manually link two transactions |
| DELETE | `/api/transfers/:id` | Remove a transfer link |
| POST | `/api/transfers/auto-detect` | Run auto-detection on all user transactions |
| POST | `/api/transfers/bulk-link` | Bulk-create multiple transfer links |
| GET | `/api/transfers/matches` | Get pending transfer matches for review |
| POST | `/api/transfers/matches/:id/confirm` | Confirm a transfer match |
| POST | `/api/transfers/matches/:id/reject` | Reject a transfer match |
| GET | `/api/transfers/flow/:period` | Money flow data for visualization |
| GET | `/api/transfers/net-position` | Net position between two accounts |

### Transactions (with account filter)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions?accountId=X` | Filter transactions by account |

## Database Schema

### New/Modified Columns

```sql
-- accounts table
ALTER TABLE accounts ADD COLUMN ownership_tag TEXT DEFAULT 'business';

-- transactions table
ALTER TABLE transactions ADD COLUMN is_owner_contribution INTEGER DEFAULT 0;
```

Migration file: `server/drizzle/0008_account_ownership.sql`

## Architecture

```
Pipeline Processing
    ↓
[PDF Parse] → [Account Detection] → [Transaction Extraction] → [Categorization]
    ↓
[DB Insert] → [Transfer Detection] → [Persist Links] → [Mark Owner Contributions]
    ↓
[RAG Indexing] → [SSE Events] → [UI Update]
```

The transfer detection is integrated as a non-blocking post-processing step. If it fails, the rest of the pipeline continues normally.
