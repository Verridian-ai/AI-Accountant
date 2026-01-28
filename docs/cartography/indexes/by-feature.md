# Index: By Feature

## Authentication
- **Components**: Auth
- **Routes**: POST /auth/login, POST /auth/register
- **Tables**: users
- **Actions**: action-login, action-register, action-logout

## Accounts
- **Components**: AccountsOverview, DebtReductionPlanner, AccountSetupWizard
- **Routes**: GET/POST/PATCH/DELETE /api/accounts
- **Tables**: accounts, statementAccounts
- **Actions**: action-create-account, action-edit-account

## Analytics
- **Components**: MonthlyTrendChart, CategoryChart
- **Routes**: GET /api/stats, GET /api/analytics/*
- **Actions**: action-view-debt-plan

## BAS
- **Components**: BASDashboard
- **Routes**: GET/POST /api/bas/*, POST /api/bas/calculate
- **Tables**: basPeriods, basCalculations
- **Service**: svc-bas
- **Actions**: action-calculate-bas, action-save-bas

## Chat
- **Components**: FloatingChat
- **Routes**: POST /api/chat
- **Service**: svc-rag
- **Actions**: action-send-chat, action-toggle-chat

## Settings
- **Components**: SettingsModal, MerchantMemoryManager
- **Routes**: GET/PATCH /api/settings, GET/PATCH /api/merchant-memory
- **Tables**: userSettings, merchantMemory
- **Actions**: action-open-settings, action-change-ai-model

## Statements
- **Components**: FileUpload, StatementList
- **Routes**: GET/POST/DELETE /api/statements
- **Tables**: statements
- **Service**: svc-pipeline
- **Actions**: action-upload-statement, action-reprocess-statement

## Tax
- **Components**: TaxDashboard, TaxCalculator, DeductionManager, CGTAssetRegister, DepreciationSchedule
- **Routes**: POST /api/tax/calculate, GET/POST /api/tax/deductions, GET/POST /api/tax/cgt-assets
- **Tables**: deductions, cgtAssets, cgtEvents, depreciationSchedules
- **Service**: svc-tax
- **Actions**: action-calculate-tax, action-add-deduction, action-add-cgt-asset

## Transactions
- **Components**: TransactionTable, PendingCategorizationReview
- **Routes**: GET/PATCH/DELETE /api/transactions, GET/POST /api/transfers
- **Tables**: transactions, transactionHistory, pendingCategorizations, transferLinks
- **Hooks**: useUndoRedo
- **Actions**: action-edit-transaction, action-delete-transaction, action-link-transfer
