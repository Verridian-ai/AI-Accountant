# D02: Security & Compliance Review — Waves 1–10

**Reviewer**: Agent D02 (Security & Compliance Specialist)
**Date**: 2026-02-13
**Scope**: All 10 wave orchestration prompts + security-critical agent task files
**Methodology**: Reviewed authentication, encryption, AU regulatory compliance, audit trails, input validation, and session security across all planned waves.

---

## 1. Critical Vulnerabilities (CRITICAL Severity)

### CRIT-01: No Authentication Layer — All Endpoints Are Unauthenticated
**Affected**: Waves 1–10 (ALL waves)
**Finding**: None of the 10 wave plans specify an authentication middleware or user identity system. The existing codebase has no JWT/session auth on API endpoints. Every new endpoint (130+ across all waves) will be publicly accessible.
- Wave 1 adds `POST /api/chat` — intent routing, but no user identity verification
- Wave 2 adds mutation confirm/reject endpoints — anyone can confirm/reject mutations
- Wave 4 adds payroll endpoints with TFN data — sensitive PII accessible without auth
- Wave 6 adds STP endpoints with ATO-reportable data — no auth check before generating STP XML
- Wave 8 adds payment gateway endpoints — payment processing with no identity verification
- Wave 10 adds bill approval and supplier payment runs — unauthorized users could approve payments

**Risk**: Complete data breach exposure. Any network-accessible client can read employee TFNs, trigger payments, approve payroll, and submit ATO reports.
**Recommendation**: Add an authentication wave (or pre-wave) that implements:
1. JWT-based auth with refresh tokens (Wave 1 schema already has `sessions` table — wire it)
2. Auth middleware applied to ALL `/api/*` routes
3. User ID extracted from JWT and passed to service layer
4. Role-based access control (admin, accountant, employee, viewer) at minimum

### CRIT-02: Agent Mutation Framework Lacks User Identity Binding
**Affected**: Wave 2
**Finding**: The `agent_mutations` table has `session_id` but the `agent_sessions` table has `user_id` as **NULL** (optional). The confirm/reject endpoints (`POST /api/chat/confirm/:actionId` and `POST /api/chat/reject/:actionId`) do not specify any user identity validation. Any client with the action ID can confirm a mutation.
- The mutation-auth.ts specifies agent-to-table permissions but **not user-to-data permissions**
- There is no check that the user confirming a mutation is the same user who owns the data being mutated

**Risk**: Cross-user mutation attacks. User B could confirm a mutation that alters User A's transactions.
**Recommendation**:
1. Make `agent_sessions.user_id` NOT NULL
2. Validate that the confirming user owns the session that proposed the mutation
3. Add row-level security checks in `executeMutation()` to verify user owns target records

### CRIT-03: Cognee Password Stored in Application DB — Credential Exposure
**Affected**: Wave 3
**Finding**: The `cognee_user_accounts` table stores `cogneePasswordHash (encrypted)` — but the task file for Agent 2 shows the system creates Cognee accounts via `POST /api/v1/users` with `{ username: email, password }`. This means:
1. The actual Cognee password must be stored in plaintext or reversibly encrypted (not hashed) to authenticate later
2. The `userTokenCache` in CogneeClient stores bearer tokens in-memory with expiry — but no mention of token rotation or revocation
3. If the server process is compromised, all Cognee user credentials are exposed

**Risk**: Full Cognee knowledge base compromise. Attacker gains all user tokens and can read/modify all indexed financial data.
**Recommendation**:
1. Use Cognee's OAuth2/API key flow instead of storing user passwords
2. If password auth is required, implement proper token refresh with short-lived tokens (< 15 min)
3. Store refresh tokens encrypted, not passwords
4. Add token revocation on user logout/session expiry

### CRIT-04: STP XML Contains Plaintext TFNs
**Affected**: Wave 6
**Finding**: The STP event generator (`stp-service.ts`) builds XML with `<TFN>{tfn}</TFN>` where `tfn` is the decrypted Tax File Number. The `xmlPayload` column in `stp_events` stores this XML as **plaintext TEXT** in PostgreSQL.
- This means TFNs are encrypted in the `employees` table but **decrypted and stored in plaintext** in the STP events table
- Any SQL query on `stp_events.xmlPayload` reveals all employee TFNs
- The `GET /api/payroll/stp/events` endpoint returns events — unclear if XML payload is included in list responses

**Risk**: TFN mass exposure via STP events table. Bypasses the entire TFN encryption system from Wave 4.
**Recommendation**:
1. Encrypt `stp_events.xmlPayload` at rest using the same AES-256-GCM encryption utility
2. Decrypt only when submitting to ATO or when explicitly viewing event detail (with auth check)
3. Never include XML payload in list endpoint responses — only in detail view with explicit user authorization
4. Add audit logging for every TFN decryption operation

### CRIT-05: Payment Gateway API Keys Stored in Plaintext JSON
**Affected**: Wave 8
**Finding**: The `payment_gateways.config` column stores gateway credentials as JSON TEXT. The task file says "encrypted at rest by DB" but there is **no column-level encryption in PostgreSQL**, and the application code uses `JSON.stringify` without any encryption wrapper.
- Stripe secret keys, webhook secrets, and PayPal credentials stored as plaintext JSON
- `listGateways()` masks config in responses, but the DB contains plaintext
- No mention of using the Wave 4 encryption utility (`encryptField`/`decryptField`) for gateway configs

**Risk**: Payment credential theft. Database dump or SQL injection exposes all payment gateway API keys, enabling unauthorized charges/refunds.
**Recommendation**:
1. Encrypt `config` field using `encryptField()` from Wave 4's encryption.ts before storage
2. Decrypt only in `getGatewayConfig()` when needed for payment processing
3. Use a separate encryption key (`PAYMENT_GATEWAY_ENCRYPTION_KEY`) — not the TFN key
4. Implement key rotation capability

---

## 2. Compliance Gaps (HIGH Severity)

### COMP-01: STP Phase 2 Missing Required Fields
**Affected**: Wave 6
**Finding**: The STP XML structure in the orchestration prompt and task file is simplified and missing several ATO Phase 2 mandatory fields:
- **Missing**: `IncomeStreamCode` (required per employee — SAW, CHP, SWP, etc.)
- **Missing**: `TaxTreatmentCode` (6-character code: RTSFFP for regular full-time, etc.)
- **Missing**: `WorkConditions` (exempt/non-exempt from OTE)
- **Missing**: `PaymentFrequency` (weekly/fortnightly/monthly — must match pay run frequency)
- **Missing**: `PayeeBirthDate` (mandatory for Phase 2)
- **Missing**: `PayeeResidenceCountry` (default 'AU' but still required)
- **Missing**: `CountryCode` for address (mandatory for Phase 2)
- **Missing**: Disaggregation of gross: `GrossPayments` must be broken into `OrdinaryTimeEarnings`, `OvertimePayments`, `BonusesCommissions`, `DirectorsFeesPayments`, `PaidLeave`, `AllowancesIncome`

**Risk**: ATO rejection of STP submissions. Non-compliance penalties.
**Recommendation**: Audit the complete ATO STP Phase 2 specification and ensure all mandatory fields are present. Add `income_stream_code` and `tax_treatment_code` columns to the `employees` table or a new `stp_employee_config` table.

### COMP-02: Super Guarantee Rate Hardcoded — No FY Awareness
**Affected**: Waves 4, 5
**Finding**: The super guarantee rate is specified as "11.5%" throughout but:
- The rate changes annually (was 11% FY2023-24, 11.5% FY2024-25, will be 12% from FY2025-26)
- The plans hardcode the rate rather than making it configurable or FY-aware
- No `super_rates` table or configuration for historical/future rates
- The `check_super_compliance` tool checks "minimum 11.5%" — this will be **wrong** for FY2025-26 (should be 12%)

**Risk**: Incorrect super calculations for different financial years. ATO compliance breach for underpaid super.
**Recommendation**:
1. Create a `super_guarantee_rates` table with `financial_year`, `rate`, `max_quarterly_base`
2. Seed with historical and known future rates
3. Always look up rate by FY period, never hardcode

### COMP-03: PAYG Tax Tables Hardcoded for Single FY
**Affected**: Wave 5
**Finding**: PAYG withholding tax tables are specified for "FY2024-25" only. The system has no mechanism to:
- Store multiple years of tax tables
- Automatically select the correct table based on pay date
- Handle the transition period when a pay run spans FY boundaries

**Risk**: Incorrect PAYG withholding in future years (system will continue using 2024-25 rates).
**Recommendation**:
1. Create a `tax_tables` database table with `financial_year`, `bracket_start`, `bracket_end`, `base_tax`, `rate`, `medicare_threshold`
2. Load tax tables per FY, not hardcoded in source code
3. Select tax table based on pay date, not build date

### COMP-04: No ABN Validation for Suppliers
**Affected**: Wave 10
**Finding**: The `suppliers` table has an `abn` column but:
- No ABN format validation (11-digit check) is specified in the endpoints or Zod schemas
- No ABN lookup against the ABR (Australian Business Register) to verify legitimacy
- The existing ABN lookup service (`services/enrichment/abn-lookup.ts`) is not referenced by Wave 10

**Risk**: Invalid ABN storage, potential GST input credit issues if supplier ABNs are invalid.
**Recommendation**:
1. Add ABN format validation (mod-89 check digit algorithm) to the supplier creation Zod schema
2. Integrate with the existing ABN lookup service for real-time ABR verification
3. Warn (not block) when ABN lookup fails — ABR may be temporarily unavailable

### COMP-05: Pay Run Modification After Processing
**Affected**: Wave 5
**Finding**: The pay run lifecycle is `draft → calculate → process → complete`, with a `reverse` option. However:
- There is no explicit immutability enforcement after a pay run is processed
- The `PATCH /api/payroll/pay-runs/:id` endpoint does not check if status is 'completed'
- No audit trail specifically for pay run modifications
- If a processed pay run is modified, STP events already submitted for that period would be inconsistent

**Risk**: Retrospective pay run manipulation without audit trail. STP data integrity compromise.
**Recommendation**:
1. Enforce status-based immutability: only 'draft' pay runs can be modified via PATCH
2. Processed/completed pay runs can only be reversed, not edited
3. Log all pay run state transitions in the audit trail (Wave 2's `agent_audit_log` or a dedicated payroll audit table)

### COMP-06: Invoice Numbering Integrity — Not Tamper-Proof
**Affected**: Wave 7
**Finding**: The `invoice_number_sequences` table stores `nextNumber` as an incrementing integer. However:
- No gap detection (if a number is skipped, there's no alert)
- No protection against concurrent race conditions (two simultaneous invoice creations could get the same number or skip a number)
- ATO requires sequential invoice numbering for tax invoices — gaps can trigger audit flags
- No check that invoice numbers cannot be reassigned after void

**Risk**: Non-sequential invoice numbers could trigger ATO audit. Potential for invoice number manipulation.
**Recommendation**:
1. Use `SELECT ... FOR UPDATE` (PostgreSQL advisory locks) when generating invoice numbers to prevent races
2. Add gap detection: log any gaps in invoice number sequence
3. Voided invoices keep their number — void status is preserved, not deleted

---

## 3. Security Improvements (MEDIUM Severity)

### SEC-01: Graceful Degradation to Plaintext — TFN Encryption Fallback
**Affected**: Wave 4
**Finding**: The encryption utility (`encryption.ts`) has a "graceful degradation" mode where if `TFN_ENCRYPTION_KEY` is not set, it stores data with `[UNENCRYPTED]` prefix in plaintext. While labeled a development convenience:
- This means a misconfigured production environment silently stores TFNs in plaintext
- No startup check forces the encryption key to be present
- No monitoring/alerting when encryption is disabled

**Recommendation**:
1. In production mode (`NODE_ENV=production`), throw on missing encryption key — fail fast
2. Add a health check endpoint that reports encryption status
3. Log a **CRITICAL** warning on every unencrypted write (not just a console.warn at startup)

### SEC-02: SSE Streams Not Authenticated
**Affected**: Waves 1, 2
**Finding**: The new SSE streaming endpoint (`POST /api/chat/stream`) and the existing `GET /api/events` have no authentication mechanism. SSE connections are long-lived and could be used for:
- Session hijacking (reading real-time mutation proposals for other users)
- Information leakage (streaming agent responses contain financial data)
- Resource exhaustion (unlimited SSE connections)

**Recommendation**:
1. Require a session token in the SSE connection request (cookie or query parameter)
2. Validate session on connection and close stream if session expires
3. Limit concurrent SSE connections per user (e.g., max 5)
4. Add connection timeout (max 30 minutes)

### SEC-03: CSRF Protection Not Specified
**Affected**: Waves 1–10 (ALL waves)
**Finding**: No wave plan mentions CSRF protection for mutation endpoints. The system uses `POST` for state-changing operations (good), but:
- No CSRF token generation or validation
- No `SameSite` cookie attribute specified
- No `Origin` header checking

**Recommendation**:
1. Implement CSRF tokens for all mutation endpoints
2. Set `SameSite=Strict` on session cookies
3. Validate `Origin` and `Referer` headers on POST/PATCH/DELETE requests

### SEC-04: File Upload Sanitization Missing
**Affected**: Wave 9 (Logo Upload), Wave 6 (Payslip PDF)
**Finding**: Wave 9 adds `POST /api/invoice-templates/:id/logo` for logo upload but:
- No file type validation (could upload malicious scripts)
- No file size limits specified
- No content-type verification
- Storage path (`server/uploads/`) is not sanitized against path traversal
- Wave 6 stores payslip PDFs at `pdfPath` — no path validation

**Recommendation**:
1. Validate file MIME type (accept only image/png, image/jpeg, image/svg+xml)
2. Enforce file size limits (e.g., 2MB for logos)
3. Use content-type detection (magic bytes), not just extension
4. Sanitize filenames and use UUIDs for storage paths
5. Serve uploaded files through a proxy route, not direct filesystem access

### SEC-05: Supplier Bank Account Encryption Key Reuse
**Affected**: Wave 10
**Finding**: Wave 10 specifies supplier bank account numbers should be "encrypted at application level" but uses the same `TFN_ENCRYPTION_KEY` from Wave 4 for bank account encryption. Using the same key for different data classes:
- Increases blast radius if the key is compromised
- Makes key rotation more complex (must re-encrypt all data types simultaneously)

**Recommendation**:
1. Use separate encryption keys: `TFN_ENCRYPTION_KEY`, `BANK_ENCRYPTION_KEY`, `GATEWAY_ENCRYPTION_KEY`
2. Alternatively, use the same key but different "context" strings in the GCM additional authenticated data (AAD) parameter to cryptographically separate the key domains

### SEC-06: Rate Limiting Not Specified for Sensitive Endpoints
**Affected**: Waves 1–10
**Finding**: While the existing codebase has a rate limiter (from the audit remediation), none of the wave plans reference rate limiting for new sensitive endpoints:
- `POST /api/chat` and `/api/chat/stream` — AI inference calls (expensive, should be rate-limited)
- `POST /api/payroll/stp/submit/:eventId` — ATO submission (should be rate-limited to prevent accidental double submissions)
- `POST /api/payments/process/:invoiceId` — Payment processing (critical to rate limit)
- `POST /api/cognee/init-user` — User creation (abuse vector)

**Recommendation**:
1. Apply tiered rate limiting: general endpoints (100 req/min), sensitive endpoints (10 req/min), AI endpoints (20 req/min)
2. Implement idempotency keys for payment and STP submission endpoints
3. Add retry-after headers on rate limit responses

### SEC-07: Audit Log Querying — Information Disclosure Risk
**Affected**: Wave 2
**Finding**: The `GET /api/agent-audit` endpoint allows querying audit logs with filters but:
- No user scoping — could return audit entries for all users
- Before/after state snapshots may contain sensitive data (TFNs, bank details)
- No access control (who can view audit logs?)

**Recommendation**:
1. Scope audit queries to the authenticated user's data
2. Redact sensitive fields (TFN, bank numbers) in audit log before/after snapshots
3. Restrict audit log access to admin role

### SEC-08: Three-Way Match Tolerance — Financial Control Risk
**Affected**: Wave 10
**Finding**: The three-way matching logic specifies an `AP_AUTO_MATCH_THRESHOLD` tolerance but:
- No maximum tolerance specified (could an admin set 100% tolerance, bypassing all matching?)
- No separation of duties enforcement (same person can create PO, receive goods, and approve bill)
- `POST /api/purchase-orders/:id/receive` and `POST /api/bills/:id/approve` have no requirement for different users

**Recommendation**:
1. Cap `AP_AUTO_MATCH_THRESHOLD` at a reasonable maximum (e.g., 5% or $50)
2. Implement separation of duties: PO creator, goods receiver, and bill approver must be different users
3. Require dual approval for bills above a configurable threshold

### SEC-09: Cognee Multi-User Dataset Prefix — Enumeration Risk
**Affected**: Wave 3
**Finding**: The dataset prefix pattern is `user_{userId}_` + dataset name. If user IDs are sequential or predictable:
- An attacker could enumerate other users' dataset names
- Cognee search with a guessed prefix could return another user's data if isolation is only prefix-based (not auth-based)

**Recommendation**:
1. Use opaque, non-sequential user identifiers (UUID) in dataset prefixes
2. Enforce Cognee-level authentication (not just prefix naming) for data isolation
3. The Wave 3 plan correctly enables `REQUIRE_AUTHENTICATION=true` in Cognee — verify this is enforced at the dataset level, not just the API level

### SEC-10: No Input Sanitization for Chat Queries — Prompt Injection Risk
**Affected**: Wave 1
**Finding**: The intent router sends user chat queries directly to Claude Haiku for classification. No sanitization is performed on the user input before it's embedded in the system prompt:
- Prompt injection could cause the intent router to classify malicious queries as legitimate agent invocations
- A crafted query could trick the agent dispatcher into invoking tools with attacker-controlled parameters
- `extractedParams` in `IntentClassification` are extracted from user input and passed to agents

**Recommendation**:
1. Sanitize user input before sending to the intent router (strip control characters, limit length)
2. Validate `extractedParams` against a schema before passing to agents
3. Use structured output mode (JSON schema) for intent classification to prevent freeform injection
4. Implement a "sandbox" mode where agents operate on read-only copies before user confirmation

---

## 4. Per-Wave Security Verdict

| Wave | Focus | Verdict | Key Issues |
|------|-------|---------|------------|
| **Wave 1** | Chat→Agent Bridge & Intent Routing | **NEEDS HARDENING** | No auth on endpoints (CRIT-01), no prompt injection mitigation (SEC-10), unauthenticated SSE (SEC-02) |
| **Wave 2** | Transaction Mutation & Streaming | **NEEDS HARDENING** | Mutation confirm/reject without user binding (CRIT-02), audit log disclosure (SEC-07), no CSRF (SEC-03) |
| **Wave 3** | Multi-User Cognee | **NEEDS HARDENING** | Cognee password storage (CRIT-03), dataset prefix enumeration (SEC-09), but correctly enables Cognee auth |
| **Wave 4** | Employee Management & Pay Structures | **PARTIALLY SECURE** | Good TFN encryption spec (AES-256-GCM), but graceful degradation to plaintext is dangerous (SEC-01); key reuse risk (SEC-05) |
| **Wave 5** | Pay Run Processing & Leave | **NEEDS HARDENING** | No pay run immutability enforcement (COMP-05), hardcoded super rate (COMP-02), hardcoded tax tables (COMP-03) |
| **Wave 6** | STP Compliance | **NEEDS HARDENING** | Plaintext TFNs in STP XML payload (CRIT-04), incomplete STP Phase 2 fields (COMP-01), no ATO cert management |
| **Wave 7** | Customer Management & Invoicing | **PARTIALLY SECURE** | Invoice numbering race condition (COMP-06), but good use of pdf-lib (no Chromium attack surface) |
| **Wave 8** | Recurring Invoices & Payments | **NEEDS HARDENING** | Plaintext payment gateway API keys (CRIT-05), no rate limiting on payment processing (SEC-06), no idempotency |
| **Wave 9** | AR Aging & Multi-Currency | **PARTIALLY SECURE** | File upload needs sanitization (SEC-04), exchange rate API needs validation, but lower risk surface |
| **Wave 10** | Accounts Payable & POs | **NEEDS HARDENING** | No ABN validation (COMP-04), no separation of duties (SEC-08), supplier bank encryption key reuse (SEC-05) |

---

## 5. Summary of Recommendations

### Mandatory (Must Do Before Production)

1. **Implement authentication middleware** before Wave 1 endpoints go live (CRIT-01)
2. **Bind mutations to authenticated users** with ownership verification (CRIT-02)
3. **Encrypt STP XML payload** at rest — TFNs must never be plaintext in DB (CRIT-04)
4. **Encrypt payment gateway configs** using the existing encryption utility (CRIT-05)
5. **Fail fast on missing encryption keys** in production — no graceful degradation (SEC-01)
6. **Add complete STP Phase 2 fields** per ATO specification (COMP-01)
7. **Make super guarantee rate configurable** by financial year (COMP-02)

### Strongly Recommended (Should Do)

8. **CSRF tokens** on all mutation endpoints (SEC-03)
9. **Rate limiting** on AI, payment, and STP endpoints (SEC-06)
10. **File upload validation** with MIME checking and size limits (SEC-04)
11. **Separate encryption keys** per data class (SEC-05)
12. **Invoice number locking** with PostgreSQL advisory locks (COMP-06)
13. **ABN format validation** with optional ABR lookup (COMP-04)
14. **Pay run immutability** after processing (COMP-05)

### Nice to Have (Recommended)

15. **Prompt injection mitigation** for intent router (SEC-10)
16. **Audit log redaction** of sensitive fields (SEC-07)
17. **Dataset isolation verification** beyond prefix naming (SEC-09)
18. **Separation of duties** for AP approval workflow (SEC-08)
19. **Cognee OAuth2 integration** instead of password storage (CRIT-03)
20. **Configurable PAYG tax tables** by financial year (COMP-03)

---

## 6. Cross-Wave Systemic Issues

### Issue A: Authentication Debt
The entire 10-wave architecture assumes a trusted client. There is no authentication, authorization, or user identity system planned across any wave. This is the single largest security risk. A "Wave 0.5: Auth Foundation" should be inserted before Wave 1 or integrated into Wave 1.

### Issue B: Encryption Key Management
Four types of sensitive data need encryption (TFNs, bank accounts, payment gateway keys, STP XML), but only one encryption key is planned (`TFN_ENCRYPTION_KEY`). A proper key management strategy is needed.

### Issue C: Australian Privacy Act Compliance
Under the Privacy Act 1988 and Australian Privacy Principles (APPs), GoldLedger handles:
- TFNs (APP 9 — special restriction)
- Employee personal information (APP 3, 6, 11)
- Financial data (APP 11 — security)
- Business information (APP 6 — use/disclosure)

A privacy impact assessment should be conducted before the payroll features (Waves 4-6) go live.

### Issue D: No Security Testing Wave
None of the 10 waves include penetration testing, security scanning (SAST/DAST), or dependency vulnerability checking (npm audit). A security testing wave should follow the main development waves.

---

*End of Security & Compliance Review*
*Agent D02 — GoldLedger Wave 0B Meta-Planning Team*
