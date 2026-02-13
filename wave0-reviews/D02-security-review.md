# D02: Security & Compliance Review — Waves 11–24

**Reviewer**: Agent D02 — Security & Compliance
**Date**: 2026-02-12
**Scope**: All 14 wave orchestration prompts (Waves 11–24), research R02 (Cognee), R09 (Docker)
**Classification**: CONFIDENTIAL — Contains security findings

---

## 1. CRITICAL SECURITY ISSUES (RED)

### CRIT-01: Cognee Authentication & Access Control Disabled Until Wave 23 [HIGH]
**Waves Affected**: 11–22 (ALL waves before Wave 23)
**Finding**: `REQUIRE_AUTHENTICATION=false` and `ENABLE_BACKEND_ACCESS_CONTROL=false` remain in effect for 12 consecutive waves. Any service on the Docker network — or anyone with access to port 8000 — can read, modify, or delete ANY Cognee dataset. As waves 11–22 add ~20 new Cognee datasets containing increasingly sensitive financial data (inventory, assets, entities, financial reports, budgets, forecasts, compliance records, OCR documents, payment matches, CDR products, market data), the blast radius grows with each wave.
**Severity**: HIGH
**Recommendation**: Multi-user Cognee isolation MUST be brought forward from Wave 23 to **before Wave 11 starts**, or at minimum, restrict Cognee port 8000 from host exposure immediately, and enable Cognee authentication with a single service-to-service token for the CBA server.

### CRIT-02: Hardcoded Cognee Default Credentials in Source Code [HIGH]
**Waves Affected**: All
**Finding**: R02 documents hardcoded default credentials: `admin@cognee-cba.dev` / `CbaAdmin2026` in `cognee_client.ts`. These credentials are committed to source control, visible to any developer, and are the only Cognee authentication in use. Even when authentication is enabled in Wave 23, these stale credentials could remain a backdoor if not rotated.
**Severity**: HIGH
**Recommendation**: Move credentials to environment variables immediately. When Cognee auth is enabled, generate per-service credentials and rotate the defaults.

### CRIT-03: No Encryption at Rest for Financial Data [HIGH]
**Waves Affected**: All
**Finding**: Across all 14 waves, no plan mentions encryption at rest for PostgreSQL, Redis, or Cognee data volumes. By Wave 24, the database will contain: bank account numbers, BSBs, ABNs, ACNs, TFNs (Wave 12 `entities` table), payroll data with TFN withholding (Wave 15 compliance), OCR-extracted bank statements and receipts (Wave 14), and CDR product credentials. None of this is encrypted at the volume or column level. PostgreSQL `postgres-data` volume is plain-text on disk.
**Severity**: HIGH
**Recommendation**: Enable PostgreSQL TDE (Transparent Data Encryption) or volume-level encryption (LUKS). For highly sensitive columns (TFN, BSB, account numbers), implement application-level AES-256-GCM encryption before storage.

### CRIT-04: TFN Stored in Plaintext in `entities` Table [HIGH]
**Wave Affected**: 12
**Finding**: Wave 12 defines `entities` table with a `tfn` column (Tax File Number). TFNs are classified as **protected information** under the Taxation Administration Act 1953 (Section 8WA). Storing TFNs in plaintext violates ATO TFN guidelines. Unauthorized disclosure carries penalties up to $12,600 per offense. Additionally, ABN and ACN are stored in plaintext — less severe but still sensitive.
**Severity**: HIGH
**Recommendation**: TFN must be encrypted at rest with AES-256. Access must be logged via audit trail. TFN display must be masked (show only last 3 digits). Create a dedicated `sensitive_data` table with column-level encryption and strict access control.

### CRIT-05: Admin Backend Has No RBAC Until Wave 23 [HIGH]
**Waves Affected**: 20 (Admin), 21, 22
**Finding**: Wave 20 builds a full admin backend with user management, agent configuration, Docker service restart, feature flags, and Cognee graph pruning — but Wave 23 (RBAC) comes 3 waves later. This means the admin backend operates with only basic JWT auth (from Wave 20's `admin-auth.ts`) with no proper role-permission matrix, no permission checks on individual operations, and the `/api/admin/docker/services/:name/restart` endpoint could be used to DoS the platform.
**Severity**: HIGH
**Recommendation**: RBAC (Wave 23) must be planned as a hard prerequisite for the admin backend (Wave 20). At minimum, Wave 20 must implement a simple role check middleware (super_admin/admin/viewer) before exposing admin endpoints.

### CRIT-06: Secrets in Docker Environment Variables — No Secrets Management [HIGH]
**Waves Affected**: All
**Finding**: All API keys (`ANTHROPIC_API_KEY`, `VITE_OPENROUTER_API_KEY`, `GOOGLE_AI_STUDIO_KEY`, `ABNLOOKUP_GUID`, `GOOGLE_API_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`) are stored in `.env` files and passed as plain environment variables. Docker environment variables are visible via `docker inspect`, in build layers, and in process listings. No wave plans Docker secrets, HashiCorp Vault, or any secrets management solution.
**Severity**: HIGH
**Recommendation**: Migrate to Docker secrets for all sensitive values. Use `_FILE` environment variable pattern (read from mounted secret file). For production, integrate with a secrets manager (Vault, AWS Secrets Manager, or GCP Secret Manager).

---

## 2. DATA ISOLATION

### ISO-01: Cognee Dataset Isolation Not Planned Until Wave 23 [HIGH]
**Finding**: Wave 23 plans to prefix Cognee datasets with `{tenantId}_transactions`, `{tenantId}_invoices`, etc. However, Waves 11–22 create ~20 new Cognee datasets (`inventory_catalog`, `stock_movements`, `recon_patterns`, `asset_register`, `depreciation_schedules`, `entity_hierarchy`, `financial_reports`, `budget_templates`, `ocr_extractions`, `matching_patterns`, `forecast_patterns`, `anomaly_history`, `compliance_rulings`, `cdr_products`, `market_intelligence`, `market_sentiment`, etc.) without any tenant scoping. When Wave 23 enables isolation, ALL existing datasets will need migration to tenant-prefixed names.
**Recommendation**: Adopt tenant-prefix convention from Wave 11 onward, even in single-tenant mode. Use `default_` prefix for pre-multi-tenant data.

### ISO-02: Entity Table Cross-Contamination Risk [MEDIUM]
**Finding**: Wave 12 introduces multi-entity (multi-company) management with parent-child entity relationships and inter-entity transactions. The `entities` table has `userId` for ownership, but the consolidation endpoints (`GET /api/consolidation/:parentId`) could potentially expose child entities belonging to different users if userId filtering is not enforced at the query level.
**Recommendation**: Every entity query MUST include `WHERE userId = ?` clause. Add RLS (Row-Level Security) policies to PostgreSQL for defense-in-depth.

### ISO-03: Admin Cross-Tenant Data Access [MEDIUM]
**Finding**: Wave 20 admin endpoints (`GET /api/admin/users`, `GET /api/admin/cognee/graph`) and Wave 23 admin endpoint (`GET /api/admin/tenants`) allow admin users to view all user data. This is appropriate for super_admin but no plan exists for audit logging of admin data access.
**Recommendation**: All admin data access MUST be logged in the audit trail (Wave 15's `audit_trails` table) with the admin user ID, timestamp, and what data was accessed.

### ISO-04: Cognee Search Results Leak Across Users [HIGH]
**Finding**: Until Wave 23 enables `ENABLE_BACKEND_ACCESS_CONTROL=true`, all Cognee searches return results from ALL datasets globally. If multiple users are added before Wave 23, User A's chat queries will return User B's financial transactions, invoices, and tax data.
**Recommendation**: Either (a) enforce single-user mode until Wave 23, or (b) add server-side result filtering by userId in the CBA server before returning Cognee search results to clients.

---

## 3. AUTHENTICATION & AUTHORIZATION

### AUTH-01: JWT Implementation Gaps [MEDIUM]
**Finding**: Wave 20 introduces admin JWT auth (`admin-auth.ts`), and Wave 23 upgrades to tenant-aware JWT. However, no wave plan specifies:
- JWT expiry time
- Refresh token mechanism (Wave 23 adds `/api/auth/refresh` but no implementation detail)
- Token revocation strategy (no JWT blacklist)
- JWT algorithm (should be RS256 for production, not HS256)
**Recommendation**: Specify: 15-min access token expiry, 7-day refresh tokens, Redis-backed token blacklist for revocation, RS256 algorithm with key rotation.

### AUTH-02: No Rate Limiting on Authentication Endpoints [HIGH]
**Finding**: Wave 20 adds `POST /api/admin/auth/login` and Wave 23 adds `POST /api/auth/login` and `POST /api/auth/register`. Neither wave specifies brute-force protection or rate limiting on these endpoints. The existing `hono-rate-limiter` uses in-memory storage (not Redis) and will not persist across server restarts.
**Recommendation**: Auth endpoints must have aggressive rate limiting: 5 attempts per IP per minute for login, 3 attempts per IP per hour for registration. Use Redis-backed store for distributed rate limiting.

### AUTH-03: Invitation Token Security (Wave 23) [MEDIUM]
**Finding**: Wave 23 includes `tenant_invitations` table with `token` and `expiresAt`. No specification for token generation (must be cryptographically random, minimum 32 bytes), token hashing (store hash, not plaintext), or single-use enforcement.
**Recommendation**: Use `crypto.randomBytes(32).toString('hex')` for tokens. Store bcrypt hash only. Invalidate immediately on acceptance. Set max 72-hour expiry.

### AUTH-04: Docker Service Restart Endpoint — No Authorization Beyond Admin [HIGH]
**Finding**: Wave 20 exposes `POST /api/admin/docker/services/:name/restart`. This is a **destructive operation** that could take down the entire platform (restart postgres = total outage). Only `admin` role check is mentioned.
**Recommendation**: This endpoint must require `super_admin` role PLUS confirmation (2FA or re-authentication). Rate limit to 1 restart per service per 5 minutes. Log all restart attempts.

---

## 4. FINANCIAL DATA PROTECTION

### FIN-01: BSB/Account Numbers Not Masked in API Responses [MEDIUM]
**Finding**: No wave plan specifies API response masking for sensitive financial identifiers. Bank account numbers, BSBs (from transactions/accounts tables), ABNs (from entities/enrichment), and TFNs (from entities) could be returned in full in API responses and logged in server logs.
**Recommendation**: Implement response transformation middleware:
- TFN: Show `***-***-XXX` (last 3 only)
- BSB: Show `XXX-XXX` (full — BSBs are public routing numbers)
- Account numbers: Show `****XXXX` (last 4 only)
- ABN: Show full (ABNs are public)

### FIN-02: OCR Document Storage Security [MEDIUM]
**Wave Affected**: 14
**Finding**: Wave 14 stores uploaded documents in `ocr_documents` with `filePath` column, and the server mounts `./statements:/statements`. Uploaded financial documents (bank statements, receipts, invoices) are stored as unencrypted files on the host filesystem. The `ACCEPT_LOCAL_FILE_PATH=true` Cognee flag further increases risk.
**Recommendation**: Encrypt uploaded files at rest. Use randomly-generated filenames (not user-controlled). Validate file types server-side. Set file permissions to 600 (owner-only).

### FIN-03: CDR Data Handling (Wave 18) [LOW]
**Finding**: Wave 18 integrates CDR Product Reference Data (PRD) API. This is public, unauthenticated data — no CDR privacy requirements apply since GoldLedger only consumes public product listings (not customer data via Data Holder APIs). However, the plan mentions "CDR privacy requirements" which is misleading.
**Recommendation**: Clarify that Wave 18 uses ONLY the public PRD API (no customer data, no CDR accreditation needed). If future waves add CDR customer data access, full CDR accreditation (ACCC registration, data minimization, consent management, breach notification) would be required.

### FIN-04: Financial Report Snapshots Contain Full Data [MEDIUM]
**Wave Affected**: 13
**Finding**: Wave 13's `report_snapshots` table stores complete report data as JSON. These snapshots could contain full P&L, balance sheet, and cash flow data. No access control or expiry is planned for snapshots.
**Recommendation**: Apply same access control to snapshots as to live reports. Add snapshot expiry/retention policy. Mark snapshots as `draft` or `final` (already planned) and restrict `final` snapshots from deletion.

### FIN-05: Audit Trail for Sensitive Operations Incomplete [MEDIUM]
**Wave Affected**: 15
**Finding**: Wave 15 adds `audit_trails` table with `beforeState`/`afterState` JSON columns. These JSON blobs could capture sensitive data changes in full (TFN updates, account modifications). No plan for PII redaction within audit logs.
**Recommendation**: Redact sensitive fields (TFN, passwords, tokens) from audit trail `beforeState`/`afterState`. Store audit logs with immutable retention (no UPDATE/DELETE allowed on audit_trails).

---

## 5. ATO COMPLIANCE

### ATO-01: STP (Single Touch Payroll) Not Explicitly Planned [MEDIUM]
**Finding**: Wave 15 compliance monitoring mentions `stp_filing` as a check type, but no wave actually implements STP data format generation, lodgment, or the STP Phase 2 reporting requirements. STP requires: gross payments, PAYG withholding, superannuation, salary sacrifice, FBT, child support, and termination payments — all in the ATO-specified XML format.
**Recommendation**: If STP is in scope, add a dedicated STP wave. If not, remove `stp_filing` from compliance checks to avoid misleading users.

### ATO-02: BAS Calculation Accuracy — Existing Fix, But No Validation in Future Waves [MEDIUM]
**Finding**: The Feb 2026 audit fixed `||` to `??` in BAS calculations. However, waves 13 (financial reporting) and 15 (compliance monitoring) both reference BAS data without specifying validation rules. BAS lodgment requires exact GST categorization (G1–G20), correct rounding (round to whole dollars), and specific reporting period alignment (monthly/quarterly/annually per entity).
**Recommendation**: Add BAS validation unit tests that verify: (a) GST amounts round to whole dollars, (b) G1 = Total Sales, (c) G11 = Non-capital purchases, (d) 1A = GST on sales, (e) 1B = GST on purchases, (f) reporting periods align to FY quarters (Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun).

### ATO-03: Financial Year Boundary Handling [MEDIUM]
**Finding**: Wave 12 `entity_settings` includes `financialYearEnd` column. Australian FY runs July 1 – June 30. However, no wave validates that date-range calculations respect FY boundaries. Budget periods (Wave 13) use calendar months (jan–dec), not FY months (jul–jun).
**Recommendation**: Budget line columns should be `jul, aug, sep, oct, nov, dec, jan, feb, mar, apr, may, jun` to align with Australian FY. All date-range report queries must accept FY-aware parameters.

### ATO-04: Record Retention — 7-Year Requirement [LOW]
**Finding**: ATO requires financial records to be retained for a minimum of 5 years (7 years for some). No wave plan specifies data retention policies. Wave 22 `saved_charts` and `dashboard_layouts` have no archiving strategy. Wave 13 `report_snapshots` have no retention period.
**Recommendation**: Add a `data_retention_policies` table. Implement soft-delete with 7-year hard retention for all financial records. Prevent hard-delete of transactions, BAS records, and tax-related data within retention period.

### ATO-05: Depreciation Thresholds — Currency and Rate Accuracy [LOW]
**Wave Affected**: 12
**Finding**: Wave 12 mentions "instant write-off for assets under $20,000." The ATO instant asset write-off threshold has changed multiple times (was $150K during COVID, reduced to $20K for 2024-25 FY for small businesses). The threshold must be configurable, not hardcoded, and must reference the correct FY.
**Recommendation**: Store ATO thresholds in a configuration table with effective date ranges. Load thresholds dynamically based on the asset's purchase date and the entity's eligible business size.

---

## 6. API SECURITY

### API-01: No Input Validation Schema for 200+ New Endpoints [HIGH]
**Finding**: Waves 11–24 collectively add ~250 new API endpoints. The Feb 2026 audit wired Zod validation middleware, but none of the wave plans specify request body schemas for their new endpoints. Without Zod schemas, endpoints are vulnerable to type confusion, over-posting (mass assignment), and injection.
**Recommendation**: Every new API endpoint MUST define a Zod schema for request body, query parameters, and path parameters. Use Hono's `zValidator` middleware consistently. Reject requests that don't conform.

### API-02: SQL Injection via `wrapPgDb()` Proxy [MEDIUM]
**Finding**: Per MEMORY.md, `wrapPgDb()` returns `any` — all DB queries are untyped at runtime. As 14 waves add services that construct queries dynamically (e.g., Wave 11 `bank_recon_rules` with regex patterns, Wave 18 CDR product search with user-supplied filters), the risk of SQL injection increases if raw string concatenation is used anywhere.
**Recommendation**: Audit all new service files for raw SQL construction. Use Drizzle ORM's parameterized query builder exclusively. Never interpolate user input into SQL strings.

### API-03: Path Traversal in OCR Upload (Wave 14) [MEDIUM]
**Finding**: Wave 14's `POST /api/ocr/upload` accepts file uploads stored at a server path. The `filePath` column in `ocr_documents` stores the path. If filePath can be user-influenced, path traversal attacks (`../../etc/passwd`) are possible. The Feb audit fixed path traversal in statement uploads, but Wave 14 creates a new upload surface.
**Recommendation**: Generate server-side UUIDs for filenames. Store files in a flat directory structure. Validate file type via magic bytes (not just extension). Block path separators in uploaded filenames.

### API-04: Missing CORS Restriction for New API Groups [MEDIUM]
**Finding**: The CBA server CORS was tightened in the Feb audit, but Wave 18 (CDR) adds external API fetching that could introduce SSRF. Wave 19 (market data) fetches from RBA, ABS, Alpha Vantage, and CoinGecko — if any of these URLs are user-configurable (`market_data_feeds.sourceUrl`), SSRF is possible.
**Recommendation**: Whitelist allowed external URLs for market data feeds. Do not allow user-supplied arbitrary URLs. Validate all external URLs against an allow-list of known domains (rba.gov.au, abs.gov.au, alphavantage.co, coingecko.com).

### API-05: Rate Limiting Per Tenant (Wave 23) — Implementation Gap [MEDIUM]
**Finding**: Wave 23 adds `api_rate_limits` table with per-tenant limits. However, the rate limiting implementation must be enforced BEFORE the request is processed (in middleware), not after. The current `hono-rate-limiter` uses in-memory storage which loses state on restart and doesn't support per-tenant scoping.
**Recommendation**: Migrate rate limiting to Redis with Lua scripts for atomic increment/check. Implement as Hono middleware that extracts tenant ID from JWT before processing.

---

## 7. INFRASTRUCTURE SECURITY

### INF-01: Exposed Database and Service Ports [HIGH]
**Finding**: Per R09, PostgreSQL (5432), Redis (6379), and Cognee (8000) are exposed to the host via port mappings. In a production environment, this allows direct database access bypassing the application layer entirely.
**Severity**: HIGH
**Recommendation**: Remove all host port mappings except port 8080 (client/nginx). Services communicate via Docker internal network only. For development, use `docker compose exec` for DB access.

### INF-02: No TLS/HTTPS Termination [HIGH]
**Finding**: R09 confirms no HTTPS is configured. All traffic — including authentication tokens, financial data, and API keys — travels in plaintext. This is a CRITICAL gap for any production deployment handling financial data.
**Recommendation**: Add TLS termination at nginx with Let's Encrypt certificates. Use HSTS headers. Enforce HTTPS redirects.

### INF-03: Redis Has No Authentication [MEDIUM]
**Finding**: Redis is configured without `requirepass`. When Redis is actually activated (Wave 17 for caching, Wave 23 for sessions), unauthenticated Redis access on the Docker network could allow session hijacking, rate limit bypass, and cache poisoning.
**Recommendation**: Set `requirepass` on Redis before activation. Pass `REDIS_PASSWORD` as a Docker secret.

### INF-04: No Database Backup Strategy [HIGH]
**Finding**: R09 confirms no backup mechanism exists. By Wave 24, the database will contain years of financial records (required by ATO for 5-7 years), knowledge graphs, audit trails, and compliance records. A single volume failure could destroy everything.
**Recommendation**: Implement automated daily pg_dump with 30-day retention. Enable WAL archiving for point-in-time recovery. Test backup restoration quarterly. Back up Cognee data volume separately.

### INF-05: Cognee CORS Wildcard [MEDIUM]
**Finding**: Cognee's `CORS_ALLOWED_ORIGINS=*` allows any origin to make API calls to the knowledge graph service. Combined with disabled authentication (CRIT-01), this means any website visited by a user on the same network could access Cognee.
**Recommendation**: Restrict to `http://server:3501` (internal only). Remove host port exposure.

### INF-06: Server Dockerfile Security Issues [LOW]
**Finding per R09**: Python packages installed globally with `--break-system-packages`, pip errors silently swallowed with `|| true`, full source copy includes test files. No `.dockerignore` file.
**Recommendation**: Use Python venv. Remove `|| true` from pip install. Add `.dockerignore` excluding `*.test.*`, `*.spec.*`, `node_modules`, `.env`.

### INF-07: No Log Rotation or Structured Logging [MEDIUM]
**Finding**: No `logging` driver configuration in docker-compose.yml. As agent executions generate verbose logs (25+ agents with LLM request/response logging), disk space could be exhausted. No structured logging format for log aggregation tools.
**Recommendation**: Add JSON file logging driver with `max-size: 50m` and `max-file: 5`. Implement structured logging (JSON format) in the server for log aggregation.

---

## 8. PRIVACY & DATA GOVERNANCE

### PRIV-01: No User Data Deletion Mechanism (Right to Be Forgotten) [HIGH]
**Finding**: No wave plan includes user data deletion. Under the Australian Privacy Act 1988 (APP 11.2), when personal information is no longer needed, organizations must take reasonable steps to destroy or de-identify it. GoldLedger stores: financial transactions, tax records, OCR documents, Cognee knowledge graphs, audit trails, agent execution logs, market alerts, push subscriptions, and notification preferences — all linked to userId. No cascade delete or data purge mechanism is planned.
**Recommendation**: Implement `DELETE /api/users/:id/data` endpoint that:
1. Soft-deletes all user records in PostgreSQL
2. Deletes user's Cognee datasets (when access control is enabled)
3. Removes uploaded files
4. Anonymizes audit trail entries (replace userId with `[DELETED]`)
5. Retains only data required by ATO (7-year retention) in anonymized form

### PRIV-02: No Data Export (Portability) [MEDIUM]
**Finding**: No wave plan includes data export capability. Users should be able to export their financial data in standard formats (CSV, JSON, ATO-standard XML).
**Recommendation**: Add `GET /api/users/:id/export` endpoint that generates a ZIP archive with: transactions (CSV), reports (PDF), tax records (XML), and settings (JSON).

### PRIV-03: Cognee Cleanup on User Deletion [HIGH]
**Finding**: When a user is deleted, their Cognee datasets must be purged. However, Cognee's graph database (Kuzu) stores entities as interconnected nodes. Deleting a user's nodes could leave orphaned edges. No wave plan addresses graph cleanup.
**Recommendation**: Use Cognee's `POST /api/v1/prune/data` endpoint (currently unimplemented in client) to prune user-specific graph data. Implement cascading graph cleanup before user deletion.

### PRIV-04: Push Notification Data (Wave 24) [LOW]
**Finding**: Wave 24 stores push subscription data (`endpoint`, `p256dh`, `auth`) which is tied to a specific device. This is PII under the Privacy Act. No expiry or cleanup is planned for stale subscriptions.
**Recommendation**: Expire push subscriptions after 90 days of inactivity. Clean up on user deletion. Don't log push subscription endpoints.

### PRIV-05: Market Sentiment Data May Contain PII [LOW]
**Wave Affected**: 19
**Finding**: Wave 19's `sentiment_snapshots` stores `topPosts` JSON from Reddit/X. These posts may contain usernames, profile links, and personal opinions that constitute PII of third parties.
**Recommendation**: Strip usernames and profile links from stored sentiment data. Store only aggregated sentiment scores and anonymized post excerpts.

---

## 9. RECOMMENDATIONS BY WAVE

### Pre-Wave 11 (Foundation Security)
| # | Action | Severity | Effort |
|---|--------|----------|--------|
| 1 | Remove host port exposure for postgres/redis/cognee | HIGH | 5 min |
| 2 | Move Cognee credentials to env vars | HIGH | 15 min |
| 3 | Enable Cognee authentication (service token) | HIGH | 1 hr |
| 4 | Add Docker secrets for all API keys | HIGH | 2 hr |
| 5 | Add Redis `requirepass` | MEDIUM | 5 min |
| 6 | Add `.dockerignore` files | LOW | 15 min |
| 7 | Add log rotation config | MEDIUM | 10 min |
| 8 | Establish Zod schema requirement for all new endpoints | HIGH | 30 min |

### Wave 11 (Inventory & Bank Recon)
- Ensure `bank_recon_rules` regex patterns are sanitized (ReDoS prevention)
- Validate recon rule `pattern` field length and complexity
- Add userId filtering on all inventory/recon queries

### Wave 12 (Fixed Assets & Multi-Entity)
- **CRITICAL**: Encrypt TFN column in `entities` table
- Mask TFN in all API responses
- Add audit logging for TFN access
- Entity queries MUST filter by userId
- Consolidation reports must validate parent-child ownership chain

### Wave 13 (Financial Reporting & Budgets)
- Align budget columns to Australian FY (jul–jun, not jan–dec)
- Report snapshots must inherit userId access control
- Add BAS validation rules as unit tests

### Wave 14 (AI OCR & Payment Matching)
- Generate server-side UUIDs for uploaded filenames
- Validate file types via magic bytes
- Encrypt uploaded documents at rest
- Set file permissions to 600
- OCR processing must run in a sandboxed context (no filesystem escape)

### Wave 15 (Predictive Analytics & Compliance)
- Make audit trail `audit_trails` table append-only (no UPDATE/DELETE)
- Redact sensitive fields from beforeState/afterState JSON
- Validate ATO obligation dates against official ATO calendar
- Anomaly detection thresholds must not expose raw financial data in alerts

### Wave 16 (Custom DataPoints)
- Custom DataPoint definitions must be validated (no arbitrary code execution)
- Ontology files must be validated against schema before application
- Feedback system must rate-limit submissions (prevent spam)

### Wave 17 (Temporal Queries)
- Cross-module queries must respect userId isolation
- Redis cache keys must be namespaced by userId
- Intelligence subscription channels must verify email ownership

### Wave 18 (CDR Open Banking)
- Whitelist external API URLs (no user-supplied URLs for crawling)
- Rate limit CDR crawling to 2 req/s per data holder (per CDR spec)
- CDR data is public — no CDR accreditation needed for PRD API
- Crawl operations must not block the main server event loop

### Wave 19 (Market Intelligence)
- Whitelist external data source URLs (RBA, ABS, Alpha Vantage, CoinGecko)
- Store Alpha Vantage API key in Docker secrets
- Strip PII from sentiment data before storage
- Rate limit external API calls per free tier limits

### Wave 20 (Admin Backend) — REQUIRES RBAC FIRST
- **Reorder**: Implement basic RBAC BEFORE admin backend
- Admin endpoints must require `super_admin` for destructive operations
- Docker restart endpoint needs 2FA or re-authentication
- All admin data access must be audit-logged
- Agent configuration changes must be versioned (rollback support)

### Wave 21 (Vercel AI SDK)
- Streaming endpoints must validate SSE connection authentication
- Structured output schemas must not expose internal system information
- Agent migration rollback must preserve data integrity

### Wave 22 (Advanced Visualizations)
- Dashboard layout JSON must be validated (no XSS via stored config)
- Saved chart configs must be sanitized
- Ensure Recharts doesn't render user-controlled HTML

### Wave 23 (Multi-Tenant & Access Control)
- JWT must include tenant_id claim
- Implement RS256 (not HS256) for JWT signing
- 15-min access tokens, 7-day refresh tokens with Redis blacklist
- Subscription plan enforcement must be server-side (not client-side)
- Invitation tokens must be cryptographically random, hashed in storage
- RLS (Row-Level Security) policies on PostgreSQL for defense-in-depth

### Wave 24 (Mobile & PWA)
- Service worker must not cache sensitive API responses
- Push subscription data is PII — handle accordingly
- Offline sync must validate data integrity on upload
- Conflict resolution must not allow data injection
- VAPID keys must be stored in Docker secrets

---

## 10. SUMMARY SCORECARD

| Area | Risk Level | Critical Issues | High Issues | Medium Issues | Low Issues |
|------|-----------|----------------|-------------|---------------|------------|
| Data Isolation | RED | 1 | 1 | 2 | 0 |
| Authentication | AMBER | 0 | 2 | 2 | 0 |
| Financial Data | RED | 1 | 0 | 4 | 0 |
| ATO Compliance | AMBER | 0 | 0 | 3 | 2 |
| API Security | AMBER | 0 | 1 | 4 | 0 |
| Infrastructure | RED | 0 | 3 | 3 | 1 |
| Privacy | RED | 0 | 2 | 1 | 2 |
| **TOTAL** | **RED** | **2** | **9** | **19** | **5** |

### Top 5 Actions (Ordered by Impact)
1. **Enable Cognee authentication + remove host port exposure** — Blocks the largest attack surface
2. **Encrypt TFN/sensitive data at rest** — Legal compliance requirement
3. **Add secrets management** — Prevents credential leaks
4. **Reorder RBAC before Admin Backend** — Prevents privileged operations without authorization
5. **Implement user data deletion** — Privacy Act compliance

---

*This review should be re-evaluated after each wave implementation to verify findings are addressed.*
