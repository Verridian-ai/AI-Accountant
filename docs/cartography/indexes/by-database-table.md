# Index: Database Tables

## Core Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| username | text | UNIQUE, NOT NULL |
| passwordHash | text | NOT NULL |

### userSettings
| Column | Type | Default |
|--------|------|---------|
| userId | text | PK, FK→users |
| modelParsingText | text | google/gemini-3-flash-preview |
| modelParsingVision | text | google/gemini-3-flash-preview |
| modelCategorization | text | google/gemini-3-flash-preview |
| modelChat | text | google/gemini-3-flash-preview |
| modelEmbedding | text | openai/text-embedding-3-large |

### statements
Key columns: id, filename, hash, uploadDate, parsingStatus, userId, periodStartDate, periodEndDate
Indexes: userIdIdx, uploadDateIdx, userDateIdx, periodIdx

### transactions
Key columns: id, date, description, amount, balance, category, gstApplicable, statementId, accountId, userId
Indexes: dateIdx, userIdIdx, statementIdIdx, categoryIdx, userDateIdx, accountIdIdx

### accounts
Key columns: id, userId, accountNumber, accountName, accountType, bankName, currentBalance
Indexes: userIdIdx, accountHashIdx

---

## Tax Tables

### basPeriods
Columns: id, userId, quarter, startDate, endDate, status

### basCalculations
Columns: id, periodId, g1_totalSales, g2_exportSales, g10_capitalPurchases, g11_otherPurchases, label1a_gstOnSales, label1b_gstOnPurchases, netGst

### deductions
Columns: id, userId, financialYear, category, description, amount, receiptPath

### cgtAssets
Columns: id, userId, assetType, description, acquisitionDate, acquisitionCost, currentValue

### cgtEvents
Columns: id, assetId, eventDate, proceeds, costBase, capitalGain, discountedGain

### depreciationSchedules
Columns: id, userId, assetDescription, purchaseDate, purchaseCost, effectiveLife, method

---

## Linking Tables

### statementAccounts
Links statements to accounts (many-to-many)

### transferLinks
Links two transactions as a transfer pair

### transactionHistory
Audit trail for transaction edits

### merchantMemory
Learned merchant categorization patterns

### pendingCategorizations
AI categorization suggestions awaiting review

**Total: 17 tables**
