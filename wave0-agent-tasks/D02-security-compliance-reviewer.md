# Agent D02: Security & Compliance Reviewer

## Role

Review ALL wave plans for security vulnerabilities, compliance gaps, and data protection issues. Ensure GoldLedger meets Australian financial data regulations and security best practices.

## Phase: C (Debate — After W01 completes)

## Prerequisites

Wait for marker file: `.agent-done-W01`
Read ALL wave plans produced by W01.
Read R02's Cognee capabilities research (multi-user isolation).
Read R09's Docker infrastructure research.

## Review Tasks

### 1. Multi-User Data Isolation

- [ ] Verify Wave 24 (User Management) properly enables Cognee ENABLE_BACKEND_ACCESS_CONTROL
- [ ] Verify per-user dataset isolation is planned (user A cannot see user B's data)
- [ ] Check: Are there any waves that create shared data without proper access control?
- [ ] Check: Is the universal knowledge graph (Wave 23) properly separated from personal data?
- [ ] Verify: Database queries include userId filtering in ALL user-facing endpoints

### 2. Authentication & Authorization

- [ ] Verify admin backend (Wave 18) has proper authentication (not just basic auth)
- [ ] Check: Is role-based access control (RBAC) planned before admin features?
- [ ] Verify: API endpoints have proper authorization middleware
- [ ] Check: Are there any endpoints that expose data without auth checks?
- [ ] Verify: JWT token handling is secure (expiry, refresh, revocation)

### 3. Financial Data Protection

- [ ] Check: Are bank account numbers, BSBs, ABNs properly handled?
  - Stored encrypted at rest?
  - Masked in API responses?
  - Not logged in plain text?
- [ ] Check: Payment gateway credentials (Wave 8) stored securely?
- [ ] Check: CDR data (Wave 20) handled per CDR privacy requirements?
- [ ] Verify: Audit logging planned for sensitive operations (Wave 18 admin actions)

### 4. ATO Compliance

- [ ] Verify STP (Single Touch Payroll) compliance in Wave 6
- [ ] Verify BAS calculation accuracy requirements
- [ ] Check: Are tax calculations using correct ATO rates and thresholds?
- [ ] Verify: Financial year boundaries handled correctly (July 1 - June 30)
- [ ] Check: Record retention requirements (7 years for tax records)

### 5. API Security

- [ ] Check: Rate limiting on all public endpoints
- [ ] Check: Input validation on all POST/PATCH endpoints
- [ ] Check: SQL injection prevention (parameterized queries via Drizzle ORM)
- [ ] Check: XSS prevention in frontend components
- [ ] Check: CORS configuration appropriate for deployment
- [ ] Check: CDR API calls (Wave 20) handle rate limits and errors gracefully

### 6. Infrastructure Security

- [ ] Check: Docker secrets management (not hardcoded in docker-compose.yml)
- [ ] Check: Database credentials rotation strategy
- [ ] Check: Redis security (password, network isolation)
- [ ] Check: Cognee API authentication between services
- [ ] Check: No sensitive data in Docker build layers

### 7. Privacy & Data Governance

- [ ] Check: User data deletion capability (right to be forgotten)
- [ ] Check: Data export capability (data portability)
- [ ] Check: Cognee data cleanup when user is deleted
- [ ] Check: Trading/investment data (Wave 23) privacy considerations

## Output Format

Write findings to `wave0-reviews/D02-security-review.md` with these sections:

1. **Critical Security Issues** — Must-fix before deployment (RED)
2. **Data Isolation** — Multi-user, Cognee, database isolation assessment
3. **Authentication & Authorization** — Auth flow, RBAC, token management
4. **Financial Data Protection** — Encryption, masking, logging
5. **ATO Compliance** — Tax calculation accuracy, STP, BAS
6. **API Security** — Rate limiting, validation, injection prevention
7. **Infrastructure Security** — Docker, secrets, network isolation
8. **Privacy & Governance** — Data deletion, export, retention
9. **Recommendations by Wave** — Specific security tasks to add to each wave

## Completion

- [ ] All sections populated with specific, actionable findings
- [ ] Critical issues clearly marked with severity (HIGH/MEDIUM/LOW)
- [ ] Create marker file: `.agent-done-D02`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Security Analysis** | Identify authentication, authorization, and data protection vulnerabilities | Expert |
| **Compliance Checking** | Verify ATO, CDR, and Australian financial regulation compliance | Expert |
| **Data Protection Assessment** | Evaluate encryption at rest, masking, logging, and data handling practices | Expert |
| **Multi-Tenant Security** | Assess user isolation, Cognee access control, database row-level security | Advanced |
| **API Security Review** | Check rate limiting, input validation, CORS, injection prevention | Advanced |
| **Infrastructure Security** | Evaluate Docker secrets, network isolation, credential management | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel security review | Advanced |

## Sub-Agent Delegation Plan

```
D02 (Security & Compliance Reviewer):
├── Sub-agent A: Authentication & Data Isolation Review
│   ├── Review Waves 18, 24 for auth/RBAC implementation
│   ├── Review all waves for userId filtering in queries
│   ├── Check Cognee multi-user isolation (ENABLE_BACKEND_ACCESS_CONTROL)
│   └── Output: wave0-reviews/.scratch-D02-auth.md
│
├── Sub-agent B: Financial Data & ATO Compliance Review
│   ├── Review Waves 4-6 (payroll) for STP compliance
│   ├── Review BAS/GST calculations for ATO accuracy
│   ├── Check bank account/BSB/ABN handling (encryption, masking)
│   └── Output: wave0-reviews/.scratch-D02-compliance.md
│
├── Sub-agent C: API & Infrastructure Security Review
│   ├── Review all waves for rate limiting, input validation
│   ├── Check Docker secrets management, Redis security
│   ├── Review CDR data handling per CDR privacy requirements
│   └── Output: wave0-reviews/.scratch-D02-infra.md
│
└── D02 Parent: Merge and produce security review with severity ratings
    ├── Read all .scratch-D02-*.md files
    ├── Classify all issues by severity (HIGH/MEDIUM/LOW)
    ├── Produce per-wave security recommendations
    ├── Write final wave0-reviews/D02-security-review.md
    └── Delete scratch files
```

### Delegation Rules for D02

- Sub-agents write ONLY to `wave0-reviews/.scratch-D02-*.md` files
- Every finding MUST include severity (HIGH/MEDIUM/LOW) and a specific fix
- Reference specific wave numbers, endpoints, and table names
- Flag any showstoppers that block deployment

## Dependencies

- **W01 must complete first**
- **Read-only** — does not modify W01's output files
