-- ============================================================================
-- GoldLedger v4 — Deterministic Masking Rules for Neon AI Branch
-- ============================================================================
--
-- Architecture: v4 Streaming-Native with Deterministic Masking
-- Converts all 110 PII columns to anon.pseudo_*() deterministic functions.
--
-- KEY CHANGES from v3 (DATA_MASKING_PLAN.md):
--   1. anon.fake_*() → anon.pseudo_*()   (deterministic — same input = same output)
--   2. anon.noise()  → REMOVED           (amounts pass through unchanged, tagged at app layer)
--   3. Static values → UNCHANGED          (already deterministic by definition)
--
-- FINANCIAL columns (amounts, balances, salaries) are intentionally NOT masked
-- in the database. They are tagged with [[amt:ID]] at the application layer
-- before being sent to the LLM. See: services/pipeline/amount-tagger.ts
--
-- Execution:
--   Run this ONCE on the Neon AI masked branch after branch creation.
--   The anon.anonymize_database() call at the bottom materializes all rules.
-- ============================================================================

-- ── 0. Extension Setup ──────────────────────────────────────────────────────

SET neon.allow_unstable_extensions = 'true';
CREATE EXTENSION IF NOT EXISTS anon CASCADE;
SELECT anon.init();

-- Set the deterministic salt. NEVER change this after initial setup,
-- or all pseudonyms will shift and Cognee's knowledge graph breaks.
ALTER DATABASE neondb SET anon.salt = 'goldledger_masking_salt_2026_CHANGE_IN_PRODUCTION';

-- ── 1. HIGH Sensitivity — Full Redaction / Static Values ────────────────────
-- Columns 1–13: Direct identifiers, secrets, credentials

-- users
SECURITY LABEL FOR anon ON COLUMN users.password_hash
  IS 'MASKED WITH VALUE ''$2b$10$REDACTED_HASH_DO_NOT_USE_0000000000000000000''';

-- employees
SECURITY LABEL FOR anon ON COLUMN employees.tax_file_number
  IS 'MASKED WITH VALUE ''***-***-***''';

-- employee_bank_details
SECURITY LABEL FOR anon ON COLUMN employee_bank_details.bsb
  IS 'MASKED WITH VALUE ''000-000''';

SECURITY LABEL FOR anon ON COLUMN employee_bank_details.account_number
  IS 'MASKED WITH VALUE ''XXXXXXXX''';

-- accounts
SECURITY LABEL FOR anon ON COLUMN accounts.account_number
  IS 'MASKED WITH FUNCTION anon.partial(account_number, 0, ''XXXX-XXXX-'', 4)';

SECURITY LABEL FOR anon ON COLUMN accounts.account_number_hash
  IS 'MASKED WITH VALUE ''masked_hash_000000''';

-- suppliers (banking)
SECURITY LABEL FOR anon ON COLUMN suppliers.bank_bsb
  IS 'MASKED WITH VALUE ''000-000''';

SECURITY LABEL FOR anon ON COLUMN suppliers.bank_account_number
  IS 'MASKED WITH VALUE ''XXXXXXXX''';

-- sessions
SECURITY LABEL FOR anon ON COLUMN sessions.refresh_token_hash
  IS 'MASKED WITH VALUE ''masked_token_hash''';

-- cognee_user_accounts
SECURITY LABEL FOR anon ON COLUMN cognee_user_accounts.cognee_refresh_token
  IS 'MASKED WITH VALUE ''masked-cognee-token''';

-- subscription_history
SECURITY LABEL FOR anon ON COLUMN subscription_history.payment_method_json
  IS 'MASKED WITH VALUE ''{"type":"card","last4":"0000","brand":"masked"}''';

-- push_subscriptions
SECURITY LABEL FOR anon ON COLUMN push_subscriptions.keys_json
  IS 'MASKED WITH VALUE ''{"p256dh":"masked","auth":"masked"}''';

SECURITY LABEL FOR anon ON COLUMN push_subscriptions.endpoint
  IS 'MASKED WITH VALUE ''https://masked.push.endpoint/''';


-- ── 2. MEDIUM Sensitivity — Deterministic Pseudonyms ────────────────────────
-- Columns 14–53: Personal identifiers (names, emails, phones, addresses)
-- v4: anon.pseudo_*() ensures same input → same output (Cognee graph stable)

-- users
SECURITY LABEL FOR anon ON COLUMN users.username
  IS 'MASKED WITH FUNCTION anon.pseudo_email(username)';

-- employees
SECURITY LABEL FOR anon ON COLUMN employees.first_name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(first_name)';

SECURITY LABEL FOR anon ON COLUMN employees.last_name
  IS 'MASKED WITH FUNCTION anon.pseudo_last_name(last_name)';

SECURITY LABEL FOR anon ON COLUMN employees.email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(email)';

SECURITY LABEL FOR anon ON COLUMN employees.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

SECURITY LABEL FOR anon ON COLUMN employees.date_of_birth
  IS 'MASKED WITH VALUE ''1990-01-01''';

SECURITY LABEL FOR anon ON COLUMN employees.address
  IS 'MASKED WITH VALUE ''{"street":"123 Masked St","city":"Sydney","state":"NSW","postcode":"2000"}''';

-- employee_bank_details
SECURITY LABEL FOR anon ON COLUMN employee_bank_details.account_name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(account_name)';

-- employee_super_funds
SECURITY LABEL FOR anon ON COLUMN employee_super_funds.fund_name
  IS 'MASKED WITH VALUE ''Australian Super Fund''';

SECURITY LABEL FOR anon ON COLUMN employee_super_funds.fund_abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN employee_super_funds.member_number
  IS 'MASKED WITH VALUE ''MEMBER-XXXXX''';

SECURITY LABEL FOR anon ON COLUMN employee_super_funds.usi
  IS 'MASKED WITH VALUE ''USI000000000''';

-- customers
SECURITY LABEL FOR anon ON COLUMN customers.contact_name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(contact_name)';

SECURITY LABEL FOR anon ON COLUMN customers.email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(email)';

SECURITY LABEL FOR anon ON COLUMN customers.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

SECURITY LABEL FOR anon ON COLUMN customers.address
  IS 'MASKED WITH VALUE ''456 Masked Ave''';

SECURITY LABEL FOR anon ON COLUMN customers.city
  IS 'MASKED WITH VALUE ''Melbourne''';

SECURITY LABEL FOR anon ON COLUMN customers.state
  IS 'MASKED WITH VALUE ''VIC''';

SECURITY LABEL FOR anon ON COLUMN customers.postcode
  IS 'MASKED WITH VALUE ''3000''';

-- customer_contacts
SECURITY LABEL FOR anon ON COLUMN customer_contacts.name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(name)';

SECURITY LABEL FOR anon ON COLUMN customer_contacts.email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(email)';

SECURITY LABEL FOR anon ON COLUMN customer_contacts.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

-- suppliers
SECURITY LABEL FOR anon ON COLUMN suppliers.contact_name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(contact_name)';

SECURITY LABEL FOR anon ON COLUMN suppliers.email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(email)';

SECURITY LABEL FOR anon ON COLUMN suppliers.phone
  IS 'MASKED WITH VALUE ''+61 4XX XXX XXX''';

SECURITY LABEL FOR anon ON COLUMN suppliers.address
  IS 'MASKED WITH VALUE ''789 Masked Rd, Sydney NSW 2000''';

SECURITY LABEL FOR anon ON COLUMN suppliers.bank_account_name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(bank_account_name)';

-- team_invitations
SECURITY LABEL FOR anon ON COLUMN team_invitations.email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(email)';

SECURITY LABEL FOR anon ON COLUMN team_invitations.token
  IS 'MASKED WITH VALUE ''masked-team-token''';

-- tenant_invitations
SECURITY LABEL FOR anon ON COLUMN tenant_invitations.email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(email)';

SECURITY LABEL FOR anon ON COLUMN tenant_invitations.token
  IS 'MASKED WITH VALUE ''masked-invite-token''';

-- tenants
SECURITY LABEL FOR anon ON COLUMN tenants.primary_contact_email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(primary_contact_email)';

-- tenant_members
SECURITY LABEL FOR anon ON COLUMN tenant_members.display_name
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(display_name)';

-- cognee_user_accounts
SECURITY LABEL FOR anon ON COLUMN cognee_user_accounts.cognee_email
  IS 'MASKED WITH FUNCTION anon.pseudo_email(cognee_email)';

-- sessions (non-secret PII)
SECURITY LABEL FOR anon ON COLUMN sessions.device_fingerprint
  IS 'MASKED WITH VALUE ''masked-fingerprint''';

SECURITY LABEL FOR anon ON COLUMN sessions.ip_address
  IS 'MASKED WITH VALUE ''10.0.0.1''';

SECURITY LABEL FOR anon ON COLUMN sessions.user_agent
  IS 'MASKED WITH VALUE ''Mozilla/5.0 (Masked)''';

-- audit_log
SECURITY LABEL FOR anon ON COLUMN audit_log.ip_address
  IS 'MASKED WITH VALUE ''10.0.0.1''';

SECURITY LABEL FOR anon ON COLUMN audit_log.user_agent
  IS 'MASKED WITH VALUE ''Mozilla/5.0 (Masked)''';

-- agent_audit_log
SECURITY LABEL FOR anon ON COLUMN agent_audit_log.ip_address
  IS 'MASKED WITH VALUE ''10.0.0.1''';

-- push_subscriptions (non-secret PII)
SECURITY LABEL FOR anon ON COLUMN push_subscriptions.user_agent
  IS 'MASKED WITH VALUE ''Mozilla/5.0 (Masked)''';

SECURITY LABEL FOR anon ON COLUMN push_subscriptions.device_name
  IS 'MASKED WITH VALUE ''Masked Device''';

-- offline_sync_log
SECURITY LABEL FOR anon ON COLUMN offline_sync_log.device_id
  IS 'MASKED WITH VALUE ''masked-device-id''';

-- ocr_documents
SECURITY LABEL FOR anon ON COLUMN ocr_documents.vendor_name
  IS 'MASKED WITH FUNCTION anon.pseudo_company(vendor_name)';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.vendor_abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

-- payment_matches
SECURITY LABEL FOR anon ON COLUMN payment_matches.confirmed_by
  IS 'MASKED WITH FUNCTION anon.pseudo_first_name(confirmed_by)';


-- ── 3. LOW Sensitivity — Light Pseudonymization ─────────────────────────────
-- Columns 54–67: Semi-public business identifiers (names, ABNs)

-- business_profiles
SECURITY LABEL FOR anon ON COLUMN business_profiles.business_name
  IS 'MASKED WITH FUNCTION anon.pseudo_company(business_name)';

SECURITY LABEL FOR anon ON COLUMN business_profiles.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

-- tenants
SECURITY LABEL FOR anon ON COLUMN tenants.name
  IS 'MASKED WITH FUNCTION anon.pseudo_company(name)';

SECURITY LABEL FOR anon ON COLUMN tenants.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

-- customers
SECURITY LABEL FOR anon ON COLUMN customers.business_name
  IS 'MASKED WITH FUNCTION anon.pseudo_company(business_name)';

SECURITY LABEL FOR anon ON COLUMN customers.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

-- suppliers
SECURITY LABEL FOR anon ON COLUMN suppliers.business_name
  IS 'MASKED WITH FUNCTION anon.pseudo_company(business_name)';

SECURITY LABEL FOR anon ON COLUMN suppliers.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

-- accounts
SECURITY LABEL FOR anon ON COLUMN accounts.account_name
  IS 'MASKED WITH FUNCTION anon.pseudo_company(account_name)';

-- cdr_data_holders
SECURITY LABEL FOR anon ON COLUMN cdr_data_holders.abn
  IS 'MASKED WITH VALUE ''00 000 000 000''';

SECURITY LABEL FOR anon ON COLUMN cdr_data_holders.acn
  IS 'MASKED WITH VALUE ''000 000 000''';

-- subscriptions
SECURITY LABEL FOR anon ON COLUMN subscriptions.stripe_customer_id
  IS 'MASKED WITH VALUE ''cus_masked000000''';

SECURITY LABEL FOR anon ON COLUMN subscriptions.stripe_subscription_id
  IS 'MASKED WITH VALUE ''sub_masked000000''';


-- ── 4. FREE-TEXT Sensitivity — Static Redaction Values ──────────────────────
-- Columns 81–110: Unstructured text that may embed PII
-- v4: Static replacement values (no randomness, fully deterministic)

-- transactions
SECURITY LABEL FOR anon ON COLUMN transactions.description
  IS 'MASKED WITH FUNCTION anon.pseudo_company(description)';

SECURITY LABEL FOR anon ON COLUMN transactions.ai_reasoning_notes
  IS 'MASKED WITH VALUE ''[redacted AI notes]''';

-- ocr_documents
SECURITY LABEL FOR anon ON COLUMN ocr_documents.file_path
  IS 'MASKED WITH VALUE ''/masked/documents/file.pdf''';

SECURITY LABEL FOR anon ON COLUMN ocr_documents.extracted_data
  IS 'MASKED WITH VALUE ''{"masked": true}''';

-- rag_chunks
SECURITY LABEL FOR anon ON COLUMN rag_chunks.content
  IS 'MASKED WITH VALUE ''[redacted RAG content]''';

SECURITY LABEL FOR anon ON COLUMN rag_chunks.metadata
  IS 'MASKED WITH VALUE ''{}''';

-- agent_mutations
SECURITY LABEL FOR anon ON COLUMN agent_mutations.before_state
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN agent_mutations.after_state
  IS 'MASKED WITH VALUE ''{"status":"masked"}''';

-- agent_audit_log
SECURITY LABEL FOR anon ON COLUMN agent_audit_log.before_state
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN agent_audit_log.after_state
  IS 'MASKED WITH VALUE ''[redacted]''';

-- audit_log
SECURITY LABEL FOR anon ON COLUMN audit_log.old_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN audit_log.new_value
  IS 'MASKED WITH VALUE ''[redacted]''';

-- cognee_sessions
SECURITY LABEL FOR anon ON COLUMN cognee_sessions.context_data
  IS 'MASKED WITH VALUE ''{}''';

-- cognee_feedback
SECURITY LABEL FOR anon ON COLUMN cognee_feedback.original_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN cognee_feedback.corrected_value
  IS 'MASKED WITH VALUE ''[redacted]''';

-- reconciliation_alerts
SECURITY LABEL FOR anon ON COLUMN reconciliation_alerts.description
  IS 'MASKED WITH VALUE ''Reconciliation alert [masked]''';

SECURITY LABEL FOR anon ON COLUMN reconciliation_alerts.resolution_notes
  IS 'MASKED WITH VALUE ''[redacted]''';

-- anomaly_alerts
SECURITY LABEL FOR anon ON COLUMN anomaly_alerts.description
  IS 'MASKED WITH VALUE ''Anomaly detected [masked]''';

SECURITY LABEL FOR anon ON COLUMN anomaly_alerts.details
  IS 'MASKED WITH VALUE ''{}''';

-- compliance_checks
SECURITY LABEL FOR anon ON COLUMN compliance_checks.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN compliance_checks.reference_number
  IS 'MASKED WITH VALUE ''REF-MASKED''';

-- cross_module_insights
SECURITY LABEL FOR anon ON COLUMN cross_module_insights.description
  IS 'MASKED WITH VALUE ''[redacted insight]''';

SECURITY LABEL FOR anon ON COLUMN cross_module_insights.evidence
  IS 'MASKED WITH VALUE ''{}''';

-- offline_sync_log
SECURITY LABEL FOR anon ON COLUMN offline_sync_log.payload_json
  IS 'MASKED WITH VALUE ''{"masked": true}''';

-- invoices
SECURITY LABEL FOR anon ON COLUMN invoices.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN invoices.terms_and_conditions
  IS 'MASKED WITH VALUE ''Standard terms apply.''';

SECURITY LABEL FOR anon ON COLUMN invoices.pdf_path
  IS 'MASKED WITH VALUE ''/masked/invoices/file.pdf''';

-- bills
SECURITY LABEL FOR anon ON COLUMN bills.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

-- deductions
SECURITY LABEL FOR anon ON COLUMN deductions.description
  IS 'MASKED WITH VALUE ''Deduction [masked]''';

-- owner_equity_events
SECURITY LABEL FOR anon ON COLUMN owner_equity_events.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

-- parser_feedback
SECURITY LABEL FOR anon ON COLUMN parser_feedback.original_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN parser_feedback.corrected_value
  IS 'MASKED WITH VALUE ''[redacted]''';

SECURITY LABEL FOR anon ON COLUMN parser_feedback.user_notes
  IS 'MASKED WITH VALUE ''[redacted]''';

-- export_history
SECURITY LABEL FOR anon ON COLUMN export_history.file_path
  IS 'MASKED WITH VALUE ''/masked/exports/file.csv''';

-- employee_documents
SECURITY LABEL FOR anon ON COLUMN employee_documents.file_path
  IS 'MASKED WITH VALUE ''/masked/employee-docs/file.pdf''';

-- customers (notes — free-text)
SECURITY LABEL FOR anon ON COLUMN customers.notes
  IS 'MASKED WITH VALUE ''[redacted]''';

-- suppliers (notes — free-text)
SECURITY LABEL FOR anon ON COLUMN suppliers.notes
  IS 'MASKED WITH VALUE ''[redacted]''';


-- ── 5. FINANCIAL Sensitivity — INTENTIONALLY NOT MASKED ─────────────────────
-- Columns 68–80: Transaction amounts, balances, salaries, pay rates
--
-- v4 DESIGN DECISION: Amounts pass through the database UNCHANGED.
-- They are tagged with [[amt:ID]] at the application layer (AmountTagger)
-- before being sent to the LLM. Real values are stored in Redis per session.
-- The StreamingUnredactor swaps tags back inline as Claude generates output.
--
-- This eliminates the ±10% noise from v3 (anon.noise) that caused:
--   - Incorrect math in Claude's responses
--   - Need for fragile AmountRecalculator
--   - Broken financial invariants (P&L, Balance Sheet)
--
-- Columns intentionally left unmasked:
--   transactions.amount, transactions.balance,
--   accounts.current_balance, accounts.credit_limit,
--   invoices.subtotal, invoices.total_amount,
--   bills.subtotal, bills.total_amount,
--   pay_structures.rate, pay_structures.annual_salary,
--   tax_year_summary.gross_income, tax_year_summary.taxable_income,
--   tax_year_summary.tax_payable,
--   ocr_documents.subtotal, ocr_documents.gst_amount, ocr_documents.total_amount,
--   deductions.amount, owner_equity_events.amount


-- ── 6. Materialize Masking ──────────────────────────────────────────────────
-- Run this AFTER all SECURITY LABEL rules are applied.
-- This permanently transforms the data on the AI branch.

SELECT anon.anonymize_database();
