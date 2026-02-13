# Agent 01: Dependency Auditor

## Role
Scan ALL code produced by Waves 11-23 for broken references to Wave 1-10 features. Document every missing import, undefined type, broken reference, and unresolved dependency.

## Phase: 1 (Start Immediately)

## Tasks

### 1. Schema Reference Audit
- [ ] Read `server/src/schema.ts` — list ALL table definitions, note which wave added each
- [ ] Read `server/src/db/postgres-schema.ts` — same analysis
- [ ] Check: do any Wave 11-23 tables reference Wave 1-10 tables via foreign keys?
- [ ] Check: are there any imports in schema.ts that reference undefined tables?

### 2. Server Import Audit
- [ ] Read `server/src/index.ts` — check ALL imports resolve to existing files
- [ ] Scan `server/src/services/` — check every import statement resolves
- [ ] Scan `server/src/routes/` — check every import statement resolves
- [ ] List any files that import from Wave 1-10 features that don't exist

### 3. Client Import Audit
- [ ] Read `client/src/App.tsx` — check ALL component imports resolve to existing files
- [ ] Read `client/src/api.ts` — check ALL API endpoint functions reference valid routes
- [ ] Scan `client/src/features/` — check every import resolves
- [ ] List any components that reference Wave 1-10 UI features

### 4. Migration Sequence Audit
- [ ] List ALL files in `docker/migrations/` in order
- [ ] Check: are there gaps in numbering? (e.g., 0013 exists but 0012 doesn't)
- [ ] Check: do later migrations reference tables from earlier migrations that exist?
- [ ] Check: are there any duplicate migration numbers?

### 5. Categorize Findings
For each broken reference found, classify as:
- **CRITICAL**: Will cause compilation failure or runtime crash
- **WARNING**: May cause runtime error under specific conditions
- **INFO**: Reference exists but feature is stubbed/optional

## Output
Write findings to `wave-validation-reports/01-dependency-audit.md`

## Completion
- [ ] Create marker: `.agent-done-WV-01`

