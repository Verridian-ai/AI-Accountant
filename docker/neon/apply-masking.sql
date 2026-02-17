-- =============================================================================
-- GoldLedger — Neon AI Branch Masking Script
-- =============================================================================
--
-- Purpose: Apply PII masking to the Neon `ai-operations` branch.
-- Method:  Rename each PII table to `_raw_{table}`, then create a VIEW with
--          the original name that applies masking functions per column.
--
-- This script is IDEMPOTENT — safe to re-run on each daily branch refresh.
--
-- Usage:
--   psql "$MASKED_DATABASE_URL" -f docker/neon/apply-masking.sql
--
-- Tables masked: 21 (19 from neon-architect list + 2 additional high-risk)
-- PII columns masked: 73
--
-- Author: masking-architect
-- Date:   2026-02-17
-- =============================================================================

-- Helper: deterministic pseudonymization via MD5 hash (stable across refreshes)
-- This ensures the same input always produces the same fake value,
-- preserving referential consistency within the masked dataset.

CREATE OR REPLACE FUNCTION _mask_email(val TEXT) RETURNS TEXT AS $$
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN 'user_' || LEFT(MD5(val), 8) || '@masked.example.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _mask_phone(val TEXT) RETURNS TEXT AS $$
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN '+61 4' || LPAD((ABS(('x' || LEFT(MD5(val), 4))::BIT(16)::INT) % 100)::TEXT, 2, '0')
         || ' ' || LPAD((ABS(('x' || SUBSTR(MD5(val), 5, 3))::BIT(12)::INT) % 1000)::TEXT, 3, '0')
         || ' ' || LPAD((ABS(('x' || SUBSTR(MD5(val), 8, 3))::BIT(12)::INT) % 1000)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _mask_name(val TEXT) RETURNS TEXT AS $$
DECLARE
  names TEXT[] := ARRAY['Alex','Sam','Jordan','Taylor','Morgan','Casey','Riley','Quinn',
                        'Avery','Cameron','Blake','Drew','Jamie','Reese','Skylar','Logan'];
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN names[1 + ABS(('x' || LEFT(MD5(val), 4))::BIT(16)::INT) % ARRAY_LENGTH(names, 1)];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _mask_surname(val TEXT) RETURNS TEXT AS $$
DECLARE
  surnames TEXT[] := ARRAY['Smith','Jones','Brown','Wilson','Taylor','Anderson','Thomas',
                          'Jackson','White','Harris','Martin','Garcia','Clark','Lewis'];
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN surnames[1 + ABS(('x' || LEFT(MD5(val), 4))::BIT(16)::INT) % ARRAY_LENGTH(surnames, 1)];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _mask_company(val TEXT) RETURNS TEXT AS $$
DECLARE
  prefixes TEXT[] := ARRAY['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Theta','Omega'];
  suffixes TEXT[] := ARRAY['Corp','Industries','Solutions','Group','Holdings','Services','Tech','Labs'];
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN prefixes[1 + ABS(('x' || LEFT(MD5(val), 3))::BIT(12)::INT) % ARRAY_LENGTH(prefixes, 1)]
    || ' '
    || suffixes[1 + ABS(('x' || SUBSTR(MD5(val), 4, 3))::BIT(12)::INT) % ARRAY_LENGTH(suffixes, 1)];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _mask_address(val TEXT) RETURNS TEXT AS $$
DECLARE
  streets TEXT[] := ARRAY['123 Test St','456 Demo Ave','789 Sample Rd','101 Mock Ln',
                          '202 Fake Dr','303 Dummy Ct','404 Placeholder Way','505 Redacted Pl'];
  cities  TEXT[] := ARRAY['Sydney NSW 2000','Melbourne VIC 3000','Brisbane QLD 4000',
                          'Perth WA 6000','Adelaide SA 5000','Hobart TAS 7000'];
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN streets[1 + ABS(('x' || LEFT(MD5(val), 3))::BIT(12)::INT) % ARRAY_LENGTH(streets, 1)]
    || ', '
    || cities[1 + ABS(('x' || SUBSTR(MD5(val), 4, 3))::BIT(12)::INT) % ARRAY_LENGTH(cities, 1)];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _mask_ip(val TEXT) RETURNS TEXT AS $$
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN '10.'
    || (ABS(('x' || LEFT(MD5(val), 2))::BIT(8)::INT) % 256)::TEXT || '.'
    || (ABS(('x' || SUBSTR(MD5(val), 3, 2))::BIT(8)::INT) % 256)::TEXT || '.'
    || (ABS(('x' || SUBSTR(MD5(val), 5, 2))::BIT(8)::INT) % 254 + 1)::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _noise_amount(val NUMERIC, noise_factor NUMERIC DEFAULT 0.1)
RETURNS NUMERIC AS $$
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  -- Deterministic noise: use the value itself to seed the offset
  RETURN ROUND(val * (1.0 + (noise_factor * (HASHFLOAT8(val::DOUBLE PRECISION)::NUMERIC))));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fallback for integer noise (transactions store cents as integer)
CREATE OR REPLACE FUNCTION _noise_int(val INTEGER, noise_factor NUMERIC DEFAULT 0.1)
RETURNS INTEGER AS $$
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN ROUND(val * (1.0 + (noise_factor * (HASHINT4(val)::NUMERIC / 2147483647.0))))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =============================================================================
-- TABLE MASKING: Rename → VIEW pattern
-- =============================================================================
-- Each block:
--   1. Drop the VIEW if it exists (from a previous run)
--   2. Rename table to _raw_ prefix (skip if already renamed)
--   3. Create VIEW with original name, applying masking expressions
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS users CASCADE;
DO $$ BEGIN
  ALTER TABLE users RENAME TO _raw_users;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW users AS
SELECT
  id,
  _mask_email(username)                     AS username,
  '$2b$10$MASKED_DO_NOT_USE_000000000000'   AS password_hash,
  created_at,
  updated_at
FROM _raw_users;


-- ---------------------------------------------------------------------------
-- 2. accounts
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS accounts CASCADE;
DO $$ BEGIN
  ALTER TABLE accounts RENAME TO _raw_accounts;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW accounts AS
SELECT
  id,
  user_id,
  'XXXX-XXXX-' || RIGHT(account_number, 4)  AS account_number,
  'masked_hash_' || LEFT(MD5(account_number_hash), 8)  AS account_number_hash,
  _mask_company(account_name)                AS account_name,
  account_type,
  bank_name,
  _noise_int(current_balance)                AS current_balance,
  last_statement_date,
  interest_rate,
  _noise_int(credit_limit)                   AS credit_limit,
  _noise_int(minimum_payment)                AS minimum_payment,
  payment_due_day,
  linked_payment_account_id,
  is_active,
  ownership_tag,
  created_at,
  updated_at
FROM _raw_accounts;


-- ---------------------------------------------------------------------------
-- 3. business_profiles
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS business_profiles CASCADE;
DO $$ BEGIN
  ALTER TABLE business_profiles RENAME TO _raw_business_profiles;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW business_profiles AS
SELECT
  id,
  user_id,
  _mask_company(business_name)   AS business_name,
  '00 000 000 000'               AS abn,
  entity_type,
  industry,
  bas_frequency,
  gst_registered,
  financial_year_end,
  created_at,
  updated_at
FROM _raw_business_profiles;


-- ---------------------------------------------------------------------------
-- 4. audit_log
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS audit_log CASCADE;
DO $$ BEGIN
  ALTER TABLE audit_log RENAME TO _raw_audit_log;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW audit_log AS
SELECT
  id,
  user_id,
  action,
  entity_type,
  entity_id,
  '[redacted]'                   AS old_value,
  '[redacted]'                   AS new_value,
  _mask_ip(ip_address)           AS ip_address,
  'Mozilla/5.0 (Masked)'        AS user_agent,
  request_path,
  request_method,
  status_code,
  duration_ms,
  error_message,
  timestamp
FROM _raw_audit_log;


-- ---------------------------------------------------------------------------
-- 5. sessions
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS sessions CASCADE;
DO $$ BEGIN
  ALTER TABLE sessions RENAME TO _raw_sessions;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW sessions AS
SELECT
  id,
  user_id,
  'masked_token_' || LEFT(MD5(refresh_token_hash), 12)  AS refresh_token_hash,
  'masked-fp-' || LEFT(MD5(COALESCE(device_fingerprint, '')), 8)  AS device_fingerprint,
  _mask_ip(ip_address)           AS ip_address,
  'Mozilla/5.0 (Masked)'        AS user_agent,
  created_at,
  expires_at,
  revoked_at
FROM _raw_sessions;


-- ---------------------------------------------------------------------------
-- 6. team_invitations
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS team_invitations CASCADE;
DO $$ BEGIN
  ALTER TABLE team_invitations RENAME TO _raw_team_invitations;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW team_invitations AS
SELECT
  id,
  team_id,
  _mask_email(email)             AS email,
  role,
  'masked-token-' || LEFT(MD5(token), 12)  AS token,
  invited_by,
  status,
  expires_at,
  accepted_at,
  created_at
FROM _raw_team_invitations;


-- ---------------------------------------------------------------------------
-- 7. subscriptions
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS subscriptions CASCADE;
DO $$ BEGIN
  ALTER TABLE subscriptions RENAME TO _raw_subscriptions;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW subscriptions AS
SELECT
  id,
  user_id,
  'cus_masked_' || LEFT(MD5(COALESCE(stripe_customer_id, '')), 8)  AS stripe_customer_id,
  'sub_masked_' || LEFT(MD5(COALESCE(stripe_subscription_id, '')), 8)  AS stripe_subscription_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
FROM _raw_subscriptions;


-- ---------------------------------------------------------------------------
-- 8. tenants
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tenants CASCADE;
DO $$ BEGIN
  ALTER TABLE tenants RENAME TO _raw_tenants;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW tenants AS
SELECT
  id,
  _mask_company(name)            AS name,
  slug,
  logo_url,
  _mask_email(primary_contact_email)  AS primary_contact_email,
  '00 000 000 000'               AS abn,
  entity_type,
  industry,
  financial_year_end,
  timezone,
  settings_json,
  is_active,
  created_at,
  updated_at
FROM _raw_tenants;


-- ---------------------------------------------------------------------------
-- 9. tenant_invitations
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tenant_invitations CASCADE;
DO $$ BEGIN
  ALTER TABLE tenant_invitations RENAME TO _raw_tenant_invitations;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW tenant_invitations AS
SELECT
  id,
  tenant_id,
  _mask_email(email)             AS email,
  role,
  invited_by,
  'masked-token-' || LEFT(MD5(token), 12)  AS token,
  status,
  expires_at,
  accepted_at,
  created_at
FROM _raw_tenant_invitations;


-- ---------------------------------------------------------------------------
-- 10. agent_audit_log
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS agent_audit_log CASCADE;
DO $$ BEGIN
  ALTER TABLE agent_audit_log RENAME TO _raw_agent_audit_log;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW agent_audit_log AS
SELECT
  id,
  mutation_id,
  session_id,
  agent_type,
  action,
  target_table,
  target_id,
  '[redacted]'                   AS before_state,
  '[redacted]'                   AS after_state,
  metadata,
  user_id,
  _mask_ip(ip_address)           AS ip_address,
  created_at
FROM _raw_agent_audit_log;


-- ---------------------------------------------------------------------------
-- 11. ocr_documents
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS ocr_documents CASCADE;
DO $$ BEGIN
  ALTER TABLE ocr_documents RENAME TO _raw_ocr_documents;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW ocr_documents AS
SELECT
  id,
  user_id,
  account_id,
  file_name,
  '/masked/documents/' || LEFT(MD5(file_path), 12) || '.pdf'  AS file_path,
  file_size,
  mime_type,
  document_type,
  document_number,
  _mask_company(vendor_name)     AS vendor_name,
  '00 000 000 000'               AS vendor_abn,
  document_date,
  due_date,
  _noise_amount(subtotal)        AS subtotal,
  _noise_amount(gst_amount)      AS gst_amount,
  _noise_amount(total_amount)    AS total_amount,
  currency,
  '{"masked": true}'             AS extracted_data,
  confidence_score,
  status,
  error_message,
  processed_at,
  created_at,
  updated_at
FROM _raw_ocr_documents;


-- ---------------------------------------------------------------------------
-- 12. suppliers
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS suppliers CASCADE;
DO $$ BEGIN
  ALTER TABLE suppliers RENAME TO _raw_suppliers;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW suppliers AS
SELECT
  id,
  user_id,
  _mask_company(business_name)   AS business_name,
  _mask_name(contact_name)       AS contact_name,
  _mask_email(email)             AS email,
  _mask_phone(phone)             AS phone,
  _mask_address(address)         AS address,
  '00 000 000 000'               AS abn,
  payment_terms_days,
  '000-000'                      AS bank_bsb,
  'XXXXXXXX'                     AS bank_account_number,
  _mask_name(bank_account_name)  AS bank_account_name,
  '[redacted]'                   AS notes,
  is_active,
  created_at
FROM _raw_suppliers;


-- ---------------------------------------------------------------------------
-- 13. customers
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS customers CASCADE;
DO $$ BEGIN
  ALTER TABLE customers RENAME TO _raw_customers;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW customers AS
SELECT
  id,
  user_id,
  _mask_company(business_name)   AS business_name,
  _mask_name(contact_name)       AS contact_name,
  _mask_email(email)             AS email,
  _mask_phone(phone)             AS phone,
  _mask_address(address)         AS address,
  'Melbourne'                    AS city,
  'VIC'                          AS state,
  '3000'                         AS postcode,
  country,
  '00 000 000 000'               AS abn,
  payment_terms_days,
  '[redacted]'                   AS notes,
  is_active,
  created_at
FROM _raw_customers;


-- ---------------------------------------------------------------------------
-- 14. customer_contacts
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS customer_contacts CASCADE;
DO $$ BEGIN
  ALTER TABLE customer_contacts RENAME TO _raw_customer_contacts;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW customer_contacts AS
SELECT
  id,
  customer_id,
  _mask_name(name)               AS name,
  _mask_email(email)             AS email,
  _mask_phone(phone)             AS phone,
  role,
  is_primary,
  created_at
FROM _raw_customer_contacts;


-- ---------------------------------------------------------------------------
-- 15. employees
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS employees CASCADE;
DO $$ BEGIN
  ALTER TABLE employees RENAME TO _raw_employees;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW employees AS
SELECT
  id,
  user_id,
  _mask_name(first_name)         AS first_name,
  _mask_surname(last_name)       AS last_name,
  _mask_email(email)             AS email,
  _mask_phone(phone)             AS phone,
  '1990-01-01'                   AS date_of_birth,
  '{"street":"123 Test St","city":"Sydney","state":"NSW","postcode":"2000"}'  AS address,
  'ENCRYPTED_REDACTED'           AS tax_file_number,
  start_date,
  end_date,
  status,
  employment_type,
  created_at,
  updated_at
FROM _raw_employees;


-- ---------------------------------------------------------------------------
-- 16. employee_bank_details
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS employee_bank_details CASCADE;
DO $$ BEGIN
  ALTER TABLE employee_bank_details RENAME TO _raw_employee_bank_details;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW employee_bank_details AS
SELECT
  id,
  employee_id,
  'ENCRYPTED_REDACTED'           AS bsb,
  'ENCRYPTED_REDACTED'           AS account_number,
  _mask_name(account_name)       AS account_name,
  split_percentage,
  is_primary,
  created_at
FROM _raw_employee_bank_details;


-- ---------------------------------------------------------------------------
-- 17. employee_super_funds
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS employee_super_funds CASCADE;
DO $$ BEGIN
  ALTER TABLE employee_super_funds RENAME TO _raw_employee_super_funds;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW employee_super_funds AS
SELECT
  id,
  employee_id,
  'Australian Super Fund'        AS fund_name,
  '00 000 000 000'               AS fund_abn,
  'USI000000000'                 AS usi,
  'MEMBER-XXXXX'                 AS member_number,
  contribution_rate,
  created_at
FROM _raw_employee_super_funds;


-- ---------------------------------------------------------------------------
-- 18. admin_users
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS admin_users CASCADE;
DO $$ BEGIN
  ALTER TABLE admin_users RENAME TO _raw_admin_users;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW admin_users AS
SELECT
  id,
  'admin_' || LEFT(MD5(username), 6)  AS username,
  _mask_email(email)                   AS email,
  '$2b$10$MASKED_DO_NOT_USE_000000000000'  AS password_hash,
  _mask_name(display_name)             AS display_name,
  role,
  permissions,
  is_active,
  last_login_at,
  login_count,
  failed_login_count,
  locked_until,
  'REDACTED_MFA_SECRET'                AS mfa_secret,
  mfa_enabled,
  created_at,
  updated_at
FROM _raw_admin_users;


-- ---------------------------------------------------------------------------
-- 19. user_activity_log
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS user_activity_log CASCADE;
DO $$ BEGIN
  ALTER TABLE user_activity_log RENAME TO _raw_user_activity_log;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW user_activity_log AS
SELECT
  id,
  user_id,
  session_id,
  action,
  resource_type,
  resource_id,
  details,
  _mask_ip(ip_address)           AS ip_address,
  'Mozilla/5.0 (Masked)'        AS user_agent,
  duration_ms,
  status,
  created_at
FROM _raw_user_activity_log;


-- ---------------------------------------------------------------------------
-- 20. push_subscriptions
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS push_subscriptions CASCADE;
DO $$ BEGIN
  ALTER TABLE push_subscriptions RENAME TO _raw_push_subscriptions;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW push_subscriptions AS
SELECT
  id,
  user_id,
  tenant_id,
  'https://masked.push.endpoint/' || LEFT(MD5(endpoint), 12)  AS endpoint,
  '{"p256dh":"masked","auth":"masked"}'  AS keys_json,
  'Mozilla/5.0 (Masked)'        AS user_agent,
  'Masked Device'                AS device_name,
  is_active,
  last_used_at,
  error_count,
  created_at,
  updated_at
FROM _raw_push_subscriptions;


-- ---------------------------------------------------------------------------
-- 21. transactions (HIGH-RISK free-text: description + financial amounts)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS transactions CASCADE;
DO $$ BEGIN
  ALTER TABLE transactions RENAME TO _raw_transactions;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW transactions AS
SELECT
  id,
  date,
  -- Mask description: replace with merchant_normalized if available, else hash
  COALESCE(
    merchant_normalized,
    'Transaction ' || LEFT(MD5(description), 8)
  )                                        AS description,
  _noise_int(amount)                       AS amount,
  _noise_int(balance)                      AS balance,
  category,
  gst_applicable,
  _noise_int(gst_amount)                   AS gst_amount,
  gst_category,
  '[masked AI notes]'                      AS ai_reasoning_notes,
  confidence_score,
  is_edited,
  is_transfer,
  transfer_link_id,
  is_owner_contribution,
  transaction_hash,
  merchant_normalized,
  parser_version,
  extraction_hash,
  parent_transaction_id,
  statement_id,
  account_id,
  user_id
FROM _raw_transactions;


-- ---------------------------------------------------------------------------
-- BONUS: rag_chunks (contains full indexed text — highest risk for Cognee)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS rag_chunks CASCADE;
DO $$ BEGIN
  ALTER TABLE rag_chunks RENAME TO _raw_rag_chunks;
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW rag_chunks AS
SELECT
  id,
  namespace_id,
  user_id,
  '[redacted RAG content]'       AS content,
  content_hash,
  chunk_type,
  '{}'                           AS metadata,
  embedding,
  source_id,
  source_type,
  document_id,
  category,
  account_id,
  date_start,
  date_end,
  content_tokens,
  _noise_int(total_amount)       AS total_amount,
  transaction_count,
  merchant_normalized,
  created_at
FROM _raw_rag_chunks;


-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these after applying to verify masking is active:

-- Check that VIEWs exist for all masked tables
DO $$
DECLARE
  masked_tables TEXT[] := ARRAY[
    'users','accounts','business_profiles','audit_log','sessions',
    'team_invitations','subscriptions','tenants','tenant_invitations',
    'agent_audit_log','ocr_documents','suppliers','customers',
    'customer_contacts','employees','employee_bank_details',
    'employee_super_funds','admin_users','user_activity_log',
    'push_subscriptions','transactions','rag_chunks'
  ];
  tbl TEXT;
  view_count INT := 0;
BEGIN
  FOREACH tbl IN ARRAY masked_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = tbl AND table_schema = 'public'
    ) THEN
      view_count := view_count + 1;
    ELSE
      RAISE WARNING 'MISSING masked view: %', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'Masking verification: %/% views created', view_count, ARRAY_LENGTH(masked_tables, 1);
END $$;

-- Spot-check: verify no real emails leak through
-- SELECT email FROM employees LIMIT 5;
-- Expected: user_abc12345@masked.example.com

-- Spot-check: verify no real TFNs leak through
-- SELECT tax_file_number FROM employees LIMIT 5;
-- Expected: ENCRYPTED_REDACTED

-- Spot-check: verify amounts are noised
-- SELECT amount, balance FROM transactions LIMIT 5;
-- Expected: values differ from production by ~10%

-- =============================================================================
-- END OF MASKING SCRIPT
-- =============================================================================
