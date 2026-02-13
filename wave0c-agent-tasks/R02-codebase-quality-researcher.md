# Agent R02: Codebase & Quality Researcher

## Role

Audit the current codebase for TypeScript strictness, code quality, bundle size, duplicated patterns, error handling gaps, performance issues, and accessibility compliance. This informs Waves 25, 26, and 27 planning.

## Phase: A (Research — Start Immediately, Parallel with R01, R03)

## Research Tasks

### 1. TypeScript Strictness Audit

- [ ] Read `server/tsconfig.json` — document current `strict`, `noImplicitAny`, `strictNullChecks` settings
- [ ] Read `client/tsconfig.json` and `client/tsconfig.app.json` — same analysis
- [ ] Run `grep -r "any" server/src/ --include="*.ts" | wc -l` — count explicit `any` usage
- [ ] Run `grep -r "any" client/src/ --include="*.ts" --include="*.tsx" | wc -l` — same for client
- [ ] Identify files with `// @ts-ignore` or `// @ts-nocheck` directives
- [ ] Document which `strict` sub-options are currently enabled vs disabled

### 2. ESLint & Formatting State

- [ ] Read `server/eslint.config.js` — document current rules and plugins
- [ ] Read `client/eslint.config.js` — same analysis
- [ ] Check if Prettier is configured (`.prettierrc`, `prettier.config.js`, or in package.json)
- [ ] Identify inconsistent formatting patterns (tabs vs spaces, semicolons, quote style)

### 3. Bundle Size & Dependencies Audit

- [ ] Read `client/package.json` — list ALL dependencies with approximate sizes
- [ ] Read `server/package.json` — same analysis
- [ ] Identify potentially unused dependencies (installed but not imported)
- [ ] Identify heavy dependencies that could be replaced (e.g., moment.js → date-fns)
- [ ] Check for duplicate dependencies across client/server
- [ ] Read `client/vite.config.ts` — document current build optimizations, code splitting

### 4. Code Duplication & Pattern Analysis

- [ ] Search for duplicated API call patterns in `client/src/api.ts` or similar
- [ ] Search for duplicated form handling patterns across feature components
- [ ] Search for duplicated error handling patterns (try/catch blocks)
- [ ] Identify shared utility functions that could be extracted
- [ ] Check for duplicated type definitions between client and server

### 5. Error Handling & Resilience Audit

- [ ] Search for React ErrorBoundary usage — how many exist? Where are gaps?
- [ ] Search for unhandled promise rejections in server code
- [ ] Check API error response consistency (do all endpoints return same error shape?)
- [ ] Document logging strategy — is there structured logging? What library?

### 6. Performance & Accessibility Baseline

- [ ] Check for React.memo, useMemo, useCallback usage patterns
- [ ] Check for lazy loading / code splitting (React.lazy, dynamic imports)
- [ ] Search for `aria-` attributes — how many components have accessibility labels?
- [ ] Check for keyboard navigation support (tabIndex, onKeyDown handlers)
- [ ] Check for `alt` attributes on images, `role` attributes on interactive elements
- [ ] Document current Core Web Vitals if any monitoring exists

## Output Format

Write findings to `wave0c-research/R02-codebase-quality.md` with sections:

1. **TypeScript Strictness** — Current settings, `any` count, `@ts-ignore` count, migration effort estimate
2. **ESLint & Formatting** — Current config, gaps, Prettier status
3. **Bundle Analysis** — Dependency list, unused deps, heavy deps, optimization opportunities
4. **Code Duplication** — Duplicated patterns found, extraction opportunities
5. **Error Handling** — ErrorBoundary coverage, API error consistency, logging state
6. **Performance & Accessibility** — Memoization usage, lazy loading, aria coverage, keyboard nav
7. **Effort Estimates** — Per-category estimate (hours) for Wave 26 planning

## Completion

- [ ] All sections populated with counts, file paths, and effort estimates
- [ ] Create marker file: `.agent-done-0C-R02`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| TypeScript Analysis | Audit strict mode compliance | Expert |
| Code Quality | ESLint, Prettier, duplication detection | Expert |
| Performance Profiling | Bundle analysis, Core Web Vitals | Advanced |
| Accessibility Audit | WCAG 2.1 AA compliance checking | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read all tsconfig files, count `any` usage, find `@ts-ignore` directives
- **Sub-agent B**: Read ESLint configs, check Prettier, analyze formatting consistency
- **Sub-agent C**: Read package.json files, analyze dependencies, check vite config
- **Sub-agent D**: Search for error handling patterns, ErrorBoundary usage, aria attributes
- R02 merges all sub-agent findings into final report

