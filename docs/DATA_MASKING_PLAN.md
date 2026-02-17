# GoldLedger — Data Masking & PII Redaction Plan

> **Author**: Data Masking & PII Redaction Architect
> **Date**: 2026-02-17
> **Status**: READY FOR IMPLEMENTATION
> **Scope**: All 70+ PostgreSQL tables, Cognee pipeline, AI service calls, OCR processing

---

## Table of Contents

1. [PII Column Inventory](#1-pii-column-inventory)
2. [Neon Masking Rules (SQL)](#2-neon-masking-rules-sql)
3. [Masking Branch Workflow](#3-masking-branch-workflow)
4. [Application-Layer Redaction](#4-application-layer-redaction)
5. [Cognee Custom Pipeline Task](#5-cognee-custom-pipeline-task)
6. [Re-identification Strategy](#6-re-identification-strategy)
7. [Compliance Mapping](#7-compliance-mapping)

---

## 1. PII Column Inventory

### Sensitivity Levels

| Level | Description | Examples | Masking Strategy |
|-------|-------------|----------|------------------|
| **HIGH** | Direct identifiers, legal/financial secrets | TFNs, bank accounts, BSBs, passwords, refresh tokens | Full redaction or strong pseudonymization |
| **MEDIUM** | Personal identifiers | Names, emails, phone numbers, addresses | Fake data generation |
| **LOW** | Semi-public business identifiers | Business names, ABNs (public register), industry | Light pseudonymization or pass-through |
| **FINANCIAL** | Monetary values (privacy via inference) | Transaction amounts, balances, salaries | ±10% noise |
| **FREE-TEXT** | Unstructured text that may embed PII | Descriptions, notes, chat messages, OCR output | Application-layer regex + NER |

### Complete PII Column Table

#### HIGH Sensitivity

| # | Table | Column | Data Type | PII Type | Notes |
|---|-------|--------|-----------|----------|-------|
| 1 | `users` | `password_hash` | text | Password hash | Never expose; mask to static value |
| 2 | `employees` | `tax_file_number` | text | TFN (AES-256 encrypted) | Australian SSN equivalent; full redact |
| 3 | `employee_bank_details` | `bsb` | text | BSB (AES-256 encrypted) | Bank routing number |
| 4 | `employee_bank_details` | `account_number` | text | Bank account (AES-256 encrypted) | Full account number |
| 5 | `accounts` | `account_number` | text | Bank account number | Full account reference |
| 6 | `accounts` | `account_number_hash` | text | Hash of account number | Derived PII |
| 7 | `suppliers` | `bank_bsb` | text | BSB | Supplier banking details |
| 8 | `suppliers` | `bank_account_number` | text | Bank account number | Supplier banking details |
| 9 | `sessions` | `refresh_token_hash` | text | Auth token hash | Session secret |
| 10 | `cognee_user_accounts` | `cognee_refresh_token` | text | Refresh token (encrypted) | API secret |
| 11 | `subscription_history` | `payment_method_json` | text | Payment card details (JSON) | Card info in JSON |
| 12 | `push_subscriptions` | `keys_json` | text | Push encryption keys | Device-specific secrets |
| 13 | `push_subscriptions` | `endpoint` | text | Push endpoint URL | Device-specific URL |

#### MEDIUM Sensitivity

| # | Table | Column | Data Type | PII Type | Notes |
|---|-------|--------|-----------|----------|-------|
| 14 | `users` | `username` | text | Username / identifier | Could be email or name |
| 15 | `employees` | `first_name` | text | Personal name | |
| 16 | `employees` | `last_name` | text | Personal name | |
| 17 | `employees` | `email` | text | Email address | |
| 18 | `employees` | `phone` | text | Phone number | |
| 19 | `employees` | `date_of_birth` | text | Date of birth | |
| 20 | `employees` | `address` | text | Physical address (JSON) | Street, city, postcode |
| 21 | `employee_bank_details` | `account_name` | text | Account holder name | |
| 22 | `customers` | `contact_name` | text | Personal name | |
| 23 | `customers` | `email` | text | Email address | |
| 24 | `customers` | `phone` | text | Phone number | |
| 25 | `customers` | `address` | text | Street address | |
| 26 | `customers` | `city` | text | City | |
| 27 | `customers` | `state` | text | State/territory | |
| 28 | `customers` | `postcode` | text | Postcode | |
| 29 | `customer_contacts` | `name` | text | Personal name | |
| 30 | `customer_contacts` | `email` | text | Email address | |
| 31 | `customer_contacts` | `phone` | text | Phone number | |
| 32 | `suppliers` | `contact_name` | text | Personal name | |
| 33 | `suppliers` | `email` | text | Email address | |
| 34 | `suppliers` | `phone` | text | Phone number | |
| 35 | `suppliers` | `address` | text | Physical address | |
| 36 | `suppliers` | `bank_account_name` | text | Account holder name | |
| 37 | `team_invitations` | `email` | text | Email address | |
| 38 | `tenant_invitations` | `email` | text | Email address | |
| 39 | `tenants` | `primary_contact_email` | text | Email address | |
| 40 | `tenant_members` | `display_name` | text | Personal/display name | |
| 41 | `cognee_user_accounts` | `cognee_email` | text | Email address | |
| 42 | `audit_log` | `ip_address` | text | IP address | |
| 43 | `audit_log` | `user_agent` | text | Browser fingerprint | |
| 44 | `sessions` | `ip_address` | text | IP address | |
| 45 | `sessions` | `user_agent` | text | Browser fingerprint | |
| 46 | `sessions` | `device_fingerprint` | text | Device fingerprint | |
| 47 | `agent_audit_log` | `ip_address` | text | IP address | |
| 48 | `push_subscriptions` | `user_agent` | text | Browser fingerprint | |
| 49 | `push_subscriptions` | `device_name` | text | Device name | |
| 50 | `offline_sync_log` | `device_id` | text | Device identifier | |
| 51 | `ocr_documents` | `vendor_name` | text | Business/person name | Could be person |
| 52 | `ocr_documents` | `vendor_abn` | text | ABN | |
| 53 | `payment_matches` | `confirmed_by` | text | User reference | |

#### LOW Sensitivity (Semi-Public)

| # | Table | Column | Data Type | PII Type | Notes |
|---|-------|--------|-----------|----------|-------|
| 54 | `business_profiles` | `business_name` | text | Business name | Semi-public |
| 55 | `business_profiles` | `abn` | text | ABN | Public register |
| 56 | `tenants` | `name` | text | Business name | |
| 57 | `tenants` | `abn` | text | ABN | |
| 58 | `customers` | `business_name` | text | Business name | |
| 59 | `customers` | `abn` | text | ABN | |
| 60 | `suppliers` | `business_name` | text | Business name | |
| 61 | `suppliers` | `abn` | text | ABN | |
| 62 | `cdr_data_holders` | `abn` | text | ABN | Public CDR register |
| 63 | `cdr_data_holders` | `acn` | text | ACN | Public ASIC register |
| 64 | `employee_super_funds` | `fund_name` | text | Super fund name | Semi-public |
| 65 | `employee_super_funds` | `fund_abn` | text | Fund ABN | Public |
| 66 | `employee_super_funds` | `member_number` | text | Member ID | Semi-private |
| 67 | `employee_super_funds` | `usi` | text | Unique Super ID | Semi-public |

#### FINANCIAL Sensitivity (Amounts)

| # | Table | Column | Data Type | PII Type | Notes |
|---|-------|--------|-----------|----------|-------|
| 68 | `transactions` | `amount` | integer | Transaction amount | Cents |
| 69 | `transactions` | `balance` | integer | Account balance | Cents |
| 70 | `accounts` | `current_balance` | integer | Account balance | Cents |
| 71 | `accounts` | `credit_limit` | integer | Credit limit | Cents |
| 72 | `invoices` | `subtotal` | integer | Invoice amount | Cents |
| 73 | `invoices` | `total_amount` | integer | Invoice amount | Cents |
| 74 | `bills` | `subtotal` | integer | Bill amount | Cents |
| 75 | `bills` | `total_amount` | integer | Bill amount | Cents |
| 76 | `pay_structures` | `rate` | integer | Pay rate | Cents |
| 77 | `pay_structures` | `annual_salary` | integer | Salary | Cents |
| 78 | `tax_year_summary` | `gross_income` | integer | Income | Cents |
| 79 | `tax_year_summary` | `taxable_income` | integer | Taxable income | Cents |
| 80 | `tax_year_summary` | `tax_payable` | integer | Tax owed | Cents |

#### FREE-TEXT Sensitivity (May Contain Embedded PII)

| # | Table | Column | Data Type | Risk | Notes |
|---|-------|--------|-----------|------|-------|
| 81 | `transactions` | `description` | text | HIGH | Bank descriptions often contain names, account refs |
| 82 | `transactions` | `ai_reasoning_notes` | text | MEDIUM | AI output may echo PII |
| 83 | `ocr_documents` | `extracted_data` | text | HIGH | Full OCR text of invoices/receipts |
| 84 | `rag_chunks` | `content` | text | HIGH | Indexed text may contain any PII |
| 85 | `rag_chunks` | `metadata` | text | MEDIUM | JSON metadata from sources |
| 86 | `agent_mutations` | `before_state` | text | MEDIUM | JSON snapshots of entities |
| 87 | `agent_mutations` | `after_state` | text | MEDIUM | JSON snapshots of entities |
| 88 | `agent_audit_log` | `before_state` | text | MEDIUM | Audit snapshots |
| 89 | `agent_audit_log` | `after_state` | text | MEDIUM | Audit snapshots |
| 90 | `audit_log` | `old_value` | text | MEDIUM | Previous entity values |
| 91 | `audit_log` | `new_value` | text | MEDIUM | Updated entity values |
| 92 | `reconciliation_alerts` | `description` | text | LOW | May reference account numbers |
| 93 | `reconciliation_alerts` | `resolution_notes` | text | LOW | May reference names |
| 94 | `anomaly_alerts` | `description` | text | LOW | May reference merchants/persons |
| 95 | `anomaly_alerts` | `details` | text | LOW | JSON detail payload |
| 96 | `compliance_checks` | `notes` | text | LOW | May reference TFNs or amounts |
| 97 | `cross_module_insights` | `description` | text | MEDIUM | AI-generated insight text |
| 98 | `cross_module_insights` | `evidence` | text | MEDIUM | JSON evidence payload |
| 99 | `cognee_feedback` | `original_value` | text | MEDIUM | User corrections |
| 100 | `cognee_feedback` | `corrected_value` | text | MEDIUM | User corrections |
| 101 | `cognee_sessions` | `context_data` | text | MEDIUM | Session context JSON |
| 102 | `offline_sync_log` | `payload_json` | text | HIGH | Full entity payloads |
| 103 | `bills` | `notes` | text | LOW | May contain contact info |
| 104 | `invoices` | `notes` | text | LOW | May contain contact info |
| 105 | `invoices` | `terms_and_conditions` | text | LOW | Boilerplate but may have ABN |
| 106 | `owner_equity_events` | `notes` | text | LOW | May reference owner names |
| 107 | `deductions` | `description` | text | LOW | May reference specific items/people |
| 108 | `parser_feedback` | `original_value` | text | MEDIUM | Corrected parse values |
| 109 | `parser_feedback` | `corrected_value` | text | MEDIUM | Corrected parse values |
| 110 | `parser_feedback` | `user_notes` | text | MEDIUM | Free-form user notes |

**Total PII columns identified: 110** across 45+ tables.

---

## 2. Neon Masking Rules (SQL)

### Prerequisites

```sql
-- Enable PostgreSQL Anonymizer extension on Neon
SET neon.allow_unstable_extensions = 'true';
CREATE EXTENSION IF NOT EXISTS anon;

-- Initialize the anonymizer with fake data
SELECT anon.init();
```

### Masking Rules by Table

#### `users`

```sql
SECURITY LABEL FOR anon ON COLUMN users.username
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN users.password_hash
  IS 'MASKED WITH VALUE ''$2b$10$MASKED_HASH_VALUE_DO_NOT_USE''';
```

#### `accounts`

```sql
SECURITY LABEL FOR anon ON COLUMN accounts.account_number
  IS 'MASKED WITH FUNCTION anon.partial(account_number, 0, ''XXXX-XXXX-'', 4)';

SECURITY LABEL FOR anon ON COLUMN accounts.account_number_hash
  IS 'MASKED WITH VALUE ''masked_hash_000000''';

SECURITY LABEL FOR anon ON COLUMN accounts.account_name
  IS 'MASKED WITH FUNCTION anon.fake_company()';

SECURITY LABEL FOR anon ON COLUMN accounts.current_balance
  IS 'MASKED WITH FUNCTION anon.noise(current_balance, 0.1)';

SECURITY LABEL FOR anon ON COLUMN accounts.credit_limit
  IS 'MASKED WITH FUNCTION anon.noise(credit_limit, 0.1)';
```

#### `transactions`

```sql
SECURITY LABEL FOR anon ON COLUMN transactions.description
  IS 'MASKED WITH FUNCTION anon.fake_company()';
  -- Note: free-text; use application-layer PiiRedactor for deep masking

SECURITY LABEL FOR anon ON COLUMN transactions.amount
  IS 'MASKED WITH FUNCTION anon.noise(amount, 0.1)';

SECURITY LABEL FOR anon ON COLUMN transactions.balance
  IS 'MASKED WITH FUNCTION anon.noise(balance, 0.1)';

SECURITY LABEL FOR anon ON COLUMN transactions.ai_reasoning_notes
  IS 'MASKED WITH VALUE ''[redacted AI notes]''';
```

#### `employees`

```sql
SECURITY LABEL FOR anon ON COLUMN employees.first_name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN employees.last_name
  IS 'MASKED WITH FUNCTION anon.fake_last_name()';

SECURITY LABEL FOR anon ON COLUMN employees.email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN employees.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

SECURITY LABEL FOR anon ON COLUMN employees.date_of_birth
  IS 'MASKED WITH VALUE ''1990-01-01''';

SECURITY LABEL FOR anon ON COLUMN employees.address
  IS 'MASKED WITH VALUE ''{"street":"123 Test St","city":"Sydney","state":"NSW","postcode":"2000"}''';

SECURITY LABEL FOR anon ON COLUMN employees.tax_file_number
  IS 'MASKED WITH VALUE ''***-***-***''';
```

#### `employee_bank_details`

```sql
SECURITY LABEL FOR anon ON COLUMN employee_bank_details.bsb
  IS 'MASKED WITH VALUE ''000-000''';

SECURITY LABEL FOR anon ON COLUMN employee_bank_details.account_number
  IS 'MASKED WITH VALUE ''XXXXXXXX''';

SECURITY LABEL FOR anon ON COLUMN employee_bank_details.account_name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';
```

#### `employee_super_funds`

```sql
SECURITY LABEL FOR anon ON COLUMN employee_super_funds.fund_name
  IS 'MASKED WITH VALUE ''Australian Super Fund''';

SECURITY LABEL FOR anon ON COLUMN employee_super_funds.fund_abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN employee_super_funds.member_number
  IS 'MASKED WITH VALUE ''MEMBER-XXXXX''';

SECURITY LABEL FOR anon ON COLUMN employee_super_funds.usi
  IS 'MASKED WITH VALUE ''USI000000000''';
```

#### `employee_tax_declarations`

```sql
-- No direct PII columns; references employeeId (FK)
-- Tax flags are boolean/numeric, not PII
```

#### `customers`

```sql
SECURITY LABEL FOR anon ON COLUMN customers.business_name
  IS 'MASKED WITH FUNCTION anon.fake_company()';

SECURITY LABEL FOR anon ON COLUMN customers.contact_name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN customers.email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN customers.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

SECURITY LABEL FOR anon ON COLUMN customers.address
  IS 'MASKED WITH VALUE ''456 Demo Ave''';

SECURITY LABEL FOR anon ON COLUMN customers.city
  IS 'MASKED WITH VALUE ''Melbourne''';

SECURITY LABEL FOR anon ON COLUMN customers.state
  IS 'MASKED WITH VALUE ''VIC''';

SECURITY LABEL FOR anon ON COLUMN customers.postcode
  IS 'MASKED WITH VALUE ''3000''';

SECURITY LABEL FOR anon ON COLUMN customers.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN customers.notes
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `customer_contacts`

```sql
SECURITY LABEL FOR anon ON COLUMN customer_contacts.name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN customer_contacts.email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN customer_contacts.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';
```

#### `suppliers`

```sql
SECURITY LABEL FOR anon ON COLUMN suppliers.business_name
  IS 'MASKED WITH FUNCTION anon.fake_company()';

SECURITY LABEL FOR anon ON COLUMN suppliers.contact_name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN suppliers.email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN suppliers.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

SECURITY LABEL FOR anon ON COLUMN suppliers.address
  IS 'MASKED WITH VALUE ''789 Supplier Rd, Sydney NSW 2000''';

SECURITY LABEL FOR anon ON COLUMN suppliers.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN suppliers.bank_bsb
  IS 'MASKED WITH VALUE ''000-000''';

SECURITY LABEL FOR anon ON COLUMN suppliers.bank_account_number
  IS 'MASKED WITH VALUE ''XXXXXXXX''';

SECURITY LABEL FOR anon ON COLUMN suppliers.bank_account_name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN suppliers.notes
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `business_profiles`

```sql
SECURITY LABEL FOR anon ON COLUMN business_profiles.business_name
  IS 'MASKED WITH FUNCTION anon.fake_company()';

SECURITY LABEL FOR anon ON COLUMN business_profiles.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';
```

#### `tenants`

```sql
SECURITY LABEL FOR anon ON COLUMN tenants.name
  IS 'MASKED WITH FUNCTION anon.fake_company()';

SECURITY LABEL FOR anon ON COLUMN tenants.primary_contact_email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN tenants.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';
```

#### `tenant_members`

```sql
SECURITY LABEL FOR anon ON COLUMN tenant_members.display_name
  IS 'MASKED WITH FUNCTION anon.fake_first_name()';
```

#### `tenant_invitations`

```sql
SECURITY LABEL FOR anon ON COLUMN tenant_invitations.email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN tenant_invitations.token
  IS 'MASKED WITH VALUE ''masked-invite-token''';
```

#### `team_invitations`

```sql
SECURITY LABEL FOR anon ON COLUMN team_invitations.email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN team_invitations.token
  IS 'MASKED WITH VALUE ''masked-team-token''';
```

#### `sessions`

```sql
SECURITY LABEL FOR anon ON COLUMN sessions.refresh_token_hash
  IS 'MASKED WITH VALUE ''masked_token_hash''';

SECURITY LABEL FOR anon ON COLUMN sessions.device_fingerprint
  IS 'MASKED WITH VALUE ''masked-fingerprint''';

SECURITY LABEL FOR anon ON COLUMN sessions.ip_address
  IS 'MASKED WITH VALUE ''10.0.0.1''';

SECURITY LABEL FOR anon ON COLUMN sessions.user_agent
  IS 'MASKED WITH VALUE ''Mozilla/5.0 (Masked)''';
```

#### `audit_log`

```sql
SECURITY LABEL FOR anon ON COLUMN audit_log.ip_address
  IS 'MASKED WITH VALUE ''10.0.0.1''';

SECURITY LABEL FOR anon ON COLUMN audit_log.user_agent
  IS 'MASKED WITH VALUE ''Mozilla/5.0 (Masked)''';

SECURITY LABEL FOR anon ON COLUMN audit_log.old_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN audit_log.new_value
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `agent_audit_log`

```sql
SECURITY LABEL FOR anon ON COLUMN agent_audit_log.ip_address
  IS 'MASKED WITH VALUE ''10.0.0.1''';

SECURITY LABEL FOR anon ON COLUMN agent_audit_log.before_state
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN agent_audit_log.after_state
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `agent_mutations`

```sql
SECURITY LABEL FOR anon ON COLUMN agent_mutations.before_state
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN agent_mutations.after_state
  IS 'MASKED WITH VALUE ''{"status":"masked"}''';
```

#### `cognee_user_accounts`

```sql
SECURITY LABEL FOR anon ON COLUMN cognee_user_accounts.cognee_email
  IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN cognee_user_accounts.cognee_refresh_token
  IS 'MASKED WITH VALUE ''masked-cognee-token''';
```

#### `cognee_sessions`

```sql
SECURITY LABEL FOR anon ON COLUMN cognee_sessions.context_data
  IS 'MASKED WITH VALUE ''{}''';
```

#### `cognee_feedback`

```sql
SECURITY LABEL FOR anon ON COLUMN cognee_feedback.original_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN cognee_feedback.corrected_value
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `ocr_documents`

```sql
SECURITY LABEL FOR anon ON COLUMN ocr_documents.file_path
  IS 'MASKED WITH VALUE ''/masked/documents/file.pdf''';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.vendor_name
  IS 'MASKED WITH FUNCTION anon.fake_company()';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.vendor_abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.extracted_data
  IS 'MASKED WITH VALUE ''{"masked": true}''';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.subtotal
  IS 'MASKED WITH FUNCTION anon.noise(subtotal, 0.1)';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.gst_amount
  IS 'MASKED WITH FUNCTION anon.noise(gst_amount, 0.1)';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.total_amount
  IS 'MASKED WITH FUNCTION anon.noise(total_amount, 0.1)';
```

#### `rag_chunks`

```sql
SECURITY LABEL FOR anon ON COLUMN rag_chunks.content
  IS 'MASKED WITH VALUE ''[redacted RAG content]''';

SECURITY LABEL FOR anon ON COLUMN rag_chunks.metadata
  IS 'MASKED WITH VALUE ''{}''';
```

#### `push_subscriptions`

```sql
SECURITY LABEL FOR anon ON COLUMN push_subscriptions.endpoint
  IS 'MASKED WITH VALUE ''https://masked.push.endpoint/''';

SECURITY LABEL FOR anon ON COLUMN push_subscriptions.keys_json
  IS 'MASKED WITH VALUE ''{"p256dh":"masked","auth":"masked"}''';

SECURITY LABEL FOR anon ON COLUMN push_subscriptions.user_agent
  IS 'MASKED WITH VALUE ''Mozilla/5.0 (Masked)''';

SECURITY LABEL FOR anon ON COLUMN push_subscriptions.device_name
  IS 'MASKED WITH VALUE ''Masked Device''';
```

#### `offline_sync_log`

```sql
SECURITY LABEL FOR anon ON COLUMN offline_sync_log.device_id
  IS 'MASKED WITH VALUE ''masked-device-id''';

SECURITY LABEL FOR anon ON COLUMN offline_sync_log.payload_json
  IS 'MASKED WITH VALUE ''{"masked": true}''';
```

#### `invoices`

```sql
SECURITY LABEL FOR anon ON COLUMN invoices.subtotal
  IS 'MASKED WITH FUNCTION anon.noise(subtotal, 0.1)';

SECURITY LABEL FOR anon ON COLUMN invoices.total_amount
  IS 'MASKED WITH FUNCTION anon.noise(total_amount, 0.1)';

SECURITY LABEL FOR anon ON COLUMN invoices.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN invoices.terms_and_conditions
  IS 'MASKED WITH VALUE ''Standard terms apply.''';

SECURITY LABEL FOR anon ON COLUMN invoices.pdf_path
  IS 'MASKED WITH VALUE ''/masked/invoices/file.pdf''';
```

#### `bills`

```sql
SECURITY LABEL FOR anon ON COLUMN bills.subtotal
  IS 'MASKED WITH FUNCTION anon.noise(subtotal, 0.1)';

SECURITY LABEL FOR anon ON COLUMN bills.total_amount
  IS 'MASKED WITH FUNCTION anon.noise(total_amount, 0.1)';

SECURITY LABEL FOR anon ON COLUMN bills.notes
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `pay_structures`

```sql
SECURITY LABEL FOR anon ON COLUMN pay_structures.rate
  IS 'MASKED WITH FUNCTION anon.noise(rate, 0.15)';

SECURITY LABEL FOR anon ON COLUMN pay_structures.annual_salary
  IS 'MASKED WITH FUNCTION anon.noise(annual_salary, 0.15)';
```

#### `tax_year_summary`

```sql
SECURITY LABEL FOR anon ON COLUMN tax_year_summary.gross_income
  IS 'MASKED WITH FUNCTION anon.noise(gross_income, 0.1)';

SECURITY LABEL FOR anon ON COLUMN tax_year_summary.taxable_income
  IS 'MASKED WITH FUNCTION anon.noise(taxable_income, 0.1)';

SECURITY LABEL FOR anon ON COLUMN tax_year_summary.tax_payable
  IS 'MASKED WITH FUNCTION anon.noise(tax_payable, 0.1)';
```

#### `subscription_history`

```sql
SECURITY LABEL FOR anon ON COLUMN subscription_history.payment_method_json
  IS 'MASKED WITH VALUE ''{"type":"card","last4":"0000","brand":"masked"}''';
```

#### `subscriptions`

```sql
SECURITY LABEL FOR anon ON COLUMN subscriptions.stripe_customer_id
  IS 'MASKED WITH VALUE ''cus_masked000000''';

SECURITY LABEL FOR anon ON COLUMN subscriptions.stripe_subscription_id
  IS 'MASKED WITH VALUE ''sub_masked000000''';
```

#### `parser_feedback`

```sql
SECURITY LABEL FOR anon ON COLUMN parser_feedback.original_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN parser_feedback.corrected_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN parser_feedback.user_notes
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `cross_module_insights`

```sql
SECURITY LABEL FOR anon ON COLUMN cross_module_insights.description
  IS 'MASKED WITH VALUE ''[redacted insight]''';

SECURITY LABEL FOR anon ON COLUMN cross_module_insights.evidence
  IS 'MASKED WITH VALUE ''{}''';
```

#### `reconciliation_alerts`

```sql
SECURITY LABEL FOR anon ON COLUMN reconciliation_alerts.description
  IS 'MASKED WITH VALUE ''Reconciliation alert [masked]''';

SECURITY LABEL FOR anon ON COLUMN reconciliation_alerts.resolution_notes
  IS 'MASKED WITH VALUE ''[redacted]''';
```

#### `anomaly_alerts`

```sql
SECURITY LABEL FOR anon ON COLUMN anomaly_alerts.description
  IS 'MASKED WITH VALUE ''Anomaly detected [masked]''';

SECURITY LABEL FOR anon ON COLUMN anomaly_alerts.details
  IS 'MASKED WITH VALUE ''{}''';
```

#### `compliance_checks`

```sql
SECURITY LABEL FOR anon ON COLUMN compliance_checks.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN compliance_checks.reference_number
  IS 'MASKED WITH VALUE ''REF-MASKED''';
```

#### `export_history`

```sql
SECURITY LABEL FOR anon ON COLUMN export_history.file_path
  IS 'MASKED WITH VALUE ''/masked/exports/file.csv''';
```

#### `employee_documents`

```sql
SECURITY LABEL FOR anon ON COLUMN employee_documents.file_path
  IS 'MASKED WITH VALUE ''/masked/employee-docs/file.pdf''';
```

#### `deductions`

```sql
SECURITY LABEL FOR anon ON COLUMN deductions.description
  IS 'MASKED WITH VALUE ''Deduction [masked]''';

SECURITY LABEL FOR anon ON COLUMN deductions.amount
  IS 'MASKED WITH FUNCTION anon.noise(amount, 0.1)';
```

#### `owner_equity_events`

```sql
SECURITY LABEL FOR anon ON COLUMN owner_equity_events.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN owner_equity_events.amount
  IS 'MASKED WITH FUNCTION anon.noise(amount, 0.1)';
```

#### `cdr_data_holders`

```sql
-- ABN is public register data; light mask for consistency
SECURITY LABEL FOR anon ON COLUMN cdr_data_holders.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN cdr_data_holders.acn
  IS 'MASKED WITH VALUE ''000 000 000''';
```

---

## 3. Masking Branch Workflow

### Architecture Overview

```
┌───────────────────┐     Neon Branch API      ┌────────────────────────┐
│  Production DB    │─────── fork ──────────▶   │  masked-ai-{date}     │
│  (Neon Main)      │                           │  (Masked Branch)      │
│                   │                           │                       │
│  Real PII data    │     anon.anonymize()      │  Fake data only       │
│  Real amounts     │───────────────────────▶   │  ±10% noise amounts   │
│  Real TFNs        │                           │  No TFNs/bank accts   │
└───────────────────┘                           └───────────┬────────────┘
                                                            │
                                                   Cognee reads from here
                                                            │
                                                   ┌────────▼────────────┐
                                                   │  Cognee Service     │
                                                   │  (cognify, search)  │
                                                   └─────────────────────┘
```

### Neon API Branch Operations

#### Create Masked Branch

```bash
# Create a point-in-time branch from production
curl -s -X POST \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "masked-ai-'$(date +%Y%m%d)'",
      "parent_id": "'${NEON_MAIN_BRANCH_ID}'"
    },
    "endpoints": [{
      "type": "read_write",
      "autoscaling_limit_min_cu": 0.25,
      "autoscaling_limit_max_cu": 1,
      "suspend_timeout_seconds": 300
    }]
  }'
```

#### Apply Masking to Branch

```sql
-- Run on the masked branch ONLY
SET neon.allow_unstable_extensions = 'true';
CREATE EXTENSION IF NOT EXISTS anon;
SELECT anon.init();

-- Apply all SECURITY LABEL rules (defined in Section 2 above)
-- Then materialize the masked data:
SELECT anon.anonymize_database();
```

#### Auto-Refresh Schedule (Nightly via Cron/GitHub Actions)

```yaml
# .github/workflows/neon-mask-refresh.yml
name: Refresh Masked Branch
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM AEST daily
  workflow_dispatch: {}

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Delete old masked branch
        run: |
          OLD_BRANCH=$(curl -s -H "Authorization: Bearer ${{ secrets.NEON_API_KEY }}" \
            "https://console.neon.tech/api/v2/projects/${{ secrets.NEON_PROJECT_ID }}/branches" \
            | jq -r '.branches[] | select(.name | startswith("masked-ai-")) | .id' | head -1)
          if [ -n "$OLD_BRANCH" ]; then
            curl -s -X DELETE \
              "https://console.neon.tech/api/v2/projects/${{ secrets.NEON_PROJECT_ID }}/branches/$OLD_BRANCH" \
              -H "Authorization: Bearer ${{ secrets.NEON_API_KEY }}"
          fi

      - name: Create fresh masked branch
        run: |
          BRANCH_RESP=$(curl -s -X POST \
            "https://console.neon.tech/api/v2/projects/${{ secrets.NEON_PROJECT_ID }}/branches" \
            -H "Authorization: Bearer ${{ secrets.NEON_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "branch": {
                "name": "masked-ai-'$(date +%Y%m%d)'",
                "parent_id": "'${{ secrets.NEON_MAIN_BRANCH_ID }}'"
              },
              "endpoints": [{
                "type": "read_write",
                "autoscaling_limit_min_cu": 0.25,
                "autoscaling_limit_max_cu": 1,
                "suspend_timeout_seconds": 300
              }]
            }')
          ENDPOINT_HOST=$(echo $BRANCH_RESP | jq -r '.endpoints[0].host')
          echo "MASKED_DB_HOST=$ENDPOINT_HOST" >> $GITHUB_ENV

      - name: Apply anonymization
        env:
          PGPASSWORD: ${{ secrets.NEON_DB_PASSWORD }}
        run: |
          psql "postgresql://app_user@${MASKED_DB_HOST}/ai_accountant?sslmode=require" \
            -f scripts/neon-masking/apply-masking-rules.sql \
            -c "SELECT anon.anonymize_database();"

      - name: Update Cognee connection string
        run: |
          # Store the masked branch endpoint for Cognee to use
          echo "$MASKED_DB_HOST" > /tmp/masked-branch-host.txt
          # Optionally: update a secrets manager or config store
```

### Branch Naming Convention

| Pattern | Use Case |
|---------|----------|
| `masked-ai-{YYYYMMDD}` | Nightly auto-refresh for AI/Cognee |
| `masked-dev-{branch}` | Developer preview branches |
| `masked-staging` | Long-lived staging branch |

### Environment Variables

```env
# Production (main branch) — app reads/writes here
DATABASE_URL=postgresql://app_user:***@ep-prod-xxx.neon.tech/ai_accountant

# Masked branch — Cognee reads from here
MASKED_DATABASE_URL=postgresql://app_user:***@ep-masked-xxx.neon.tech/ai_accountant

# Cognee should use MASKED_DATABASE_URL for pgvector connections
COGNEE_PGVECTOR_URL=${MASKED_DATABASE_URL}
```

---

## 4. Application-Layer Redaction

### `PiiRedactor` Class Design

**File**: `server/src/services/pii-redactor.ts`

```typescript
/**
 * PiiRedactor — Application-layer PII detection and redaction.
 *
 * Intercepts text before it reaches external AI APIs (Anthropic, OpenRouter,
 * Cognee) and replaces identified PII with reversible tokens.
 *
 * Two modes:
 *   1. Tokenized (default): PII → PERSON_TOKEN_abc123 (reversible via Redis)
 *   2. Destructive: PII → [REDACTED] (irreversible, for logs)
 */

export interface RedactionResult {
  redactedText: string;
  tokenMap: Map<string, string>;  // token → original value
  stats: {
    tfnsRedacted: number;
    bsbsRedacted: number;
    accountNumbersRedacted: number;
    emailsRedacted: number;
    phonesRedacted: number;
    abnRedacted: number;
    namesRedacted: number;    // via NER heuristic
    addressesRedacted: number;
  };
}

export class PiiRedactor {
  // Australian TFN: 9 digits, optional dashes/spaces
  private static TFN_PATTERN = /\b(\d{3}[-\s]?\d{3}[-\s]?\d{3})\b/g;

  // Australian BSB: 6 digits with dash after first 3
  private static BSB_PATTERN = /\b(\d{3}-\d{3})\b/g;

  // Bank account numbers: 6-10 digits (after BSB context)
  private static ACCT_PATTERN = /\b(\d{6,10})\b/g;

  // Email addresses
  private static EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  // Australian phone: +61, 04xx, (0x) xxxx xxxx
  private static PHONE_PATTERN =
    /(\+61\s?\d{1,2}\s?\d{4}\s?\d{4}|04\d{2}\s?\d{3}\s?\d{3}|\(0\d\)\s?\d{4}\s?\d{4})/g;

  // ABN: 11 digits with optional spaces
  private static ABN_PATTERN = /\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/g;

  // Name heuristic: Capitalized word pairs (first + last)
  // Enhanced with common Australian name prefixes
  private static NAME_PATTERN =
    /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/g;

  /**
   * Redact PII from text, returning tokenized replacements.
   * Tokens are stored in Redis for re-identification.
   */
  redact(text: string, mode: 'tokenized' | 'destructive' = 'tokenized'): RedactionResult {
    const tokenMap = new Map<string, string>();
    const stats = {
      tfnsRedacted: 0, bsbsRedacted: 0, accountNumbersRedacted: 0,
      emailsRedacted: 0, phonesRedacted: 0, abnRedacted: 0,
      namesRedacted: 0, addressesRedacted: 0,
    };

    let result = text;

    // Order matters: most specific patterns first

    // 1. TFNs (highest priority)
    result = result.replace(PiiRedactor.TFN_PATTERN, (match) => {
      if (this.isTfnChecksum(match)) {
        stats.tfnsRedacted++;
        return this.replaceWith(match, 'TFN', mode, tokenMap);
      }
      return match;
    });

    // 2. Emails
    result = result.replace(PiiRedactor.EMAIL_PATTERN, (match) => {
      stats.emailsRedacted++;
      return this.replaceWith(match, 'EMAIL', mode, tokenMap);
    });

    // 3. Phone numbers
    result = result.replace(PiiRedactor.PHONE_PATTERN, (match) => {
      stats.phonesRedacted++;
      return this.replaceWith(match, 'PHONE', mode, tokenMap);
    });

    // 4. BSBs
    result = result.replace(PiiRedactor.BSB_PATTERN, (match) => {
      stats.bsbsRedacted++;
      return this.replaceWith(match, 'BSB', mode, tokenMap);
    });

    // 5. ABNs (11 digits)
    result = result.replace(PiiRedactor.ABN_PATTERN, (match) => {
      if (match.replace(/\s/g, '').length === 11) {
        stats.abnRedacted++;
        return this.replaceWith(match, 'ABN', mode, tokenMap);
      }
      return match;
    });

    // 6. Names (heuristic — last, to avoid false positives)
    result = result.replace(PiiRedactor.NAME_PATTERN, (match, first, last) => {
      if (this.isLikelyName(first, last)) {
        stats.namesRedacted++;
        return this.replaceWith(match, 'PERSON', mode, tokenMap);
      }
      return match;
    });

    return { redactedText: result, tokenMap, stats };
  }

  /**
   * Batch-redact an array of strings (e.g., transaction descriptions).
   */
  redactBatch(texts: string[]): { redactedTexts: string[]; combinedMap: Map<string, string> } {
    const combinedMap = new Map<string, string>();
    const redactedTexts = texts.map((t) => {
      const r = this.redact(t);
      r.tokenMap.forEach((v, k) => combinedMap.set(k, v));
      return r.redactedText;
    });
    return { redactedTexts, combinedMap };
  }

  /**
   * Re-identify: substitute tokens back to original values.
   */
  reidentify(text: string, tokenMap: Map<string, string>): string {
    let result = text;
    for (const [token, original] of tokenMap) {
      result = result.replaceAll(token, original);
    }
    return result;
  }

  private replaceWith(
    original: string,
    type: string,
    mode: 'tokenized' | 'destructive',
    tokenMap: Map<string, string>,
  ): string {
    if (mode === 'destructive') return `[REDACTED_${type}]`;
    const token = `${type}_TOKEN_${this.generateShortId()}`;
    tokenMap.set(token, original);
    return token;
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Australian TFN checksum validation (digit-weight algorithm).
   * Reduces false positives on 9-digit number sequences.
   */
  private isTfnChecksum(raw: string): boolean {
    const digits = raw.replace(/[-\s]/g, '');
    if (digits.length !== 9) return false;
    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    const sum = digits.split('').reduce((s, d, i) => s + parseInt(d) * weights[i], 0);
    return sum % 11 === 0;
  }

  /**
   * Heuristic: Is this capitalized pair likely a person name?
   * Exclude common non-name words (months, cities, company suffixes).
   */
  private isLikelyName(first: string, last: string): boolean {
    const excludeWords = new Set([
      'January','February','March','April','May','June','July',
      'August','September','October','November','December',
      'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
      'Sydney','Melbourne','Brisbane','Perth','Adelaide','Hobart','Darwin','Canberra',
      'Street','Road','Avenue','Drive','Lane','Place','Court','Way',
      'Pty','Ltd','Inc','Corp','Limited','Australia','Australian',
      'Bank','National','Commonwealth','Westpac',
      'Tax','Income','Total','Amount','Balance','Payment','Invoice',
    ]);
    return !excludeWords.has(first) && !excludeWords.has(last);
  }
}
```

### Injection Points

The `PiiRedactor` middleware must be injected at these critical points in the data flow:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA FLOW WITH PII REDACTION                    │
│                                                                     │
│  User Input ──▶ [PiiRedactor] ──▶ Claude/OpenRouter API             │
│                                                                     │
│  OCR Result ──▶ [PiiRedactor] ──▶ Transaction Description Storage   │
│                                                                     │
│  Transaction ──▶ [PiiRedactor] ──▶ Cognee add() / cognify()        │
│  Data                                                               │
│                                                                     │
│  Chat Query ──▶ [PiiRedactor] ──▶ RAG search() + LLM prompt        │
│                                      │                              │
│                                      ▼                              │
│                              LLM Response                           │
│                                      │                              │
│                                      ▼                              │
│                            [Re-identify] ──▶ User Response          │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1. Before AI API Calls (`server/src/services/ai.ts`)

Inject in `categorizeTransaction()`, `generateInsight()`, `parseStatementText()`, `extractAccountInfo()`, `categorizeWithMemory()`, `detectTransfers()`:

```typescript
// Before building the prompt:
const redactor = new PiiRedactor();
const { redactedText, tokenMap } = redactor.redact(description);
// Use redactedText in prompt
// After LLM response:
const finalResponse = redactor.reidentify(llmResponse, tokenMap);
```

#### 2. Before Cognee Operations (`server/src/services/rag.ts`)

Inject in `indexTransactions()`, `addDocuments()`:

```typescript
// Before cogneeClient.add():
const redactor = new PiiRedactor();
const { redactedTexts, combinedMap } = redactor.redactBatch(lines);
await cogneeClient.add(redactedTexts, datasetName);
// Store combinedMap in Redis for this indexing session
```

#### 3. Before Chat Processing (`server/src/services/claude/orchestrator.ts`)

Inject in `invoke()` for all agent types:

```typescript
// Before passing input to any agent:
const redactor = new PiiRedactor();
// Redact all string fields in input recursively
const redactedInput = deepRedact(input, redactor);
// After agent response:
const finalOutput = deepReidentify(output, tokenMap);
```

#### 4. After OCR Extraction (`server/src/services/ocr-processing.ts`)

Inject after Claude Vision API returns extracted text:

```typescript
// After OCR extraction:
const redactor = new PiiRedactor();
const { redactedText } = redactor.redact(extractedText, 'destructive');
// Store redactedText in extracted_data column (production safety)
```

#### 5. Before Cognee Cognify (`server/src/services/cognee_client.ts`)

When calling `cognify()`, the underlying data should already come from the masked branch. But as defense-in-depth, validate:

```typescript
// In cogneeClient.cognify():
if (process.env.COGNEE_USE_MASKED_BRANCH !== 'true') {
  logger.warn('[COGNEE] WARNING: cognify not using masked branch!');
}
```

---

## 5. Cognee Custom Pipeline Task

### Option A: TypeScript Pre-Processing (Recommended)

Since the GoldLedger server is TypeScript-native, the Cognee pipeline integration is best done as a pre-processing step before calling the Cognee REST API.

**File**: `server/src/services/cognee-pii-pipeline.ts`

```typescript
/**
 * Cognee PII Pipeline — runs BEFORE any data reaches Cognee.
 *
 * Two protection layers:
 * 1. Data reads from masked Neon branch (DB-level masking)
 * 2. Application-layer PiiRedactor strips any residual PII from free-text
 *
 * This pipeline wraps cogneeClient.add() and cogneeClient.cognify().
 */

import { PiiRedactor } from './pii-redactor.js';
import { cogneeClient } from './cognee_client.js';
import { logger } from '../utils/logger.js';

export class CogneePiiPipeline {
  private redactor: PiiRedactor;

  constructor() {
    this.redactor = new PiiRedactor();
  }

  /**
   * Safe add: redact PII from data before uploading to Cognee.
   */
  async safeAdd(data: string[], datasetName: string, userId?: string): Promise<void> {
    const { redactedTexts, combinedMap } = this.redactor.redactBatch(data);

    logger.info(`[CogneePII] Redacted ${combinedMap.size} PII tokens from ${data.length} items`);

    await cogneeClient.add(redactedTexts, datasetName, userId);

    // Store token map in Redis for potential re-identification
    // TTL: 1 hour (matches re-identification window)
    if (combinedMap.size > 0) {
      await this.storeTokenMap(datasetName, combinedMap);
    }
  }

  /**
   * Safe cognify: ensure we're operating on masked data.
   */
  async safeCognify(datasets: string[], userId?: string): Promise<void> {
    // Validate we're reading from masked branch
    const dbUrl = process.env.COGNEE_PGVECTOR_URL || process.env.MASKED_DATABASE_URL;
    if (!dbUrl || !dbUrl.includes('masked')) {
      logger.warn('[CogneePII] Cognify may be using production DB — verify MASKED_DATABASE_URL');
    }

    await cogneeClient.cognify(datasets, true, undefined, userId);
  }

  private async storeTokenMap(namespace: string, map: Map<string, string>): Promise<void> {
    // Store in Redis with 1-hour TTL
    // Implementation uses cognee-sessions Redis client
    const serialized = JSON.stringify(Object.fromEntries(map));
    // Redis SET with EX (handled by cognee-sessions.ts Redis connection)
    logger.info(`[CogneePII] Stored ${map.size} tokens for namespace '${namespace}'`);
  }
}
```

### Option B: Python Pipeline Task (If Cognee Runs Custom Pipelines)

If Cognee's internal pipeline system is extended to support custom tasks:

**File**: `cognee-models/pii_redaction_task.py`

```python
"""
Cognee custom pipeline task for PII redaction.

Runs BEFORE the default cognify task in the Cognee pipeline.
Reads data from the masked Neon branch and applies regex-based
redaction as a defense-in-depth measure.
"""

import re
from typing import List, Dict, Tuple

# Australian PII patterns
TFN_PATTERN = re.compile(r'\b(\d{3}[-\s]?\d{3}[-\s]?\d{3})\b')
BSB_PATTERN = re.compile(r'\b(\d{3}-\d{3})\b')
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_PATTERN = re.compile(
    r'(\+61\s?\d{1,2}\s?\d{4}\s?\d{4}|04\d{2}\s?\d{3}\s?\d{3})'
)
ABN_PATTERN = re.compile(r'\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b')


def redact_pii(text: str) -> Tuple[str, Dict[str, str]]:
    """
    Redact PII from text, returning (redacted_text, token_map).
    """
    token_map = {}
    counter = 0

    def make_token(pii_type: str, original: str) -> str:
        nonlocal counter
        counter += 1
        token = f"{pii_type}_TOKEN_{counter:04d}"
        token_map[token] = original
        return token

    # Order: most specific first
    text = TFN_PATTERN.sub(lambda m: make_token("TFN", m.group()), text)
    text = EMAIL_PATTERN.sub(lambda m: make_token("EMAIL", m.group()), text)
    text = PHONE_PATTERN.sub(lambda m: make_token("PHONE", m.group()), text)
    text = BSB_PATTERN.sub(lambda m: make_token("BSB", m.group()), text)
    text = ABN_PATTERN.sub(lambda m: make_token("ABN", m.group()), text)

    return text, token_map


async def pii_redaction_task(data: List[str]) -> List[str]:
    """
    Cognee pipeline task: redact PII from all incoming text chunks.
    This runs BEFORE cognify's default entity extraction.
    """
    redacted = []
    total_tokens = 0
    for item in data:
        clean, tokens = redact_pii(item)
        redacted.append(clean)
        total_tokens += len(tokens)

    print(f"[PII Task] Redacted {total_tokens} PII tokens from {len(data)} chunks")
    return redacted
```

### Pipeline Integration

Register the task in Cognee's pipeline configuration:

```python
# In Cognee pipeline setup (cognee-repo configuration)
from pii_redaction_task import pii_redaction_task

pipeline.add_task(
    name="pii_redaction",
    task=pii_redaction_task,
    order=0,  # BEFORE all other tasks
    description="Strip PII before entity extraction"
)
```

---

## 6. Re-identification Strategy

### Token-Based Approach

```
┌──────────────┐     PiiRedactor      ┌──────────────────────┐
│ "John Smith   │ ──────────────────▶  │ "PERSON_TOKEN_a1b2   │
│  paid $500    │      redact()        │  paid $500           │
│  TFN 123-456  │                      │  TFN_TOKEN_c3d4      │
│  -789"        │                      │  "                   │
└──────────────┘                       └──────────┬───────────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  Redis Store  │
                                          │  TTL: 1 hour  │
                                          │               │
                                          │ PERSON_TOKEN   │
                                          │ _a1b2 →       │
                                          │ "John Smith"  │
                                          │               │
                                          │ TFN_TOKEN     │
                                          │ _c3d4 →       │
                                          │ "123-456-789" │
                                          └───────┬───────┘
                                                  │
                    ┌──────────────┐      reidentify()
                    │ "John Smith  │ ◀────────────┘
                    │  paid $500   │
                    │  TFN 123-456 │
                    │  -789"       │
                    └──────────────┘
```

### Redis Storage Design

```typescript
// Key format: pii:session:{sessionId}:tokens
// Value: JSON map of token → original
// TTL: 3600 seconds (1 hour)

interface PiiTokenStore {
  /** Store redaction tokens for a session */
  store(sessionId: string, tokenMap: Map<string, string>): Promise<void>;

  /** Retrieve tokens for re-identification */
  retrieve(sessionId: string): Promise<Map<string, string> | null>;

  /** Destroy tokens (session end or timeout) */
  destroy(sessionId: string): Promise<void>;
}

// Redis implementation:
class RedisPiiTokenStore implements PiiTokenStore {
  private readonly KEY_PREFIX = 'pii:tokens:';
  private readonly TTL_SECONDS = 3600; // 1 hour

  async store(sessionId: string, tokenMap: Map<string, string>): Promise<void> {
    const key = `${this.KEY_PREFIX}${sessionId}`;
    const value = JSON.stringify(Object.fromEntries(tokenMap));
    await redis.set(key, value, 'EX', this.TTL_SECONDS);
  }

  async retrieve(sessionId: string): Promise<Map<string, string> | null> {
    const key = `${this.KEY_PREFIX}${sessionId}`;
    const value = await redis.get(key);
    if (!value) return null;
    return new Map(Object.entries(JSON.parse(value)));
  }

  async destroy(sessionId: string): Promise<void> {
    await redis.del(`${this.KEY_PREFIX}${sessionId}`);
  }
}
```

### Re-identification Rules

1. **Only re-identify for the requesting user's session** — never cross-session lookup
2. **TTL enforced at 1 hour** — tokens automatically expire; Redis evicts
3. **Never persist token maps to PostgreSQL** — Redis-only, ephemeral
4. **Rate-limit re-identification calls** — max 100/minute per session (prevent enumeration)
5. **Audit all re-identification events** — log session ID, timestamp, token count (not values)
6. **Token format is non-guessable** — 8-char random alphanumeric suffix per token

### Integration with Chat Flow

```typescript
// In /api/chat handler:
async function handleChat(query: string, userId: string, sessionId: string) {
  const redactor = new PiiRedactor();
  const tokenStore = new RedisPiiTokenStore();

  // 1. Redact user query
  const { redactedText, tokenMap } = redactor.redact(query);

  // 2. Store tokens
  await tokenStore.store(sessionId, tokenMap);

  // 3. Send redacted query to RAG + LLM
  const ragResults = await ragService.searchMulti(redactedText, userId, sessionId);
  const llmResponse = await generateAnswer(redactedText, ragResults);

  // 4. Re-identify in response (for this session only)
  const storedTokens = await tokenStore.retrieve(sessionId);
  const finalResponse = storedTokens
    ? redactor.reidentify(llmResponse, storedTokens)
    : llmResponse;

  return { answer: finalResponse };
}
```

---

## 7. Compliance Mapping

### Australian Privacy Act 1988

| APP | Requirement | GoldLedger Implementation |
|-----|-------------|--------------------------|
| **APP 1** | Open & transparent management | Privacy policy + data masking documentation |
| **APP 6** | Use or disclosure of personal information | PiiRedactor prevents PII from reaching external LLMs |
| **APP 8** | Cross-border disclosure | Application-layer redaction before OpenRouter/Anthropic API calls |
| **APP 11** | Security of personal information | AES-256-GCM encryption (TFN, bank details), Neon masking branches, Redis-only token storage with TTL |
| **APP 12** | Access to personal information | Token re-identification allows user to see their own data |
| **APP 13** | Correction of personal information | Original data preserved in production branch; masked branch is derivative |

### Tax Practitioner Requirements (Tax Agent Services Act 2009)

| Requirement | Implementation |
|-------------|----------------|
| TFN handling (Tax File Number secrecy) | AES-256-GCM encrypted at rest; masked to `***-***-***` in Neon branch; PiiRedactor strips from free-text before AI; never sent to external APIs |
| Client records retention (5 years) | Production branch retains original data; masked branch is ephemeral derivative |
| Registered agent access only | RBAC system (Wave 23) with `owner > admin > accountant > bookkeeper > viewer` hierarchy; TFN access requires `accountant` or above |

### GDPR Article 25 (Future-Ready)

| Principle | Implementation |
|-----------|----------------|
| Data protection by design | Masking built into Neon branch pipeline; PiiRedactor is mandatory middleware |
| Data protection by default | Cognee NEVER sees production data; masked branch is the default AI source |
| Pseudonymization | Token-based replacement preserves referential utility while hiding identity |
| Right to erasure | Delete tokens from Redis; Neon branch rebuild excludes deleted records from parent |
| Data minimization | Only necessary fields sent to LLMs; PiiRedactor strips all others |

### Australian Prudential Standards (APS 234 — Information Security)

| Control | Implementation |
|---------|----------------|
| Data classification | 5-tier sensitivity model (HIGH/MEDIUM/LOW/FINANCIAL/FREE-TEXT) |
| Encryption at rest | AES-256-GCM for TFNs and bank details; Neon's built-in encryption |
| Access control | Neon branch roles (read-only for AI services); JWT + RBAC for app access |
| Audit trails | `audit_log` table records all data access; PII token operations logged to Redis |
| Third-party risk | External AI APIs only see redacted/tokenized data; no raw PII exposure |

### Logging & Audit Trail Requirements

```typescript
// Audit events to log for compliance:
interface PiiAuditEvent {
  timestamp: string;
  sessionId: string;
  userId: string;
  action: 'redact' | 'reidentify' | 'destroy_tokens';
  tokenCount: number;
  piiTypes: string[];       // ['TFN', 'EMAIL', 'PHONE'] — types, not values
  targetService: string;    // 'anthropic' | 'openrouter' | 'cognee'
  // NEVER log actual PII values in audit trail
}
```

---

## Summary: Defense-in-Depth Layers

| Layer | Protection | Scope |
|-------|-----------|-------|
| **Layer 1: Neon Masking Branch** | DB-level column masking via `anon` extension | All 110 PII columns across 45+ tables |
| **Layer 2: PiiRedactor Middleware** | Regex + heuristic PII detection in free-text | All AI API calls, Cognee operations, OCR output |
| **Layer 3: Cognee Pipeline Task** | Pre-cognify PII scrubbing | Data entering Cognee knowledge graph |
| **Layer 4: Redis Token Store** | Ephemeral, session-scoped re-identification | Chat responses, agent outputs |
| **Layer 5: RBAC + Encryption** | Access control + AES-256-GCM | TFNs, bank details, session tokens |

This five-layer approach ensures that even if one layer fails, subsequent layers catch PII before it reaches external services.
