# R04: Database Schema Gap Analysis

## 1. Current Schema State

### SQLite Schema (`server/src/schema.ts`) — 52 Tables

| # | Table Name | Section | Wave Origin |
|---|-----------|---------|-------------|
| 1 | `users` | Users & Auth | Core |
| 2 | `user_settings` | Users & Auth | Core |
| 3 | `accounts` | Accounts | Core |
| 4 | `account_balance_history` | Accounts | Core |
| 5 | `statements` | Statements | Core |
| 6 | `statement_accounts` | Statements | Core |
| 7 | `transactions` | Transactions | Core |
| 8 | `transaction_history` | Transactions | Core |
| 9 | `transfer_links` | Transfers | Core |
| 10 | `merchant_memory` | Categorization | Core |
| 11 | `pending_categorization` | Categorization | Core |
| 12 | `reconciliation_alerts` | Reconciliation | Core |
| 13 | `business_profiles` | Business Profiles | Core |
| 14 | `bas_periods` | Tax & BAS | Core |
| 15 | `bas_calculations` | Tax & BAS | Core |
| 16 | `tax_codes` | Tax & BAS | Core |
| 17 | `tax_brackets` | Tax & BAS | Core |
| 18 | `deductions` | Tax & BAS | Core |
| 19 | `cgt_assets` | Tax & BAS | Core |
| 20 | `cgt_events` | Tax & BAS | Core |
| 21 | `depreciable_assets` | Tax & BAS | Core |
| 22 | `depreciation_schedule` | Tax & BAS | Core |
| 23 | `tax_year_summary` | Tax & BAS | Core |
| 24 | `audit_log` | Audit & Security | Core |
| 25 | `sessions` | Audit & Security | Core |
| 26 | `teams` | Teams & Subscriptions | Core |
| 27 | `team_members` | Teams & Subscriptions | Core |
| 28 | `team_invitations` | Teams & Subscriptions | Core |
| 29 | `subscriptions` | Teams & Subscriptions | Core |
| 30 | `export_history` | Exports & Reports | Core |
| 31 | `parser_metrics` | Parser Metrics | Core |
| 32 | `parser_accuracy_aggregates` | Parser Metrics | Core |
| 33 | `parser_feedback` | Parser Metrics | Core |
| 34 | `chart_of_accounts` | Ledger & Accounting | Core |
| 35 | `journal_entries` | Ledger & Accounting | Core |
| 36 | `journal_entry_lines` | Ledger & Accounting | Core |
| 37 | `accounting_periods` | Ledger & Accounting | Core |
| 38 | `account_balances` | Ledger & Accounting | Core |
| 39 | `rag_namespaces` | RAG & Knowledge | Core |
| 40 | `rag_chunks` | RAG & Knowledge | Core |
| 41 | `rag_documents` | RAG & Knowledge | Core |
| 42 | `rag_citations` | RAG & Knowledge | Core |
| 43 | `tax_offsets` | Tax Offsets | Core |
| 44 | `capital_losses` | Capital Losses | Core |
| 45 | `upload_queue` | Upload Queue | Core |
| 46 | `wage_payments` | Payroll Ledger | Core |
| 47 | `owner_equity_events` | Owner Equity | Core |
| 48 | `tax_strategies` | Tax Strategies | Core |
| 49 | `loan_scenarios` | Loan Scenarios | Core |
| 50 | `budget_templates` | Budget Templates | Core |
| 51 | `economic_data_cache` | Economic Data | Core |
| 52 | `inventory_items` | Inventory | Wave 11 |
| 53 | `warehouses` | Inventory | Wave 11 |
| 54 | `inventory_stock` | Inventory | Wave 11 |
| 55 | `inventory_movements` | Inventory | Wave 11 |
| 56 | `bank_recon_rules` | Bank Reconciliation | Wave 11 |
| 57 | `bank_recon_sessions` | Bank Reconciliation | Wave 11 |
| 58 | `bank_recon_matches` | Bank Reconciliation | Wave 11 |
| 59 | `entities` | Multi-Entity | Wave 12 |
| 60 | `entity_accounts` | Multi-Entity | Wave 12 |
| 61 | `entity_settings` | Multi-Entity | Wave 12 |
| 62 | `fixed_assets` | Fixed Assets | Wave 12 |
| 63 | `asset_depreciation` | Fixed Assets | Wave 12 |
| 64 | `asset_disposals` | Fixed Assets | Wave 12 |
| 65 | `inter_entity_transactions` | Multi-Entity | Wave 12 |
| 66 | `consolidation_rules` | Consolidation | Wave 12 |
| 67 | `consolidation_snapshots` | Consolidation | Wave 12 |
| 68 | `consolidation_snapshot_lines` | Consolidation | Wave 12 |
| 69 | `ocr_documents` | OCR | Wave 14 |
| 70 | `ocr_line_items` | OCR | Wave 14 |
| 71 | `payment_match_rules` | Payment Matching | Wave 14 |
| 72 | `payment_matches` | Payment Matching | Wave 14 |
| 73 | `document_queue` | Document Queue | Wave 14 |
| 74 | `datapoint_configs` | Cognee DataPoints | Wave 16 |
| 75 | `graph_schemas` | Cognee Graph | Wave 16 |
| 76 | `cognee_feedback` | Cognee Feedback | Wave 16 |
| 77 | `report_templates` | Financial Reporting | Wave 13 |
| 78 | `report_snapshots` | Financial Reporting | Wave 13 |
| 79 | `budgets` | Budgets | Wave 13 |
| 80 | `budget_lines` | Budgets | Wave 13 |
| 81 | `budget_vs_actual` | Budgets | Wave 13 |
| 82 | `forecast_scenarios` | Forecasting | Wave 13 |
| 83 | `forecast_periods` | Forecasting | Wave 13 |
| 84 | `kpi_metrics` | KPI Metrics | Wave 13 |
| 85 | `temporal_queries` | Temporal Intelligence | Wave 17 |
| 86 | `cross_module_insights` | Cross-Module Intelligence | Wave 17 |
| 87 | `intelligence_subscriptions` | Intelligence Subscriptions | Wave 17 |
| 88 | `module_connections` | Module Connections | Wave 17 |

**Total SQLite tables: 88**

### PostgreSQL Schema (`server/src/db/postgres-schema.ts`) — 52 Tables

| # | Table Name | Notes |
|---|-----------|-------|
| 1 | `users` | ✅ Matches SQLite |
| 2 | `user_settings` | ✅ Matches SQLite |
| 3 | `accounts` | ✅ Matches (has `ownershipTag` column gap — missing in PG) |
| 4 | `account_balance_history` | ✅ Matches SQLite |
| 5 | `statements` | ✅ Matches SQLite |
| 6 | `statement_accounts` | ✅ Matches SQLite |
| 7 | `transactions` | ⚠️ Missing `gst_amount`, `gst_category`, `transaction_hash`, `parser_version`, `extraction_hash`, `is_owner_contribution` |
| 8 | `transaction_history` | ✅ Matches SQLite |
| 9 | `transfer_links` | ✅ Matches SQLite |
| 10 | `user_categories` | 🆕 PG-only (not in SQLite) |
| 11 | `merchant_memory` | ✅ Matches SQLite |
| 12 | `pending_categorization` | ✅ Matches SQLite |
| 13 | `reconciliation_alerts` | ✅ Matches SQLite |
| 14 | `debt_payoff_scenarios` | 🆕 PG-only (not in SQLite) |
| 15 | `wage_payments` | ✅ Matches SQLite |
| 16 | `owner_equity_events` | ✅ Matches SQLite |
| 17 | `tax_strategies` | ✅ Matches SQLite |
| 18 | `loan_scenarios` | ✅ Matches SQLite |
| 19 | `budget_templates` | ✅ Matches SQLite |
| 20 | `economic_data_cache` | ✅ Matches SQLite |
| 21 | `inventory_items` | ✅ Matches SQLite |
| 22 | `warehouses` | ✅ Matches SQLite |
| 23 | `inventory_stock` | ✅ Matches SQLite |
| 24 | `inventory_movements` | ✅ Matches SQLite |
| 25 | `bank_recon_rules` | ✅ Matches SQLite |
| 26 | `bank_recon_sessions` | ✅ Matches SQLite |
| 27 | `bank_recon_matches` | ✅ Matches SQLite |
| 28 | `entities` | ✅ Matches SQLite |
| 29 | `entity_accounts` | ✅ Matches SQLite |
| 30 | `entity_settings` | ✅ Matches SQLite |
| 31 | `fixed_assets` | ✅ Matches SQLite |
| 32 | `asset_depreciation` | ✅ Matches SQLite |
| 33 | `asset_disposals` | ✅ Matches SQLite |
| 34 | `inter_entity_transactions` | ✅ Matches SQLite |
| 35 | `consolidation_rules` | ✅ Matches SQLite |
| 36 | `consolidation_snapshots` | ✅ Matches SQLite |
| 37 | `consolidation_snapshot_lines` | ✅ Matches SQLite |
| 38 | `ocr_documents` | ✅ Matches SQLite |
| 39 | `ocr_line_items` | ✅ Matches SQLite |
| 40 | `payment_match_rules` | ✅ Matches SQLite |
| 41 | `payment_matches` | ✅ Matches SQLite |
| 42 | `document_queue` | ✅ Matches SQLite |
| 43 | `datapoint_configs` | ✅ Matches SQLite |
| 44 | `graph_schemas` | ✅ Matches SQLite |
| 45 | `cognee_feedback` | ✅ Matches SQLite |
| 46 | `report_templates` | ✅ Matches SQLite |
| 47 | `report_snapshots` | ✅ Matches SQLite |
| 48 | `budgets` | ✅ Matches SQLite |
| 49 | `budget_lines` | ✅ Matches SQLite |
| 50 | `budget_vs_actual` | ✅ Matches SQLite |
| 51 | `forecast_scenarios` | ✅ Matches SQLite |
| 52 | `forecast_periods` | ✅ Matches SQLite |
| 53 | `kpi_metrics` | ✅ Matches SQLite |
| 54 | `temporal_queries` | ✅ Matches SQLite |
| 55 | `cross_module_insights` | ✅ Matches SQLite |
| 56 | `intelligence_subscriptions` | ✅ Matches SQLite |
| 57 | `module_connections` | ✅ Matches SQLite |

**Total PostgreSQL tables: 57** (55 matching SQLite + 2 PG-only: `user_categories`, `debt_payoff_scenarios`)

---

## 2. Schema Gap Analysis: SQLite Tables Missing from PostgreSQL

These **31 tables** exist in SQLite but have **no** corresponding `pgTable()` definition in `postgres-schema.ts`:

| # | Table Name | Section | Columns |
|---|-----------|---------|---------|
| 1 | `business_profiles` | Business | id, userId, businessName, abn, entityType, industry, basFrequency, gstRegistered, financialYearEnd, createdAt, updatedAt |
| 2 | `bas_periods` | Tax & BAS | id, userId, financialYear, quarter, periodType, startDate, endDate, dueDate, lodgementDue, lodgementDate, accountingMethod, status, lodgedAt, createdAt, updatedAt |
| 3 | `bas_calculations` | Tax & BAS | id, basPeriodId, periodId, label, value, labelG1-G11, label1A-1B, labelW1-W2, label5A, label7C-7D, amountOwing, refundDue, calculatedAt, createdAt, updatedAt |
| 4 | `tax_codes` | Tax & BAS | id, code, description, rate, isActive |
| 5 | `tax_brackets` | Tax & BAS | id, taxYear, financialYear, minIncome, maxIncome, baseTax, rate |
| 6 | `deductions` | Tax & BAS | id, userId, taxYear, financialYear, category, subcategory, calculationMethod, description, amount, transactionId, isVerified, createdAt |
| 7 | `cgt_assets` | Tax & BAS | id, userId, assetName, assetType, quantity, unitCost, acquisitionDate, acquisitionCost, acquisitionCostsIncidental, improvementsCost, status, createdAt |
| 8 | `cgt_events` | Tax & BAS | id, userId, assetId, taxYear, eventType, eventDate, disposalDate, disposalProceeds, proceeds, costBase, capitalGainLoss, capitalGainGross, capitalGainNet, capitalLoss, discountApplied, createdAt |
| 9 | `depreciable_assets` | Tax & BAS | id, userId, assetName, assetCategory, purchaseDate, purchaseCost, effectiveLife, effectiveLifeYears, depreciationMethod, openingValue, openingWrittenDownValue, currentValue, currentWrittenDownValue, businessUsePercentage, isInstantWriteOff, isActive, createdAt |
| 10 | `depreciation_schedule` | Tax & BAS | id, assetId, financialYear, openingValue, depreciationAmount, closingValue, createdAt |
| 11 | `tax_year_summary` | Tax & BAS | id, userId, taxYear, financialYear, grossIncome, totalDeductions, taxableIncome, taxPayable, medicareLevy, taxOffsets, netTax, calculatedAt |
| 12 | `audit_log` | Audit & Security | id, userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent, requestPath, requestMethod, statusCode, durationMs, errorMessage, timestamp |
| 13 | `sessions` | Audit & Security | id, userId, refreshTokenHash, deviceFingerprint, ipAddress, userAgent, createdAt, expiresAt, revokedAt |
| 14 | `teams` | Teams & Subscriptions | id, name, ownerId, description, settings, createdAt, updatedAt |
| 15 | `team_members` | Teams & Subscriptions | id, teamId, userId, role, joinedAt |
| 16 | `team_invitations` | Teams & Subscriptions | id, teamId, email, role, token, invitedBy, status, expiresAt, acceptedAt, createdAt |
| 17 | `subscriptions` | Teams & Subscriptions | id, userId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt |
| 18 | `export_history` | Exports & Reports | id, userId, exportType, format, parameters, filters, dateRange, filePath, fileSize, fileSizeBytes, recordCount, status, errorMessage, expiresAt, createdAt, completedAt |
| 19 | `parser_metrics` | Parser Metrics | id, statementId, bankName, parserUsed, extractionTimeMs, transactionCount, confidenceScore, errorsCount, warningsCount, usedVisionFallback, bankId, totalDurationMs, parseErrorCount, transactionsParsed, detectionConfidence, highConfidenceCount, lowConfidenceCount, extractionMethod, createdAt |
| 20 | `parser_accuracy_aggregates` | Parser Metrics | id, bankName, parserVersion, periodStart, periodEnd, totalStatements, successfulStatements, avgConfidenceScore, avgExtractionTimeMs, visionFallbackRate, bankId, periodType, createdAt |
| 21 | `parser_feedback` | Parser Feedback | id, userId, statementId, transactionId, feedbackType, originalValue, correctedValue, fieldName, notes, aiConfidence, userNotes, status, bankId, reviewedAt, reviewNotes, createdAt |
| 22 | `chart_of_accounts` | Ledger | id, userId, code, name, type, parentId, isSystem, isActive, accountCode, accountName, accountType, normalBalance, taxCode, basLabel, createdAt |
| 23 | `journal_entries` | Ledger | id, userId, entryDate, reference, description, transactionId, isAuto, status, createdAt, postedAt |
| 24 | `journal_entry_lines` | Ledger | id, entryId, accountId, debit, credit, description, lineOrder, journalEntryId, debitAmount, creditAmount |
| 25 | `accounting_periods` | Ledger | id, userId, name, startDate, endDate, status, closedAt, createdAt |
| 26 | `account_balances` | Ledger | id, chartAccountId, periodId, openingBalance, debits, credits, closingBalance, createdAt |
| 27 | `rag_namespaces` | RAG & Knowledge | id, userId, name, description, chunkCount, embeddingModel, embeddingDimensions, documentCount, lastIndexedAt, status, settings, lastUpdated, createdAt |
| 28 | `rag_chunks` | RAG & Knowledge | id, namespaceId, userId, content, contentHash, chunkType, metadata, embedding, sourceId, sourceType, documentId, category, accountId, dateStart, dateEnd, contentTokens, totalAmount, transactionCount, merchantNormalized, createdAt |
| 29 | `rag_documents` | RAG & Knowledge | id, namespaceId, userId, title, sourceType, sourceId, version, chunkCount, status, contentHash, createdAt, updatedAt |
| 30 | `rag_citations` | RAG & Knowledge | id, userId, queryId, chunkId, relevanceScore, usedInResponse, documentId, rerankScore, position, excerptUsed, wasHelpful, createdAt |
| 31 | `tax_offsets` | Tax Offsets | id, userId, taxYear, offsetType, amount, description, createdAt |
| 32 | `capital_losses` | Capital Losses | id, userId, taxYear, assetDescription, acquisitionDate, disposalDate, lossAmount, appliedAmount, carriedForward, createdAt |
| 33 | `upload_queue` | Upload Queue | id, userId, batchId, filename, originalName, size, mimeType, state, priority, statementId, error, retryCount, createdAt, processedAt |

**Total missing from PG: 33 tables** (not 31 — the original 31 + `tax_offsets` and `capital_losses` which were added later)

### Column-Level Gaps on Existing PG Tables

| PG Table | Missing Columns (present in SQLite) |
|----------|-------------------------------------|
| `accounts` | `ownership_tag` |
| `transactions` | `gst_amount`, `gst_category`, `transaction_hash`, `parser_version`, `extraction_hash`, `is_owner_contribution` |

### PG-Only Tables (not in SQLite)

| Table | Purpose |
|-------|---------|
| `user_categories` | Custom per-user categories with icons/colors |
| `debt_payoff_scenarios` | Debt payoff strategy comparison |

---

## 3. Wave-by-Wave New Tables (Waves 1-10)

### Wave 1: Chat→Agent Bridge & Intent Routing
**Migration: `0013_postgres_schema_sync.sql`**
**New SQLite tables: 0** | **New PG tables: 33** (sync gap)

No new tables to create in SQLite. This wave syncs the 33 missing PostgreSQL tables to match SQLite. Also adds the 6 missing columns to `transactions` and `ownership_tag` to `accounts` in PG.

### Wave 2: Transaction Mutation & Streaming
**Migration: `0014_agent_mutations.sql`**
**New tables: 3** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `agent_mutations` | id TEXT PK, userId TEXT FK→users, agentType TEXT, mutationType TEXT ('create'\|'update'\|'delete'\|'batch'), entityType TEXT ('transaction'\|'category'\|'gst'), entityId TEXT, proposedChanges TEXT (JSON), status TEXT ('pending'\|'confirmed'\|'rejected'\|'applied'), confirmedAt TEXT, rejectedAt TEXT, appliedAt TEXT, errorMessage TEXT, chatSessionId TEXT FK→agent_sessions, createdAt TEXT | Tracks agent-proposed mutations |
| `agent_sessions` | id TEXT PK, userId TEXT FK→users, startedAt TEXT, lastMessageAt TEXT, messageCount INTEGER, summary TEXT, agentTypesUsed TEXT (JSON), status TEXT ('active'\|'closed'), createdAt TEXT | Chat session tracking |
| `agent_audit_log` | id TEXT PK, userId TEXT FK→users, agentType TEXT, action TEXT, entityType TEXT, entityId TEXT, oldValue TEXT (JSON), newValue TEXT (JSON), mutationId TEXT FK→agent_mutations, reason TEXT, timestamp TEXT | Agent action audit trail |

### Wave 3: Multi-User Cognee & Custom DataPoints
**Migration: `0015_cognee_multi_user.sql`**
**New tables: 2** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `cognee_user_accounts` | id TEXT PK, userId TEXT FK→users UNIQUE, cogneeUserId TEXT UNIQUE, apiToken TEXT, status TEXT ('active'\|'inactive'\|'pending'), lastSyncAt TEXT, createdAt TEXT | Maps GoldLedger user → Cognee user |
| `cognee_sessions` | id TEXT PK, userId TEXT FK→users, cogneeSessionId TEXT, isActive INTEGER/BOOLEAN, startedAt TEXT, lastActivityAt TEXT, expiresAt TEXT, memorySnapshot TEXT (JSON), createdAt TEXT | Active Cognee sessions per user |

### Wave 4: Employee Management & Pay Structures
**Migration: `0016_employee_management.sql`**
**New tables: 7** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `employees` | id TEXT PK, userId TEXT FK→users, firstName TEXT, lastName TEXT, email TEXT, phone TEXT, dateOfBirth TEXT, address TEXT, taxFileNumber TEXT (encrypted), startDate TEXT, endDate TEXT, status TEXT ('active'\|'terminated'\|'on_leave'), employmentType TEXT ('full_time'\|'part_time'\|'casual'\|'contractor'), createdAt TEXT, updatedAt TEXT | Core employee record |
| `employee_bank_details` | id TEXT PK, employeeId TEXT FK→employees, bsb TEXT, accountNumber TEXT (encrypted), accountName TEXT, splitPercentage REAL, isPrimary INTEGER/BOOLEAN, createdAt TEXT | Employee bank accounts |
| `employee_super_funds` | id TEXT PK, employeeId TEXT FK→employees, fundName TEXT, fundABN TEXT, memberNumber TEXT, contributionRate REAL, createdAt TEXT | Super fund details |
| `employee_tax_declarations` | id TEXT PK, employeeId TEXT FK→employees, taxFreeThreshold INTEGER/BOOLEAN, helpDebt INTEGER/BOOLEAN, sfssDebt INTEGER/BOOLEAN, claimDependents INTEGER, effectiveDate TEXT, createdAt TEXT | ATO TFN declaration fields |
| `pay_categories` | id TEXT PK, userId TEXT FK→users, name TEXT, type TEXT ('ordinary'\|'overtime'\|'allowance'\|'deduction'\|'super'\|'leave'), rateType TEXT ('hourly'\|'annual'\|'fixed'), defaultRate INTEGER, isActive INTEGER/BOOLEAN, createdAt TEXT | Pay category definitions |
| `pay_structures` | id TEXT PK, employeeId TEXT FK→employees, payCategoryId TEXT FK→pay_categories, rate INTEGER, hoursPerWeek REAL, annualSalary INTEGER, effectiveDate TEXT, createdAt TEXT | Employee pay structure |
| `employee_documents` | id TEXT PK, employeeId TEXT FK→employees, documentType TEXT, fileName TEXT, filePath TEXT, uploadedAt TEXT | Employee document storage |

### Wave 5: Pay Run Processing & Leave Management
**Migration: `0017_pay_runs_leave.sql`**
**New tables: 7** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `pay_runs` | id TEXT PK, userId TEXT FK→users, payPeriodStart TEXT, payPeriodEnd TEXT, payDate TEXT, status TEXT ('draft'\|'processing'\|'completed'\|'reversed'), frequency TEXT ('weekly'\|'fortnightly'\|'monthly'), totalGross INTEGER, totalTax INTEGER, totalSuper INTEGER, totalNet INTEGER, processedAt TEXT, createdAt TEXT, updatedAt TEXT | Pay run header |
| `pay_run_lines` | id TEXT PK, payRunId TEXT FK→pay_runs, employeeId TEXT FK→employees, payCategoryId TEXT FK→pay_categories, hours REAL, rate INTEGER, amount INTEGER, description TEXT | Individual pay items |
| `pay_run_summary` | id TEXT PK, payRunId TEXT FK→pay_runs, employeeId TEXT FK→employees, grossPay INTEGER, taxWithheld INTEGER, superGuarantee INTEGER, superSalarySacrifice INTEGER, netPay INTEGER, leaveLoading INTEGER | Per-employee pay summary |
| `leave_types` | id TEXT PK, userId TEXT FK→users, name TEXT, accrualRate REAL, accrualFrequency TEXT, maxBalance REAL, isPaid INTEGER/BOOLEAN, isActive INTEGER/BOOLEAN, createdAt TEXT | Leave type definitions |
| `leave_balances` | id TEXT PK, employeeId TEXT FK→employees, leaveTypeId TEXT FK→leave_types, balance REAL, accrued REAL, taken REAL, adjustments REAL, asAtDate TEXT | Current leave balances |
| `leave_requests` | id TEXT PK, employeeId TEXT FK→employees, leaveTypeId TEXT FK→leave_types, startDate TEXT, endDate TEXT, hours REAL, status TEXT ('pending'\|'approved'\|'rejected'), approvedBy TEXT FK→users, notes TEXT, createdAt TEXT | Leave request workflow |
| `leave_transactions` | id TEXT PK, employeeId TEXT FK→employees, leaveTypeId TEXT FK→leave_types, payRunId TEXT FK→pay_runs, type TEXT ('accrual'\|'taken'\|'adjustment'), hours REAL, date TEXT, notes TEXT | Leave ledger entries |

### Wave 6: STP Compliance & Payroll Reporting
**Migration: `0018_stp_payslips_timesheets.sql`**
**New tables: 7** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `stp_events` | id TEXT PK, userId TEXT FK→users, payRunId TEXT FK→pay_runs, eventType TEXT ('pay_event'\|'update'\|'finalisation'), status TEXT ('draft'\|'submitted'\|'accepted'\|'rejected'), submissionDate TEXT, atoResponseId TEXT, xmlPayload TEXT, createdAt TEXT | STP Phase 2 events |
| `stp_employee_ytd` | id TEXT PK, stpEventId TEXT FK→stp_events, employeeId TEXT FK→employees, grossPayments INTEGER, taxWithheld INTEGER, superGuarantee INTEGER, reportableSuper INTEGER, rfba INTEGER, lumpSumA INTEGER, lumpSumB INTEGER, lumpSumD INTEGER, lumpSumE INTEGER, etpCode TEXT, etpAmount INTEGER | YTD figures per employee |
| `payslips` | id TEXT PK, payRunId TEXT FK→pay_runs, employeeId TEXT FK→employees, payPeriodStart TEXT, payPeriodEnd TEXT, payDate TEXT, grossPay INTEGER, taxWithheld INTEGER, superAmount INTEGER, netPay INTEGER, pdfPath TEXT, sentAt TEXT, createdAt TEXT | Generated payslips |
| `awards` | id TEXT PK, userId TEXT FK→users, name TEXT, code TEXT, effectiveDate TEXT, expiryDate TEXT, isActive INTEGER/BOOLEAN, createdAt TEXT | Modern Awards |
| `award_rates` | id TEXT PK, awardId TEXT FK→awards, classification TEXT, level TEXT, hourlyRate INTEGER, casualLoading REAL, overtimeMultiplier REAL, effectiveDate TEXT | Award pay rates |
| `timesheets` | id TEXT PK, employeeId TEXT FK→employees, date TEXT, startTime TEXT, endTime TEXT, breakMinutes INTEGER, totalHours REAL, payCategoryId TEXT FK→pay_categories, status TEXT ('draft'\|'submitted'\|'approved'), approvedBy TEXT FK→users, createdAt TEXT | Timesheet headers |
| `timesheet_entries` | id TEXT PK, timesheetId TEXT FK→timesheets, projectId TEXT, taskDescription TEXT, hours REAL, billable INTEGER/BOOLEAN | Timesheet line items |

### Wave 7: Customer Management & Invoice Generation
**Migration: `0019_customers_invoices.sql`**
**New tables: 6** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `customers` | id TEXT PK, userId TEXT FK→users, businessName TEXT, contactName TEXT, email TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, postcode TEXT, country TEXT DEFAULT 'AU', abn TEXT, paymentTermsDays INTEGER DEFAULT 30, notes TEXT, isActive INTEGER/BOOLEAN DEFAULT true, createdAt TEXT | Customer master record |
| `customer_contacts` | id TEXT PK, customerId TEXT FK→customers, name TEXT, email TEXT, phone TEXT, role TEXT, isPrimary INTEGER/BOOLEAN, createdAt TEXT | Contact people |
| `invoices` | id TEXT PK, userId TEXT FK→users, customerId TEXT FK→customers, invoiceNumber TEXT UNIQUE, type TEXT ('tax_invoice'\|'credit_note'\|'receipt'), status TEXT ('draft'\|'sent'\|'viewed'\|'paid'\|'overdue'\|'void'), issueDate TEXT, dueDate TEXT, subtotal INTEGER, gstAmount INTEGER, totalAmount INTEGER, amountPaid INTEGER DEFAULT 0, amountDue INTEGER, currency TEXT DEFAULT 'AUD', notes TEXT, termsAndConditions TEXT, pdfPath TEXT, createdAt TEXT, updatedAt TEXT | Invoice headers |
| `invoice_lines` | id TEXT PK, invoiceId TEXT FK→invoices, description TEXT, quantity REAL, unitPrice INTEGER, amount INTEGER, gstRate REAL DEFAULT 0.1, gstAmount INTEGER, accountCode TEXT, taxCode TEXT | Invoice line items |
| `invoice_number_sequences` | id TEXT PK, userId TEXT FK→users UNIQUE, prefix TEXT DEFAULT 'INV-', nextNumber INTEGER DEFAULT 1, format TEXT DEFAULT '{prefix}{number:06d}' | Auto-numbering config |
| `invoice_payments` | id TEXT PK, invoiceId TEXT FK→invoices, paymentDate TEXT, amount INTEGER, paymentMethod TEXT, reference TEXT, transactionId TEXT FK→transactions, notes TEXT, createdAt TEXT | Payment receipts |

### Wave 8: Recurring Invoices & Payment Processing
**Migration: `0020_recurring_payments.sql`**
**New tables: 5** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `recurring_invoices` | id TEXT PK, userId TEXT FK→users, customerId TEXT FK→customers, frequency TEXT ('weekly'\|'fortnightly'\|'monthly'\|'quarterly'\|'annually'), nextGenerationDate TEXT, endDate TEXT, templateInvoiceId TEXT FK→invoices, isActive INTEGER/BOOLEAN DEFAULT true, lastGeneratedAt TEXT, createdAt TEXT | Recurring schedule |
| `payment_gateways` | id TEXT PK, userId TEXT FK→users, provider TEXT ('stripe'\|'paypal'\|'bank_transfer'), config TEXT (encrypted JSON), isActive INTEGER/BOOLEAN DEFAULT true, createdAt TEXT | Gateway config |
| `dunning_sequences` | id TEXT PK, userId TEXT FK→users, name TEXT, steps TEXT (JSON: [{daysAfterDue, action, template}]), isActive INTEGER/BOOLEAN DEFAULT true, createdAt TEXT | Payment reminder sequences |
| `dunning_history` | id TEXT PK, invoiceId TEXT FK→invoices, sequenceId TEXT FK→dunning_sequences, stepNumber INTEGER, sentAt TEXT, action TEXT, result TEXT, createdAt TEXT | Reminder history |
| `customer_subscriptions` | id TEXT PK, customerId TEXT FK→customers, name TEXT, amount INTEGER, frequency TEXT, startDate TEXT, endDate TEXT, status TEXT ('active'\|'paused'\|'cancelled'), recurringInvoiceId TEXT FK→recurring_invoices, createdAt TEXT | Subscription billing |

### Wave 9: AR Aging & Multi-Currency
**Migration: `0021_ar_multicurrency.sql`**
**New tables: 4** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `currencies` | id TEXT PK, code TEXT UNIQUE, name TEXT, symbol TEXT, decimalPlaces INTEGER DEFAULT 2, isActive INTEGER/BOOLEAN DEFAULT true | Supported currencies |
| `exchange_rates` | id TEXT PK, fromCurrency TEXT FK→currencies(code), toCurrency TEXT FK→currencies(code), rate REAL, effectiveDate TEXT, source TEXT ('manual'\|'api'), createdAt TEXT | Exchange rate history |
| `invoice_templates` | id TEXT PK, userId TEXT FK→users, name TEXT, logoPath TEXT, headerHtml TEXT, footerHtml TEXT, colorScheme TEXT (JSON), isDefault INTEGER/BOOLEAN DEFAULT false, createdAt TEXT | Invoice branding |
| `customer_statements` | id TEXT PK, customerId TEXT FK→customers, periodStart TEXT, periodEnd TEXT, openingBalance INTEGER, closingBalance INTEGER, pdfPath TEXT, generatedAt TEXT | Statement of account |

### Wave 10: Accounts Payable & Purchase Orders
**Migration: `0022_ap_purchase_orders.sql`**
**New tables: 10** (both schemas)

| Table | Columns | Notes |
|-------|---------|-------|
| `suppliers` | id TEXT PK, userId TEXT FK→users, businessName TEXT, contactName TEXT, email TEXT, phone TEXT, address TEXT, abn TEXT, paymentTermsDays INTEGER DEFAULT 30, bankBsb TEXT, bankAccountNumber TEXT (encrypted), bankAccountName TEXT, notes TEXT, isActive INTEGER/BOOLEAN DEFAULT true, createdAt TEXT | Supplier master |
| `bills` | id TEXT PK, userId TEXT FK→users, supplierId TEXT FK→suppliers, billNumber TEXT, status TEXT ('draft'\|'awaiting_approval'\|'approved'\|'paid'\|'overdue'\|'void'), issueDate TEXT, dueDate TEXT, subtotal INTEGER, gstAmount INTEGER, totalAmount INTEGER, amountPaid INTEGER DEFAULT 0, amountDue INTEGER, currency TEXT DEFAULT 'AUD', notes TEXT, createdAt TEXT, updatedAt TEXT | Bills/invoices from suppliers |
| `bill_lines` | id TEXT PK, billId TEXT FK→bills, description TEXT, quantity REAL, unitPrice INTEGER, amount INTEGER, gstRate REAL, gstAmount INTEGER, accountCode TEXT, taxCode TEXT | Bill line items |
| `bill_payments` | id TEXT PK, billId TEXT FK→bills, paymentDate TEXT, amount INTEGER, paymentMethod TEXT, reference TEXT, transactionId TEXT FK→transactions, notes TEXT, createdAt TEXT | Bill payment records |
| `purchase_orders` | id TEXT PK, userId TEXT FK→users, supplierId TEXT FK→suppliers, poNumber TEXT UNIQUE, status TEXT ('draft'\|'sent'\|'partially_received'\|'received'\|'cancelled'), issueDate TEXT, expectedDate TEXT, subtotal INTEGER, gstAmount INTEGER, totalAmount INTEGER, notes TEXT, createdAt TEXT, updatedAt TEXT | Purchase orders |
| `po_lines` | id TEXT PK, purchaseOrderId TEXT FK→purchase_orders, description TEXT, quantity REAL, unitPrice INTEGER, amount INTEGER, quantityReceived REAL DEFAULT 0 | PO line items |
| `po_receipts` | id TEXT PK, purchaseOrderId TEXT FK→purchase_orders, receiptDate TEXT, receivedBy TEXT FK→users, notes TEXT, createdAt TEXT | Goods receipt header |
| `po_receipt_lines` | id TEXT PK, receiptId TEXT FK→po_receipts, poLineId TEXT FK→po_lines, quantityReceived REAL | Goods receipt lines |
| `supplier_payment_runs` | id TEXT PK, userId TEXT FK→users, paymentDate TEXT, status TEXT ('draft'\|'processing'\|'completed'), totalAmount INTEGER, bankReference TEXT, createdAt TEXT | Batch payment runs |
| `supplier_payment_run_items` | id TEXT PK, paymentRunId TEXT FK→supplier_payment_runs, billId TEXT FK→bills, amount INTEGER | Payment run line items |

---

## 4. Migration Plan

| Migration # | Wave | File Name | Tables Created |
|------------|------|-----------|----------------|
| 0013 | 1 | `0013_postgres_schema_sync.sql` | **0 new** — syncs 33 existing SQLite tables to PG + adds missing columns |
| 0014 | 2 | `0014_agent_mutations.sql` | **3 new**: agent_mutations, agent_sessions, agent_audit_log |
| 0015 | 3 | `0015_cognee_multi_user.sql` | **2 new**: cognee_user_accounts, cognee_sessions |
| 0016 | 4 | `0016_employee_management.sql` | **7 new**: employees, employee_bank_details, employee_super_funds, employee_tax_declarations, pay_categories, pay_structures, employee_documents |
| 0017 | 5 | `0017_pay_runs_leave.sql` | **7 new**: pay_runs, pay_run_lines, pay_run_summary, leave_types, leave_balances, leave_requests, leave_transactions |
| 0018 | 6 | `0018_stp_payslips_timesheets.sql` | **7 new**: stp_events, stp_employee_ytd, payslips, awards, award_rates, timesheets, timesheet_entries |
| 0019 | 7 | `0019_customers_invoices.sql` | **6 new**: customers, customer_contacts, invoices, invoice_lines, invoice_number_sequences, invoice_payments |
| 0020 | 8 | `0020_recurring_payments.sql` | **5 new**: recurring_invoices, payment_gateways, dunning_sequences, dunning_history, customer_subscriptions |
| 0021 | 9 | `0021_ar_multicurrency.sql` | **4 new**: currencies, exchange_rates, invoice_templates, customer_statements |
| 0022 | 10 | `0022_ap_purchase_orders.sql` | **10 new**: suppliers, bills, bill_lines, bill_payments, purchase_orders, po_lines, po_receipts, po_receipt_lines, supplier_payment_runs, supplier_payment_run_items |

### Migration Numbering Verification

| Range | Usage | Conflicts? |
|-------|-------|-----------|
| 0001-0010 | Existing core migrations | ✅ No conflict |
| 0011 | `0011_final_schema_sync.sql` | ✅ Exists |
| 0012 | `0012_tax_return_platform.sql` | ✅ Exists |
| **0013-0022** | **Waves 1-10 (NEW)** | ✅ **Gap available — no conflicts** |
| 0023 | Wave 11: `0023_inventory_bank_recon.sql` | ✅ Exists |
| 0024 | Wave 12: `0024_fixed_assets_multi_entity.sql` | ✅ Exists |
| 0025 | Wave 13: `0025_financial_reporting.sql` | ✅ Exists |
| 0026 | Wave 14: `0026_ai_ocr_payment_matching.sql` | ✅ Exists |
| 0027 | (Gap — reserved, not yet used) | ✅ Available |
| 0028 | Wave 16: `0028_cognee_datapoints.sql` | ✅ Exists |
| 0029 | Wave 17: `0029_temporal_intelligence.sql` | ✅ Exists |

**No numbering conflicts.** Migrations 0013-0022 are cleanly available for Waves 1-10.

---

## 5. Foreign Key Map

### Wave 2 (agent_mutations, agent_sessions, agent_audit_log)
```
agent_mutations.userId → users.id
agent_mutations.chatSessionId → agent_sessions.id
agent_sessions.userId → users.id
agent_audit_log.userId → users.id
agent_audit_log.mutationId → agent_mutations.id
```

### Wave 3 (cognee_user_accounts, cognee_sessions)
```
cognee_user_accounts.userId → users.id (UNIQUE)
cognee_sessions.userId → users.id
```

### Wave 4 (employees + related)
```
employees.userId → users.id
employee_bank_details.employeeId → employees.id (CASCADE)
employee_super_funds.employeeId → employees.id (CASCADE)
employee_tax_declarations.employeeId → employees.id (CASCADE)
pay_categories.userId → users.id
pay_structures.employeeId → employees.id (CASCADE)
pay_structures.payCategoryId → pay_categories.id
employee_documents.employeeId → employees.id (CASCADE)
```

### Wave 5 (pay_runs + leave)
```
pay_runs.userId → users.id
pay_run_lines.payRunId → pay_runs.id (CASCADE)
pay_run_lines.employeeId → employees.id
pay_run_lines.payCategoryId → pay_categories.id
pay_run_summary.payRunId → pay_runs.id (CASCADE)
pay_run_summary.employeeId → employees.id
leave_types.userId → users.id
leave_balances.employeeId → employees.id (CASCADE)
leave_balances.leaveTypeId → leave_types.id
leave_requests.employeeId → employees.id
leave_requests.leaveTypeId → leave_types.id
leave_requests.approvedBy → users.id
leave_transactions.employeeId → employees.id
leave_transactions.leaveTypeId → leave_types.id
leave_transactions.payRunId → pay_runs.id
```

### Wave 6 (stp + timesheets)
```
stp_events.userId → users.id
stp_events.payRunId → pay_runs.id
stp_employee_ytd.stpEventId → stp_events.id (CASCADE)
stp_employee_ytd.employeeId → employees.id
payslips.payRunId → pay_runs.id
payslips.employeeId → employees.id
awards.userId → users.id
award_rates.awardId → awards.id (CASCADE)
timesheets.employeeId → employees.id
timesheets.payCategoryId → pay_categories.id
timesheets.approvedBy → users.id
timesheet_entries.timesheetId → timesheets.id (CASCADE)
```

### Wave 7 (customers + invoices)
```
customers.userId → users.id
customer_contacts.customerId → customers.id (CASCADE)
invoices.userId → users.id
invoices.customerId → customers.id
invoice_lines.invoiceId → invoices.id (CASCADE)
invoice_number_sequences.userId → users.id (UNIQUE)
invoice_payments.invoiceId → invoices.id
invoice_payments.transactionId → transactions.id
```

### Wave 8 (recurring + payments)
```
recurring_invoices.userId → users.id
recurring_invoices.customerId → customers.id
recurring_invoices.templateInvoiceId → invoices.id
payment_gateways.userId → users.id
dunning_sequences.userId → users.id
dunning_history.invoiceId → invoices.id
dunning_history.sequenceId → dunning_sequences.id
customer_subscriptions.customerId → customers.id
customer_subscriptions.recurringInvoiceId → recurring_invoices.id
```

### Wave 9 (currencies + templates)
```
exchange_rates.fromCurrency → currencies.code
exchange_rates.toCurrency → currencies.code
invoice_templates.userId → users.id
customer_statements.customerId → customers.id
```

### Wave 10 (suppliers + bills + POs)
```
suppliers.userId → users.id
bills.userId → users.id
bills.supplierId → suppliers.id
bill_lines.billId → bills.id (CASCADE)
bill_payments.billId → bills.id
bill_payments.transactionId → transactions.id
purchase_orders.userId → users.id
purchase_orders.supplierId → suppliers.id
po_lines.purchaseOrderId → purchase_orders.id (CASCADE)
po_receipts.purchaseOrderId → purchase_orders.id
po_receipts.receivedBy → users.id
po_receipt_lines.receiptId → po_receipts.id (CASCADE)
po_receipt_lines.poLineId → po_lines.id
supplier_payment_runs.userId → users.id
supplier_payment_run_items.paymentRunId → supplier_payment_runs.id (CASCADE)
supplier_payment_run_items.billId → bills.id
```

---

## 6. Index Recommendations

### Wave 1 (PG sync — 33 tables need indexes matching SQLite patterns)
Already documented in existing PG schema for Wave 11+ tables. Wave 1 migration should add:
- `business_profiles`: `(userId)` unique
- `bas_periods`: `(userId, financialYear, quarter)` unique
- `bas_calculations`: `(basPeriodId)`, `(periodId)`
- `deductions`: `(userId, taxYear)`
- `cgt_assets`: `(userId, status)`
- `cgt_events`: `(userId, taxYear)`, `(assetId)`
- `tax_year_summary`: `(userId, taxYear)` unique
- `audit_log`: `(userId)`, `(timestamp)`, `(entityType, entityId)`
- `sessions`: `(userId)`, `(expiresAt)`
- `chart_of_accounts`: `(userId, code)` unique
- `journal_entries`: `(userId, entryDate)`, `(transactionId)`
- `journal_entry_lines`: `(entryId)`, `(accountId)`
- `rag_chunks`: `(namespaceId)`, `(contentHash)` unique per namespace
- `upload_queue`: `(userId, state)`, `(batchId)`

### Waves 2-10 (new tables)
| Table | Recommended Indexes |
|-------|-------------------|
| `agent_mutations` | `(userId, status)`, `(chatSessionId)`, `(entityType, entityId)` |
| `agent_sessions` | `(userId, status)`, `(lastMessageAt DESC)` |
| `agent_audit_log` | `(userId)`, `(timestamp)`, `(agentType)` |
| `employees` | `(userId, status)`, `(email)` unique per user |
| `pay_runs` | `(userId, status)`, `(payPeriodStart, payPeriodEnd)` |
| `pay_run_lines` | `(payRunId)`, `(employeeId)` |
| `pay_run_summary` | `(payRunId, employeeId)` unique |
| `leave_balances` | `(employeeId, leaveTypeId)` unique |
| `leave_requests` | `(employeeId, status)`, `(startDate, endDate)` |
| `stp_events` | `(userId, status)`, `(payRunId)` |
| `stp_employee_ytd` | `(stpEventId)`, `(employeeId)` |
| `payslips` | `(payRunId)`, `(employeeId)` |
| `timesheets` | `(employeeId, date)`, `(status)` |
| `customers` | `(userId, isActive)`, `(abn)`, `(email)` |
| `invoices` | `(userId, status)`, `(customerId)`, `(invoiceNumber)` unique, `(dueDate)` |
| `invoice_lines` | `(invoiceId)` |
| `invoice_payments` | `(invoiceId)`, `(transactionId)` |
| `recurring_invoices` | `(userId, isActive)`, `(nextGenerationDate)` |
| `dunning_history` | `(invoiceId)`, `(sequenceId)` |
| `suppliers` | `(userId, isActive)`, `(abn)` |
| `bills` | `(userId, status)`, `(supplierId)`, `(dueDate)` |
| `bill_lines` | `(billId)` |
| `bill_payments` | `(billId)`, `(transactionId)` |
| `purchase_orders` | `(userId, status)`, `(supplierId)`, `(poNumber)` unique |
| `po_lines` | `(purchaseOrderId)` |
| `po_receipts` | `(purchaseOrderId)` |
| `po_receipt_lines` | `(receiptId)`, `(poLineId)` |
| `supplier_payment_runs` | `(userId, status)`, `(paymentDate)` |
| `supplier_payment_run_items` | `(paymentRunId)`, `(billId)` |
| `currencies` | `(code)` unique |
| `exchange_rates` | `(fromCurrency, toCurrency, effectiveDate)` unique |

---

## 7. Wave 11-24 Overlap Check

### Tables Already Created by Waves 11-17 (in schema files now)

| Wave | Tables | Already in Both Schemas? |
|------|--------|------------------------|
| 11 | inventory_items, warehouses, inventory_stock, inventory_movements, bank_recon_rules, bank_recon_sessions, bank_recon_matches | ✅ Yes |
| 12 | entities, entity_accounts, entity_settings, fixed_assets, asset_depreciation, asset_disposals, inter_entity_transactions, consolidation_rules, consolidation_snapshots, consolidation_snapshot_lines | ✅ Yes |
| 13 | report_templates, report_snapshots, budgets, budget_lines, budget_vs_actual, forecast_scenarios, forecast_periods, kpi_metrics | ✅ Yes |
| 14 | ocr_documents, ocr_line_items, payment_match_rules, payment_matches, document_queue | ✅ Yes |
| 16 | datapoint_configs, graph_schemas, cognee_feedback | ✅ Yes |
| 17 | temporal_queries, cross_module_insights, intelligence_subscriptions, module_connections | ✅ Yes |

### Potential Overlaps Between Wave 1-10 and Wave 11-24

| Wave 1-10 Table | Potential Overlap | Resolution |
|----------------|-------------------|------------|
| `employees` (Wave 4) | No overlap | New domain |
| `customers` (Wave 7) | No overlap | New domain |
| `suppliers` (Wave 10) | No overlap | New domain |
| `invoices` (Wave 7) | No overlap with `ocr_documents` (Wave 14) | Different purpose: invoices=outgoing, ocr_documents=scanned incoming |
| `bills` (Wave 10) | Relates to `ocr_documents` (Wave 14) | OCR can create bills; FK from `ocr_documents.matched_bill_id` could be added later |
| `purchase_orders` (Wave 10) | Relates to `inventory_movements` (Wave 11) | PO receipts trigger inventory movements; cross-wave FK needed |

### Cross-Wave Foreign Keys Needed Later
- Wave 10 `po_receipts` → Wave 11 `inventory_movements` (receiving PO creates inventory movement)
- Wave 7 `invoice_payments` → already references `transactions` (core table)
- Wave 10 `bill_payments` → already references `transactions` (core table)

---

## 8. Column Type Pattern Compliance

All new Wave 1-10 tables follow existing patterns:

| Pattern | Convention | Compliance |
|---------|-----------|------------|
| Primary keys | `id TEXT PRIMARY KEY` (UUID strings) | ✅ All tables |
| Foreign keys | `TEXT` with `.references()` and ON DELETE | ✅ All tables |
| Monetary amounts | `INTEGER` (cents) | ✅ All pay/invoice/bill amounts |
| Percentages | `REAL` (decimal, e.g., 0.1 for 10%) | ✅ casualLoading, gstRate, splitPercentage |
| Booleans (SQLite) | `INTEGER` with `{ mode: 'boolean' }` | ✅ All boolean fields |
| Booleans (PostgreSQL) | `BOOLEAN` | ✅ All boolean fields |
| Timestamps (SQLite) | `TEXT` with `.default('CURRENT_TIMESTAMP')` | ✅ All tables |
| Timestamps (PostgreSQL) | `TIMESTAMP WITH TIME ZONE` with `.defaultNow()` | ✅ Convention |
| JSON fields | `TEXT` (stored as JSON string) | ✅ xmlPayload, steps, config, etc. |
| Encrypted fields | `TEXT` (app-level encryption) | ✅ TFN, bank accounts, gateway config |

---

## 9. Total New Tables Summary

| Wave | New Tables | Cumulative |
|------|-----------|------------|
| 1 | 0 (PG sync only) | 0 |
| 2 | 3 | 3 |
| 3 | 2 | 5 |
| 4 | 7 | 12 |
| 5 | 7 | 19 |
| 6 | 7 | 26 |
| 7 | 6 | 32 |
| 8 | 5 | 37 |
| 9 | 4 | 41 |
| 10 | 10 | 51 |
| **Total** | **51 new tables** | **+ 33 PG synced = 84 table operations** |

After all 10 waves, the schema will have:
- **SQLite**: 88 (current) + 51 = **139 tables**
- **PostgreSQL**: 57 (current) + 33 (synced) + 51 (new) = **141 tables** (includes 2 PG-only tables)

---

## 10. Critical Notes for W01 (Migration File Author)

1. **Migration 0013 is the largest** — it must CREATE 33 tables AND ALTER 2 tables (add missing columns). All DDL should use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency.

2. **Wave 4-6 form a dependency chain** — `employees` must exist before `pay_runs`, `pay_runs` before `stp_events`. Migration ordering is correct (0016 → 0017 → 0018).

3. **Wave 7-8 form a dependency chain** — `customers` + `invoices` must exist before `recurring_invoices`. Migration ordering is correct (0019 → 0020).

4. **Wave 10 depends on Wave 7** — `suppliers` parallels `customers`, and `bill_payments` references `transactions` (core). No actual dependency on Wave 7 tables.

5. **Encrypted columns** — `taxFileNumber`, `bankAccountNumber`, `config` fields should be stored as encrypted TEXT. Application-level encryption (not DB-level).

6. **Each migration should be wrapped in `BEGIN; ... COMMIT;`** for transactional safety (matching existing migration pattern from 0024+).

7. **No migration 0027 exists** — it's a gap between 0026 and 0028. This is fine; don't try to fill it.

8. **Dual schema files must stay in sync** — every `sqliteTable()` in `schema.ts` needs a matching `pgTable()` in `postgres-schema.ts` with:
   - `integer` booleans → `boolean` type
   - `text` timestamps → `timestamp({ withTimezone: true })`
   - Index definitions in PG (SQLite doesn't need explicit indexes via Drizzle)
