# Wave 4 — Employee Management & Pay Structures — Orchestration Prompt

You are the **Team Lead** for Wave 4: Employee Management & Pay Structures. You coordinate 10 specialized agents to add the core employee/payroll data model to GoldLedger — the foundation for the full payroll system (Waves 5-6).

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 4, lines ~820–880)
- **Existing payroll agent**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Cognee tools**: `server/src/services/claude/cognee-tools.ts`
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 3)
- 21 Claude agents operational
- SQLite + PostgreSQL dual schema synchronized (90 SQLite tables, 59 PG tables)
- Multi-user Cognee with per-user dataset isolation (Wave 3)
- 8 custom DataPoint models registered (TransactionNode, AccountNode, etc.)
- Cognee sessions with conversation memory (Wave 3)
- Agent mutation framework with propose/confirm/execute flow (Wave 2)
- 27+ Cognee datasets with per-user prefixing
- Docker: 5 services with Cognee auth + Redis caching enabled
- Migrations 0009–0015 applied

## Dependencies
- **Requires**: Wave 3 complete (multi-user Cognee for user-scoped payroll data)
- **Unlocks**: Wave 5 (Pay Run Processing & Leave Management), Wave 6 (STP Compliance)
- **Estimated Complexity**: VERY HIGH

## SECURITY REQUIREMENTS

### Auth Middleware (REVISION — D02 CRIT-01)
All `/api/payroll/*` endpoints handle sensitive PII (TFN, bank details). These endpoints MUST require authentication once the auth middleware is built (Wave 1). For now, Wave 4 endpoints accept `userId` as a query/body parameter. When Wave 1's JWT auth is wired, replace `userId` extraction from request body/query with extraction from the authenticated JWT.

### TFN Encryption (REVISION — D02 SEC-01)
Australian Tax File Numbers (TFNs) are classified as sensitive personal information under the Privacy Act 1988. ALL TFN storage MUST use **AES-256-GCM** encryption:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encryption key from environment: TFN_ENCRYPTION_KEY (32 bytes hex)
const TFN_KEY = Buffer.from(process.env.TFN_ENCRYPTION_KEY ?? '', 'hex');

function encryptTFN(tfn: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', TFN_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(tfn, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptTFN(encrypted: string): string {
  const [ivB64, tagB64, dataB64] = encrypted.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', TFN_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}
```

**Also encrypt**: Employee bank account numbers (`employee_bank_details.accountNumber`) AND BSB numbers (`employee_bank_details.bsb`) — **REVISION (D02): Both encrypted at rest with same AES-256-GCM key**

### TFN Encryption Key Management (REVISION — D02 SEC-01)
The `TFN_ENCRYPTION_KEY` environment variable:
- **MUST be at least 32 bytes (256 bits)** = 64 hex characters
- **MUST be loaded from env at startup, NEVER hardcoded**
- **In production (`NODE_ENV=production`): FAIL FAST** — server refuses to start without the key. No graceful degradation to plaintext.
- **In development**: Warn loudly but allow `[UNENCRYPTED]` prefix fallback
- **Key rotation plan**: `reEncryptField(ciphertext, oldKeyHex)` utility re-encrypts data with new key. Process: set `OLD_TFN_ENCRYPTION_KEY` + `TFN_ENCRYPTION_KEY`, run migration script to re-encrypt all TFNs + bank details, then remove old key.
- Generate with: `openssl rand -hex 32`

### Super Guarantee Rate (REVISION — D02 COMP-02)
The super guarantee rate (currently 11.5%) **MUST be configurable**, NOT hardcoded:
- **Environment variable**: `SUPER_GUARANTEE_RATE` (default: 11.5)
- Rate changes annually: 11% (FY2023-24), 11.5% (FY2024-25), 12% (FY2025-26)
- All super calculations MUST read from the env var, not a hardcoded constant
- The `check_super_compliance` tool MUST use the configurable rate

### Error Handling (REVISION — D05 H-05)
Payroll operations involve multi-step processes. Error handling patterns:
- **Employee save fails mid-batch**: Return partial results with `{ success: Employee[], failed: { id: string, error: string }[] }`
- **Encryption key missing**: Fail fast in production, warn in development (see SEC-01)
- **Bank detail validation fails**: Return 400 with specific field errors, do NOT save partial data
- **Super fund ABN invalid format**: Warn but allow save (ABR may be temporarily unavailable)

## Database Schema Changes

### New Tables (7 tables)
| Table | Columns |
|-------|---------|
| `employees` | id, userId (FK→users), firstName, lastName, email, phone, dateOfBirth, address, taxFileNumber (encrypted), startDate, endDate, status ('active'\|'terminated'\|'on_leave'), employmentType ('full_time'\|'part_time'\|'casual'\|'contractor'), createdAt, updatedAt |
| `employee_bank_details` | id, employeeId (FK→employees), bsb (encrypted — REVISION D02), accountNumber (encrypted), accountName, splitPercentage, isPrimary, createdAt |
| `employee_super_funds` | id, employeeId (FK→employees), fundName, fundABN, usi, memberNumber, contributionRate (default from `SUPER_GUARANTEE_RATE` env var — REVISION D02 COMP-02), createdAt |
| `employee_tax_declarations` | id, employeeId (FK→employees), taxFreeThreshold (boolean), helpDebt (boolean — HELP/HECS), sfssDebt (boolean — Student Financial Supplement), claimDependents (integer), effectiveDate, createdAt |
| `pay_categories` | id, userId (FK→users), name, type ('ordinary'\|'overtime'\|'allowance'\|'deduction'\|'super'\|'leave'), rateType ('hourly'\|'annual'\|'fixed'), defaultRate (cents), isActive, createdAt |
| `pay_structures` | id, employeeId (FK→employees), payCategoryId (FK→pay_categories), rate (cents), hoursPerWeek, annualSalary (cents), effectiveDate, createdAt |
| `employee_documents` | id, employeeId (FK→employees), documentType, fileName, filePath, uploadedAt |

**Migration**: `docker/migrations/0016_employee_management.sql`

## API Endpoints (15 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/payroll/employees | List employees (paginated, filterable by status) |
| POST | /api/payroll/employees | Create employee (with TFN encryption) |
| GET | /api/payroll/employees/:id | Get employee detail (TFN masked in response) |
| PATCH | /api/payroll/employees/:id | Update employee |
| DELETE | /api/payroll/employees/:id | Soft-delete (set status=terminated) |
| GET | /api/payroll/employees/:id/bank-details | Get bank details (account numbers masked) |
| POST | /api/payroll/employees/:id/bank-details | Add bank account |
| GET | /api/payroll/employees/:id/super | Get super fund details |
| POST | /api/payroll/employees/:id/super | Add/update super fund |
| GET | /api/payroll/employees/:id/tax-declaration | Get tax declaration |
| POST | /api/payroll/employees/:id/tax-declaration | Submit tax declaration |
| GET | /api/payroll/pay-categories | List pay categories |
| POST | /api/payroll/pay-categories | Create pay category |
| GET | /api/payroll/employees/:id/pay-structure | Get employee pay structure |
| POST | /api/payroll/employees/:id/pay-structure | Set pay structure |

## UI Components
### `client/src/features/payroll/` — Extend existing feature folder (if exists) or create new
- **PayrollDashboard.tsx** — Main payroll hub with tabs (Employees, Pay Categories, upcoming: Pay Runs)
- **EmployeeList.tsx** — Searchable, filterable employee table with status badges
- **EmployeeDetail.tsx** — Full employee profile with tabs (Personal, Bank, Super, Tax, Pay Structure, Documents)
- **EmployeeOnboarding.tsx** — Step-by-step new employee wizard (Personal → Bank → Super → Tax Declaration → Pay Structure)
- **PayCategoryManager.tsx** — CRUD interface for pay categories with rate type configuration
- **PayStructureEditor.tsx** — Configure employee pay rates, hours, salary with effective date tracking

**Navigation**: Add `payroll` to TabId type in BottomNavigation.tsx (with Users icon)

## New Claude Agents
**None** — Wave 4 enhances the existing `payroll_agent` with employee management tools.

### Payroll Agent Enhancement
Add these tools to the existing `payroll_agent`:
- `lookup_employee` — Search employees by name/email/status
- `get_employee_pay_details` — Get pay structure, rate, hours for an employee
- `calculate_gross_pay` — Calculate gross pay for a period given hours worked
- `check_super_compliance` — Verify super guarantee rate meets minimum (**REVISION: configurable via `SUPER_GUARANTEE_RATE` env var**, default 11.5% — D02 COMP-02)

## Cognee Integration
- **New datasets**: `employee_profiles`, `pay_structures`
- Index employee data for "What's John's salary?" or "Show me all casual employees"
- Index pay structures for "What's the hourly rate for Overtime - Weekend?"
- Use `CHUNKS_LEXICAL` for employee name searches
- Use `CHUNKS` for pay rate queries
- Apply user-scoped dataset prefix from Wave 3

## Testing Criteria
- [ ] Employee CRUD lifecycle (create, read, update, soft-delete)
- [ ] TFN encryption: stored encrypted, returned masked (***-***-**X)
- [ ] **REVISION (D02 SEC-01):** With `NODE_ENV=production` and no `TFN_ENCRYPTION_KEY`, server REFUSES TO START (fail-fast)
- [ ] **REVISION (D02):** BSB encryption: stored encrypted, returned masked (062-***)
- [ ] Bank account encryption: stored encrypted, returned masked (****1234)
- [ ] **REVISION (D02 SEC-01):** `reEncryptField()` can rotate encryption key
- [ ] Super fund: contribution rate defaults to `SUPER_GUARANTEE_RATE` env var (REVISION D02 COMP-02)
- [ ] **REVISION (D02 COMP-02):** Super compliance check reads rate from env var, not hardcoded
- [ ] Tax declaration: all ATO TFN declaration fields captured
- [ ] Pay categories: CRUD with all 6 types (ordinary, overtime, allowance, deduction, super, leave)
- [ ] Pay structures: rate assignment with effective date
- [ ] Employee onboarding wizard: all 5 steps complete
- [ ] Payroll agent enhanced: can answer "What's John's pay rate?"
- [ ] Chat answers "List all active employees" via payroll agent
- [ ] **REVISION (D05 H-05):** Bank detail validation failure returns 400 with field errors, not 500
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: employee-schema-builder [PRIORITY: SUB-WAVE 1]
**Role**: Create 7 employee/payroll tables in dual schema + migration SQL
**Task file**: `wave4-agent-tasks/01-employee-schema-builder.md`
**Creates**: docker/migrations/0016_employee_management.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: employee-service-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build employee CRUD service with TFN encryption
**Task file**: `wave4-agent-tasks/02-employee-service-builder.md`
**Creates**: server/src/services/employee.ts
**Dependencies**: None — can start immediately

### Agent 3: pay-structure-service-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build pay category and pay structure management service
**Task file**: `wave4-agent-tasks/03-pay-structure-service-builder.md`
**Creates**: server/src/services/pay-structures.ts
**Dependencies**: None — can start immediately

### Agent 4: tfn-encryption-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build AES-256-GCM encryption utility for TFN and bank account numbers
**Task file**: `wave4-agent-tasks/04-tfn-encryption-builder.md`
**Creates**: server/src/services/encryption.ts
**Dependencies**: None — can start immediately

### Agent 5: payroll-agent-enhancer [DEPENDS ON: Agents 2, 3]
**Role**: Add employee management tools to existing payroll_agent
**Task file**: `wave4-agent-tasks/05-payroll-agent-enhancer.md`
**Modifies**: server/src/services/claude/agents/payroll-agent.ts, server/src/services/claude/types.ts, server/src/services/claude/config.ts
**Dependencies**: Employee and pay structure services must exist

### Agent 6: api-employee-endpoints [DEPENDS ON: Agents 2, 3, 4]
**Role**: Wire 15 new API routes in server/src/index.ts
**Task file**: `wave4-agent-tasks/06-api-employee-endpoints.md`
**Modifies**: server/src/index.ts
**Dependencies**: All backend services must exist

### Agent 7: cognee-payroll-datasets [DEPENDS ON: Agent 2]
**Role**: Configure Cognee datasets for employee and payroll data
**Task file**: `wave4-agent-tasks/07-cognee-payroll-datasets.md`
**Modifies**: server/src/services/claude/cognee-tools.ts
**Dependencies**: Employee service must exist for data shape

### Agent 8: ui-employee-components [DEPENDS ON: Agent 6]
**Role**: Build employee management UI components
**Task file**: `wave4-agent-tasks/08-ui-employee-components.md`
**Creates**: 4 new .tsx components in client/src/features/payroll/
**Modifies**: client/src/api.ts, client/src/App.tsx, client/src/components/layout/BottomNavigation.tsx
**Dependencies**: API routes must exist

### Agent 9: ui-pay-structure-components [DEPENDS ON: Agent 6]
**Role**: Build pay category and pay structure UI components
**Task file**: `wave4-agent-tasks/09-ui-pay-structure-components.md`
**Creates**: 2 new .tsx components in client/src/features/payroll/
**Modifies**: client/src/api.ts
**Dependencies**: API routes must exist

### Agent 10: testing-validation [DEPENDS ON: All]
**Role**: Run full verification plan and documentation
**Task file**: `wave4-agent-tasks/10-testing-validation.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **encryption.ts lock**: Only Agent 4 creates and owns encryption.ts
3. **index.ts lock**: Only Agent 6 modifies server/src/index.ts
4. **payroll-agent.ts lock**: Only Agent 5 modifies the payroll agent
5. **api.ts lock**: Only Agents 8 and 9 modify client/src/api.ts (Agent 8 first, then Agent 9)
6. **Pattern compliance**: All new services follow existing service patterns
7. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
8. **Test before done**: `cd server && npx tsc --noEmit` must pass
9. **Marker naming**: Use `.agent-done-W04-{NN}` format
10. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation
11. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination (NOT `?page=`), returning `{ data: T[], total: number }`. Max limit=100. This matches the existing codebase convention. **REVISION NOTE (D01-CRIT-03)**: Standardized from page-based to offset-based pagination across all waves.
12. **TFN security**: TFN MUST be encrypted at rest and masked in API responses (***-***-**X)
13. **Bank account security**: Account numbers MUST be encrypted and masked (****1234)
14. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min.
15. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via React.lazy() + Suspense. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use @tanstack/react-virtual.

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3 + Agent 4
Sub-wave 2 (After 1):  Agent 5 + Agent 7
Sub-wave 3 (After 2):  Agent 6
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave4-agent-tasks/` for detailed atomic tasks.
