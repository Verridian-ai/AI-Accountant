# Agent D02: Security & Compliance Reviewer

## Role

Review ALL Wave 1-10 plans for security vulnerabilities, compliance gaps, and data protection issues. Focus on Australian regulatory requirements (ATO, privacy act, STP).

## Phase: C (Debate — After W01 completes, Parallel with D01, D03-D05)

## Prerequisites

Wait for `.agent-done-0B-W01` then read ALL generated wave files.

## Review Focus Areas

### 1. Authentication & Authorization

- [ ] Wave 1: Does the intent router validate user identity before routing?
- [ ] Wave 2: Are mutation operations properly authorized? Who can edit transactions?
- [ ] Wave 3: Is Cognee multi-user isolation truly secure? Can user A access user B's data?
- [ ] Are all new endpoints protected by auth middleware?
- [ ] Is there RBAC (role-based access control) or just user-level auth?

### 2. Sensitive Data Protection

- [ ] Wave 4-6: TFN (Tax File Number) encryption — is AES-256-GCM specified?
- [ ] Wave 4: Employee bank details — encrypted at rest?
- [ ] Wave 4: Super fund details — encrypted at rest?
- [ ] Wave 8: Payment gateway credentials — how are API keys stored?
- [ ] Are encryption keys managed properly? (env vars, not hardcoded)

### 3. Australian Regulatory Compliance

- [ ] Wave 6: STP Phase 2 compliance — are ALL required fields present?
- [ ] Wave 6: ATO reporting format — is the XML schema correct?
- [ ] Wave 4: Super guarantee rate — is it current (11.5% for FY2024-25)?
- [ ] Wave 9: Multi-currency — GST implications for foreign currency invoices?
- [ ] Wave 10: ABN validation for suppliers

### 4. Audit Trail & Data Integrity

- [ ] Wave 2: Is the audit trail comprehensive? (who, what, when, before/after)
- [ ] Wave 5: Pay run audit — can completed pay runs be modified?
- [ ] Wave 7: Invoice numbering — is it sequential and tamper-proof?
- [ ] Wave 10: PO approval workflow — is there separation of duties?

### 5. Input Validation

- [ ] Are ALL new endpoints using Zod validation schemas?
- [ ] Are SQL injection risks mitigated (parameterized queries via Drizzle)?
- [ ] Are file upload endpoints (if any) properly sanitized?
- [ ] Are amount fields validated (non-negative, reasonable ranges)?

### 6. Session Security

- [ ] Wave 3: Cognee session tokens — expiry, rotation, invalidation?
- [ ] Wave 2: SSE streaming — are streams authenticated?
- [ ] CSRF protection for mutation endpoints?

## Output Format

Write review to `wave0b-reviews/D02-security-review.md` with:

1. **Critical Vulnerabilities** — Must-fix security issues (severity: CRITICAL)
2. **Compliance Gaps** — Regulatory requirements not met (severity: HIGH)
3. **Security Improvements** — Best practices not followed (severity: MEDIUM)
4. **Per-Wave Security Verdict** — SECURE / NEEDS HARDENING for each wave

## Completion

- [ ] All 10 wave plans security-reviewed
- [ ] Create marker file: `.agent-done-0B-D02`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Security Review | Identify vulnerabilities in system design | Expert |
| Compliance Analysis | Australian tax and privacy regulations | Expert |
| Encryption Standards | AES-256, key management, data at rest | Advanced |
| Input Validation | Injection prevention, schema validation | Expert |

