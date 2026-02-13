# R08: Database Schema Gap Analysis & Strategy

**Agent**: R08 — Database Schema Gap Researcher
**Date**: 2026-02-12
**Status**: Complete

---

## 1. SQLite Schema Inventory (`server/src/schema.ts`)

All tables use `sqliteTable()` from `drizzle-orm/sqlite-core`. Amounts stored as integers (cents). IDs are text (UUIDs). Booleans are `integer({ mode: 'boolean' })`. Timestamps are `text` with `CURRENT_TIMESTAMP` defaults.

### Table Inventory — 45 tables by domain

#### Auth & Users (3)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `users` | id, username, passwordHash, createdAt, updatedAt | id | — | Unique on username |
| `user_settings` | userId, modelParsingText, modelParsingVision, modelCategorization, modelChat, modelEmbedding | userId | users.id | 5 AI model preferences |
| `sessions` | id, userId, refreshTokenHash, deviceFingerprint, ipAddress, userAgent, createdAt, expiresAt, revokedAt | id | users.id | JWT session store |

#### Accounts (2)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `accounts` | id, userId, accountNumber, accountNumberHash, accountName, accountType, bankName, currentBalance, lastStatementDate, interestRate, creditLimit, minimumPayment, paymentDueDay, linkedPaymentAccountId, isActive, ownershipTag, createdAt, updatedAt | id | users.id | Credit card fields included |
| `account_balance_history` | id, accountId, balance, balanceDate, source, statementId, notes, createdAt | id | accounts.id, statements.id | Balance snapshots |

#### Statements (2)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `statements` | id, filename, hash, uploadDate, parsingStatus, aiModelUsed, errorMessage, errorType, errorDetails, userId, periodStartDate, periodEndDate, openingBalance, closingBalance, transactionCount, isComplete, validationErrors | id | users.id | Unique on hash |
| `statement_accounts` | statementId, accountId | statementId | statements.id, accounts.id | M:1 link |

#### Transactions (2)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `transactions` | id, date, description, amount, balance, category, gstApplicable, gstAmount, gstCategory, aiReasoningNotes, confidenceScore, isEdited, isTransfer, transferLinkId, isOwnerContribution, transactionHash, merchantNormalized, parserVersion, extractionHash, parentTransactionId, statementId, accountId, userId, claimType, claimAmount, claimMethod, substantiationStatus | id | statements.id, accounts.id, users.id | 28 columns incl GST + tax claim |
| `transaction_history` | id, transactionId, changeType, oldData, newData, timestamp | id | transactions.id | Audit trail |

#### Transfers (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `transfer_links` | id, userId, sourceTransactionId, destinationTransactionId, sourceAccountId, destinationAccountId, amount, transferDate, confidence, isUserConfirmed, createdAt | id | users.id, transactions.id ×2, accounts.id ×2 | Bidirectional links |

#### Categorization (2)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `merchant_memory` | id, userId, merchantPattern, merchantDisplayName, category, gstApplicable, timesUsed, lastUsed, isUserConfirmed, createdAt | id | users.id | Pattern-based learning |
| `pending_categorization` | id, userId, transactionId, suggestedCategory, suggestedConfidence, aiReasoning, alternativeCategories, status, userSelectedCategory, createdAt, resolvedAt | id | users.id, transactions.id | Review queue |

#### Reconciliation (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `reconciliation_alerts` | id, userId, accountId, alertType, expectedValue, actualValue, difference, description, statementId, isResolved, resolvedAt, resolutionNotes, createdAt | id | users.id, accounts.id, statements.id | Balance mismatch detection |

#### Business (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `business_profiles` | id, userId, businessName, abn, entityType, industry, basFrequency, gstRegistered, financialYearEnd, createdAt, updatedAt | id | users.id | Sole trader / company / trust |

#### Tax & BAS (8)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `bas_periods` | id, userId, financialYear, quarter, periodType, startDate, endDate, dueDate, lodgementDue, lodgementDate, accountingMethod, status, lodgedAt, createdAt, updatedAt | id | users.id | BAS period management |
| `bas_calculations` | id, basPeriodId, periodId, label, value, labelG1..G11, label1A..1B, labelW1..W2, label5A, label7C..7D, amountOwing, refundDue, calculatedAt, createdAt, updatedAt | id | basPeriods.id ×2 | ATO BAS label mapping |
| `tax_codes` | id, code, description, rate, isActive | id | — | Master tax code list |
| `tax_brackets` | id, taxYear, financialYear, minIncome, maxIncome, baseTax, rate | id | — | ATO income tax brackets |
| `deductions` | id, userId, taxYear, financialYear, category, subcategory, calculationMethod, description, amount, transactionId, isVerified, createdAt | id | users.id, transactions.id | Tax deduction claims |
| `tax_year_summary` | id, userId, taxYear, financialYear, grossIncome, totalDeductions, taxableIncome, taxPayable, medicareLevy, taxOffsets, netTax, calculatedAt | id | users.id | Annual tax summary |
| `tax_offsets` | id, userId, taxYear, offsetType, amount, description, createdAt | id | — | LITO/SAPTO/etc |
| `capital_losses` | id, userId, taxYear, assetDescription, acquisitionDate, disposalDate, lossAmount, appliedAmount, carriedForward, createdAt | id | — | CGT loss carry-forward |

#### CGT & Depreciation (4)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `cgt_assets` | id, userId, assetName, assetType, quantity, unitCost, acquisitionDate, acquisitionCost, acquisitionCostsIncidental, improvementsCost, status, createdAt | id | users.id | Capital asset register |
| `cgt_events` | id, userId, assetId, taxYear, eventType, eventDate, disposalDate, disposalProceeds, proceeds, costBase, capitalGainLoss, capitalGainGross, capitalGainNet, capitalLoss, discountApplied, createdAt | id | users.id, cgtAssets.id | Disposal/CGT events |
| `depreciable_assets` | id, userId, assetName, assetCategory, purchaseDate, purchaseCost, effectiveLife, effectiveLifeYears, depreciationMethod, openingValue, openingWrittenDownValue, currentValue, currentWrittenDownValue, businessUsePercentage, isInstantWriteOff, isActive, createdAt | id | users.id | Diminishing/prime cost |
| `depreciation_schedule` | id, assetId, financialYear, openingValue, depreciationAmount, closingValue, createdAt | id | depreciableAssets.id | Year-by-year schedule |

#### Audit & Security (2)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `audit_log` | id, userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent, requestPath, requestMethod, statusCode, durationMs, errorMessage, timestamp | id | users.id | OWASP audit trail |
| `sessions` | (see Auth above) | — | — | — |

#### Teams & Subscriptions (4)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `teams` | id, name, ownerId, description, settings, createdAt, updatedAt | id | users.id | Multi-user teams |
| `team_members` | id, teamId, userId, role, joinedAt | id | teams.id, users.id | Role: viewer/editor/admin |
| `team_invitations` | id, teamId, email, role, token, invitedBy, status, expiresAt, acceptedAt, createdAt | id | teams.id, users.id | Token-based invite |
| `subscriptions` | id, userId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt | id | users.id | Stripe billing |

#### Exports (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `export_history` | id, userId, exportType, format, parameters, filters, dateRange, filePath, fileSize, fileSizeBytes, recordCount, status, errorMessage, expiresAt, createdAt, completedAt | id | users.id | CSV/PDF export log |

#### Parser Metrics (3)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `parser_metrics` | id, statementId, bankName, parserUsed, extractionTimeMs, transactionCount, confidenceScore, errorsCount, warningsCount, usedVisionFallback, bankId, totalDurationMs, parseErrorCount, transactionsParsed, detectionConfidence, highConfidenceCount, lowConfidenceCount, extractionMethod, createdAt | id | statements.id | Per-statement metrics |
| `parser_accuracy_aggregates` | id, bankName, parserVersion, periodStart, periodEnd, totalStatements, successfulStatements, avgConfidenceScore, avgExtractionTimeMs, visionFallbackRate, bankId, periodType, createdAt | id | — | Aggregate accuracy |
| `parser_feedback` | id, userId, statementId, transactionId, feedbackType, originalValue, correctedValue, fieldName, notes, aiConfidence, userNotes, status, bankId, reviewedAt, reviewNotes, createdAt | id | users.id, statements.id, transactions.id | Human correction loop |

#### Ledger & Accounting (4)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `chart_of_accounts` | id, userId, code, name, type, parentId, isSystem, isActive, accountCode, accountName, accountType, normalBalance, taxCode, basLabel, createdAt | id | users.id | Double-entry CoA |
| `journal_entries` | id, userId, entryDate, reference, description, transactionId, isAuto, status, createdAt, postedAt | id | users.id, transactions.id | Journal header |
| `journal_entry_lines` | id, entryId, accountId, debit, credit, description, lineOrder, journalEntryId, debitAmount, creditAmount | id | journalEntries.id, chartOfAccounts.id | Debit/credit lines |
| `accounting_periods` | id, userId, name, startDate, endDate, status, closedAt, createdAt | id | users.id | Month/quarter close |
| `account_balances` | id, chartAccountId, periodId, openingBalance, debits, credits, closingBalance, createdAt | id | chartOfAccounts.id, accountingPeriods.id | Period trial balance |

#### RAG & Knowledge (4)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `rag_namespaces` | id, userId, name, description, chunkCount, embeddingModel, embeddingDimensions, documentCount, lastIndexedAt, status, settings, lastUpdated, createdAt | id | users.id | Vector namespace |
| `rag_chunks` | id, namespaceId, userId, content, contentHash, chunkType, metadata, embedding, sourceId, sourceType, documentId, category, accountId, dateStart, dateEnd, contentTokens, totalAmount, transactionCount, merchantNormalized, createdAt | id | ragNamespaces.id, users.id | Text chunks |
| `rag_documents` | id, namespaceId, userId, title, sourceType, sourceId, version, chunkCount, status, contentHash, createdAt, updatedAt | id | ragNamespaces.id, users.id | Document records |
| `rag_citations` | id, userId, queryId, chunkId, relevanceScore, usedInResponse, documentId, rerankScore, position, excerptUsed, wasHelpful, createdAt | id | users.id, ragChunks.id | Citation tracking |

#### Upload Queue (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `upload_queue` | id, userId, batchId, filename, originalName, size, mimeType, state, priority, statementId, error, retryCount, createdAt, processedAt | id | users.id, statements.id | Batch upload pipeline |

#### Payroll (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `wage_payments` | id, userId, accountId, transactionId, employeeName, employeeCount, grossWages, taxWithheld, netPay, superannuation, payPeriodStart, payPeriodEnd, payFrequency, ledgerFileUrl, source, status, financialYear, quarter, notes, createdAt, updatedAt | id | users.id, accounts.id, transactions.id | STP-ready payroll |

#### Owner Equity (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `owner_equity_events` | id, userId, accountId, transactionId, eventType, amount, detectedBy, confirmed, financialYear, notes, createdAt, updatedAt | id | users.id, accounts.id, transactions.id | Contribution/drawing |

#### Tax Strategies (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `tax_strategies` | id, userId, financialYear, strategyName, description, estimatedSaving, confidence, atoRulingRef, applicableEntities, status, createdAt | id | users.id | AI-suggested |

#### Loan Scenarios (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `loan_scenarios` | id, userId, loanType, principal, rate, termMonths, frequency, offsetBalance, extraRepayment, resultsJson, createdAt | id | users.id | Amortisation calc |

#### Budget Templates (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `budget_templates` | id, userId, name, entityType, categoriesJson, isActive, createdAt | id | users.id | Reusable templates |

#### Economic Data (1)
| Table | Columns | PKs | FKs | Notes |
|-------|---------|-----|-----|-------|
| `economic_data_cache` | id, dataSource, dataKey, dataValue, fetchedAt, expiresAt | id | — | RBA/ABS/ATO cache |

**Total SQLite tables: 45**

---

## 2. PostgreSQL Schema Inventory (`server/src/db/postgres-schema.ts`)

PostgreSQL schema uses `pgTable()` from `drizzle-orm/pg-core`. Booleans are native `boolean`. Timestamps are `timestamp({ withTimezone: true })`. Includes indexes.

### Tables Present in PostgreSQL Drizzle Schema

| # | Table | Domain |
|---|-------|--------|
| 1 | `users` | Auth |
| 2 | `user_settings` | Auth |
| 3 | `accounts` | Accounts |
| 4 | `account_balance_history` | Accounts |
| 5 | `statements` | Statements |
| 6 | `statement_accounts` | Statements |
| 7 | `transactions` | Transactions |
| 8 | `transaction_history` | Transactions |
| 9 | `transfer_links` | Transfers |
| 10 | `user_categories` | Categorization (PG-only in Drizzle) |
| 11 | `merchant_memory` | Categorization |
| 12 | `pending_categorization` | Categorization |
| 13 | `reconciliation_alerts` | Reconciliation |
| 14 | `debt_payoff_scenarios` | Debt (PG-only in Drizzle) |
| 15 | `wage_payments` | Payroll |
| 16 | `owner_equity_events` | Owner Equity |
| 17 | `tax_strategies` | Tax |
| 18 | `loan_scenarios` | Loans |
| 19 | `budget_templates` | Budgets |
| 20 | `economic_data_cache` | Economic Data |

**Total PG Drizzle tables: 20**

Plus tables created via SQL migrations (0010–0012) but NOT in `postgres-schema.ts`:
- `tax_offsets` (migration 0010)
- `capital_losses` (migration 0010)

**Total PG tables (Drizzle + migrations): 22**

---

## 3. Gap Analysis

### 3A. Tables in SQLite but MISSING from PostgreSQL Drizzle Schema (25 tables)

| # | Table | Domain | Blocking? | Priority |
|---|-------|--------|-----------|----------|
| 1 | `sessions` | Auth | **YES** — JWT auth broken without it | P0 |
| 2 | `business_profiles` | Business | **YES** — BAS/GST features need it | P0 |
| 3 | `bas_periods` | Tax/BAS | **YES** — BAS dashboard broken | P0 |
| 4 | `bas_calculations` | Tax/BAS | **YES** — BAS calculations broken | P0 |
| 5 | `tax_codes` | Tax | **YES** — GST categorization | P0 |
| 6 | `tax_brackets` | Tax | YES — tax return calculations | P1 |
| 7 | `deductions` | Tax | YES — deduction tracking | P1 |
| 8 | `tax_year_summary` | Tax | YES — tax dashboard | P1 |
| 9 | `tax_offsets` | Tax | No — migration-only, not used yet | P2 |
| 10 | `capital_losses` | Tax | No — migration-only, not used yet | P2 |
| 11 | `cgt_assets` | CGT | No — future feature | P2 |
| 12 | `cgt_events` | CGT | No — future feature | P2 |
| 13 | `depreciable_assets` | Depreciation | No — future feature | P2 |
| 14 | `depreciation_schedule` | Depreciation | No — future feature | P2 |
| 15 | `audit_log` | Security | **YES** — security middleware writes here | P0 |
| 16 | `teams` | Teams | No — multi-user not active | P3 |
| 17 | `team_members` | Teams | No | P3 |
| 18 | `team_invitations` | Teams | No | P3 |
| 19 | `subscriptions` | Billing | No — Stripe not wired | P3 |
| 20 | `export_history` | Exports | No — export works client-side | P2 |
| 21 | `parser_metrics` | Metrics | No — nice to have | P2 |
| 22 | `parser_accuracy_aggregates` | Metrics | No | P3 |
| 23 | `parser_feedback` | Metrics | No | P2 |
| 24 | `chart_of_accounts` | Ledger | YES — ledger service needs it | P1 |
| 25 | `journal_entries` | Ledger | YES — journal posting | P1 |
| 26 | `journal_entry_lines` | Ledger | YES — double-entry lines | P1 |
| 27 | `accounting_periods` | Ledger | YES | P1 |
| 28 | `account_balances` | Ledger | YES | P1 |
| 29 | `rag_namespaces` | RAG | Cognee handles this | P3 |
| 30 | `rag_chunks` | RAG | Cognee handles this | P3 |
| 31 | `rag_documents` | RAG | Cognee handles this | P3 |
| 32 | `rag_citations` | RAG | Cognee handles this | P3 |
| 33 | `upload_queue` | Upload | **YES** — batch upload broken | P0 |

### 3B. Tables in PostgreSQL but NOT in SQLite Drizzle Schema

| # | Table | Notes |
|---|-------|-------|
| 1 | `user_categories` | Exists in PG Drizzle + migration 0011, but NOT in `schema.ts` |
| 2 | `debt_payoff_scenarios` | Exists in PG Drizzle + migration 0011, but NOT in `schema.ts` |

### 3C. Column-Level Gaps (PG transactions vs SQLite transactions)

SQLite `transactions` has columns MISSING from PG `transactions`:
| Column | Type | Impact |
|--------|------|--------|
| `gst_amount` | integer | GST calculation broken |
| `gst_category` | text | GST classification broken |
| `is_owner_contribution` | boolean | Owner equity detection broken |
| `transaction_hash` | text | Dedup broken |
| `parser_version` | text | Provenance tracking broken |
| `extraction_hash` | text | Dedup broken |

> These are added by migration `0009` at SQL level but NOT in `postgres-schema.ts` Drizzle definitions.

PG `accounts` is missing:
| Column | Type | Impact |
|--------|------|--------|
| `ownership_tag` | text | Business/personal separation broken |

### 3D. Index Gaps

PostgreSQL schema has **comprehensive indexes** on its 20 tables. SQLite schema has **zero explicit indexes** (relies on SQLite auto-index on PKs and unique columns). When tables are synced to PG, all indexes from the PG schema pattern should be applied.

---

## 4. Sync Strategy

### Recommendation: Incremental Sync by Wave, with a Blocking P0 migration first

#### Phase 0: P0 Critical Sync (Before Wave 11)
Create migration `0013_critical_schema_sync.sql`:
1. Add 6 missing columns to PG `transactions` table
2. Add `ownership_tag` to PG `accounts` table
3. Create 5 P0 tables: `sessions`, `business_profiles`, `bas_periods`, `bas_calculations`, `audit_log`
4. Create 1 P0 table: `upload_queue`
5. Add `user_categories` and `debt_payoff_scenarios` to `schema.ts`

#### Phase 1: P1 Ledger + Tax Sync (Wave 11–12)
Migration `0014_ledger_tax_sync.sql`:
1. Create `tax_codes`, `tax_brackets`, `deductions`, `tax_year_summary`
2. Create `chart_of_accounts`, `journal_entries`, `journal_entry_lines`, `accounting_periods`, `account_balances`

#### Phase 2: P2 Features (Wave 12–14)
Migration `0015_cgt_depreciation_metrics.sql`:
1. Create `cgt_assets`, `cgt_events`, `depreciable_assets`, `depreciation_schedule`
2. Create `export_history`, `parser_metrics`, `parser_feedback`

#### Phase 3: P3 Teams/RAG (Wave 24)
Migration `0016_teams_rag.sql`:
1. Create `teams`, `team_members`, `team_invitations`, `subscriptions`
2. RAG tables: `rag_namespaces`, `rag_chunks`, `rag_documents`, `rag_citations` (or skip if Cognee is primary)

### Should PostgreSQL be primary?
**YES.** PostgreSQL should be the primary database going forward:
- pgvector support for embeddings (Cognee already uses it)
- Proper BOOLEAN, TIMESTAMPTZ, NUMERIC types
- Indexes, constraints, CHECK constraints
- Concurrent access for Docker deployment
- SQLite should be kept only for local dev/demo mode

### Dual-schema pattern
The `wrapPgDb()` proxy in `schema.ts` adds `.get()/.all()/.run()` methods to make PG behave like SQLite. This works but:
- Returns `any` — no type safety at runtime
- Should be phased out in favor of proper PG Drizzle queries
- Recommended: keep `schema.ts` as SQLite for local, `postgres-schema.ts` as PG for Docker

---

## 5. New Table Projections for Waves 11–24

### Wave 11: Inventory & Bank Reconciliation
```
inventory_items (id, userId, sku, name, description, category, unitCost, salePrice,
                 gstApplicable, trackQuantity, reorderPoint, isActive, createdAt, updatedAt)
inventory_stock (id, itemId, warehouseId, quantity, reservedQuantity, lastCountDate, createdAt)
inventory_movements (id, itemId, warehouseId, movementType, quantity, unitCost,
                     transactionId, reference, notes, createdAt)
warehouses (id, userId, name, location, isDefault, isActive, createdAt)
bank_recon_sessions (id, userId, accountId, periodStart, periodEnd, statementBalance,
                     bookBalance, difference, status, reconciledAt, createdAt)
bank_recon_items (id, sessionId, transactionId, status, matchType, matchedWith, notes, createdAt)
```
**Migration**: `0017_inventory_bank_recon.sql`

### Wave 12: Fixed Assets & Entity Management
```
fixed_assets (id, userId, assetName, assetCode, category, location, purchaseDate, purchaseCost,
              residualValue, usefulLifeYears, depreciationMethod, currentBookValue,
              disposalDate, disposalProceeds, status, createdAt, updatedAt)
asset_depreciation_entries (id, assetId, periodId, openingValue, depreciationAmount,
                           accumulatedDepreciation, closingValue, method, createdAt)
entities (id, userId, entityName, entityType, abn, acn, tfn, registeredAddress,
          taxStatus, gstRegistered, basFrequency, financialYearEnd, createdAt, updatedAt)
entity_relationships (id, parentEntityId, childEntityId, relationshipType,
                      ownershipPercentage, effectiveFrom, effectiveTo, createdAt)
entity_accounts (id, entityId, accountId, isPrimary, createdAt)
```
**Migration**: `0018_fixed_assets_entities.sql`

### Wave 13: Financial Reports & Budgets
```
financial_reports (id, userId, entityId, reportType, periodStart, periodEnd,
                   reportData, generatedAt, status, createdAt)
report_templates (id, userId, name, reportType, templateConfig, isDefault, createdAt)
budget_categories (id, budgetId, category, subcategory, budgetedAmount, actualAmount,
                   variance, variancePercent, notes, sortOrder)
budget_items (id, budgetCategoryId, month, budgetedAmount, actualAmount,
              transactionIds, notes)
budget_periods (id, userId, name, entityId, startDate, endDate, status,
                totalBudgeted, totalActual, createdAt, updatedAt)
```
**Migration**: `0019_financial_reports_budgets.sql`

### Wave 14: OCR & Payment Matching
```
ocr_documents (id, userId, statementId, originalFilePath, processedFilePath,
               ocrEngine, ocrConfidence, pageCount, status, errorMessage, createdAt)
ocr_results (id, documentId, pageNumber, rawText, structuredData, confidence,
             processingTimeMs, createdAt)
ocr_corrections (id, resultId, userId, fieldName, originalValue, correctedValue,
                 feedbackType, createdAt)
payment_rules (id, userId, ruleName, matchCriteria, action, priority,
               isActive, timesMatched, createdAt)
payment_matches (id, userId, invoiceRef, transactionId, matchConfidence,
                 matchMethod, status, createdAt)
```
**Migration**: `0020_ocr_payment_matching.sql`

### Wave 15: Predictions & Compliance
```
predictions (id, userId, predictionType, targetDate, predictedValue, confidence,
             modelUsed, inputFeatures, actualValue, accuracy, createdAt)
prediction_models (id, userId, modelType, modelVersion, trainingDataRange,
                   accuracy, lastTrainedAt, isActive, config, createdAt)
compliance_rules (id, ruleCode, jurisdiction, ruleType, description,
                  checkLogic, severity, effectiveFrom, effectiveTo, isActive, createdAt)
compliance_checks (id, userId, entityId, ruleId, checkDate, status,
                   findings, remediation, resolvedAt, createdAt)
compliance_reports (id, userId, entityId, reportPeriod, overallStatus,
                    checksRun, checksPassed, checksFailed, generatedAt, createdAt)
```
**Migration**: `0021_predictions_compliance.sql`

### Waves 16–17: Cognee Enhancement
Primarily Cognee-side (pgvector tables managed by Cognee service). No new SQL tables needed in app database. May add:
```
cognee_sync_log (id, userId, datasetName, syncType, recordCount, status,
                 startedAt, completedAt, errorMessage)
```
**Migration**: `0022_cognee_sync_log.sql` (optional)

### Wave 18: Admin & Agent Config
```
admin_settings (id, settingKey, settingValue, settingType, description,
                updatedBy, updatedAt, createdAt)
agent_configs (id, agentName, agentType, modelId, systemPrompt, tools,
               maxTokens, temperature, isActive, version, createdAt, updatedAt)
agent_logs (id, agentName, sessionId, userId, inputTokens, outputTokens,
            toolCalls, durationMs, status, errorMessage, createdAt)
agent_feedback (id, logId, userId, rating, feedbackText, createdAt)
system_health (id, serviceName, status, lastCheckAt, responseTimeMs,
               errorCount, metadata, createdAt)
```
**Migration**: `0023_admin_agent_config.sql`

### Wave 19: Knowledge Graph Visualization
```
graph_snapshots (id, userId, graphType, snapshotData, nodeCount, edgeCount,
                 generatedAt, createdAt)
graph_layouts (id, snapshotId, layoutAlgorithm, layoutData, createdAt)
graph_annotations (id, snapshotId, userId, nodeId, annotationType, content, createdAt)
```
**Migration**: `0024_graph_visualization.sql`

### Wave 20: CDR / Open Banking
```
cdr_data_holders (id, brandName, logoUri, industry, legalEntity,
                  registrationStatus, apiBaseUrl, createdAt, updatedAt)
cdr_consent_records (id, userId, dataHolderId, consentId, scopes,
                     status, grantedAt, expiresAt, revokedAt, createdAt)
cdr_products (id, dataHolderId, productId, productCategory, name,
              description, effectiveFrom, effectiveTo, createdAt)
cdr_lending_rates (id, productId, rateType, rate, additionalValue,
                   applicationFrequency, calculationFrequency, createdAt)
cdr_fees (id, productId, feeType, name, amount, currency,
          additionalInfo, createdAt)
cdr_account_data (id, userId, consentId, accountRef, displayName,
                  maskedNumber, productCategory, balance, lastSynced, createdAt)
```
**Migration**: `0025_cdr_open_banking.sql`

### Wave 21: Market Data
```
market_data (id, symbol, exchange, dataType, dataDate, openPrice, highPrice,
             lowPrice, closePrice, volume, adjustedClose, source, fetchedAt, createdAt)
market_indicators (id, indicatorName, indicatorType, dataDate, value,
                   source, region, fetchedAt, createdAt)
market_watchlist (id, userId, symbol, exchange, addedAt, notes, createdAt)
```
**Migration**: `0026_market_data.sql`

### Wave 23: Investments & Trading
```
trading_accounts (id, userId, brokerName, accountRef, accountType,
                  currency, linkedBankAccountId, isActive, createdAt, updatedAt)
investment_positions (id, userId, tradingAccountId, symbol, exchange,
                      positionType, quantity, avgCostBasis, currentPrice,
                      unrealizedGainLoss, lastPriceUpdate, createdAt, updatedAt)
investment_transactions (id, userId, tradingAccountId, positionId, transactionType,
                         symbol, quantity, price, fees, totalAmount,
                         executionDate, settlementDate, createdAt)
dividend_records (id, userId, positionId, paymentDate, exDividendDate,
                  grossAmount, taxWithheld, netAmount, frankedPercentage,
                  frankingCredits, createdAt)
```
**Migration**: `0027_investments_trading.sql`

### Wave 24: Multi-Tenancy
```
tenants (id, name, slug, plan, status, settings, ownerId,
         createdAt, updatedAt)
tenant_users (id, tenantId, userId, role, permissions, invitedBy,
              joinedAt, createdAt)
roles (id, tenantId, name, description, permissions, isSystem, createdAt)
permissions (id, tenantId, resource, action, conditions, createdAt)
tenant_audit_log (id, tenantId, userId, action, resource, resourceId,
                  details, ipAddress, createdAt)
```
**Migration**: `0028_multi_tenancy.sql`

---

## 6. Migration Plan

### Current Migrations
| # | File | Content |
|---|------|---------|
| 0009 | `0009_complete_schema.sql` | Add gst_amount, gst_category, is_owner_contribution, transaction_hash, parser_version, extraction_hash to transactions; ownership_tag to accounts |
| 0010 | `0010_add_missing_columns.sql` | Add columns to parser_metrics, parser_accuracy_aggregates, chart_of_accounts, journal_entry_lines, parser_feedback, teams, team_invitations, rag_citations, rag_chunks, rag_namespaces, rag_documents; CREATE tax_offsets + capital_losses |
| 0011 | `0011_final_schema_sync.sql` | Add parser_feedback columns; CREATE user_categories + debt_payoff_scenarios; indexes |
| 0012 | `0012_tax_return_platform.sql` | CREATE owner_equity_events, tax_strategies, loan_scenarios, budget_templates, economic_data_cache; ALTER transactions claim columns |

### Projected Migration Numbering

| Migration | Wave | Description |
|-----------|------|-------------|
| `0013_critical_schema_sync.sql` | Pre-11 | P0 blocking tables: sessions, business_profiles, bas_periods, bas_calculations, tax_codes, audit_log, upload_queue + missing PG columns |
| `0014_ledger_tax_sync.sql` | 11 | P1 tables: chart_of_accounts, journal_entries, journal_entry_lines, accounting_periods, account_balances, tax_brackets, deductions, tax_year_summary |
| `0015_cgt_depreciation_metrics.sql` | 12 | P2 tables: cgt_assets, cgt_events, depreciable_assets, depreciation_schedule, export_history, parser_metrics, parser_accuracy_aggregates, parser_feedback |
| `0016_teams_rag.sql` | 24 | P3 tables: teams, team_members, team_invitations, subscriptions, rag_* tables |
| `0017_inventory_bank_recon.sql` | 11 | inventory_items, inventory_stock, inventory_movements, warehouses, bank_recon_sessions, bank_recon_items |
| `0018_fixed_assets_entities.sql` | 12 | fixed_assets, asset_depreciation_entries, entities, entity_relationships, entity_accounts |
| `0019_financial_reports_budgets.sql` | 13 | financial_reports, report_templates, budget_categories, budget_items, budget_periods |
| `0020_ocr_payment_matching.sql` | 14 | ocr_documents, ocr_results, ocr_corrections, payment_rules, payment_matches |
| `0021_predictions_compliance.sql` | 15 | predictions, prediction_models, compliance_rules, compliance_checks, compliance_reports |
| `0022_cognee_sync_log.sql` | 16-17 | cognee_sync_log (optional) |
| `0023_admin_agent_config.sql` | 18 | admin_settings, agent_configs, agent_logs, agent_feedback, system_health |
| `0024_graph_visualization.sql` | 19 | graph_snapshots, graph_layouts, graph_annotations |
| `0025_cdr_open_banking.sql` | 20 | cdr_data_holders, cdr_consent_records, cdr_products, cdr_lending_rates, cdr_fees, cdr_account_data |
| `0026_market_data.sql` | 21 | market_data, market_indicators, market_watchlist |
| `0027_investments_trading.sql` | 23 | trading_accounts, investment_positions, investment_transactions, dividend_records |
| `0028_multi_tenancy.sql` | 24 | tenants, tenant_users, roles, permissions, tenant_audit_log |

### Dual-Schema Pattern Requirements
Each migration MUST:
1. Create the table in PostgreSQL via SQL migration file
2. Add the table definition to `postgres-schema.ts` using `pgTable()`
3. Add/keep the table definition in `schema.ts` using `sqliteTable()` for local dev
4. Export TypeScript types from both files
5. Use `IF NOT EXISTS` for idempotency

---

## 7. Conventions

### ID Strategy
- **Primary key**: Text (UUID v4), generated with `crypto.randomUUID()` or `nanoid()`
- **Pattern**: All tables use `id: text('id').primaryKey()`
- **Foreign keys**: Text references to parent table ID
- **No auto-increment**: UUIDs everywhere for distributed compatibility

### Amount Convention
- **All monetary amounts stored as integers (cents)**
- $100.00 → stored as `10000`
- Prevents floating-point precision errors
- Column names: `amount`, `balance`, `grossWages`, `taxWithheld`, `principal`, etc.
- Display: divide by 100 at the client layer

### Timestamp Convention
- **SQLite**: `text` type with `CURRENT_TIMESTAMP` default (ISO 8601 strings)
- **PostgreSQL**: `timestamp({ withTimezone: true })` with `defaultNow()`
- Standard columns: `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- Date-only fields (e.g., `date`, `balanceDate`): `text` in ISO format `YYYY-MM-DD`

### Naming Standards
- **Tables**: `snake_case` in SQL, `camelCase` in Drizzle TypeScript
- **Columns**: `snake_case` in SQL, `camelCase` in Drizzle TypeScript
- **Indexes**: `{table}_{column(s)}_idx` or `{table}_{column}_unique`
- **Foreign keys**: Drizzle handles via `.references()`
- **Boolean columns**: `is_*` or past tense (e.g., `confirmed`, `is_active`)
- **JSON columns**: Stored as `text` (stringified JSON), named `*_json` or `*Data`
- **Enum-like columns**: Stored as `text` with CHECK constraints in PG, validated at app layer

### Type Export Convention
```typescript
// For each table:
export type TableName = typeof tableName.$inferSelect;    // Read type
export type NewTableName = typeof tableName.$inferInsert;  // Insert type
```

---

## Summary Stats

| Metric | Count |
|--------|-------|
| SQLite tables (schema.ts) | 45 |
| PostgreSQL tables (postgres-schema.ts) | 20 |
| PostgreSQL tables (incl. migrations) | 22 |
| **Gap: Missing from PG Drizzle** | **25** |
| **Gap: Missing from SQLite Drizzle** | **2** |
| **Column gaps (transactions PG)** | **6** |
| **Column gaps (accounts PG)** | **1** |
| P0 blocking tables | 6 |
| P1 high-priority tables | 5 |
| New tables projected (Waves 11–24) | ~55 |
| Total migrations projected | 16 (0013–0028) |
