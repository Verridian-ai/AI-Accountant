# GoldLedger — Atomic Refactoring Implementation Guide

> **Version**: 1.1 | **Last Updated**: 2026-02-16
> **Audience**: Junior-to-mid developers executing refactoring tasks
> **Companion Document**: `docs/REFACTORING_PLAN.md` (high-level plan with dependency graph)

## How to Use This Guide

Each task below is written as a **self-contained work unit**. Before starting ANY task:

1. **Read the entire task** top to bottom before touching any code
2. **Verify all prerequisites** in the "Before You Start" section
3. **Create a new git branch** named `refactor/REFACTOR-XXX-short-description`
4. **Follow steps IN ORDER** — do not skip ahead
5. **Run verification** after EVERY step, not just at the end
6. **Commit after each logical sub-step** with message format: `refactor(REFACTOR-XXX): step N - description`
7. **If something breaks**, check the "Rollback" section before trying to fix it yourself

### Golden Rules

- **NEVER delete code without first confirming it has zero references** (use `grep -r` or IDE "Find All References")
- **NEVER modify more than one file at a time without committing** — small commits are your safety net
- **ALWAYS run `npx tsc --noEmit` in both `server/` and `client/` after every change** to catch type errors immediately
- **ALWAYS run existing tests** (`cd server && npm test`) after every change
- **When in doubt, ASK** — it's cheaper to ask a question than to fix a broken production build

### Terminology

| Term | Meaning |
|------|---------|
| **Barrel export** | An `index.ts` file that re-exports from multiple files, e.g., `export * from './auth.js'` |
| **Hono sub-app** | A `new Hono()` instance with routes, mounted on the main app via `app.route('/prefix', subApp)` |
| **Repository pattern** | A class that encapsulates all database queries for a domain (e.g., `TransactionRepository`) |
| **Service layer** | A class that contains business logic, calling repositories for data access |
| **DI (Dependency Injection)** | Passing dependencies (like services) into a class constructor instead of importing them directly |

---

## Phase 1: Foundation & Code Quality (REFACTOR-001 to REFACTOR-010)

> **Goal**: Clean up the codebase, enforce consistent standards, and eliminate low-hanging quality issues.
> **Risk Level**: LOW — these changes don't alter business logic.
> **Estimated Duration**: 3-4 days for a single developer.

---

### REFACTOR-001: Archive Deprecated Files

**Priority**: P0 — Critical | **Effort**: 2 hours | **Risk**: Low

> **⚠️ STATUS (2026-02-16):** Reported as COMPLETE, but the `_archive/` directory does NOT exist in the current codebase. Either deprecated files were deleted outright instead of archived, or the task was completed differently than described below. Verify with the team before re-executing. If files were deleted (not archived), this task can be considered done — the goal (remove dead code from active codebase) was achieved.

#### WHY This Matters

The codebase contains ~50 files that are no longer used: old migration scripts, `.agent-done-*` marker files, backup copies, and deprecated utilities. These files:

- Confuse developers who don't know what's current vs. abandoned
- Inflate search results (you search for a function and get hits in dead code)
- Create false positives in linting and type-checking
- Make the codebase look unmaintained

#### BEFORE YOU START

- [ ] You have a clean git working tree (`git status` shows no uncommitted changes)
- [ ] You've created branch: `git checkout -b refactor/REFACTOR-001-archive-deprecated`
- [ ] You can run `npx tsc --noEmit` in `server/` without errors (baseline check)
- [ ] You can run `npm test` in `server/` without failures (baseline check)

#### STEP-BY-STEP Instructions

**Step 1: Create the archive directory**

```bash
mkdir -p _archive/deprecated-scripts
mkdir -p _archive/agent-markers
mkdir -p _archive/old-migrations
```

> **WHY a `_archive/` folder instead of deleting?** Because we might need to reference old code later. The underscore prefix ensures it sorts first in directory listings and is obviously not production code.

**Step 2: Identify and move `.agent-done-*` marker files**

These are marker files left by AI agents during development waves. They serve no runtime purpose.

```bash
# First, LIST them (don't move yet — always verify first)
find . -name ".agent-done-*" -not -path "./node_modules/*" -not -path "./_archive/*"

# Review the list. If it looks correct, move them:
find . -name ".agent-done-*" -not -path "./node_modules/*" -not -path "./_archive/*" -exec mv {} _archive/agent-markers/ \;
```

**Step 3: Identify deprecated/backup files**

Look for files with these patterns:

- `*.bak`, `*.old`, `*.backup`, `*.deprecated`
- Files with `DEPRECATED` in their name or first line
- Duplicate files (e.g., `pipeline-old.ts` alongside `pipeline.ts`)

```bash
# Search for backup-pattern files
find . -type f \( -name "*.bak" -o -name "*.old" -o -name "*.backup" -o -name "*deprecated*" \) \
  -not -path "./node_modules/*" -not -path "./_archive/*"
```

**Step 4: For EACH file you want to archive, verify it has zero imports**

This is the CRITICAL step. For every file you plan to move:

```bash
# Replace "filename.ts" with the actual file name
grep -r "filename" server/src/ client/src/ --include="*.ts" --include="*.tsx" -l
```

If ANY file imports it, **DO NOT MOVE IT**. Mark it for investigation instead.

**Step 5: Move verified-safe files**

```bash
# Move each file individually, committing after each batch
mv path/to/deprecated-file.ts _archive/deprecated-scripts/
git add -A && git commit -m "refactor(REFACTOR-001): archive deprecated-file.ts — zero references confirmed"
```

**Step 6: Add `_archive/` to `.gitignore` (optional) or keep tracked**

If you want to keep the archive in git history but exclude from builds:

```bash
# Add to tsconfig exclude lists
# In server/tsconfig.json, add to "exclude" array:
#   "_archive"
# In client/tsconfig.app.json, add to "exclude" array:
#   "_archive"
```

**Step 7: Update `.gitignore`**

Add this line to prevent future agent marker files:

```
.agent-done-*
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Deleting files instead of archiving | Can't reference old code if needed | Always move to `_archive/` |
| Moving a file that's still imported | Build breaks immediately | ALWAYS grep for references first |
| Moving test files that are still valid | Test coverage drops silently | Check if tests pass before AND after |
| Archiving `.env.example` | New devs won't know what env vars are needed | Never archive example/template files |

#### VERIFICATION

```bash
# 1. TypeScript still compiles
cd server && npx tsc --noEmit && echo "✅ Server OK"
cd ../client && npx tsc --noEmit && echo "✅ Client OK"

# 2. Tests still pass
cd ../server && npm test && echo "✅ Tests OK"

# 3. Server starts without errors
cd server && timeout 10 npx tsx src/index.ts 2>&1 | head -20
# Should see "Server running on port 3501" or similar — no import errors
```

#### ROLLBACK

If something breaks after archiving:

```bash
# Move the file back from archive
mv _archive/deprecated-scripts/the-file.ts original/path/the-file.ts
git add -A && git commit -m "refactor(REFACTOR-001): rollback — restored the-file.ts"
```

---

### REFACTOR-002: Configure ESLint + Prettier (Unified)

**Priority**: P0 — Critical | **Effort**: 4 hours | **Risk**: Low
**Depends On**: REFACTOR-001

> **⚠️ STATUS (2026-02-16):** Reported as COMPLETE. ESLint and Prettier ARE configured, but with issues:
>
> - Root config exists as `eslint.config.mjs` (not `.js` as described below)
> - `.prettierrc` and `.prettierignore` exist at root with correct settings
> - `.husky/pre-commit` exists with `npx lint-staged`
> - Root `package.json` has lint scripts and `lint-staged` config
>
> **⚠️ REMAINING ISSUES to clean up:**
>
> - **THREE separate ESLint configs exist**: root `eslint.config.mjs`, `server/eslint.config.js` (34 lines, different rules), and `client/eslint.config.js` (24 lines, different structure). The doc's COMMON MISTAKES table warns against this exact scenario ("Installing ESLint in both server/ and client/ → Version conflicts").
> - **Duplicate `lint-staged` configs**: Both root `package.json` and `client/package.json` have `lint-staged` entries, which may cause double-running of lint on client files.
> - **ESLint installed at all 3 levels**: Root, server, and client each have their own ESLint devDependencies. The doc says "Install at root only."
> - Consider a follow-up task to remove the server and client ESLint configs and consolidate to root only.

#### WHY This Matters

The codebase now has ESLint and Prettier configured, but the setup is fragmented across three levels (root, server, client) instead of unified at root. This means:

- Three different ESLint configs may apply conflicting rules
- Duplicate `lint-staged` configs may cause double-linting on client files
- Version drift between root, server, and client ESLint installations

#### BEFORE YOU START

- [ ] REFACTOR-001 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-002-eslint-prettier`
- [ ] You understand the difference between ESLint (catches bugs) and Prettier (formats code)
- [ ] Baseline: `cd server && npx tsc --noEmit` passes, `npm test` passes

#### STEP-BY-STEP Instructions

**Step 1: Install dependencies at the ROOT of the monorepo**

```bash
# From the project root (where both client/ and server/ directories are)
npm init -y  # Only if no root package.json exists
npm install -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh globals
```

> **WHY root-level?** So both client and server share the same ESLint/Prettier versions. No version drift.

**Step 2: Create the ESLint flat config at the project root**

Create file: `eslint.config.js` *(Note: the actual file created was `eslint.config.mjs` — use `.mjs` extension for ESM compatibility)*

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  { ignores: ['**/dist/', '**/node_modules/', '_archive/', '**/*.js', '!eslint.config.js'] },

  // Base config for all TS files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Server-specific rules
  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { project: './server/tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',  // Start as warning, upgrade to error later
      '@typescript-eslint/explicit-function-return-type': 'off',  // Too noisy initially
      'no-console': 'warn',  // Will be upgraded to error after REFACTOR-008 (structured logger)
    },
  },

  // Client-specific rules
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      globals: { ...globals.browser },u
      parserOptions: { project: './client/tsconfig.app.json' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Prettier must be LAST to override formatting rules
  prettierConfig,
);
```

> **IMPORTANT**: `@typescript-eslint/no-explicit-any` is set to `'warn'` not `'error'`. We'll upgrade it to `'error'` AFTER completing REFACTOR-004 through REFACTOR-007 (the `any` elimination tasks). If you set it to `'error'` now, you'll get 600+ errors and the CI will be permanently red.

**Step 3: Create Prettier config at the project root**

Create file: `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf",
  "arrowParens": "always",
  "bracketSpacing": true
}
```

Create file: `.prettierignore`

```
dist/
node_modules/
_archive/
*.md
*.json
```

**Step 4: Add lint scripts to root `package.json`**

```json
{
  "scripts": {
    "lint": "eslint server/src/ client/src/ --max-warnings 0",
    "lint:fix": "eslint server/src/ client/src/ --fix",
    "format": "prettier --write \"server/src/**/*.ts\" \"client/src/**/*.{ts,tsx}\"",
    "format:check": "prettier --check \"server/src/**/*.ts\" \"client/src/**/*.{ts,tsx}\""
  }
}
```

**Step 5: Install and configure pre-commit hooks**

```bash
npm install -D husky lint-staged
npx husky init
```

Create/update `.husky/pre-commit`:

```bash
npx lint-staged
```

Add to root `package.json`:

```json
{
  "lint-staged": {
    "server/src/**/*.ts": ["eslint --fix", "prettier --write"],
    "client/src/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

**Step 6: Run the first lint pass (expect MANY warnings)**

```bash
# See what we're dealing with — DO NOT try to fix everything now
npm run lint 2>&1 | tail -5
# Expected: "X warnings" — this is fine for now
# The warnings will be fixed in subsequent REFACTOR tasks

# Run format to normalize all files
npm run format
```

**Step 7: Commit the formatted files separately**

```bash
git add -A
git commit -m "refactor(REFACTOR-002): add ESLint flat config + Prettier + husky pre-commit hooks"
```

> **WHY separate commit?** Because the formatting commit will touch hundreds of files. If you mix it with config changes, the PR becomes unreadable.

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Setting `no-explicit-any` to `error` immediately | 600+ errors, CI permanently red | Use `warn` first, upgrade after REFACTOR-004–007 |
| Forgetting `eslint-config-prettier` | ESLint and Prettier fight over formatting | Always include it as the LAST config |
| Running `eslint --fix` on the entire codebase at once | Can introduce subtle bugs in auto-fixed code | Review auto-fixes in small batches |
| Not adding `.prettierignore` | Prettier reformats JSON configs and breaks them | Always create `.prettierignore` |
| Installing ESLint in both server/ and client/ | Version conflicts, different rule sets | Install at root only |

#### VERIFICATION

```bash
# 1. ESLint runs without crashing (warnings are OK, errors are not)
npm run lint 2>&1 | grep -c "error" # Should be 0 errors (warnings OK)

# 2. Prettier check passes (all files formatted)
npm run format:check && echo "✅ All files formatted"

# 3. TypeScript still compiles
cd server && npx tsc --noEmit && echo "✅ Server OK"
cd ../client && npx tsc --noEmit && echo "✅ Client OK"

# 4. Tests still pass
cd ../server && npm test && echo "✅ Tests OK"

# 5. Pre-commit hook works
echo "// test" >> server/src/index.ts
git add server/src/index.ts
git commit -m "test hook" # Should trigger lint-staged
git reset HEAD~1 --hard   # Undo test commit
```

#### ROLLBACK

```bash
# Remove all ESLint/Prettier config
rm eslint.config.mjs .prettierrc .prettierignore  # Note: actual file is .mjs not .js
rm -rf .husky
# Remove from package.json: lint, lint:fix, format, format:check scripts, lint-staged config
npm uninstall eslint @eslint/js typescript-eslint prettier eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh globals husky lint-staged
git checkout -- .  # Restore all formatted files to original
```

---

### REFACTOR-003: Tighten TypeScript Configuration

**Priority**: P0 — Critical | **Effort**: 3 hours | **Risk**: Medium
**Depends On**: REFACTOR-002

> **⚠️ STATUS (2026-02-16):** Reported as COMPLETE, but audit shows the flags described below are **STILL NOT APPLIED**:
>
> - `server/tsconfig.json`: Still MISSING `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
> - `client/tsconfig.app.json`: Still has `noUnusedLocals: false`, `noUnusedParameters: false`, `noImplicitReturns: false`, `noUncheckedIndexedAccess: false` (only `noFallthroughCasesInSwitch: true` is enabled)
> - **This task needs to be re-executed.** The instructions below remain accurate.

#### WHY This Matters

Both `server/tsconfig.json` and `client/tsconfig.app.json` have `strict: true` but are MISSING several important strictness flags:

**Server** (`server/tsconfig.json`) is missing:

- `noUnusedLocals` — allows declaring variables you never use
- `noUnusedParameters` — allows function parameters you never use
- `noImplicitReturns` — allows functions that sometimes return and sometimes don't
- `noFallthroughCasesInSwitch` — allows switch cases without `break`
- `noUncheckedIndexedAccess` — allows `array[0]` without checking if it exists

**Client** (`client/tsconfig.app.json`) explicitly DISABLES:

- `noUnusedLocals: false` (line 25)
- `noUnusedParameters: false` (line 26)
- `noImplicitReturns: false` (line 31)

These missing flags mean TypeScript silently allows bugs that would be caught at compile time.

#### BEFORE YOU START

- [ ] REFACTOR-002 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-003-ts-strict`
- [ ] Run `cd server && npx tsc --noEmit` — note the current error count (should be 0)
- [ ] Run `cd client && npx tsc --noEmit` — note the current error count (should be 0)

#### STEP-BY-STEP Instructions

**Step 1: Enable flags in `server/tsconfig.json` ONE AT A TIME**

> **CRITICAL**: Enable ONE flag, fix ALL errors, commit, then enable the next. Do NOT enable all flags at once — you'll get hundreds of errors and won't know which flag caused which error.

**Step 1a: Enable `noUnusedLocals`**

Edit `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "noUnusedLocals": true
  }
}
```

Run: `cd server && npx tsc --noEmit 2>&1 | head -50`

For each error like `'foo' is declared but its value is never read`:

- If the variable IS needed later → prefix with underscore: `const _foo = ...`
- If the variable is truly unused → DELETE the declaration
- If it's an import → remove the import

```bash
# After fixing all errors:
cd server && npx tsc --noEmit && echo "✅ noUnusedLocals clean"
git add -A && git commit -m "refactor(REFACTOR-003): enable noUnusedLocals in server, fix all errors"
```

**Step 1b: Enable `noUnusedParameters`**

Add to `server/tsconfig.json`:

```json
"noUnusedParameters": true
```

Run: `cd server && npx tsc --noEmit 2>&1 | head -50`

For each error like `'param' is declared but its value is never read`:

- If the parameter is required by an interface/callback signature → prefix with underscore: `(_req, res) => ...`
- If the parameter is truly unused → remove it (but check if callers pass it)

```bash
cd server && npx tsc --noEmit && echo "✅ noUnusedParameters clean"
git add -A && git commit -m "refactor(REFACTOR-003): enable noUnusedParameters in server, fix all errors"
```

**Step 1c: Enable `noImplicitReturns`**

Add to `server/tsconfig.json`:

```json
"noImplicitReturns": true
```

This catches functions where some code paths return a value and others don't. Fix by:

- Adding explicit `return undefined;` or `return;` at the end
- Or restructuring the function to always return

```bash
cd server && npx tsc --noEmit && echo "✅ noImplicitReturns clean"
git add -A && git commit -m "refactor(REFACTOR-003): enable noImplicitReturns in server, fix all errors"
```

**Step 1d: Enable `noFallthroughCasesInSwitch`**

Add to `server/tsconfig.json`:

```json
"noFallthroughCasesInSwitch": true
```

Fix by adding `break;` or `return` to each `case` block, or add `// falls through` comment if intentional.

```bash
cd server && npx tsc --noEmit && echo "✅ noFallthroughCasesInSwitch clean"
git add -A && git commit -m "refactor(REFACTOR-003): enable noFallthroughCasesInSwitch in server"
```

**Step 1e: Enable `noUncheckedIndexedAccess`**

Add to `server/tsconfig.json`:

```json
"noUncheckedIndexedAccess": true
```

> **WARNING**: This is the MOST disruptive flag. It makes `array[0]` return `T | undefined` instead of `T`. You'll get many errors. Fix by:
>
> - Adding null checks: `const first = array[0]; if (first) { ... }`
> - Using non-null assertion ONLY when you're 100% sure: `array[0]!` (use sparingly)
> - Using `.at(0)` with a null check

```bash
cd server && npx tsc --noEmit && echo "✅ noUncheckedIndexedAccess clean"
git add -A && git commit -m "refactor(REFACTOR-003): enable noUncheckedIndexedAccess in server"
```

**Step 2: Repeat for `client/tsconfig.app.json`**

Change these existing lines:

```json
"noUnusedLocals": true,       // was false
"noUnusedParameters": true,   // was false
"noImplicitReturns": true,    // was false
"noUncheckedIndexedAccess": true,  // was false
```

Follow the same one-at-a-time approach. Fix errors, commit after each flag.

**Step 3: Final server `tsconfig.json` should look like:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Enabling all flags at once | Hundreds of errors, impossible to debug | ONE flag at a time |
| Using `!` (non-null assertion) everywhere | Defeats the purpose of the flag | Only use when you have a runtime guarantee |
| Prefixing ALL unused params with `_` | Hides real dead code | Only prefix if the param is required by a signature |
| Skipping `noUncheckedIndexedAccess` | Most common source of runtime `undefined` errors | Do it, even though it's painful |

#### VERIFICATION

```bash
# Both projects compile with zero errors
cd server && npx tsc --noEmit && echo "✅ Server strict"
cd ../client && npx tsc --noEmit && echo "✅ Client strict"

# Tests still pass
cd ../server && npm test && echo "✅ Tests OK"

# Verify flags are actually enabled (not just added but commented out)
grep -c "noUnused" server/tsconfig.json  # Should be 2
grep -c "noImplicit" server/tsconfig.json  # Should be 1
```

#### ROLLBACK

If too many errors to fix in one session:

```bash
# Revert the tsconfig change for the problematic flag
git checkout -- server/tsconfig.json
# Or revert to the last working commit
git reset --hard HEAD~1
```

---

### REFACTOR-004: Eliminate `any` Types — Batch 1 (Server Core)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-003

> **⚠️ STATUS (2026-02-16):** Reported as COMPLETE. Note: `server/src/index.ts` is now **7,458 lines** (not ~5,987 as originally estimated) and `server/src/schema.ts` is now **2,145 lines** (not ~1,906). If this task was completed against the earlier file sizes, additional `any` types may have been introduced since then. Consider re-running the baseline count to verify.

#### WHY This Matters

`any` is TypeScript's escape hatch — it disables ALL type checking for that value. Every `any` in the codebase is a potential runtime crash that TypeScript can't warn you about. The server core files (`index.ts`, `schema.ts`, and core services) are the most critical because they handle every request.

Current state: The codebase has hundreds of `any` usages. We'll tackle them in 4 batches to keep PRs reviewable.

#### BEFORE YOU START

- [ ] REFACTOR-003 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-004-any-batch1`
- [ ] Count current `any` usage as baseline:

  ```bash
  grep -rn "\bany\b" server/src/index.ts server/src/schema.ts | grep -v "node_modules" | wc -l
  ```

- [ ] Understand the difference between these `any` patterns:
  - `catch (err: any)` — needs `unknown` + type narrowing
  - `as any` — needs proper type assertion or generic
  - `Record<string, any>` — needs specific interface
  - Function parameter `any` — needs proper type

#### STEP-BY-STEP Instructions

**Step 1: Fix `catch (err: any)` blocks — the easiest wins**

Search for all catch blocks in server core:

```bash
grep -n "catch.*any" server/src/index.ts server/src/schema.ts
```

Replace pattern:

```typescript
// BEFORE (unsafe):
} catch (err: any) {
    console.error('Failed:', err.message);
    return c.json({ error: err.message }, 500);
}

// AFTER (safe):
} catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed:', message);
    return c.json({ error: message }, 500);
}
```

> **WHY `unknown` instead of `any`?** Because `unknown` forces you to check the type before using it. With `any`, you can call `.message` on `null` and TypeScript won't warn you.

**Step 2: Fix `as any` type assertions in route handlers**

Search: `grep -n "as any" server/src/index.ts`

Common patterns and fixes:

```typescript
// Pattern 1: Response body casting
// BEFORE:
return c.body(buf as any);
// AFTER:
return c.body(buf as ArrayBuffer);

// Pattern 2: Database result casting
// BEFORE:
const result = await db.select().from(table).where(...) as any;
// AFTER: Define a proper type
interface TransactionRow {
    id: string;
    amount: number;
    description: string;
    // ... add all columns
}
const result: TransactionRow[] = await db.select().from(table).where(...);

// Pattern 3: JSON body parsing
// BEFORE:
const body = await c.req.json() as any;
// AFTER: Use Zod validation (preferred) or define interface
const body = await c.req.json<{ amount: number; description: string }>();
```

**Step 3: Fix `Record<string, any>` types**

Replace with specific interfaces:

```typescript
// BEFORE:
function processData(data: Record<string, any>) { ... }

// AFTER:
interface TransactionData {
    amount: number;
    description: string;
    date: string;
    categoryId?: string;
}
function processData(data: TransactionData) { ... }
```

**Step 4: Fix function parameter `any` types**

```typescript
// BEFORE:
app.post('/api/transactions', async (c: any) => { ... });

// AFTER: Hono provides proper types
app.post('/api/transactions', async (c) => { ... });
// Hono infers the context type automatically — just remove the explicit `any`
```

**Step 5: Commit after each file**

```bash
# After fixing index.ts:
git add server/src/index.ts
git commit -m "refactor(REFACTOR-004): eliminate any types in index.ts — N remaining"

# After fixing schema.ts:
git add server/src/schema.ts
git commit -m "refactor(REFACTOR-004): eliminate any types in schema.ts"
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Replacing `any` with `object` | `object` is almost as useless as `any` | Use specific interfaces |
| Using `as unknown as SpecificType` | Double assertion is a code smell | Fix the source of the type mismatch |
| Creating one giant `interface` for everything | Defeats the purpose of typing | One interface per domain concept |
| Ignoring generic type parameters | `Promise<any>` is still unsafe | Use `Promise<TransactionRow[]>` |

#### VERIFICATION

```bash
# 1. Count remaining `any` — should be significantly lower
grep -rn "\bany\b" server/src/index.ts server/src/schema.ts | wc -l
# Compare with baseline from "Before You Start"

# 2. TypeScript compiles
cd server && npx tsc --noEmit && echo "✅ Server OK"

# 3. Tests pass
cd server && npm test && echo "✅ Tests OK"

# 4. Server starts
cd server && timeout 10 npx tsx src/index.ts 2>&1 | head -5
```

#### ROLLBACK

```bash
git reset --hard HEAD~N  # Where N is the number of commits in this task
```

---

### REFACTOR-005: Eliminate `any` Types — Batch 2 (Server Services)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-004

#### WHY This Matters

Server services contain the business logic. `any` types here mean business rules can silently receive wrong data types, leading to incorrect calculations (imagine a tax calculation receiving a string instead of a number).

#### BEFORE YOU START

- [ ] REFACTOR-004 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-005-any-batch2`
- [ ] Count baseline:

  ```bash
  grep -rn "\bany\b" server/src/services/ --include="*.ts" | grep -v node_modules | wc -l
  ```

#### STEP-BY-STEP Instructions

**Step 1: Prioritize by risk — fix financial services first**

These files handle money and MUST have correct types:

1. `server/src/services/tax.ts`
2. `server/src/services/bas.ts`
3. `server/src/services/invoicing.ts`
4. `server/src/services/payment-matching.ts`
5. `server/src/services/bank-reconciliation.ts`
6. `server/src/services/loan-calculator.ts`

For each file:

```bash
grep -n "\bany\b" server/src/services/tax.ts
```

**Step 2: Apply the same patterns from REFACTOR-004**

- `catch (err: any)` → `catch (err: unknown)` + type narrowing
- `as any` → proper type assertion
- `Record<string, any>` → specific interface
- Function params `any` → proper types

**Step 3: For AI/external service files, use branded types**

Files like `ai.ts`, `vertex-ai.ts`, `ai-proxy.ts` often use `any` for API responses:

```typescript
// BEFORE:
async function callAI(prompt: string): Promise<any> { ... }

// AFTER: Define response types
interface AIResponse {
    content: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number };
}
async function callAI(prompt: string): Promise<AIResponse> { ... }
```

**Step 4: For Cognee/external integration files, use `unknown` + validators**

```typescript
// BEFORE:
const response: any = await fetch(cogneeUrl).then(r => r.json());

// AFTER:
const raw: unknown = await fetch(cogneeUrl).then(r => r.json());
const response = CogneeResponseSchema.parse(raw); // Zod validates at runtime
```

**Step 5: Commit after each service file**

```bash
git add server/src/services/tax.ts
git commit -m "refactor(REFACTOR-005): eliminate any in tax.ts"
```

#### VERIFICATION

Same as REFACTOR-004 but for services directory. Target: reduce `any` count by 200+.

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-006: Eliminate `any` Types — Batch 3 (Client)

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-005

#### WHY This Matters

The client's `api.ts` (2,763 lines) is the bridge between frontend and backend. `any` types here mean the UI can silently display wrong data or crash on unexpected API responses.

#### BEFORE YOU START

- [ ] REFACTOR-005 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-006-any-batch3`
- [ ] Count baseline:

  ```bash
  grep -rn "\bany\b" client/src/ --include="*.ts" --include="*.tsx" | wc -l
  ```

#### STEP-BY-STEP Instructions

**Step 1: Fix `client/src/api.ts` first — it's the biggest impact**

This file already has SOME interfaces (Transaction, Statement, etc.) but many API functions return `any`:

```typescript
// BEFORE:
export async function getTransactions(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/api/transactions`, { headers: getAuthHeaders() });
    return res.json();
}

// AFTER:
export async function getTransactions(): Promise<Transaction[]> {
    const res = await fetch(`${BASE_URL}/api/transactions`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
    return res.json() as Promise<Transaction[]>;
}
```

**Step 2: Fix component props**

```typescript
// BEFORE:
function TransactionRow({ data }: { data: any }) { ... }

// AFTER:
import type { Transaction } from '../api';
function TransactionRow({ data }: { data: Transaction }) { ... }
```

**Step 3: Fix event handlers**

```typescript
// BEFORE:
const handleChange = (e: any) => { setValue(e.target.value); };

// AFTER:
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { setValue(e.target.value); };
```

**Step 4: Fix state types**

```typescript
// BEFORE:
const [data, setData] = useState<any>(null);

// AFTER:
const [data, setData] = useState<Transaction[] | null>(null);
```

#### VERIFICATION

```bash
cd client && npx tsc --noEmit && echo "✅ Client OK"
grep -rn "\bany\b" client/src/ --include="*.ts" --include="*.tsx" | wc -l
# Compare with baseline
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-007: Eliminate `any` Types — Batch 4 (Final Sweep)

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Low
**Depends On**: REFACTOR-006

#### WHY This Matters

This is the cleanup pass. After batches 1-3, there will be remaining `any` types in edge cases: test files, type definition files, third-party integration shims, and generated code. The goal is to get to ZERO `any` or document every remaining one with a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment explaining WHY.

#### BEFORE YOU START

- [ ] REFACTOR-004, 005, 006 are complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-007-any-final`
- [ ] Get the full count:

  ```bash
  grep -rn "\bany\b" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
  ```

#### STEP-BY-STEP Instructions

**Step 1: Generate a full report of remaining `any` usages**

```bash
grep -rn "\bany\b" server/src/ client/src/ --include="*.ts" --include="*.tsx" | \
  grep -v node_modules | grep -v "\.test\." | \
  sort > /tmp/any-report.txt
cat /tmp/any-report.txt | wc -l
```

**Step 2: Categorize each remaining `any`**

For each line in the report, categorize:

- **FIXABLE**: Can be replaced with a proper type → fix it
- **THIRD-PARTY**: Required by a library's type signature → add `// eslint-disable-next-line` with explanation
- **GENERATED**: In generated/auto-created code → exclude from lint

**Step 3: Fix all FIXABLE instances**

Apply the same patterns from REFACTOR-004/005/006.

**Step 4: Document all THIRD-PARTY exceptions**

```typescript
// When a library forces `any` (e.g., pdf-parse returns `any`):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf-parse library returns untyped data
const pdfData: any = await pdfParse(buffer);
// TODO(REFACTOR): Create typed wrapper for pdf-parse
```

**Step 5: Upgrade ESLint rule from `warn` to `error`**

In `eslint.config.mjs`, change:

```javascript
'@typescript-eslint/no-explicit-any': 'error',  // Was 'warn'
```

Run `npm run lint` — it should pass with zero errors (all remaining `any` should have disable comments).

#### VERIFICATION

```bash
# 1. ESLint passes with no-explicit-any as error
npm run lint && echo "✅ Zero any warnings"

# 2. Count remaining (should be only documented exceptions)
grep -rn "\bany\b" server/src/ client/src/ --include="*.ts" --include="*.tsx" | \
  grep -v "eslint-disable" | grep -v node_modules | wc -l
# Target: < 20 (documented exceptions only)

# 3. Both compile
cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit
```

---

### REFACTOR-008: Replace console.log with Structured Logger

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-002

#### WHY This Matters

The codebase has ~894 `console.log/warn/error` calls. In production:

- `console.log` output is unstructured text — impossible to search/filter in log aggregators
- No log levels means you can't filter debug noise from real errors
- No request IDs means you can't trace a request across multiple log lines
- No timestamps in a consistent format
- `console.error` in catch blocks loses the stack trace structure

Enterprise apps use structured logging (JSON format) with levels, timestamps, request IDs, and context.

#### BEFORE YOU START

- [ ] REFACTOR-002 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-008-structured-logger`
- [ ] Count baseline:

  ```bash
  grep -rn "console\.\(log\|warn\|error\|info\|debug\)" server/src/ --include="*.ts" | wc -l
  ```

#### STEP-BY-STEP Instructions

**Step 1: Install pino (structured logger)**

```bash
cd server
npm install pino pino-pretty
npm install -D @types/pino  # If needed
```

> **WHY pino?** It's the fastest Node.js logger, outputs JSON by default, and has zero-overhead when log level is disabled. Used by Fastify, Hono ecosystem, and most enterprise Node apps.

**Step 2: Create the logger module**

> **NOTE (2026-02-16):** A basic logger already exists at `server/src/utils/logger.ts` (15 lines) — it's a simple console wrapper with `[INFO]`/`[ERROR]`/`[WARN]`/`[DEBUG]` prefixes. This is NOT a structured logger. Replace it with the pino-based implementation below. You may choose to place the new logger at `server/src/lib/logger.ts` (as described) or upgrade the existing file at `server/src/utils/logger.ts` — either way, update all imports accordingly.

Create file: `server/src/lib/logger.ts`

```typescript
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined, // In production, output raw JSON for log aggregators
  base: {
    service: 'goldledger-server',
    version: process.env.npm_package_version || '1.0.0',
  },
});

// Create child loggers for specific domains
export const dbLogger = logger.child({ module: 'database' });
export const authLogger = logger.child({ module: 'auth' });
export const apiLogger = logger.child({ module: 'api' });
export const aiLogger = logger.child({ module: 'ai' });
export const pipelineLogger = logger.child({ module: 'pipeline' });

export type Logger = pino.Logger;
```

**Step 3: Create request-scoped logger middleware**

Create file: `server/src/middleware/request-logger.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import { logger as baseLogger } from '../lib/logger.js';
import crypto from 'crypto';

export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  const startTime = Date.now();

  // Create request-scoped logger
  const reqLogger = baseLogger.child({
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  // Attach to context for use in route handlers
  c.set('logger', reqLogger);
  c.set('requestId', requestId);

  // Set response header
  c.header('x-request-id', requestId);

  reqLogger.info('Request started');

  await next();

  const duration = Date.now() - startTime;
  reqLogger.info({ status: c.res.status, duration }, 'Request completed');
});
```

**Step 4: Replace `console.log` calls — work file by file**

Start with `server/src/index.ts` (the most impactful file):

```typescript
// BEFORE:
console.log(`Server running on port ${port}`);

// AFTER:
import { logger } from './lib/logger.js';
logger.info({ port }, 'Server started');

// BEFORE:
console.error('Export failed:', err);

// AFTER:
const reqLogger = c.get('logger');
reqLogger.error({ err }, 'Export failed');

// BEFORE:
console.log(`[Pipeline] Processing statement ${id}`);

// AFTER:
import { pipelineLogger } from './lib/logger.js';
pipelineLogger.info({ statementId: id }, 'Processing statement');
```

> **IMPORTANT**: Replace ONE file at a time. After each file, run `npx tsc --noEmit` and `npm test`.

**Step 5: Replace in service files**

Work through services in order of importance:

1. `pipeline.ts` — most log-heavy
2. `ai.ts`, `ai-proxy.ts` — AI service logging
3. `bank-reconciliation.ts` — financial operations
4. All remaining services

**Step 6: Upgrade ESLint `no-console` rule to `error`**

In `eslint.config.mjs`:

```javascript
'no-console': 'error',  // Was 'warn'
```

**Step 7: Add logger to Hono app initialization**

In `server/src/index.ts`:

```typescript
import { requestLogger } from './middleware/request-logger.js';

// Add BEFORE other middleware
app.use('*', requestLogger);
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Using `logger.info(err)` for errors | Loses stack trace | Use `logger.error({ err }, 'message')` — pino serializes Error objects |
| Logging sensitive data (passwords, tokens) | Security breach | Never log `req.body` for auth routes |
| Using string interpolation in log messages | Can't search/filter structured fields | Use `logger.info({ userId, action }, 'User action')` |
| Forgetting to add `pino-pretty` for dev | JSON logs are unreadable in terminal | Always configure transport for dev |

#### VERIFICATION

```bash
# 1. Zero console.log remaining (except in test files)
grep -rn "console\.\(log\|warn\|error\)" server/src/ --include="*.ts" | grep -v "\.test\." | wc -l
# Target: 0

# 2. ESLint passes with no-console as error
npm run lint && echo "✅ No console calls"

# 3. Server starts and logs in structured format
cd server && npx tsx src/index.ts 2>&1 | head -5
# Should see JSON or pretty-printed structured logs

# 4. Tests pass
cd server && npm test
```

#### ROLLBACK

```bash
# Revert to before logger changes
git reset --hard HEAD~N
# Uninstall pino
cd server && npm uninstall pino pino-pretty
```

---

### REFACTOR-009: Remove Hardcoded Secrets

**Priority**: P0 — Critical | **Effort**: 2 hours | **Risk**: High (if done wrong)
**Depends On**: REFACTOR-002

#### WHY This Matters

Hardcoded secrets (API keys, database passwords, JWT secrets) in source code are the #1 security vulnerability in web applications. If the repo is ever made public, or a developer's laptop is compromised, ALL secrets are exposed. Even in private repos, secrets in code mean:

- Can't rotate secrets without a code deploy
- Every developer has access to production secrets
- Secrets appear in git history forever (even after deletion)

#### BEFORE YOU START

- [ ] REFACTOR-002 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-009-remove-secrets`
- [ ] You have access to the `.env` file (or `.env.example`)
- [ ] Scan for hardcoded secrets:

  ```bash
  grep -rn "sk-\|sk_live\|pk_live\|AKIA\|password.*=.*['\"]" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
  grep -rn "secret.*=.*['\"]" server/src/ --include="*.ts" | grep -v "process\.env" | grep -v node_modules
  ```

#### STEP-BY-STEP Instructions

**Step 1: Audit ALL environment variable usage**

```bash
# Find all process.env references
grep -rn "process\.env\." server/src/ --include="*.ts" | sort -u
```

Create a checklist of every env var used. Verify each one exists in `.env.example`.

**Step 2: Find hardcoded values that SHOULD be env vars**

Look for:

- JWT secret strings: `const secret = 'some-secret'`
- API keys: `const apiKey = 'sk-...'`
- Database URLs: `const dbUrl = 'postgres://...'`
- Port numbers that should be configurable: `const port = 3501`

```bash
grep -rn "const.*secret\|const.*apiKey\|const.*password\|const.*token" server/src/ --include="*.ts" | grep -v "process\.env"
```

**Step 3: Replace each hardcoded value with `process.env`**

```typescript
// BEFORE:
const JWT_SECRET = 'my-super-secret-key';

// AFTER:
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
```

> **CRITICAL**: Always add a startup check that throws if a required env var is missing. Silent fallbacks to default secrets are WORSE than hardcoded secrets because they're invisible.

**Step 4: Create a centralized config module**

Create file: `server/src/lib/config.ts`

```typescript
function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optionalEnv(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
}

export const config = {
    port: parseInt(optionalEnv('PORT', '3501'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    jwtSecret: requireEnv('JWT_SECRET'),
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
    openrouterApiKey: requireEnv('OPENROUTER_API_KEY'),
    // Add ALL env vars here
} as const;
```

**Step 5: Update `.env.example` with ALL required variables**

```bash
# .env.example — copy to .env and fill in values
JWT_SECRET=change-me-to-a-random-string
DATABASE_URL=file:./goldledger.db
OPENROUTER_API_KEY=your-key-here
REDIS_URL=redis://localhost:6379
PORT=3501
NODE_ENV=development
```

**Step 6: Add `.env` to `.gitignore` (if not already)**

```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
# But NOT .env.example — that should be tracked
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Using default values for secrets | `JWT_SECRET || 'default'` means production runs with 'default' | Use `requireEnv()` — crash on startup if missing |
| Committing `.env` to git | Secrets in git history forever | Add to `.gitignore` BEFORE creating the file |
| Only checking server code | Client might have API keys too | Check `client/src/` as well |
| Forgetting to update Docker configs | Docker Compose might have hardcoded values | Check `docker-compose.yml` too |

#### VERIFICATION

```bash
# 1. No hardcoded secrets in source
grep -rn "sk-\|sk_live\|pk_live\|AKIA" server/src/ client/src/ --include="*.ts" --include="*.tsx" | wc -l
# Target: 0

# 2. Server starts with .env file
cd server && npx tsx src/index.ts 2>&1 | head -5
# Should start normally

# 3. Server FAILS without .env (proves env vars are required)
cd server && env -i npx tsx src/index.ts 2>&1 | head -5
# Should see "Missing required environment variable" error

# 4. .env is in .gitignore
git status | grep ".env"  # Should NOT show .env as untracked
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-010: Fix TODO/FIXME Comments

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: Low
**Depends On**: REFACTOR-002

#### WHY This Matters

TODO and FIXME comments are technical debt markers. They indicate known issues that were deferred. Left unaddressed, they accumulate and become invisible. This task triages them: fix the easy ones, create tickets for the hard ones, and remove the stale ones.

#### BEFORE YOU START

- [ ] REFACTOR-002 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-010-fix-todos`
- [ ] Generate the full TODO report:

  ```bash
  grep -rn "TODO\|FIXME\|HACK\|XXX\|WORKAROUND" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules > /tmp/todo-report.txt
  wc -l /tmp/todo-report.txt
  ```

#### STEP-BY-STEP Instructions

**Step 1: Categorize each TODO/FIXME**

Read through `/tmp/todo-report.txt` and categorize each item:

| Category | Action | Example |
|----------|--------|---------|
| **STALE** | Delete the comment — the issue was already fixed | `// TODO: add validation` (but validation exists) |
| **QUICK-FIX** | Fix it now (< 15 min) | `// FIXME: handle null case` |
| **TICKET** | Create a GitHub issue, update comment with issue # | `// TODO: implement caching` (needs design) |
| **REFACTOR-TASK** | Already covered by another REFACTOR task | `// TODO: extract to service` → REFACTOR-017 |

**Step 2: Delete STALE comments**

For each stale TODO, verify the issue is actually resolved, then delete the comment:

```bash
# Search for the specific TODO
grep -n "TODO.*add validation" server/src/services/tax.ts
# Verify validation exists in the function
# Delete the comment line
```

**Step 3: Fix QUICK-FIX items**

These are small fixes that take < 15 minutes each. Fix them inline:

```typescript
// BEFORE:
// FIXME: handle null case
const name = user.name.toUpperCase();

// AFTER:
const name = user.name?.toUpperCase() ?? 'UNKNOWN';
```

**Step 4: Convert TICKET items to standardized format**

```typescript
// BEFORE:
// TODO: implement caching for this endpoint

// AFTER:
// TODO(PERF): Implement Redis caching for dashboard endpoint — see REFACTOR-046
```

**Step 5: Remove REFACTOR-TASK items that are covered**

```typescript
// BEFORE:
// TODO: extract this to a service class

// AFTER: (delete the comment — REFACTOR-017 covers this)
```

**Step 6: Add ESLint rule to track remaining TODOs**

In `eslint.config.mjs`, add:

```javascript
'no-warning-comments': ['warn', { terms: ['FIXME', 'HACK', 'XXX'], location: 'start' }],
```

> **NOTE**: We use `warn` not `error` for TODOs — they're acceptable as long as they're tracked. But FIXME/HACK/XXX should be resolved.

#### VERIFICATION

```bash
# 1. Count remaining TODOs (should be significantly fewer)
grep -rn "TODO\|FIXME\|HACK\|XXX" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l

# 2. All remaining TODOs have standardized format
grep -rn "TODO" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v "TODO(" | grep -v node_modules
# Target: 0 (all TODOs should have a category like TODO(PERF), TODO(SECURITY), etc.)

# 3. TypeScript compiles
cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit

# 4. Tests pass
cd server && npm test
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

## Phase 2: Architecture & Structure (REFACTOR-011 to REFACTOR-030)

> **Goal**: Transform the monolithic architecture into a layered, modular structure.
> **Risk Level**: MEDIUM-HIGH — these changes restructure how code is organized.
> **Estimated Duration**: 2-3 weeks for a single developer.
> **CRITICAL**: This phase has the highest risk of breaking things. Follow the dependency order EXACTLY.

---

### REFACTOR-011: Create Shared Types Package

**Priority**: P0 — Critical | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-003

#### WHY This Matters

Currently, the client and server define the SAME types independently. For example, `Transaction` is defined in `client/src/api.ts` AND inferred from `server/src/schema.ts`. When one changes, the other silently becomes out of sync. A shared types package means:

- ONE source of truth for all domain types
- Client and server always agree on data shapes
- Changes to types are caught at compile time in BOTH projects

#### BEFORE YOU START

- [ ] REFACTOR-003 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-011-shared-types`
- [ ] Understand the current type situation:

  ```bash
  # Find all interface/type definitions in client api.ts
  grep -n "^export interface\|^export type" client/src/api.ts | head -30
  # Find all table definitions in server schema
  grep -n "export const.*=.*Table" server/src/schema.ts | head -30
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create the shared types directory**

```bash
mkdir -p packages/shared/src
```

**Step 2: Initialize the package**

Create `packages/shared/package.json`:

```json
{
  "name": "@goldledger/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./src/index.ts", "types": "./src/index.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Extract domain types from client/src/api.ts**

Look at the interfaces in `api.ts` and create corresponding files:

Create `packages/shared/src/types/transaction.ts`:

```typescript
export interface Transaction {
    id: string;
    statementId: string;
    date: string;
    description: string;
    amount: number;
    balance: number | null;
    category: string | null;
    gstCode: string | null;
    gstAmount: number | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTransactionInput {
    statementId: string;
    date: string;
    description: string;
    amount: number;
    category?: string;
}

export interface UpdateTransactionInput {
    description?: string;
    amount?: number;
    category?: string;
    gstCode?: string;
}
```

Create similar files for: `statement.ts`, `account.ts`, `user.ts`, `invoice.ts`, `settings.ts`, etc.

**Step 4: Create barrel export**

Create `packages/shared/src/index.ts`:

```typescript
export * from './types/transaction.js';
export * from './types/statement.js';
export * from './types/account.js';
export * from './types/user.js';
export * from './types/invoice.js';
export * from './types/settings.js';
// Add more as needed
```

**Step 5: Configure path aliases in server and client**

In `server/tsconfig.json`, add:

```json
"paths": {
    "@goldledger/shared": ["../packages/shared/src"],
    "@goldledger/shared/*": ["../packages/shared/src/*"]
}
```

In `client/tsconfig.app.json`, add to `paths`:

```json
"@goldledger/shared": ["../packages/shared/src"],
"@goldledger/shared/*": ["../packages/shared/src/*"]
```

**Step 6: Update imports gradually**

Do NOT change all imports at once. Start with ONE type in ONE file:

```typescript
// BEFORE (in client/src/api.ts):
export interface Transaction { ... }

// AFTER:
import type { Transaction } from '@goldledger/shared';
export type { Transaction }; // Re-export for backward compatibility
```

> **IMPORTANT**: Keep the re-export for backward compatibility. Other files that import from `api.ts` will still work. Remove re-exports in a later cleanup pass.

**Step 7: Verify both projects compile**

```bash
cd packages/shared && npx tsc --noEmit && echo "✅ Shared OK"
cd ../../server && npx tsc --noEmit && echo "✅ Server OK"
cd ../client && npx tsc --noEmit && echo "✅ Client OK"
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Putting runtime code in shared types | Shared package should be types-only (no runtime deps) | Only `interface`, `type`, `enum`, `const` (for enums) |
| Changing all imports at once | One wrong import breaks everything | Change ONE file, verify, commit, repeat |
| Not re-exporting from original location | Breaks all existing imports | Always re-export for backward compat |
| Making shared types too specific | Coupling shared types to implementation details | Only share domain types, not internal types |

#### VERIFICATION

```bash
# All three projects compile
cd packages/shared && npx tsc --noEmit
cd ../../server && npx tsc --noEmit
cd ../client && npx tsc --noEmit

# Tests pass
cd ../server && npm test
```

#### ROLLBACK

```bash
rm -rf packages/shared
git checkout -- server/tsconfig.json client/tsconfig.app.json
```

---

### REFACTOR-012: Extract Auth Routes from index.ts

**Priority**: P0 — Critical | **Effort**: 4 hours | **Risk**: High
**Depends On**: REFACTOR-011

#### WHY This Matters

`server/src/index.ts` is **7,458 lines** — a massive monolith containing most route definitions. This is the single biggest architectural problem. We'll extract routes domain-by-domain, starting with auth because:

- Auth routes are self-contained (no complex dependencies on other routes)
- They're the first routes in the file (lines ~149-230)
- They establish the pattern for all subsequent extractions

#### BEFORE YOU START

- [ ] REFACTOR-011 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-012-auth-routes`
- [ ] Study the GOOD example: `server/src/routes/invoicing-routes.ts` — this is the pattern to follow
- [ ] Read lines 149-230 of `server/src/index.ts` to understand current auth routes
- [ ] Identify all auth-related imports in index.ts

#### STEP-BY-STEP Instructions

**Step 1: Study the target pattern (invoicing-routes.ts)**

Open `server/src/routes/invoicing-routes.ts` and note the pattern:

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
// ... service imports

const invoicingRoutes = new Hono();

// Zod schemas for this domain
const createCustomerSchema = z.object({ ... });

// Route handlers
invoicingRoutes.get('/customers', async (c) => { ... });
invoicingRoutes.post('/customers', zValidator('json', createCustomerSchema), async (c) => { ... });

export default invoicingRoutes;
```

Then in `index.ts`:

```typescript
import invoicingRoutes from './routes/invoicing-routes.js';
app.route('/api/invoicing', invoicingRoutes);
```

> **NOTE (2026-02-16):** `server/src/routes/auth-routes.ts` already exists (62 lines) with some auth routes partially extracted. Review this file first — you may need to extend it rather than create a new `auth.ts`. The existing file follows the Hono pattern described above.

**Step 2: Create `server/src/routes/auth.ts`** *(or extend existing `auth-routes.ts`)*

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, users } from '../schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword, generateToken } from '../auth.js';
import crypto from 'crypto';

const authRoutes = new Hono();

// Validation schemas
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

// POST /register
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
    // Copy the EXACT logic from index.ts lines ~149-180
    // Do NOT change any business logic — just move it
    // ...
});

// POST /login
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
    // Copy the EXACT logic from index.ts lines ~181-210
    // ...
});

// GET /me (requires JWT — will be protected by middleware in index.ts)
authRoutes.get('/me', async (c) => {
    // Copy the EXACT logic from index.ts
    // ...
});

export default authRoutes;
```

> **CRITICAL RULE**: When extracting routes, **COPY the logic EXACTLY as-is**. Do NOT refactor, clean up, or improve the code during extraction. That comes in later tasks (REFACTOR-017+). Mixing extraction with refactoring is the #1 cause of bugs.

**Step 3: Mount the new route file in index.ts**

In `server/src/index.ts`, add:

```typescript
import authRoutes from './routes/auth.js';

// Mount BEFORE the JWT middleware (auth routes are public)
app.route('/auth', authRoutes);
```

**Step 4: Delete the old auth routes from index.ts**

Remove the original route handlers (lines ~149-230) from `index.ts`. Keep the imports that are still used by other routes.

**Step 5: Verify the auth flow works**

```bash
# 1. TypeScript compiles
cd server && npx tsc --noEmit

# 2. Tests pass
npm test

# 3. Manual test — register
curl -X POST http://localhost:3501/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","name":"Test"}'

# 4. Manual test — login
curl -X POST http://localhost:3501/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}'
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Refactoring logic during extraction | Introduces bugs in two places at once | COPY exactly, refactor later |
| Forgetting to update route paths | `/auth/login` might become `/login` if mounted at `/auth` | Test every endpoint |
| Not handling JWT middleware correctly | Auth routes should be PUBLIC, API routes need JWT | Mount auth routes BEFORE JWT middleware |
| Leaving dead imports in index.ts | Unused imports cause lint errors | Clean up imports after extraction |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Manual test all auth endpoints
# Check index.ts line count decreased by ~80 lines
wc -l server/src/index.ts  # Should decrease by ~80 lines from current 7,458
```

---

### REFACTOR-013: Extract Transaction Routes from index.ts

**Priority**: P0 — Critical | **Effort**: 6 hours | **Risk**: High
**Depends On**: REFACTOR-012

#### WHY This Matters

Transaction routes are the LARGEST route group in `index.ts` (~200+ lines). They handle CRUD operations, exports (CSV/Excel), filtering, categorization, and bulk operations. Extracting them is the single biggest reduction in `index.ts` size.

#### BEFORE YOU START

- [ ] REFACTOR-012 is complete and merged (auth routes extracted successfully)
- [ ] Branch: `git checkout -b refactor/REFACTOR-013-transaction-routes`
- [ ] Map ALL transaction routes in index.ts:

  ```bash
  grep -n "app\.\(get\|post\|put\|patch\|delete\).*transaction\|app\.\(get\|post\|put\|patch\|delete\).*export" server/src/index.ts
  ```

#### STEP-BY-STEP Instructions

**Step 1: Identify ALL transaction-related routes**

Search `index.ts` for routes containing "transaction" or related paths:

- `GET /api/transactions` — list with filters
- `GET /api/transactions/:id` — get single
- `POST /api/transactions` — create
- `PATCH /api/transactions/:id` — update
- `DELETE /api/transactions/:id` — delete
- `POST /api/transactions/bulk-categorize` — bulk operations
- `GET /api/transactions/export` — CSV/Excel export
- Any other transaction-related endpoints

**Step 2: Create `server/src/routes/transactions.ts`**

Follow the EXACT same pattern as REFACTOR-012:

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, transactions } from '../schema.js';
import { eq, and, desc, like, between, sql } from 'drizzle-orm';
// ... copy ALL imports needed by transaction routes

const transactionRoutes = new Hono();

// Copy ALL transaction route handlers from index.ts
// EXACT copy — no refactoring

export default transactionRoutes;
```

**Step 3: Handle the CSV generation helper**

The `generateCSV` function (defined inline in index.ts around line 422) is used by the export route. Move it into the route file or into a utility:

```typescript
// Option A: Move into the route file (simpler)
function generateCSV(data: any[]): string { ... }

// Option B: Create utility file (better for reuse)
// server/src/utils/csv.ts
export function generateCSV(data: Record<string, unknown>[]): string { ... }
```

**Step 4: Mount in index.ts**

```typescript
import transactionRoutes from './routes/transactions.js';
app.route('/api/transactions', transactionRoutes);
```

> **PATH WARNING**: If the original routes are `/api/transactions/...` and you mount at `/api/transactions`, then inside the route file the paths become `/`, `/:id`, `/export`, etc. (the prefix is stripped). Double-check every path.

**Step 5: Delete old routes from index.ts and verify**

```bash
cd server && npx tsc --noEmit && npm test
wc -l server/src/index.ts  # Should decrease by ~200+ lines
```

#### VERIFICATION

```bash
# TypeScript + tests
cd server && npx tsc --noEmit && npm test

# Manual test key endpoints
TOKEN=$(curl -s -X POST http://localhost:3501/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234"}' | jq -r '.token')
curl -H "Authorization: Bearer $TOKEN" http://localhost:3501/api/transactions
curl -H "Authorization: Bearer $TOKEN" http://localhost:3501/api/transactions/export?format=csv
```

---

### REFACTOR-014: Extract Account Routes from index.ts

**Priority**: P0 — Critical | **Effort**: 4 hours | **Risk**: High
**Depends On**: REFACTOR-012

#### WHY This Matters

Account routes handle chart-of-accounts CRUD, account balances, and account reconciliation. They're the second most important domain after transactions. Extracting them continues the systematic decomposition of `index.ts` and further reduces its size.

#### BEFORE YOU START

- [ ] REFACTOR-012 is complete and merged (auth routes extracted)
- [ ] Branch: `git checkout -b refactor/REFACTOR-014-account-routes`
- [ ] Map ALL account routes in index.ts:

  ```bash
  grep -n "app\.\(get\|post\|put\|patch\|delete\).*account\|app\.\(get\|post\|put\|patch\|delete\).*chart" server/src/index.ts
  ```

- [ ] Note which imports are used ONLY by account routes (these move to the new file)

#### STEP-BY-STEP Instructions

**Step 1: Identify ALL account-related routes**

Look for routes matching these patterns:

- `GET /api/accounts` — list accounts
- `POST /api/accounts` — create account
- `GET /api/accounts/:id` — get single account
- `PATCH /api/accounts/:id` — update account
- `DELETE /api/accounts/:id` — delete account
- `GET /api/chart-of-accounts` — chart of accounts tree
- Any balance, reconciliation, or history endpoints for accounts

**Step 2: Create `server/src/routes/accounts.ts`**

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, accounts, accountBalanceHistory } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
// ... copy ALL imports needed by account routes

const accountRoutes = new Hono();

// Copy ALL account route handlers from index.ts
// EXACT copy — no refactoring

export default accountRoutes;
```

> **REMINDER**: COPY logic exactly. Do NOT rename variables, change error messages, or "improve" anything. That's REFACTOR-018's job.

**Step 3: Mount in index.ts**

```typescript
import accountRoutes from './routes/accounts.js';
app.route('/api/accounts', accountRoutes);
// If chart-of-accounts has a different prefix:
// app.route('/api/chart-of-accounts', chartRoutes);
```

**Step 4: Handle shared helpers**

If account routes use helper functions defined elsewhere in `index.ts` (like `getUserId`), either:

- Move the helper to `server/src/utils/auth-helpers.ts` and import from both files
- Or duplicate it temporarily (mark with `// TODO(REFACTOR): consolidate with index.ts`)

**Step 5: Delete old routes from index.ts, clean up imports, verify**

```bash
cd server && npx tsc --noEmit && npm test
wc -l server/src/index.ts  # Should decrease by ~200+ lines
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Missing the `getUserId` helper | Account routes use it but it's defined in index.ts | Extract to shared utility |
| Forgetting account balance history routes | They're separate from CRUD but related | Search for ALL `/api/account` patterns |
| Wrong path prefix | `/api/accounts/:id` becomes `/:id` when mounted at `/api/accounts` | Test every endpoint |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Test account CRUD
TOKEN=$(curl -s -X POST http://localhost:3501/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234"}' | jq -r '.token')
curl -H "Authorization: Bearer $TOKEN" http://localhost:3501/api/accounts
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-015: Extract Remaining Routes from index.ts (Batch 1)

**Priority**: P0 — Critical | **Effort**: 8 hours | **Risk**: High
**Depends On**: REFACTOR-013, REFACTOR-014

> **NOTE (2026-02-16):** Five route files already exist in `server/src/routes/`:
>
> - `auth-routes.ts` (62 lines) — partial auth extraction
> - `agents.ts` (129 lines) — agent routes
> - `pipeline.ts` (365 lines) — pipeline routes
> - `invoicing-routes.ts` (375 lines) — invoicing routes
> - `agent-routes-extended.ts` (477 lines) — extended agent routes
>
> Despite these extractions, `index.ts` is still **7,458 lines**. Account for existing route files when planning extractions — some domains listed below may already be partially extracted. Check `server/src/routes/` before creating new files.

#### WHY This Matters

After extracting auth, transactions, and accounts, `index.ts` still has thousands of lines of routes. This batch extracts the next 4 major domains: statements, reports, dashboard, and settings. The goal is to get `index.ts` below 2,000 lines.

#### BEFORE YOU START

- [ ] REFACTOR-013 and REFACTOR-014 are complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-015-routes-batch1`
- [ ] Map remaining route groups:

  ```bash
  grep -n "app\.\(get\|post\|put\|patch\|delete\).*'/api/" server/src/index.ts | \
    sed "s/.*'\(\/api\/[^/']*\).*/\1/" | sort -u
  ```

  This shows all unique API path prefixes still in index.ts.

#### STEP-BY-STEP Instructions

> **IMPORTANT**: Extract ONE route file at a time. After each file: compile, test, commit. Do NOT extract all 4 at once.

**Step 1: Extract statement routes → `server/src/routes/statements.ts`**

Statement routes handle:

- Statement upload (PDF/CSV)
- Statement listing and detail
- Statement processing/parsing
- Statement deletion

```bash
grep -n "app\.\(get\|post\|put\|patch\|delete\).*statement" server/src/index.ts
```

Create `server/src/routes/statements.ts`, copy all statement handlers, mount at `/api/statements`.

```bash
cd server && npx tsc --noEmit && npm test
git add -A && git commit -m "refactor(REFACTOR-015): extract statement routes"
```

**Step 2: Extract report routes → `server/src/routes/reports.ts`**

Report routes handle:

- Financial reports (P&L, balance sheet, trial balance)
- Report generation and export
- Report scheduling

```bash
grep -n "app\.\(get\|post\).*report\|app\.\(get\|post\).*financial" server/src/index.ts
```

Create, mount, verify, commit.

**Step 3: Extract dashboard routes → `server/src/routes/dashboard.ts`**

Dashboard routes handle:

- Dashboard data aggregation
- Widget data endpoints
- Dashboard CRUD (custom dashboards)

The codebase has a `DashboardService` — routes likely delegate to it:

```bash
grep -n "app\.\(get\|post\|put\|delete\).*dashboard" server/src/index.ts
```

Create, mount, verify, commit.

**Step 4: Extract settings routes → `server/src/routes/settings.ts`**

Settings routes handle:

- User preferences
- Organization settings
- Notification preferences

```bash
grep -n "app\.\(get\|post\|put\|patch\).*setting\|app\.\(get\|post\|put\|patch\).*preference" server/src/index.ts
```

Create, mount, verify, commit.

**Step 5: Verify index.ts size reduction**

```bash
wc -l server/src/index.ts
# Target: < 2,000 lines (was 7,458 as of 2026-02-16)
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Extracting all 4 at once | If something breaks, you don't know which extraction caused it | ONE file at a time, commit after each |
| Missing service instantiations | Some routes create service instances at module level | Move service instantiation into the route file |
| Forgetting file upload middleware | Statement routes use multer/multipart | Ensure upload middleware is configured in the route file |
| Breaking the import chain | Removing an import used by remaining routes | Only remove imports that are EXCLUSIVELY used by extracted routes |

#### VERIFICATION

```bash
# Full verification after all 4 extractions
cd server && npx tsc --noEmit && npm test

# Check route files exist
ls -la server/src/routes/statements.ts server/src/routes/reports.ts server/src/routes/dashboard.ts server/src/routes/settings.ts

# Check index.ts is smaller
wc -l server/src/index.ts  # Target: < 2,000 lines
```

#### ROLLBACK

```bash
# If one extraction broke things, revert just that commit
git log --oneline -5  # Find the bad commit
git revert <commit-hash>
```

---

### REFACTOR-016: Extract Remaining Routes from index.ts (Batch 2 — Final)

**Priority**: P0 — Critical | **Effort**: 12 hours | **Risk**: High
**Depends On**: REFACTOR-015

#### WHY This Matters

This is the FINAL route extraction. After this task, `index.ts` should contain ONLY: imports, middleware setup, route mounting, and server start — under 300 lines. The remaining domains are: payroll, tax, BAS, employees, teams, subscriptions, suppliers, bills, purchase orders, budgets, cash flow, market data, AI/chat, admin, and all other endpoints.

#### BEFORE YOU START

- [ ] REFACTOR-015 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-016-routes-batch2`
- [ ] Count remaining routes in index.ts:

  ```bash
  grep -c "app\.\(get\|post\|put\|patch\|delete\)" server/src/index.ts
  ```

- [ ] List all remaining API prefixes:

  ```bash
  grep -n "app\.\(get\|post\|put\|patch\|delete\).*'/api/" server/src/index.ts | \
    sed "s/.*'\(\/api\/[^/']*\).*/\1/" | sort | uniq -c | sort -rn
  ```

#### STEP-BY-STEP Instructions

> **GOLDEN RULE**: Extract ONE domain at a time. Compile → test → commit after EACH extraction. This task will produce 8-12 commits.

**Step 1: Extract BAS/Tax routes → `server/src/routes/tax.ts`**

BAS and tax routes are tightly coupled. Group them together:

- `/api/bas/*` — BAS quarters, calculations, lodgement
- `/api/tax/*` — tax calculations, brackets, returns

```bash
grep -n "app\.\(get\|post\).*bas\|app\.\(get\|post\).*tax" server/src/index.ts
```

Note: These routes instantiate `BASService` and `TaxService` at module level. Move those instantiations into the route file.

**Step 2: Extract payroll routes → `server/src/routes/payroll.ts`**

- `/api/payroll/*` — pay runs, pay slips, STP
- `/api/employees/*` — employee CRUD, bank details, super funds

```bash
grep -n "app\.\(get\|post\|put\|patch\|delete\).*payroll\|app\.\(get\|post\|put\|patch\|delete\).*employee" server/src/index.ts
```

**Step 3: Extract team/subscription routes → `server/src/routes/teams.ts`**

- `/api/teams/*` — team CRUD, invitations, members
- `/api/subscriptions/*` — subscription management

**Step 4: Extract supplier/bill/PO routes → `server/src/routes/ap.ts`** (accounts payable)

These are already well-structured with service delegation:

- `/api/suppliers/*` — supplier CRUD
- `/api/bills/*` — bill CRUD, approval
- `/api/purchase-orders/*` — PO CRUD, send

**Step 5: Extract budget/forecast routes → `server/src/routes/budgets.ts`**

- `/api/budgets/*` — budget CRUD
- `/api/cash-flow/*` — cash flow forecasting

**Step 6: Extract market data routes → `server/src/routes/market-data.ts`**

- `/api/market/*` — market prices, economic indicators, alerts

**Step 7: Extract AI/chat routes → `server/src/routes/chat.ts`**

- `/api/chat` — AI chat streaming (uses Vercel AI SDK)
- `/api/ai/*` — AI-related endpoints

> **WARNING**: Chat routes use streaming (SSE). Make sure the streaming middleware is properly configured in the route file.

**Step 8: Extract admin routes → `server/src/routes/admin.ts`**

- `/api/admin/*` — admin panel endpoints

**Step 9: Extract any remaining routes**

After steps 1-8, check what's left:

```bash
grep -n "app\.\(get\|post\|put\|patch\|delete\)" server/src/index.ts
```

Any remaining routes should go into appropriate domain files or a `server/src/routes/misc.ts` as a last resort.

**Step 10: Clean up index.ts to be a pure composition root**

The final `index.ts` should look like:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
// ... middleware imports
// ... route imports

const app = new Hono();

// Middleware
app.use('/*', cors({ ... }));
app.use('*', requestLogger);
app.use('/api/*', jwtMiddleware);

// Route mounting
app.route('/auth', authRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/statements', statementRoutes);
// ... all other routes

// Health check
app.get('/api/health/ping', (c) => c.json({ status: 'ok' }));

// Start server
const port = parseInt(process.env.PORT || '3501', 10);
serve({ fetch: app.fetch, port });
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Trying to extract everything in one commit | Impossible to debug if something breaks | ONE domain per commit |
| Forgetting service instantiations | `const basService = new BASService()` is in index.ts | Move to route file |
| Missing the `app.route('/api', pipelineRoutes)` pattern | Some routes are already mounted via `app.route` | Don't re-extract already-extracted routes |
| Breaking streaming endpoints | Chat uses SSE which needs special handling | Test streaming manually |

#### VERIFICATION

```bash
# Final verification
cd server && npx tsc --noEmit && npm test

# index.ts should be tiny
wc -l server/src/index.ts  # Target: < 300 lines

# List all route files
ls -la server/src/routes/
# Should see: auth.ts, transactions.ts, accounts.ts, statements.ts, reports.ts,
# dashboard.ts, settings.ts, tax.ts, payroll.ts, teams.ts, ap.ts, budgets.ts,
# market-data.ts, chat.ts, admin.ts, agents.ts, pipeline.ts, invoicing-routes.ts

# Count total routes (should match original)
grep -c "app\.\(get\|post\|put\|patch\|delete\)\|Routes\.\(get\|post\|put\|patch\|delete\)" server/src/routes/*.ts
```

#### ROLLBACK

```bash
git log --oneline -15  # Find the commit before this task
git reset --hard <commit-hash>
```

---

### REFACTOR-017: Create Service Layer for Transactions

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-013

#### WHY This Matters

After route extraction (REFACTOR-013), transaction route handlers still contain business logic mixed with HTTP concerns. The route handler does: parse request → query DB → apply business rules → format response — all in one function. Enterprise architecture separates these:

- **Route handler**: Parse HTTP request, call service, return HTTP response
- **Service**: Business logic, validation, orchestration
- **Repository**: Data access (added in REFACTOR-019)

This separation enables: unit testing business logic without HTTP, reusing logic across routes, and clear responsibility boundaries.

#### BEFORE YOU START

- [ ] REFACTOR-013 is complete and merged (transaction routes extracted)
- [ ] Branch: `git checkout -b refactor/REFACTOR-017-transaction-service`
- [ ] Read `server/src/routes/transactions.ts` to understand current business logic
- [ ] Check if `server/src/services/` already has any transaction-related service (there may be one from earlier waves)

#### STEP-BY-STEP Instructions

**Step 1: Identify business logic in route handlers**

Open `server/src/routes/transactions.ts` and for each route handler, highlight the business logic:

```typescript
// Example: PATCH /api/transactions/:id
transactionRoutes.patch('/:id', async (c) => {
    // HTTP concern: parse request
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');
    const body = await c.req.json();

    // BUSINESS LOGIC (should be in service):
    const oldData = await db.select().from(transactions).where(...).get();
    if (!oldData) return c.json({ error: 'Not found' }, 404);
    await db.update(transactions).set(body).where(...);
    await db.insert(transactionHistory).values({ ... });

    // HTTP concern: format response
    return c.json(updated);
});
```

**Step 2: Create `server/src/services/transaction-service.ts`**

```typescript
import { db, transactions, transactionHistory } from '../schema.js';
import { eq, and, desc, like, between, sql } from 'drizzle-orm';

export class TransactionService {
    async listTransactions(userId: string, filters: {
        page?: number;
        limit?: number;
        search?: string;
        category?: string;
        startDate?: string;
        endDate?: string;
    }) {
        // Move the query logic from the GET handler here
        // Return { transactions: [...], total: number }
    }

    async getTransaction(userId: string, transactionId: string) {
        const result = await db.select().from(transactions)
            .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
            .get();
        if (!result) throw new NotFoundError('Transaction not found');
        return result;
    }

    async updateTransaction(userId: string, transactionId: string, data: UpdateTransactionInput) {
        // Move update logic here
        // Include history tracking
    }

    async deleteTransaction(userId: string, transactionId: string) {
        // Move delete logic here
    }

    async bulkCategorize(userId: string, items: { id: string; category: string }[]) {
        // Move bulk categorize logic here
    }

    async exportTransactions(userId: string, format: 'csv' | 'excel', filters: object) {
        // Move export logic here
    }
}
```

**Step 3: Update route handlers to use the service**

```typescript
import { TransactionService } from '../services/transaction-service.js';

const transactionService = new TransactionService();

transactionRoutes.patch('/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');
    const body = await c.req.json();

    const updated = await transactionService.updateTransaction(userId, id, body);
    return c.json(updated);
});
```

> **RULE**: Route handlers should be 5-10 lines max: parse → call service → respond. All business logic lives in the service.

**Step 4: Move error handling to use error classes**

In the service, throw typed errors (from `server/src/errors.ts`):

```typescript
import { NotFoundError, ValidationError } from '../errors.js';

// In service method:
if (!result) throw new NotFoundError('Transaction not found');
```

The global error handler (REFACTOR-022) will catch these and return proper HTTP responses.

**Step 5: Verify everything works identically**

```bash
cd server && npx tsc --noEmit && npm test
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Passing `c` (Hono context) to the service | Couples service to HTTP framework | Pass only the data the service needs |
| Returning HTTP status codes from service | Service shouldn't know about HTTP | Throw typed errors, let route handler map to status |
| Duplicating validation in service AND route | Double validation is confusing | Validate in route (Zod), business rules in service |
| Making service methods too granular | One method per DB query is a repository, not a service | Service methods = business operations |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Route handlers should be < 10 lines each
# Service file should contain ALL business logic
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-018: Create Service Layer for Accounts

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-014

#### WHY This Matters

Same principle as REFACTOR-017 but for accounts. Note: `server/src/services/accounts.ts` already exists with `AccountService` class (has `hashAccountNumber`, `findAccountByHash`, `createAccount`). However, the route handlers in `index.ts` (now `routes/accounts.ts`) do NOT use this service — they have inline DB queries. This task bridges that gap.

#### BEFORE YOU START

- [ ] REFACTOR-014 is complete and merged (account routes extracted)
- [ ] Branch: `git checkout -b refactor/REFACTOR-018-account-service`
- [ ] Read the EXISTING `server/src/services/accounts.ts` to understand what's already there
- [ ] Read `server/src/routes/accounts.ts` to see what business logic needs to move

#### STEP-BY-STEP Instructions

**Step 1: Audit the existing AccountService**

```bash
cat server/src/services/accounts.ts
```

Note what methods already exist and what's missing.

**Step 2: Extend AccountService with missing methods**

Add methods for operations currently inline in route handlers:

```typescript
// Add to existing AccountService class:
async listAccounts(userId: string, filters?: { type?: string; search?: string }) { ... }
async getAccount(userId: string, accountId: string) { ... }
async updateAccount(userId: string, accountId: string, data: UpdateAccountInput) { ... }
async deleteAccount(userId: string, accountId: string) { ... }
async getChartOfAccounts(userId: string) { ... }
async getAccountBalance(userId: string, accountId: string) { ... }
```

**Step 3: Update route handlers to use the service**

Same pattern as REFACTOR-017: thin route handlers that delegate to the service.

**Step 4: Verify**

```bash
cd server && npx tsc --noEmit && npm test
```

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Verify no direct DB queries remain in routes/accounts.ts
grep -n "db\.\(select\|insert\|update\|delete\)" server/src/routes/accounts.ts
# Target: 0 matches
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-019: Create Repository Layer (Core)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-017, REFACTOR-018

#### WHY This Matters

Currently, services import `db` and Drizzle operators directly and build queries inline. This means:

- Business logic is coupled to the ORM — switching ORMs requires rewriting services
- Testing services requires a real database (can't mock the data layer)
- The same query patterns are duplicated across services
- The SQLite/PostgreSQL compatibility layer in `schema.ts` leaks into business logic

The repository pattern creates a clean boundary: repositories are the ONLY code that talks to the database.

#### BEFORE YOU START

- [ ] REFACTOR-017 and REFACTOR-018 are complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-019-repository-layer`
- [ ] Understand the current DB access pattern:

  ```bash
  # Find all files that import from schema.ts
  grep -rn "from.*schema" server/src/services/ server/src/routes/ --include="*.ts" | grep -v node_modules | head -30
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create the repository directory**

```bash
mkdir -p server/src/repositories
```

**Step 2: Create `TransactionRepository`**

```typescript
// server/src/repositories/transaction-repository.ts
import { db, transactions, transactionHistory } from '../schema.js';
import { eq, and, desc, like, between, sql, count } from 'drizzle-orm';

export interface TransactionFilters {
    userId: string;
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
}

export class TransactionRepository {
    async findMany(filters: TransactionFilters) {
        const { userId, page = 1, limit = 50, search, category, startDate, endDate } = filters;
        const conditions = [eq(transactions.userId, userId)];
        // Build conditions from filters...
        const result = await db.select().from(transactions)
            .where(and(...conditions))
            .limit(limit)
            .offset((page - 1) * limit)
            .orderBy(desc(transactions.date))
            .all();
        const total = await db.select({ count: count() }).from(transactions)
            .where(and(...conditions))
            .get();
        return { data: result, total: total?.count ?? 0 };
    }

    async findById(userId: string, id: string) {
        return db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
            .get();
    }

    async update(id: string, data: Partial<typeof transactions.$inferInsert>) {
        return db.update(transactions).set({ ...data, updatedAt: new Date().toISOString() })
            .where(eq(transactions.id, id))
            .returning()
            .get();
    }

    async delete(id: string) {
        return db.delete(transactions).where(eq(transactions.id, id)).run();
    }

    async insertHistory(entry: typeof transactionHistory.$inferInsert) {
        return db.insert(transactionHistory).values(entry).run();
    }
}
```

**Step 3: Create `AccountRepository` and `UserRepository`**

Follow the same pattern. Each repository:

- Imports ONLY from `schema.ts` and `drizzle-orm`
- Exposes methods named after data operations: `findMany`, `findById`, `create`, `update`, `delete`
- Returns raw data (no business logic, no HTTP concerns)
- Accepts typed filter/input objects

**Step 4: Update services to use repositories**

```typescript
// BEFORE (in TransactionService):
import { db, transactions } from '../schema.js';
import { eq, and } from 'drizzle-orm';

// AFTER:
import { TransactionRepository } from '../repositories/transaction-repository.js';

export class TransactionService {
    private repo = new TransactionRepository();

    async getTransaction(userId: string, id: string) {
        const result = await this.repo.findById(userId, id);
        if (!result) throw new NotFoundError('Transaction not found');
        return result;
    }
}
```

**Step 5: Verify no service imports directly from schema**

```bash
# Services should NOT import db or table objects
grep -n "from.*schema" server/src/services/transaction-service.ts server/src/services/accounts.ts
# Target: 0 matches (only repositories import from schema)
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Putting business logic in repositories | Repositories are data access ONLY | If it has an `if` statement about business rules, it belongs in the service |
| Creating one repository per table | Over-granular — repositories should map to aggregates | Group related tables (e.g., `transactions` + `transactionHistory` in one repo) |
| Not typing filter/input objects | Loses type safety | Create interfaces for all repository method parameters |
| Forgetting the SQLite/PG compat layer | `schema.ts` has `wrapPgDb` proxy | Repositories abstract this — callers don't need to know |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test

# Verify layering: only repositories import from schema
grep -rn "from.*['\"].*schema" server/src/services/ --include="*.ts" | grep -v "\.test\."
# Target: 0 matches (services use repositories, not schema directly)
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-020: Split Schema into Domain Modules

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: High
**Depends On**: REFACTOR-019

#### WHY This Matters

`server/src/schema.ts` is 2,088 lines containing: database connection setup, the `wrapPgDb` compatibility proxy, AND all ~50+ table definitions. This violates single responsibility. Splitting it into domain modules makes it easier to find tables, reduces merge conflicts, and enables domain teams to own their schemas.

#### BEFORE YOU START

- [ ] REFACTOR-019 is complete and merged (repositories abstract DB access)
- [ ] Branch: `git checkout -b refactor/REFACTOR-020-split-schema`
- [ ] Count tables in schema.ts:

  ```bash
  grep -c "export const.*=.*Table\|sqliteTable" server/src/schema.ts
  ```

- [ ] **CRITICAL**: Understand the `wrapPgDb` proxy (lines ~14-100 of schema.ts). This MUST be preserved.

#### STEP-BY-STEP Instructions

**Step 1: Create the schema directory structure**

```bash
mkdir -p server/src/db/schemas
```

**Step 2: Extract the DB connection into `server/src/db/connection.ts`**

Move the database connection setup and `wrapPgDb` proxy from `schema.ts`:

```typescript
// server/src/db/connection.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
// ... all connection logic, wrapPgDb, etc.
export const db = ...;
```

> **CRITICAL**: The `wrapPgDb` proxy that adds `.get()/.all()/.run()` to PostgreSQL queries MUST be preserved exactly. Do NOT modify it.

**Step 3: Split tables into domain files**

Create one file per domain:

- `server/src/db/schemas/users.ts` — `users`, `sessions`, `userSettings`
- `server/src/db/schemas/transactions.ts` — `transactions`, `transactionHistory`, `pendingCategorization`
- `server/src/db/schemas/accounts.ts` — `accounts`, `chartOfAccounts`, `accountBalanceHistory`, `accountBalances`
- `server/src/db/schemas/statements.ts` — `statements`, `statementAccounts`
- `server/src/db/schemas/payroll.ts` — `employees`, `employeeBankDetails`, `employeeSuperFunds`, etc.
- `server/src/db/schemas/tax.ts` — `taxBrackets`, `taxCodes`, `basPeriods`, etc.
- `server/src/db/schemas/invoicing.ts` — `customers`, `invoices`, `invoiceLineItems`
- `server/src/db/schemas/market.ts` — `marketDataFeeds`, `marketPrices`, `economicIndicators`

**Step 4: Create barrel export**

```typescript
// server/src/db/schemas/index.ts
export * from './users.js';
export * from './transactions.js';
export * from './accounts.js';
export * from './statements.js';
export * from './payroll.js';
export * from './tax.js';
export * from './invoicing.js';
export * from './market.js';
```

**Step 5: Update the original `schema.ts` to be a re-export barrel**

```typescript
// server/src/schema.ts — backward compatibility
export { db } from './db/connection.js';
export * from './db/schemas/index.js';
```

This ensures ALL existing imports from `'./schema.js'` continue to work without changes.

**Step 6: Verify everything compiles and tests pass**

```bash
cd server && npx tsc --noEmit && npm test
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Breaking the `wrapPgDb` proxy | Entire DB layer stops working | Extract connection.ts FIRST, verify, then split tables |
| Circular imports between schema files | Tables that reference each other cause import cycles | Use Drizzle's `relations()` in a separate file |
| Not re-exporting from original schema.ts | Breaks 100+ import statements | Always keep backward-compatible re-exports |
| Splitting too granularly | One file per table is overkill | Group by domain (5-10 tables per file) |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test

# Verify backward compatibility
grep -rn "from.*schema" server/src/ --include="*.ts" | grep -v "db/schemas" | head -5
# These should all still work (importing from schema.ts barrel)

# Verify no file > 300 lines
wc -l server/src/db/schemas/*.ts
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-021: Split Client API into Feature Modules

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-011

#### WHY This Matters

`client/src/api.ts` is 2,848 lines — a single file containing ALL API call functions and ALL interface definitions. Every component imports from this one file, meaning any change triggers recompilation of the entire client. Splitting it into feature modules enables tree-shaking, faster builds, and clearer ownership.

#### BEFORE YOU START

- [ ] REFACTOR-011 is complete and merged (shared types package exists)
- [ ] Branch: `git checkout -b refactor/REFACTOR-021-split-client-api`
- [ ] Count functions and interfaces:

  ```bash
  grep -c "^export function\|^export async function\|^export interface\|^export type" client/src/api.ts
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create the API module directory**

```bash
mkdir -p client/src/api
```

**Step 2: Extract shared utilities first**

Create `client/src/api/client.ts` with the shared HTTP helpers:

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3501';

export function getToken(): string | null {
    return localStorage.getItem('token');
}

export function getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
// ... apiPatch, apiDelete, etc.
```

**Step 3: Split API functions by domain**

Create one file per domain:

- `client/src/api/auth.ts` — login, register, getMe
- `client/src/api/transactions.ts` — CRUD, export, bulk operations
- `client/src/api/accounts.ts` — CRUD, chart of accounts
- `client/src/api/statements.ts` — upload, list, process
- `client/src/api/reports.ts` — financial reports
- `client/src/api/payroll.ts` — employees, pay runs
- `client/src/api/tax.ts` — BAS, tax calculations
- `client/src/api/settings.ts` — user/org settings

Each file imports from `./client.ts` for HTTP helpers.

**Step 4: Create barrel export for backward compatibility**

```typescript
// client/src/api/index.ts
export * from './client.js';
export * from './auth.js';
export * from './transactions.js';
export * from './accounts.js';
export * from './statements.js';
export * from './reports.js';
export * from './payroll.js';
export * from './tax.js';
export * from './settings.js';
```

**Step 5: Replace original `api.ts` with re-export**

```typescript
// client/src/api.ts — backward compatibility
export * from './api/index.js';
```

**Step 6: Verify all components still work**

```bash
cd client && npx tsc --noEmit && npm run build
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Breaking existing imports | Components import `from '../api'` | Keep backward-compatible re-export |
| Duplicating interfaces | Types should come from `@goldledger/shared` | Import types from shared package |
| Not extracting shared HTTP helpers | Each module re-implements fetch logic | Create `client.ts` with shared helpers FIRST |

#### VERIFICATION

```bash
cd client && npx tsc --noEmit && npm run build
# Verify no file > 300 lines
wc -l client/src/api/*.ts
```

#### ROLLBACK

```bash
rm -rf client/src/api/
git checkout -- client/src/api.ts
```

---

### REFACTOR-022: Create Error Handling Framework

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-012

#### WHY This Matters

Currently, every route handler has its own `try-catch` with `console.error` and `c.json({ error: '...' }, 500)`. This means:

- Error response format is inconsistent across endpoints
- Stack traces are lost (only the message is logged)
- No correlation between log entries and error responses
- Every new route must remember to add error handling

A global error handler catches ALL errors and returns consistent responses. The existing `server/src/errors.ts` already has excellent error classes — we just need to wire them up.

#### BEFORE YOU START

- [ ] REFACTOR-012 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-022-error-framework`
- [ ] Read `server/src/errors.ts` — understand the existing error hierarchy
- [ ] Count inline error handling:

  ```bash
  grep -c "catch.*err\|console\.error" server/src/routes/*.ts
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create global error handler middleware**

Create `server/src/middleware/error-handler.ts`:

```typescript
import { Context } from 'hono';
import { BaseError, isOperationalError, toHttpError } from '../errors.js';
import { logger } from '../lib/logger.js';

export function globalErrorHandler(err: Error, c: Context) {
    // Use existing toHttpError() from errors.ts
    const httpError = toHttpError(err);

    // Log with full context
    if (isOperationalError(err)) {
        logger.warn({ err, path: c.req.path, method: c.req.method }, 'Operational error');
    } else {
        logger.error({ err, path: c.req.path, method: c.req.method }, 'Unexpected error');
    }

    // Consistent response format
    return c.json({
        error: httpError.message,
        code: httpError.code,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    }, httpError.statusCode as any);
}
```

**Step 2: Register the error handler in the app**

In `server/src/index.ts`:

```typescript
import { globalErrorHandler } from './middleware/error-handler.js';

app.onError(globalErrorHandler);
```

**Step 3: Remove inline try-catch from route handlers**

```typescript
// BEFORE:
transactionRoutes.get('/:id', async (c) => {
    try {
        const result = await transactionService.getTransaction(userId, id);
        return c.json(result);
    } catch (err) {
        console.error('Failed:', err);
        return c.json({ error: 'Failed' }, 500);
    }
});

// AFTER:
transactionRoutes.get('/:id', async (c) => {
    const result = await transactionService.getTransaction(userId, id);
    return c.json(result);
    // Errors propagate to globalErrorHandler automatically
});
```

> **NOTE**: Remove try-catch ONE route file at a time. Verify after each file.

**Step 4: Ensure services throw typed errors**

Services should throw from the existing error hierarchy:

```typescript
import { NotFoundError, ValidationError, AuthorizationError } from '../errors.js';

// In service:
throw new NotFoundError('Transaction not found');
throw new ValidationError('Invalid date range', [{ field: 'startDate', message: 'Must be before endDate' }]);
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Removing ALL try-catch at once | If one route throws unexpectedly, hard to find | Remove ONE file at a time |
| Not distinguishing operational vs programmer errors | 404 is operational (expected), null pointer is a bug | Use `isOperationalError()` from errors.ts |
| Exposing stack traces in production | Security risk | Only include stack in non-production |
| Forgetting to handle Zod validation errors | Zod throws its own error type | Add a case for `ZodError` in the handler |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test

# Verify consistent error format
curl -s http://localhost:3501/api/transactions/nonexistent-id -H "Authorization: Bearer $TOKEN" | jq
# Should return: { "error": "...", "code": "NOT_FOUND" }

# Verify no inline console.error in routes
grep -rn "console\.error" server/src/routes/ --include="*.ts" | wc -l
# Target: 0
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-023: Implement Dependency Injection Container

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-019

#### WHY This Matters

Currently, services instantiate their own dependencies inline:

```typescript
// In TransactionService:
private repo = new TransactionRepository();
```

This makes testing painful — you can't swap out the real repository for a mock without hacking the module system. A DI container lets you register all services and repositories in ONE place, wire them together, and swap implementations easily in tests.

Think of it like a phonebook: instead of every service looking up its own dependencies, they ask the container "give me the TransactionRepository" and the container decides what to hand back.

#### BEFORE YOU START

- [ ] REFACTOR-019 is complete and merged (repositories exist)
- [ ] Branch: `git checkout -b refactor/REFACTOR-023-di-container`
- [ ] Understand the current instantiation pattern:

  ```bash
  grep -rn "new.*Service\|new.*Repository" server/src/services/ server/src/routes/ --include="*.ts" | head -20
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create the container — `server/src/container.ts`**

We use a lightweight, hand-rolled container — no framework needed. The pattern is: register factories, resolve lazily, support overrides for testing.

```typescript
// server/src/container.ts
type Factory<T> = () => T;

class Container {
    private factories = new Map<string, Factory<unknown>>();
    private singletons = new Map<string, unknown>();

    register<T>(token: string, factory: Factory<T>): void {
        this.factories.set(token, factory);
        this.singletons.delete(token); // Clear cached singleton
    }

    resolve<T>(token: string): T {
        if (this.singletons.has(token)) return this.singletons.get(token) as T;
        const factory = this.factories.get(token);
        if (!factory) throw new Error(`No registration for "${token}"`);
        const instance = factory() as T;
        this.singletons.set(token, instance);
        return instance;
    }

    // For tests: override a registration temporarily
    override<T>(token: string, instance: T): void {
        this.singletons.set(token, instance);
    }

    // For tests: reset all overrides
    reset(): void {
        this.singletons.clear();
    }
}

export const container = new Container();
```

**Step 2: Register all repositories**

```typescript
// server/src/container.ts (continued)
import { TransactionRepository } from './repositories/transaction-repository.js';
import { AccountRepository } from './repositories/account-repository.js';
import { UserRepository } from './repositories/user-repository.js';

// Tokens
export const TOKENS = {
    TransactionRepo: 'TransactionRepository',
    AccountRepo: 'AccountRepository',
    UserRepo: 'UserRepository',
    TransactionService: 'TransactionService',
    AccountService: 'AccountService',
} as const;

// Register repositories
container.register(TOKENS.TransactionRepo, () => new TransactionRepository());
container.register(TOKENS.AccountRepo, () => new AccountRepository());
container.register(TOKENS.UserRepo, () => new UserRepository());
```

**Step 3: Register services with repository injection**

```typescript
import { TransactionService } from './services/transaction-service.js';
import { AccountService } from './services/accounts.js';

container.register(TOKENS.TransactionService, () =>
    new TransactionService(container.resolve(TOKENS.TransactionRepo))
);
container.register(TOKENS.AccountService, () =>
    new AccountService(container.resolve(TOKENS.AccountRepo))
);
```

**Step 4: Update services to accept dependencies via constructor**

```typescript
// BEFORE:
export class TransactionService {
    private repo = new TransactionRepository();
}

// AFTER:
export class TransactionService {
    constructor(private repo: TransactionRepository) {}
}
```

**Step 5: Update route files to resolve from container**

```typescript
// BEFORE (in routes/transactions.ts):
const transactionService = new TransactionService();

// AFTER:
import { container, TOKENS } from '../container.js';
const transactionService = container.resolve<TransactionService>(TOKENS.TransactionService);
```

**Step 6: Test with mock overrides**

```typescript
// In tests:
import { container, TOKENS } from '../container.js';

beforeEach(() => {
    container.override(TOKENS.TransactionRepo, {
        findById: vi.fn().mockResolvedValue({ id: '1', description: 'Test' }),
        findMany: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    });
});

afterEach(() => container.reset());
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Using a heavy DI framework (InversifyJS, etc.) | Overkill for this codebase, adds complexity | Our hand-rolled container is <30 lines |
| Circular dependencies in registrations | A needs B needs A → infinite loop | Register repos first, then services |
| Forgetting `container.reset()` in tests | Tests leak state between runs | Always reset in `afterEach` |
| Using the container everywhere | Only routes should resolve from container | Services receive deps via constructor |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test

# Check no service uses 'new Repository()' directly
grep -rn "new.*Repository()" server/src/services/ --include="*.ts"
# Target: 0 matches (all injection via constructor)
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-024: Split Large Service Files (Batch 1 — >1,000 Lines)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-019

#### WHY This Matters

Multiple service files exceed 1,000 lines each. Files this large are impossible to review, test in isolation, or reason about. Enterprise standard: **no file over 300 lines**. These are the worst offenders:

| File | Lines | What It Contains |
|------|-------|-----------------|
| `cognee_client.ts` | ~1,369 | Cognee REST client + caching + retry logic |
| `cross-module-intelligence.ts` | ~1,328 | 6 scanner methods + correlation engine + types |
| `teams.ts` | ~1,282 | Team CRUD + invitations + permissions + audit logging |
| `sbr-export.ts` | ~1,238 | SBR XML generation + CSV export + PDF report + validation |
| `pipeline.ts` | ~1,206 | Pipeline stages + orchestrator + error handling |
| `purchase-orders.ts` | ~1,067 | PO CRUD + approval workflow + PDF generation |
| `consolidation.ts` | ~1,043 | Consolidation steps + elimination rules + report generation |
| `bank-reconciliation.ts` | ~1,039 | Matching + suggestions + balance check |

> **NOTE (2026-02-16):** File sizes have changed significantly since the original plan. `pipeline.ts` grew from ~977 to ~1,206 lines and now qualifies for Batch 1. `consolidation.ts` (~1,043) and `bank-reconciliation.ts` (~1,039) also now exceed 1,000 lines. Consider splitting all 8 files in this batch, or move the 3 new additions to REFACTOR-025.

#### BEFORE YOU START

- [ ] REFACTOR-019 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-024-split-services-batch1`
- [ ] Verify file sizes:

  ```bash
  wc -l server/src/services/cross-module-intelligence.ts server/src/services/teams.ts server/src/services/cognee_client.ts server/src/services/sbr-export.ts server/src/services/purchase-orders.ts
  ```

#### STEP-BY-STEP Instructions

> **GOLDEN RULE**: Split ONE file at a time. Compile → test → commit after EACH split. This task will produce 5 commits.

**Step 1: Split `cross-module-intelligence.ts`**

This file has 6 independent scanner methods. Split by scanner:

```
server/src/services/intelligence/
├── types.ts              — All interfaces (CrossModuleInsight, MetricPair, etc.)
├── correlation.ts        — Pearson correlation helper and metric analysis
├── scanners/
│   ├── anomaly-cascade.ts    — _scanAnomalyCascades
│   ├── trend-alignment.ts    — _scanTrendAlignments
│   ├── compliance-risk.ts    — _scanComplianceRisks
│   ├── forecast-deviation.ts — _scanForecastDeviations
│   ├── tax-opportunity.ts    — _scanTaxOpportunities
│   └── spending-pattern.ts   — _scanSpendingPatterns
├── cross-module-intelligence.ts — Thin orchestrator that calls scanners
└── index.ts              — Barrel export
```

Each scanner becomes its own file (<100 lines). The main class becomes an orchestrator that imports and runs them.

Backward compatibility:

```typescript
// server/src/services/cross-module-intelligence.ts (original location)
export { CrossModuleIntelligenceService } from './intelligence/index.js';
```

**Step 2: Split `teams.ts`**

```
server/src/services/teams/
├── types.ts              — Team, TeamMember, TeamInvitation interfaces, TeamRole, Permission
├── permissions.ts        — ROLE_PERMISSIONS map, hasPermission(), checkTeamAccess()
├── team-crud.ts          — createTeam, getTeam, updateTeam, deleteTeam, listTeams
├── invitation-service.ts — createInvitation, acceptInvitation, revokeInvitation
├── member-service.ts     — addMember, removeMember, updateMemberRole
├── audit-logger.ts       — logAuditEvent, getAuditLog
└── index.ts              — Barrel + TeamService facade class
```

**Step 3: Split `cognee_client.ts`**

```
server/src/services/cognee/
├── types.ts        — CogneeSearchResult, CogneeDataset, etc.
├── http-client.ts  — Raw HTTP methods: get, post, put, delete with retry
├── auth.ts         — Authentication and token management
├── datasets.ts     — Dataset CRUD operations
├── search.ts       — Search and query operations
├── cognify.ts      — Cognify (processing) operations
├── merchant-mapping.ts — storeMerchantMapping, getMerchantCategory
└── index.ts        — CogneeClient facade + barrel export
```

**Step 4: Split `sbr-export.ts`**

```
server/src/services/sbr/
├── types.ts          — BusinessProfile, BASData, ValidationError, SBRExportResult
├── validator.ts      — validateBASData(), validateBusinessProfile()
├── xml-generator.ts  — generateSBRXml() — the actual XML template
├── csv-exporter.ts   — generateCSVSummary()
├── pdf-exporter.ts   — generatePDFReport()
├── export-history.ts — saveExportRecord, getExportHistory
└── index.ts          — SBRExporter facade + barrel export
```

**Step 5: Split `purchase-orders.ts`**

```
server/src/services/purchase-orders/
├── types.ts           — PurchaseOrder, POLineItem, POApproval interfaces
├── po-crud.ts         — CRUD operations
├── approval-workflow.ts — submit, approve, reject, getApprovalHistory
├── pdf-generator.ts   — generatePurchaseOrderPDF()
├── numbering.ts       — PO number generation and sequencing
└── index.ts           — PurchaseOrderService facade + barrel export
```

**General pattern for each split:**

1. Create the subdirectory
2. Move types/interfaces to `types.ts`
3. Extract each logical group into its own file
4. Create a thin facade class in `index.ts` that imports sub-modules
5. Update the original file location to re-export from the new barrel
6. `npx tsc --noEmit && npm test`
7. Commit: `refactor(REFACTOR-024): split <filename> into sub-modules`

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Trying to refactor while splitting | Changing logic during split introduces bugs | COPY logic exactly — refactor LATER |
| Not preserving backward-compatible exports | Breaks all importers | Always re-export from original location |
| Splitting too fine (one function per file) | Creates too many tiny files | 3-6 sub-modules per service is the sweet spot |
| Forgetting to move private helper functions | Sub-modules can't access private methods | Make helpers standalone functions in their own file |

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test

# All original imports should still work
grep -rn "from.*cross-module-intelligence\|from.*teams\|from.*cognee_client\|from.*sbr-export\|from.*purchase-orders" server/src/ --include="*.ts" | grep -v node_modules | head -10
# These should resolve correctly via re-exports

# No file > 300 lines in the new directories
find server/src/services/intelligence server/src/services/teams server/src/services/cognee server/src/services/sbr server/src/services/purchase-orders -name "*.ts" -exec wc -l {} + | sort -n
```

#### ROLLBACK

```bash
git reset --hard HEAD~5  # One commit per file split
```

---

### REFACTOR-025: Split Large Service Files (Batch 2 — >700 Lines)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-024

#### WHY This Matters

After Batch 1, these files remain over 700 lines. Same principle: split until every file is under 300 lines.

> **NOTE (2026-02-16):** File sizes updated to current counts. `pipeline.ts` (~1,206), `consolidation.ts` (~1,043), and `bank-reconciliation.ts` (~1,039) now exceed 1,000 lines and were noted in REFACTOR-024 as potential Batch 1 candidates. If they are handled in Batch 1, remove them from this table. `loan-calculator.ts` also crossed 1,000 lines (~1,001).

| File | Lines | Split Strategy |
|------|-------|---------------|
| `pipeline.ts` | ~1,206 | Separate stages, orchestrator, error handling *(may move to Batch 1)* |
| `consolidation.ts` | ~1,043 | Separate elimination rules, report generation *(may move to Batch 1)* |
| `bank-reconciliation.ts` | ~1,039 | Separate matching, suggestions, balance check *(may move to Batch 1)* |
| `loan-calculator.ts` | ~1,001 | Separate amortization, comparison, scenarios |
| `tax.ts` | ~962 | Separate GST calc, income tax, brackets |
| `payment-matching.ts` | ~892 | Separate matching algorithm, scoring, rules |
| `cdr-crawler.ts` | ~886 | Separate API client, data mapping, storage |
| `bills.ts` | ~844 | Separate CRUD, approval, payment tracking |
| `financial-reports.ts` | ~835 | Separate P&L, balance sheet, cash flow |

#### BEFORE YOU START

- [ ] REFACTOR-024 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-025-split-services-batch2`
- [ ] Verify remaining large files:

  ```bash
  find server/src/services -maxdepth 1 -name "*.ts" -exec wc -l {} + | sort -rn | head -15
  ```

#### STEP-BY-STEP Instructions

Follow the EXACT same pattern as REFACTOR-024. For each file:

1. Identify logical groups within the file (types, algorithms, CRUD, external API calls, report generation)
2. Create a subdirectory: `server/src/services/<domain>/`
3. Extract types → `types.ts`
4. Extract each group → separate file
5. Create facade + barrel → `index.ts`
6. Re-export from original location for backward compatibility
7. Compile → test → commit

**Example split for `financial-reports.ts`:**

```
server/src/services/reports/
├── types.ts            — ReportConfig, FinancialPeriod, ReportOutput
├── profit-loss.ts      — generateProfitAndLoss()
├── balance-sheet.ts    — generateBalanceSheet()
├── cash-flow.ts        — generateCashFlowStatement()
├── trial-balance.ts    — generateTrialBalance()
├── report-utils.ts     — Shared formatting, date range helpers
└── index.ts            — FinancialReportService facade
```

> **NOTE**: Some files like `tax.ts` may already use the `BASService` and `TaxService` classes. Keep the class names and public API identical — only move the internal implementation into sub-files.

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test

# Zero files > 300 lines in services
find server/src/services -name "*.ts" -exec wc -l {} + | sort -rn | awk '$1 > 300 { print }'
# Target: 0 results
```

#### ROLLBACK

```bash
git log --oneline -15
git reset --hard <commit-before-this-task>
```

---

### REFACTOR-026: Split Large Client Components

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-021

#### WHY This Matters

Two client components exceed 900 lines: `TransactionTable.tsx` (~1,260 lines) and `BASDashboard.tsx` (~997 lines). Components this large are impossible to test, slow to re-render, and violate React best practices. The fix: extract sub-components, custom hooks, and utility functions.

#### BEFORE YOU START

- [ ] REFACTOR-021 is complete and merged (client API split)
- [ ] Branch: `git checkout -b refactor/REFACTOR-026-split-components`
- [ ] Verify file sizes:

  ```bash
  wc -l client/src/features/transactions/components/TransactionTable.tsx client/src/features/bas/components/BASDashboard.tsx
  ```

#### STEP-BY-STEP Instructions

**Step 1: Split `TransactionTable.tsx`**

Current structure: one massive component with filtering, sorting, inline editing, virtualization, mobile layout, export, column definitions — all in one file.

Target structure:

```
client/src/features/transactions/components/
├── TransactionTable.tsx       — Main component (orchestrator only, <150 lines)
├── TransactionFilters.tsx     — Filter bar (search, date range, category)
├── TransactionColumns.tsx     — Column definitions (useMemo block → own file)
├── TransactionInlineEdit.tsx  — Inline edit form state and handlers
├── TransactionExport.tsx      — CSV/Excel export functionality
├── hooks/
│   ├── useTransactionFilters.ts — Filter state and logic
│   ├── useTransactionEdit.ts    — Inline editing state machine
│   └── useTransactionExport.ts  — Export handlers
└── utils/
    └── transaction-helpers.ts   — formatAmount, categoryHelpers
```

How to extract a hook:

```typescript
// BEFORE (in TransactionTable.tsx):
const [editingId, setEditingId] = useState<string | null>(null);
const [editForm, setEditForm] = useState<Partial<Transaction>>({});
const handleEditStart = useCallback((tx: Transaction) => { ... }, []);
const handleSave = useCallback((id: string) => { ... }, []);

// AFTER (in hooks/useTransactionEdit.ts):
export function useTransactionEdit(onDataChange?: () => void) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Transaction>>({});
    const handleEditStart = useCallback((tx: Transaction) => { ... }, []);
    const handleSave = useCallback((id: string) => { ... }, [onDataChange]);
    return { editingId, editForm, setEditForm, handleEditStart, handleSave, setEditingId };
}
```

**Step 2: Split `BASDashboard.tsx`**

Current structure: BAS calculation UI with calculate, breakdown, and history tabs — all inline.

Target structure:

```
client/src/features/bas/components/
├── BASDashboard.tsx         — Main component with tab routing (<100 lines)
├── BASCalculateTab.tsx      — Quarter selection, method, calculate button
├── BASBreakdownTab.tsx      — Detailed BAS line items display
├── BASHistoryTab.tsx        — Historical BAS submissions list
├── BASRow.tsx               — Already a sub-component, keep as-is
├── BASSummaryCards.tsx       — Summary stat cards (net payable, GST, etc.)
├── hooks/
│   └── useBASCalculation.ts — State + API calls for BAS calculation
└── utils/
    └── bas-formatters.ts    — formatCurrency, formatCurrencyShort, getCurrentQuarter
```

**Step 3: Verify visual behavior is identical**

```bash
cd client && npx tsc --noEmit && npm run build
# Then manually test both pages in the browser
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Changing component behavior while splitting | Introduces visual regressions | COPY logic exactly — refactor LATER |
| Passing too many props to sub-components | "Prop drilling" makes components hard to use | Use custom hooks to share state |
| Extracting hooks that depend on component state | Hook can't access parent's state | Pass dependencies as hook parameters |
| Not memoizing extracted components | Re-renders increase after splitting | Use `React.memo()` on presentational sub-components |

#### VERIFICATION

```bash
cd client && npx tsc --noEmit && npm run build

# No component > 300 lines
wc -l client/src/features/transactions/components/*.tsx client/src/features/bas/components/*.tsx
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-027: Consolidate AI SDK Dependencies

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-024

#### WHY This Matters

The codebase uses THREE different AI SDK approaches (FIVE packages total):

1. **Vercel AI SDK** (`ai@^6.0.85`, `@ai-sdk/anthropic@^3.0.43`, `@ai-sdk/openai@^3.0.28`) — the standard
2. **Direct Anthropic SDK** (`@anthropic-ai/sdk@^0.74.0`) — used by Claude agents
3. **Direct OpenAI SDK** (`openai@^4.28.0`) — legacy, from early waves

Having multiple SDKs means: duplicate configuration, inconsistent error handling, and confusion about which to use. Standardize on Vercel AI SDK and use the direct Anthropic SDK only where tool-use loops require it.

#### BEFORE YOU START

- [ ] REFACTOR-024 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-027-consolidate-ai`
- [ ] Audit current AI SDK usage:

  ```bash
  grep -rn "from.*@anthropic-ai/sdk\|from.*openai\|from.*@ai-sdk\|from.*\"ai\"" server/src/ --include="*.ts" | grep -v node_modules
  ```

#### STEP-BY-STEP Instructions

**Step 1: Map every AI call site**

Create a spreadsheet/list of every file that imports an AI SDK:

- Which SDK does it use?
- What does it do? (chat, completion, tool use, streaming)
- Can it be migrated to Vercel AI SDK?

**Step 2: Identify files that MUST use direct Anthropic SDK**

The Claude agents in `server/src/services/claude/` use the `@anthropic-ai/sdk` directly for tool-use loops. These are COMPLEX and should NOT be migrated — the Vercel AI SDK wrapper may not support all features. Mark these as exceptions.

**Step 3: Migrate legacy `openai` package usage**

Find files using the `openai` package directly (not via `@ai-sdk/openai`):

```bash
grep -rn "from 'openai'" server/src/ --include="*.ts"
```

Replace with Vercel AI SDK equivalents:

```typescript
// BEFORE:
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.chat.completions.create({ ... });

// AFTER:
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
const { text } = await generateText({ model: openai('gpt-4o'), prompt: '...' });
```

**Step 4: Create a shared AI utility module**

```typescript
// server/src/lib/ai.ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export const models = {
    categorization: anthropic('claude-3-5-haiku-20241022'),
    analysis: anthropic('claude-sonnet-4-20250514'),
    chat: anthropic('claude-sonnet-4-20250514'),
    embeddings: openai('text-embedding-3-small'),
} as const;
```

**Step 5: Verify all AI features still work**

```bash
cd server && npx tsc --noEmit && npm test
```

> **WARNING**: AI features require API keys. Test in a local environment with keys set.

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Count remaining direct SDK imports (should only be in claude/ agents)
grep -rn "from '@anthropic-ai/sdk'" server/src/ --include="*.ts" | grep -v "claude/"
# Target: 0 matches outside claude/
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-028: Consolidate PDF Libraries

**Priority**: P2 — Medium | **Effort**: 3 hours | **Risk**: Low
**Depends On**: None

#### WHY This Matters

The codebase uses FOUR PDF libraries: `pdf-parse` (text extraction), `pdf-lib` (PDF creation/modification), `pdf-to-img` (PDF to image conversion), `pdfjs-dist` (Mozilla's PDF renderer). Each adds to bundle size and attack surface. We need to audit which are actually used and consolidate where possible.

#### BEFORE YOU START

- [ ] Branch: `git checkout -b refactor/REFACTOR-028-consolidate-pdf`
- [ ] Audit usage of each library:

  ```bash
  grep -rn "from.*pdf-parse\|require.*pdf-parse" server/src/ --include="*.ts"
  grep -rn "from.*pdf-lib\|require.*pdf-lib" server/src/ --include="*.ts"
  grep -rn "from.*pdf-to-img\|require.*pdf-to-img" server/src/ --include="*.ts"
  grep -rn "from.*pdfjs-dist\|require.*pdfjs-dist" server/src/ --include="*.ts"
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create a usage map**

For each PDF library, document:

- Which files import it
- What operation it performs
- Whether another library could handle it

**Step 2: Determine minimum required set**

Likely outcome:

- **Keep `pdf-parse`**: Used for extracting text from bank statement PDFs (core functionality)
- **Keep `pdf-lib`**: Used for generating PDF invoices and reports
- **Evaluate `pdf-to-img`**: May only be used for preview thumbnails — consider if needed
- **Evaluate `pdfjs-dist`**: May overlap with `pdf-parse` for text extraction

**Step 3: Remove unused libraries**

If a library is imported but never actually used, or only used in dead code:

```bash
npm uninstall <library-name>
```

**Step 4: Create a thin abstraction if keeping multiple**

```typescript
// server/src/lib/pdf.ts
export { extractTextFromPdf } from './pdf/text-extractor.js'; // wraps pdf-parse
export { generatePdf } from './pdf/generator.js';             // wraps pdf-lib
```

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Verify PDF parsing still works with a real statement
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-029: Move @types to devDependencies

**Priority**: P2 — Medium | **Effort**: 15 minutes | **Risk**: Very Low
**Depends On**: None

#### WHY This Matters

In `server/package.json`, `@types/bcryptjs` and `@types/ioredis` are listed under `dependencies` instead of `devDependencies`. Type packages are ONLY needed at build time (for TypeScript compilation) — they should never ship to production. Misplacing them bloats the production `node_modules` and signals poor package hygiene.

#### STEP-BY-STEP Instructions

**Step 1: Move the packages**

```bash
cd server
npm uninstall @types/bcryptjs @types/ioredis
npm install -D @types/bcryptjs @types/ioredis
```

This removes them from `dependencies` and adds them to `devDependencies`.

**Step 2: Verify TypeScript still compiles**

```bash
cd server && npx tsc --noEmit
```

**Step 3: Verify production install works**

```bash
cd server && npm install --omit=dev
# This should succeed — types aren't needed at runtime
npm install  # Restore dev deps
```

#### VERIFICATION

```bash
cd server && npx tsc --noEmit && npm test
# Check package.json
grep -A2 "bcryptjs\|ioredis" server/package.json
# Should only appear under devDependencies
```

#### ROLLBACK

```bash
git checkout -- server/package.json server/package-lock.json
npm install
```

---

### REFACTOR-030: Add CI/CD Pipeline

**Priority**: P0 — Critical | **Effort**: 4 hours | **Risk**: Low
**Depends On**: REFACTOR-002

#### WHY This Matters

There is NO CI/CD pipeline. Code merges without automated checks. This means: lint errors, type errors, and test failures can slip into `main`. A CI pipeline is the safety net that catches mistakes before they reach production. This is non-negotiable for enterprise-grade software.

#### BEFORE YOU START

- [ ] REFACTOR-002 is complete and merged (ESLint + Prettier configured)
- [ ] Branch: `git checkout -b refactor/REFACTOR-030-cicd`
- [ ] Ensure you have a `.github/` directory or create it

#### STEP-BY-STEP Instructions

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint --workspace=server
      - run: npm run lint --workspace=client

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd server && npx tsc --noEmit
      - run: cd client && npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd server && npm test
      - run: cd client && npm test

  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd client && npm run build
```

**Step 2: Verify the pipeline runs locally**

```bash
# Simulate what CI does:
cd server && npx tsc --noEmit && npm test
cd ../client && npx tsc --noEmit && npm run build
```

**Step 3: Add branch protection (manual step)**

In GitHub repository settings → Branches → Branch protection rules:

- Branch name pattern: `main`
- Require status checks to pass: `lint`, `typecheck`, `test`, `build`
- Require pull request reviews: 1

**Step 4: Add CI badge to README (optional)**

```markdown
![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Not caching `node_modules` | CI takes 5+ minutes per run | Use `actions/setup-node` with `cache: 'npm'` |
| Running all steps sequentially | Wastes time | Lint and typecheck run in parallel |
| Not running tests before build | Build can succeed with broken tests | `needs: [test]` dependency |
| Hardcoding Node version | Breaks when version changes | Use `.nvmrc` or `engines` field |

#### VERIFICATION

```bash
# Push the branch and check GitHub Actions
git push -u origin refactor/REFACTOR-030-cicd
# Open GitHub → Actions tab → verify pipeline runs
```

#### ROLLBACK

```bash
rm -rf .github/workflows/ci.yml
git checkout -- .
```

---

## Phase 3: Testing (Weeks 9–12) — Achieve >80% Coverage

> **Phase Goal**: Build a comprehensive test suite that catches regressions before they reach production. Start with the highest-risk business logic (tax, payroll, invoicing) and expand outward.

---

### REFACTOR-031: Set Up Test Infrastructure

**Priority**: P0 — Critical | **Effort**: 6 hours | **Risk**: Low
**Depends On**: REFACTOR-023, REFACTOR-030

#### WHY This Matters

The codebase has only 12 test files (~3,700 lines total) across ~170K+ lines of source code — that's roughly 2% test coverage. Most tests are integration-style "wave validation" tests that hit live services. There are NO mock factories, NO test database setup, NO shared test utilities, and NO coverage reporting configured. Before writing any tests, we need the infrastructure: Vitest configs with coverage, test utilities, mock factories, and a test database strategy.

Think of this like building the workshop before you start building furniture. Without proper tools, every test you write will be harder than it needs to be.

#### BEFORE YOU START

- [ ] REFACTOR-023 is complete and merged (DI container exists for mock injection)
- [ ] REFACTOR-030 is complete and merged (CI pipeline exists to run tests)
- [ ] Branch: `git checkout -b refactor/REFACTOR-031-test-infrastructure`
- [ ] Verify current test setup:

  ```bash
  cd server && npm test  # Should run vitest
  cat server/package.json | grep -A1 '"test"'
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create `server/vitest.config.ts`**

The server currently has `"test": "vitest run"` in package.json but NO vitest config file. Create one:

```typescript
// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/tests/**',
                'src/**/*.d.ts',
            ],
            thresholds: {
                // Start low — we'll raise these in REFACTOR-041
                lines: 10,
                branches: 5,
                functions: 10,
                statements: 10,
            },
        },
        // Timeout for async tests (DB, AI calls)
        testTimeout: 30_000,
        // Run tests sequentially to avoid DB conflicts
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } },
    },
});
```

**Step 2: Create `client/vitest.config.ts`**

```typescript
// client/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom', // Lighter than jsdom
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        exclude: ['node_modules', 'dist'],
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/test/**',
                'src/**/*.d.ts',
                'src/vite-env.d.ts',
            ],
            thresholds: {
                lines: 5,
                branches: 3,
                functions: 5,
                statements: 5,
            },
        },
    },
});
```

**Step 3: Create server test utilities — `server/src/test/setup.ts`**

```typescript
// server/src/test/setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { container } from '../container.js';

// Reset DI container between tests
afterEach(() => {
    container.reset();
});

// Global test setup
beforeAll(() => {
    // Ensure test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
    process.env.DATABASE_URL = 'sqlite://test.db';
});

afterAll(() => {
    // Cleanup
});
```

**Step 4: Create mock factories — `server/src/test/factories.ts`**

Mock factories generate realistic test data. This is the MOST important file in your test infrastructure.

```typescript
// server/src/test/factories.ts
import crypto from 'crypto';

let counter = 0;
function nextId(): string {
    return crypto.randomUUID();
}

export function buildUser(overrides: Partial<any> = {}) {
    counter++;
    return {
        id: nextId(),
        email: `testuser${counter}@example.com`,
        name: `Test User ${counter}`,
        passwordHash: '$2a$10$fakehashfortest',
        role: 'owner',
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

export function buildAccount(overrides: Partial<any> = {}) {
    counter++;
    return {
        id: nextId(),
        userId: nextId(),
        name: `Test Account ${counter}`,
        type: 'bank',
        bankName: 'CBA',
        bsb: '062-000',
        accountNumber: `1234${counter}`,
        currentBalanceCents: 100000,
        isPersonal: false,
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

export function buildTransaction(overrides: Partial<any> = {}) {
    counter++;
    return {
        id: nextId(),
        accountId: nextId(),
        date: '2025-01-15',
        description: `Test Transaction ${counter}`,
        amountCents: -5000,
        balanceCents: 95000,
        category: 'office-supplies',
        gstCategory: 'gst-free',
        gstAmountCents: 0,
        ...overrides,
    };
}

export function buildBASData(overrides: Partial<any> = {}) {
    return {
        financialYear: '2024-25',
        quarter: 2,
        totalSalesCents: 10000000,
        gstOnSalesCents: 909091,
        totalPurchasesCents: 5000000,
        gstOnPurchasesCents: 454545,
        netGstCents: 454546,
        ...overrides,
    };
}
```

**Step 5: Create mock repository helpers — `server/src/test/mock-repos.ts`**

```typescript
// server/src/test/mock-repos.ts
import { vi } from 'vitest';

export function createMockTransactionRepo() {
    return {
        findById: vi.fn(),
        findMany: vi.fn().mockResolvedValue({ data: [], total: 0 }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };
}

export function createMockAccountRepo() {
    return {
        findById: vi.fn(),
        findByUserId: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };
}

export function createMockUserRepo() {
    return {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    };
}
```

**Step 6: Create client test setup — `client/src/test/setup.ts`**

```typescript
// client/src/test/setup.ts
import '@testing-library/jest-dom/vitest';

// Mock window.matchMedia (used by responsive components)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock IntersectionObserver (used by virtualized lists)
class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
});
```

**Step 7: Create client render helper — `client/src/test/render.tsx`**

```typescript
// client/src/test/render.tsx
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Add providers that most components need (router, theme, etc.)
function AllProviders({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
    // When you add React Router, wrap with MemoryRouter here
    // When you add a theme provider, wrap here
}

export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { renderWithProviders as render };
```

**Step 8: Add npm scripts for coverage**

```bash
# In server/package.json, add:
cd server
npm pkg set scripts.test:coverage="vitest run --coverage"
npm pkg set scripts.test:watch="vitest watch"

# In client/package.json, add:
cd ../client
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:coverage="vitest run --coverage"
npm pkg set scripts.test:watch="vitest watch"
```

**Step 9: Install missing test dependencies**

```bash
# Server
cd server
npm install -D @vitest/coverage-v8

# Client
cd ../client
npm install -D @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom
```

**Step 10: Verify everything works**

```bash
cd server && npm test          # Existing tests should still pass
cd server && npm run test:coverage  # Should show coverage report
cd ../client && npm test       # Should run (even with 0 tests)
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Setting coverage thresholds too high initially | CI fails immediately, blocks all work | Start at 10% and raise in REFACTOR-041 |
| Using `jsdom` instead of `happy-dom` for client | jsdom is 3-5x slower | Use `happy-dom` unless you need specific jsdom features |
| Not mocking `window.matchMedia` | Many components crash in test env | Add to `client/src/test/setup.ts` |
| Forgetting `globals: true` in vitest config | Must import `describe`, `it`, `expect` in every file | Set `globals: true` to auto-inject |
| Not resetting mocks between tests | Tests leak state and become flaky | Use `afterEach(() => vi.restoreAllMocks())` |

#### VERIFICATION

```bash
# Server tests pass with coverage
cd server && npm run test:coverage
# Should see: "All files | ... | ..." coverage table

# Client tests pass (even if 0 tests)
cd client && npm run test:coverage

# Verify config files exist
ls server/vitest.config.ts client/vitest.config.ts
ls server/src/test/setup.ts server/src/test/factories.ts server/src/test/mock-repos.ts
ls client/src/test/setup.ts client/src/test/render.tsx
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-032: Unit Tests — Tax Calculations

**Priority**: P0 — Critical | **Effort**: 8 hours | **Risk**: Low
**Depends On**: REFACTOR-031

#### WHY This Matters

Tax calculations are the HIGHEST-RISK business logic in the entire application. If GST is calculated wrong, the user files an incorrect BAS with the ATO. If income tax brackets are wrong, payroll withholding is incorrect. These are financial calculations with legal consequences — they MUST be tested exhaustively.

The existing `TaxService` class in `server/src/services/tax.ts` (~750+ lines) contains: income tax brackets, Medicare levy, CGT calculations, depreciation, PAYG withholding, and BAS-related calculations. The `BASService` in `server/src/services/bas.ts` handles GST calculations and BAS quarter logic.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete and merged (test infrastructure exists)
- [ ] Branch: `git checkout -b refactor/REFACTOR-032-tax-tests`
- [ ] Read the tax service files to understand what needs testing:

  ```bash
  wc -l server/src/services/tax.ts server/src/services/bas.ts
  grep -n "export.*function\|export.*class\|async.*(" server/src/services/tax.ts | head -30
  grep -n "export.*function\|export.*class\|async.*(" server/src/services/bas.ts | head -20
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create `server/src/services/__tests__/tax.test.ts`**

Start with the pure functions — these are easiest to test because they have no database dependencies.

```typescript
import { describe, it, expect } from 'vitest';
import { TaxService } from '../tax.js';

const taxService = new TaxService();

describe('TaxService', () => {
    describe('calculateIncomeTax', () => {
        it('should return 0 tax for income below tax-free threshold ($18,200)', () => {
            const result = taxService.calculateIncomeTax(18200);
            expect(result.incomeTax).toBe(0);
        });

        it('should calculate 19% for income $18,201-$45,000', () => {
            const result = taxService.calculateIncomeTax(45000);
            // ($45,000 - $18,200) × 0.19 = $5,092
            expect(result.incomeTax).toBe(5092);
        });

        it('should calculate correctly for $120,000 income', () => {
            const result = taxService.calculateIncomeTax(120000);
            // Verify against ATO tax tables
            expect(result.incomeTax).toBeGreaterThan(0);
            expect(result.effectiveTaxRate).toBeGreaterThan(0);
            expect(result.effectiveTaxRate).toBeLessThan(0.45);
        });

        it('should handle zero income', () => {
            const result = taxService.calculateIncomeTax(0);
            expect(result.incomeTax).toBe(0);
            expect(result.totalTax).toBe(0);
        });

        it('should apply deductions before calculating tax', () => {
            const withDeductions = taxService.calculateIncomeTax(100000, 20000);
            const withoutDeductions = taxService.calculateIncomeTax(100000, 0);
            expect(withDeductions.totalTax).toBeLessThan(withoutDeductions.totalTax);
        });
    });

    describe('Medicare Levy', () => {
        it('should be 2% of taxable income above threshold', () => {
            const result = taxService.calculateIncomeTax(100000);
            expect(result.medicareLevy).toBe(2000); // 2% of $100,000
        });

        it('should be 0 for income below Medicare threshold', () => {
            const result = taxService.calculateIncomeTax(15000);
            expect(result.medicareLevy).toBe(0);
        });
    });

    describe('PAYG Withholding', () => {
        it('should calculate weekly withholding with tax-free threshold', () => {
            const result = taxService.calculatePAYGWithholding(1000_00, 'weekly', true);
            expect(result).toBeDefined();
            expect(result.withholdingAmountCents).toBeGreaterThanOrEqual(0);
        });

        it('should withhold more without tax-free threshold', () => {
            const withTFT = taxService.calculatePAYGWithholding(1500_00, 'weekly', true);
            const withoutTFT = taxService.calculatePAYGWithholding(1500_00, 'weekly', false);
            expect(withoutTFT.withholdingAmountCents).toBeGreaterThan(withTFT.withholdingAmountCents);
        });

        it('should handle different pay periods', () => {
            const weekly = taxService.calculatePAYGWithholding(1000_00, 'weekly', true);
            const fortnightly = taxService.calculatePAYGWithholding(2000_00, 'fortnightly', true);
            // Fortnightly should be roughly 2x weekly
            expect(fortnightly.withholdingAmountCents).toBeCloseTo(weekly.withholdingAmountCents * 2, -2);
        });
    });
});
```

**Step 2: Create `server/src/services/__tests__/bas.test.ts`**

Test the pure GST calculation functions first (no DB needed), then mock DB for `BASService.calculateBAS()`.

```typescript
import { describe, it, expect } from 'vitest';
import {
    calculateGstFromInclusive,
    grossFromNet,
    getQuarterDates,
    getCurrentQuarter,
    getCurrentFinancialYear,
} from '../bas.js';

describe('GST Calculations (pure functions)', () => {
    describe('calculateGstFromInclusive', () => {
        it('should extract GST from $110 inclusive → $10 GST', () => {
            expect(calculateGstFromInclusive(11000)).toBe(1000); // cents
        });

        it('should handle zero amount', () => {
            expect(calculateGstFromInclusive(0)).toBe(0);
        });

        it('should handle negative amounts (refunds)', () => {
            expect(calculateGstFromInclusive(-11000)).toBe(1000); // absolute
        });

        it('should return 0 for GST-free (rate=0)', () => {
            expect(calculateGstFromInclusive(11000, 0)).toBe(0);
        });

        it('should round correctly for odd amounts', () => {
            // $1.00 inclusive → GST = $0.09 (rounded)
            const gst = calculateGstFromInclusive(100);
            expect(gst).toBe(9); // 100 * 0.10 / 1.10 = 9.09 → 9
        });
    });

    describe('grossFromNet', () => {
        it('should calculate $100 net → $110 gross at 10% GST', () => {
            expect(grossFromNet(10000)).toBe(11000);
        });

        it('should handle zero', () => {
            expect(grossFromNet(0)).toBe(0);
        });
    });

    describe('getQuarterDates', () => {
        it('should return correct dates for Q1 (Jul-Sep)', () => {
            const dates = getQuarterDates('2024-25', 1);
            expect(dates.startDate).toBe('2024-07-01');
            expect(dates.endDate).toBe('2024-09-30');
        });

        it('should return correct dates for Q3 (Jan-Mar)', () => {
            const dates = getQuarterDates('2024-25', 3);
            expect(dates.startDate).toBe('2025-01-01');
            expect(dates.endDate).toBe('2025-03-31');
        });

        it('should include lodgement due date', () => {
            const dates = getQuarterDates('2024-25', 1);
            expect(dates.lodgementDueDate).toBeDefined();
        });
    });

    describe('getCurrentFinancialYear', () => {
        it('should return a string in format YYYY-YY', () => {
            const fy = getCurrentFinancialYear();
            expect(fy).toMatch(/^[0-9]{4}-[0-9]{2}$/);
        });
    });
});
```

**Step 3: Add CGT and Depreciation tests**

```typescript
// Add to server/src/services/__tests__/tax.test.ts

describe('CGT Calculations', () => {
    it('should calculate capital gain correctly', () => {
        const result = taxService.calculateCGT({
            acquisitionDate: '2020-01-01',
            disposalDate: '2025-06-15',
            costBase: 100000,
            capitalProceeds: 150000,
        });
        expect(result.grossGain).toBe(50000);
        expect(result.discountEligible).toBe(true); // Held > 12 months
        expect(result.discountAmount).toBe(25000); // 50% discount
        expect(result.netGain).toBe(25000);
    });

    it('should NOT apply discount for assets held < 12 months', () => {
        const result = taxService.calculateCGT({
            acquisitionDate: '2025-01-01',
            disposalDate: '2025-06-15',
            costBase: 100000,
            capitalProceeds: 150000,
        });
        expect(result.discountEligible).toBe(false);
        expect(result.netGain).toBe(50000);
    });

    it('should handle capital losses', () => {
        const result = taxService.calculateCGT({
            acquisitionDate: '2020-01-01',
            disposalDate: '2025-06-15',
            costBase: 150000,
            capitalProceeds: 100000,
        });
        expect(result.capitalLoss).toBe(50000);
        expect(result.netGain).toBe(0);
    });
});

describe('Depreciation', () => {
    it('should calculate diminishing value depreciation', () => {
        const result = taxService.calculateDepreciation({
            cost: 10000,
            effectiveLife: 5,
            method: 'diminishing',
        });
        expect(result.depreciation).toBeGreaterThan(0);
        expect(result.closingValue).toBeLessThan(10000);
    });

    it('should calculate prime cost (straight-line) depreciation', () => {
        const result = taxService.calculateDepreciation({
            cost: 10000,
            effectiveLife: 5,
            method: 'prime-cost',
        });
        expect(result.depreciation).toBe(2000); // 10000 / 5
    });
});
```

**Step 4: Test edge cases that catch real bugs**

```typescript
describe('Tax Edge Cases', () => {
    it('should handle exactly $18,200 (boundary)', () => {
        const result = taxService.calculateIncomeTax(18200);
        expect(result.incomeTax).toBe(0);
    });

    it('should handle $18,201 (one dollar over threshold)', () => {
        const result = taxService.calculateIncomeTax(18201);
        expect(result.incomeTax).toBeGreaterThan(0);
    });

    it('should handle very large income ($10M)', () => {
        const result = taxService.calculateIncomeTax(10_000_000);
        expect(result.effectiveTaxRate).toBeLessThanOrEqual(0.45);
        expect(result.incomeTax).toBeGreaterThan(0);
    });

    it('should handle negative income gracefully', () => {
        // Business loss scenario
        const result = taxService.calculateIncomeTax(-50000);
        expect(result.incomeTax).toBe(0);
    });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Hardcoding expected tax amounts | Tax rates change yearly | Use ATO-published tables as reference, add comments with source |
| Testing only happy path | Edge cases (zero, negative, boundary) cause real bugs | Always test: 0, -1, boundary, max |
| Not testing rounding | Financial calculations must round correctly | Use `toBeCloseTo()` for floating point, exact match for cents |
| Mocking the tax service itself | You're testing the mock, not the code | Only mock external dependencies (DB), test the actual calculation |

#### VERIFICATION

```bash
cd server && npx vitest run src/services/__tests__/tax.test.ts --coverage
cd server && npx vitest run src/services/__tests__/bas.test.ts --coverage

# Check coverage on tax.ts and bas.ts specifically
# Target: >90% line coverage on both files
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-033: Unit Tests — Payroll Processing

**Priority**: P0 — Critical | **Effort**: 6 hours | **Risk**: Low
**Depends On**: REFACTOR-031

#### WHY This Matters

Payroll errors directly affect employees' pay. If super guarantee is calculated wrong, the employer faces ATO penalties. If STP reporting is incorrect, the ATO receives wrong data. Payroll services include: `server/src/services/payroll/stp-service.ts`, `server/src/services/payroll/payslip-service.ts`, `server/src/services/payroll/award-service.ts`, `server/src/services/employee.ts`, and `server/src/services/pay-structures.ts`.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-033-payroll-tests`
- [ ] Map the payroll service files:

  ```bash
  find server/src/services/payroll -name "*.ts" -exec wc -l {} +
  wc -l server/src/services/employee.ts server/src/services/pay-structures.ts
  ```

#### STEP-BY-STEP Instructions

**Step 1: Test super guarantee calculations**

Super guarantee is 11.5% (2024-25) of ordinary time earnings. This is a pure calculation — no DB needed.

```typescript
// server/src/services/__tests__/payroll.test.ts
import { describe, it, expect } from 'vitest';

describe('Super Guarantee', () => {
    it('should calculate 11.5% of ordinary time earnings', () => {
        const grossPay = 5000_00; // $5,000 in cents
        const superAmount = Math.round(grossPay * 0.115);
        expect(superAmount).toBe(575_00); // $575
    });

    it('should not apply super on overtime (OTE only)', () => {
        // Super is on Ordinary Time Earnings, not overtime
        // Test that overtime hours are excluded from super base
    });

    it('should handle the $450/month threshold (pre-July 2022 legacy)', () => {
        // Post July 2022: no minimum threshold
        // Ensure all employees get super regardless of amount
    });

    it('should cap at maximum super contribution base', () => {
        // 2024-25: $65,070 per quarter
        // Earnings above this don't require super
    });
});
```

**Step 2: Test STP reporting format**

```typescript
describe('STP Service', () => {
    it('should generate valid STP event payload', () => {
        // Test that the STP event contains required fields:
        // - Employee TFN (masked), name, address
        // - Gross payments, PAYG withheld, super
        // - Reportable fringe benefits, salary sacrifice
    });

    it('should calculate YTD totals correctly', () => {
        // Sum all pay runs for the financial year
        // Verify gross, tax, super, net totals
    });

    it('should handle EOFY finalisation event', () => {
        // Final STP submission marks the year as complete
        // All YTD figures must be final
    });
});
```

**Step 3: Test leave accrual**

```typescript
describe('Leave Accrual', () => {
    it('should accrue 4 weeks annual leave per year (full-time)', () => {
        // 20 days / 52 weeks = 0.3846 days per week
    });

    it('should accrue 10 days personal/carer leave per year', () => {
        // 10 days / 52 weeks = 0.1923 days per week
    });

    it('should pro-rata for part-time employees', () => {
        // Part-time at 0.6 FTE = 60% of full-time accrual
    });

    it('should not accrue leave for casual employees', () => {
        // Casuals get 25% loading instead of leave
    });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Using dollars instead of cents | Rounding errors compound across payroll | ALL amounts in cents, convert only for display |
| Forgetting super guarantee rate changes | Rate increases yearly (11% → 11.5% → 12%) | Use a constant, not a magic number |
| Not testing part-time pro-rata | Part-time calculations are the most error-prone | Always test full-time AND part-time scenarios |
| Ignoring the maximum super contribution base | Over-calculating super for high earners | Test with salary above the quarterly cap |

#### VERIFICATION

```bash
cd server && npx vitest run src/services/__tests__/payroll.test.ts --coverage
# Target: >90% coverage on payroll service files
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-034: Unit Tests — Invoicing & Billing

**Priority**: P0 — Critical | **Effort**: 6 hours | **Risk**: Low
**Depends On**: REFACTOR-031

#### WHY This Matters

Invoicing is a core revenue feature. If invoice numbers are duplicated, if payment matching fails, or if overdue calculations are wrong, the user's accounts receivable is incorrect. The invoicing service lives in `server/src/services/invoicing.ts` and the route file is `server/src/routes/invoicing-routes.ts`.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-034-invoicing-tests`
- [ ] Read the invoicing service:

  ```bash
  wc -l server/src/services/invoicing.ts server/src/routes/invoicing-routes.ts
  grep -n "export.*function\|export.*class\|async " server/src/services/invoicing.ts | head -20
  ```

#### STEP-BY-STEP Instructions

**Step 1: Test invoice number generation**

```typescript
// server/src/services/__tests__/invoicing.test.ts
describe('Invoice Number Generation', () => {
    it('should generate sequential invoice numbers', () => {
        // INV-0001, INV-0002, INV-0003...
    });

    it('should never generate duplicate numbers', () => {
        // Generate 100 numbers, verify all unique
        const numbers = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const num = generateInvoiceNumber(i + 1);
            expect(numbers.has(num)).toBe(false);
            numbers.add(num);
        }
    });

    it('should pad numbers correctly (INV-0001 not INV-1)', () => {
        const num = generateInvoiceNumber(1);
        expect(num).toMatch(/INV-[0-9]{4,}/);
    });
});
```

**Step 2: Test payment allocation**

```typescript
describe('Payment Allocation', () => {
    it('should mark invoice as paid when full amount received', () => {
        // Invoice: $1,000. Payment: $1,000. Status: 'paid'
    });

    it('should handle partial payments', () => {
        // Invoice: $1,000. Payment: $500. Status: 'partially-paid'
        // Balance remaining: $500
    });

    it('should handle overpayment', () => {
        // Invoice: $1,000. Payment: $1,200. Credit: $200
    });

    it('should allocate payment to oldest invoice first', () => {
        // Multiple outstanding invoices — FIFO allocation
    });
});
```

**Step 3: Test overdue/aging calculations**

```typescript
describe('Invoice Aging', () => {
    it('should classify as current if within payment terms', () => {
        // Due date: 30 days from now → 'current'
    });

    it('should classify as 30+ days overdue', () => {
        // Due date: 35 days ago → '30-60'
    });

    it('should classify as 60+ days overdue', () => {
        // Due date: 65 days ago → '60-90'
    });

    it('should classify as 90+ days overdue', () => {
        // Due date: 95 days ago → '90+'
    });

    it('should calculate aging summary totals', () => {
        // Given 5 invoices at various ages, verify bucket totals
    });
});
```

#### VERIFICATION

```bash
cd server && npx vitest run src/services/__tests__/invoicing.test.ts --coverage
# Target: >90% coverage on invoicing service
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-035: Unit Tests — Bank Reconciliation

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Low
**Depends On**: REFACTOR-031

#### WHY This Matters

Bank reconciliation is the process of matching bank statement transactions against ledger entries. The matching algorithm in `server/src/services/bank-reconciliation.ts` (~1,109 lines) uses multi-strategy matching with confidence scoring. If the matching is wrong, the user's books don't balance. This is a core accounting function that MUST be tested.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-035-reconciliation-tests`
- [ ] Read the reconciliation service:

  ```bash
  wc -l server/src/services/bank-reconciliation.ts
  grep -n "export.*function\|export.*class\|async " server/src/services/bank-reconciliation.ts | head -20
  ```

#### STEP-BY-STEP Instructions

**Step 1: Test the matching algorithm (pure logic)**

The matching engine compares bank transactions to ledger entries using multiple strategies: exact amount match, date proximity, description similarity, and rule-based matching. Each strategy produces a confidence score.

```typescript
// server/src/services/__tests__/bank-reconciliation.test.ts
import { describe, it, expect } from 'vitest';

describe('Bank Reconciliation Matching', () => {
    describe('Exact Amount Match', () => {
        it('should match transactions with identical amounts', () => {
            // Bank: -$500.00, Ledger: $500.00 debit → match
        });

        it('should NOT match transactions with different amounts', () => {
            // Bank: -$500.00, Ledger: $499.99 → no match
        });

        it('should handle sign differences (bank negative = ledger debit)', () => {
            // Bank statements show debits as negative
            // Ledger shows debits as positive in debit column
        });
    });

    describe('Confidence Scoring', () => {
        it('should give high confidence for exact amount + same date', () => {
            // Amount match + date match → confidence > 0.9
        });

        it('should give medium confidence for amount match + close date', () => {
            // Amount match + date within 3 days → confidence 0.6-0.9
        });

        it('should give low confidence for amount match only', () => {
            // Amount match + date > 7 days apart → confidence < 0.5
        });
    });

    describe('Balance Verification', () => {
        it('should detect when statement balance matches ledger balance', () => {
            // All transactions matched → difference = 0
        });

        it('should calculate unreconciled difference', () => {
            // 3 of 5 transactions matched → show remaining difference
        });
    });
});
```

**Step 2: Test suggestion engine**

```typescript
describe('Reconciliation Suggestions', () => {
    it('should suggest matches above confidence threshold', () => {
        // Only suggest matches with confidence > 0.5
    });

    it('should rank suggestions by confidence (highest first)', () => {
        // Multiple possible matches → sort descending by confidence
    });

    it('should not suggest already-matched transactions', () => {
        // Once a transaction is matched, exclude from future suggestions
    });
});
```

#### VERIFICATION

```bash
cd server && npx vitest run src/services/__tests__/bank-reconciliation.test.ts --coverage
# Target: >80% coverage on bank-reconciliation.ts
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-036: Unit Tests — Auth & RBAC

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Low
**Depends On**: REFACTOR-031

#### WHY This Matters

Authentication and authorization are security-critical. If JWT validation is wrong, unauthorized users access data. If RBAC is wrong, a `viewer` role can delete transactions. The auth code lives in `server/src/auth.ts` (30 lines — JWT sign/verify, password hash/compare) and `server/src/services/admin-auth.ts` (595 lines — admin auth with lockout, RBAC middleware).

The role hierarchy is: `owner > admin > accountant > bookkeeper > viewer`. Each role has specific permissions. The RBAC middleware checks `c.get('jwtPayload')` for the user's role and compares against required permissions.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete and merged
- [ ] Branch: `git checkout -b refactor/REFACTOR-036-auth-tests`
- [ ] Read the auth files:

  ```bash
  cat server/src/auth.ts
  grep -n "export.*function\|export.*class" server/src/services/admin-auth.ts | head -15
  ```

#### STEP-BY-STEP Instructions

**Step 1: Test JWT generation and verification**

```typescript
// server/src/services/__tests__/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

// Set JWT_SECRET before importing auth module
beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests';
});

describe('JWT Authentication', () => {
    it('should generate a valid JWT token', async () => {
        const { generateToken } = await import('../../auth.js');
        const token = await generateToken('user-123');
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should verify a valid token and return payload', async () => {
        const { generateToken, verifyToken } = await import('../../auth.js');
        const token = await generateToken('user-123');
        const payload = await verifyToken(token);
        expect(payload).toBeDefined();
        expect(payload?.userId).toBe('user-123');
    });

    it('should return null for an invalid token', async () => {
        const { verifyToken } = await import('../../auth.js');
        const result = await verifyToken('invalid.token.here');
        expect(result).toBeNull();
    });

    it('should return null for an expired token', async () => {
        // Create a token with exp in the past
        // This tests the expiry check
    });

    it('should include expiry claim (24 hours)', async () => {
        const { generateToken, verifyToken } = await import('../../auth.js');
        const token = await generateToken('user-123');
        const payload = await verifyToken(token);
        expect(payload?.exp).toBeDefined();
        // exp should be ~24 hours from now
        const now = Math.floor(Date.now() / 1000);
        expect(payload?.exp).toBeGreaterThan(now);
        expect(payload?.exp).toBeLessThanOrEqual(now + 86400 + 5); // 24h + 5s tolerance
    });
});
```

**Step 2: Test password hashing**

```typescript
describe('Password Hashing', () => {
    it('should hash a password (not store plaintext)', async () => {
        const { hashPassword } = await import('../../auth.js');
        const hash = await hashPassword('mySecurePassword123');
        expect(hash).not.toBe('mySecurePassword123');
        expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    });

    it('should verify correct password', async () => {
        const { hashPassword, comparePassword } = await import('../../auth.js');
        const hash = await hashPassword('mySecurePassword123');
        const isValid = await comparePassword('mySecurePassword123', hash);
        expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
        const { hashPassword, comparePassword } = await import('../../auth.js');
        const hash = await hashPassword('mySecurePassword123');
        const isValid = await comparePassword('wrongPassword', hash);
        expect(isValid).toBe(false);
    });
});
```

**Step 3: Test RBAC role hierarchy**

```typescript
describe('RBAC Role Hierarchy', () => {
    it('owner should have all permissions', () => {
        // owner can: create, read, update, delete, manage-team, manage-billing
    });

    it('viewer should only have read permission', () => {
        // viewer can: read
        // viewer cannot: create, update, delete, manage-team
    });

    it('accountant should have financial permissions but not team management', () => {
        // accountant can: create, read, update (financial data)
        // accountant cannot: manage-team, manage-billing, delete
    });

    it('should deny access when role lacks required permission', () => {
        // Simulate middleware check: viewer tries to delete → 403
    });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Using real JWT_SECRET in tests | Leaks production secret | Set `process.env.JWT_SECRET` in test setup |
| Not testing token expiry | Expired tokens could grant access | Create tokens with past expiry, verify rejection |
| Testing only the happy path for auth | Security bugs hide in edge cases | Test: missing token, malformed token, expired token, wrong role |
| Importing auth module before setting env vars | Module reads JWT_SECRET at import time | Use dynamic `import()` or set env in `beforeAll` |

#### VERIFICATION

```bash
cd server && npx vitest run src/services/__tests__/auth.test.ts --coverage
# Target: >90% coverage on auth.ts and admin-auth.ts
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-037: Integration Tests — API Routes (Core)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-031, REFACTOR-016

#### WHY This Matters

Unit tests verify individual functions. Integration tests verify that routes, middleware, services, and database work TOGETHER correctly. A unit test might pass for `calculateIncomeTax()` but an integration test reveals that the route handler doesn't parse the request body correctly, or the JWT middleware rejects valid tokens, or the response format doesn't match what the client expects.

Hono provides `app.request()` for testing WITHOUT starting an HTTP server — this is fast and reliable for integration tests.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete (test infrastructure exists)
- [ ] REFACTOR-016 is complete (routes are extracted — if not, test against index.ts directly)
- [ ] Branch: `git checkout -b refactor/REFACTOR-037-integration-tests-core`
- [ ] Understand Hono's test approach:

  ```typescript
  // Hono built-in: no HTTP server needed
  const res = await app.request('/api/some-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer TOKEN' },
      body: JSON.stringify({ key: 'value' }),
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create the integration test helper**

This helper creates a test app instance with mocked DB and generates valid JWT tokens for authenticated requests.

```typescript
// server/src/test/integration-helper.ts
import { Hono } from 'hono';

/**
 * Creates a test-ready Hono app instance.
 * Re-uses the same app setup as production but with test DB.
 */
export async function createTestApp(): Promise<Hono> {
    // Set test env vars BEFORE importing the app
    process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
    process.env.DATABASE_URL = ':memory:'; // SQLite in-memory for speed

    // Import the app (after env vars are set)
    // If routes are extracted: import route files directly
    // If not yet extracted: import the full app from index.ts
    const { generateToken } = await import('../auth.js');

    // Return app instance
    // For now, build a minimal app with the routes under test
    const app = new Hono();
    return app;
}

/**
 * Generate a valid JWT for test requests.
 */
export async function getTestToken(userId = 'test-user-1', role = 'owner'): Promise<string> {
    const { generateToken } = await import('../auth.js');
    return generateToken(userId);
}

/**
 * Helper to make authenticated requests.
 */
export async function authRequest(
    app: Hono,
    path: string,
    options: RequestInit = {},
    role = 'owner'
): Promise<Response> {
    const token = await getTestToken('test-user-1', role);
    return app.request(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
}
```

**Step 2: Test Auth routes (register, login)**

```typescript
// server/src/routes/__tests__/auth.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Auth Routes (Integration)', () => {
    describe('POST /auth/register', () => {
        it('should register a new user and return token', async () => {
            // POST /auth/register with { username, password }
            // Expect: 200, { token: '...' }
        });

        it('should reject duplicate username', async () => {
            // Register same username twice
            // Expect: 409 Conflict
        });

        it('should reject weak password', async () => {
            // Password too short or missing
            // Expect: 400 Bad Request with validation error
        });

        it('should reject missing fields', async () => {
            // Empty body or missing username/password
            // Expect: 400
        });
    });

    describe('POST /auth/login', () => {
        it('should login with correct credentials', async () => {
            // Login with registered user
            // Expect: 200, { token: '...' }
        });

        it('should reject incorrect password', async () => {
            // Expect: 401 Unauthorized
        });

        it('should reject non-existent user', async () => {
            // Expect: 401 Unauthorized (same as wrong password — don't leak user existence)
        });
    });
});
```

**Step 3: Test Transaction routes (CRUD)**

```typescript
// server/src/routes/__tests__/transactions.integration.test.ts
describe('Transaction Routes (Integration)', () => {
    describe('POST /api/transactions', () => {
        it('should create a transaction with valid data', async () => {
            // Authenticated POST with { date, description, amount, category }
            // Expect: 201, transaction object with ID
        });

        it('should reject unauthenticated request', async () => {
            // No Authorization header
            // Expect: 401
        });

        it('should validate required fields', async () => {
            // Missing amount or date
            // Expect: 400 with validation errors
        });
    });

    describe('GET /api/transactions', () => {
        it('should list transactions for authenticated user', async () => {
            // Expect: 200, array of transactions
        });

        it('should filter by date range', async () => {
            // ?startDate=2025-01-01&endDate=2025-01-31
            // Expect: only transactions in range
        });

        it('should paginate results', async () => {
            // ?offset=0&limit=10
            // Expect: max 10 results
        });

        it('should NOT return other user\'s transactions', async () => {
            // Create transaction as user A
            // Query as user B
            // Expect: user B sees 0 transactions
        });
    });

    describe('PUT /api/transactions/:id', () => {
        it('should update own transaction', async () => {
            // Create, then update category
            // Expect: 200, updated transaction
        });

        it('should 404 for non-existent transaction', async () => {
            // Expect: 404
        });
    });

    describe('DELETE /api/transactions/:id', () => {
        it('should delete own transaction', async () => {
            // Create, delete, verify gone
            // Expect: 200 on delete, 404 on subsequent GET
        });
    });
});
```

**Step 4: Test Account routes**

```typescript
// server/src/routes/__tests__/accounts.integration.test.ts
describe('Account Routes (Integration)', () => {
    describe('GET /api/accounts', () => {
        it('should return chart of accounts for user', async () => {
            // Expect: array with standard accounts
        });
    });

    describe('POST /api/accounts', () => {
        it('should create a new account', async () => {
            // { name, type, code }
            // Expect: 201, account object
        });

        it('should reject duplicate account codes', async () => {
            // Create same code twice
            // Expect: 409
        });
    });
});
```

**Step 5: Test Statement upload**

```typescript
describe('Statement Routes (Integration)', () => {
    describe('POST /api/statements/upload', () => {
        it('should accept a valid CSV/PDF upload', async () => {
            // Multipart form data with file
            // Expect: 200 with parsing status
        });

        it('should reject unsupported file types', async () => {
            // Upload a .exe or .txt
            // Expect: 400
        });

        it('should reject files over size limit', async () => {
            // Body limit is 50MB (set in index.ts)
            // Expect: 413 Payload Too Large
        });
    });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Starting a real HTTP server in tests | Slow, port conflicts, CI issues | Use `app.request()` — no server needed |
| Using production database | Destroys real data | Always use test/in-memory DB |
| Not cleaning up between tests | Tests depend on each other's data | Use `beforeEach` to reset DB state |
| Testing implementation details | Tests break when code is refactored | Test HTTP request → HTTP response, not internal methods |
| Forgetting to set env vars before import | Module-level code reads env at import time | Set `process.env` before any `import()` calls |

#### VERIFICATION

```bash
cd server && npx vitest run src/routes/__tests__/ --coverage
# All integration tests pass
# No console.error output (all errors handled)
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-038: Integration Tests — API Routes (Extended)

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-037

#### WHY This Matters

After core routes (auth, transactions, accounts, statements) are integration-tested, you need to cover the remaining feature routes: reports, payroll, tax/BAS, teams, subscriptions, invoicing, market data, and AP (bills/purchase orders). These routes have more complex business logic and more service dependencies, so integration tests catch wiring issues early.

#### BEFORE YOU START

- [ ] REFACTOR-037 is complete and merged (core integration tests pass)
- [ ] Branch: `git checkout -b refactor/REFACTOR-038-integration-tests-extended`
- [ ] List all untested route groups:

  ```bash
  grep -n "app.route\|app.get\|app.post\|app.put\|app.delete" server/src/index.ts | wc -l
  ls server/src/routes/
  ```

#### STEP-BY-STEP Instructions

**Step 1: Test Report generation endpoints**

```typescript
// server/src/routes/__tests__/reports.integration.test.ts
describe('Report Routes (Integration)', () => {
    describe('GET /api/reports/profit-loss', () => {
        it('should generate P&L report for date range', async () => {
            // ?startDate=2025-01-01&endDate=2025-03-31
            // Expect: { revenue, expenses, netProfit, lineItems: [...] }
        });

        it('should return empty report for date range with no data', async () => {
            // Expect: all zeros, empty line items
        });
    });

    describe('GET /api/reports/balance-sheet', () => {
        it('should generate balance sheet as at date', async () => {
            // ?asAt=2025-03-31
            // Expect: { assets, liabilities, equity } that balance
        });
    });

    describe('GET /api/reports/trial-balance', () => {
        it('should have equal debits and credits', async () => {
            // The fundamental accounting equation
            // Expect: totalDebits === totalCredits
        });
    });
});
```

**Step 2: Test Payroll endpoints**

```typescript
// server/src/routes/__tests__/payroll.integration.test.ts
describe('Payroll Routes (Integration)', () => {
    describe('POST /api/payroll/run', () => {
        it('should create a pay run for employees', async () => {
            // Expect: pay run object with employee payslips
        });

        it('should calculate super and tax correctly', async () => {
            // Verify payslip breakdown matches expected values
        });
    });

    describe('GET /api/payroll/history', () => {
        it('should list past pay runs', async () => {
            // Expect: array of pay run summaries
        });
    });
});
```

**Step 3: Test BAS/Tax endpoints**

```typescript
// server/src/routes/__tests__/bas.integration.test.ts
describe('BAS Routes (Integration)', () => {
    describe('GET /api/bas/calculate', () => {
        it('should calculate BAS for a quarter', async () => {
            // ?financialYear=2024-25&quarter=2
            // Expect: GST collected, GST paid, PAYG withheld, net amount
        });
    });

    describe('POST /api/bas/lodge', () => {
        it('should mark BAS as lodged', async () => {
            // Expect: status changed to 'lodged'
        });
    });
});
```

**Step 4: Test Team/Subscription endpoints**

```typescript
describe('Team Routes (Integration)', () => {
    describe('POST /api/teams/invite', () => {
        it('should invite a new team member', async () => {
            // { email, role: 'bookkeeper' }
            // Expect: invitation created
        });

        it('should reject invitation from non-owner/admin', async () => {
            // Authenticate as 'viewer' role
            // Expect: 403 Forbidden
        });
    });
});

describe('Subscription Routes (Integration)', () => {
    describe('GET /api/subscription/status', () => {
        it('should return current subscription details', async () => {
            // Expect: { plan, status, billingCycle, nextBillingDate }
        });
    });
});
```

**Step 5: Test Invoicing endpoints**

The invoicing routes are already well-structured in `server/src/routes/invoicing-routes.ts`. Test the 17 endpoints.

```typescript
// server/src/routes/__tests__/invoicing.integration.test.ts
describe('Invoicing Routes (Integration)', () => {
    describe('Customer CRUD', () => {
        it('POST /api/customers — should create customer', async () => {});
        it('GET /api/customers — should list customers', async () => {});
        it('GET /api/customers/:id — should get customer detail', async () => {});
        it('PUT /api/customers/:id — should update customer', async () => {});
        it('DELETE /api/customers/:id — should delete customer', async () => {});
    });

    describe('Invoice Lifecycle', () => {
        it('POST /api/invoices — should create draft invoice', async () => {});
        it('GET /api/invoices — should list invoices with filters', async () => {});
        it('POST /api/invoices/:id/send — should mark as sent', async () => {});
        it('POST /api/invoices/:id/payment — should record payment', async () => {});
        it('GET /api/invoices/next-number — should return next invoice number', async () => {});
    });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Testing ALL 200+ endpoints at once | Overwhelming, hard to debug failures | Group by domain, one test file per feature |
| Not seeding test data | Tests fail because there's no data to query | Use `beforeAll` to create seed data (users, accounts, transactions) |
| Ignoring error response format | Client expects `{ error: 'message' }` but server sends `{ message: 'error' }` | Assert the exact error response shape |
| Coupling tests to specific IDs | IDs change between test runs | Create data in the test, capture the ID, use it in subsequent assertions |

#### VERIFICATION

```bash
cd server && npx vitest run src/routes/__tests__/ --coverage
# All integration tests pass
# Coverage on route handler files >70%
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-039: Client Component Tests

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Low
**Depends On**: REFACTOR-031, REFACTOR-026

#### WHY This Matters

The client has 40+ feature components and 0 component tests. If a refactor breaks a component's rendering, sorting, filtering, or form validation, there's NO safety net. Component tests using Vitest + React Testing Library verify that components render correctly, handle user interactions, and display data properly — all WITHOUT a browser.

Key components to test first (highest user impact): `LedgerPage` (transaction table/list), `BASPage`, `InvoicingDashboard`, `Auth` (login/register), `PayrollDashboard`.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete (client test infrastructure exists with happy-dom, Testing Library)
- [ ] Branch: `git checkout -b refactor/REFACTOR-039-client-component-tests`
- [ ] Verify client test setup works:

  ```bash
  cd client && npm test  # Should run with 0 tests
  ```

- [ ] Familiarize with Testing Library principles:
  - **Query by role, text, label** — NOT by class name or test ID
  - **User-centric**: test what the user sees, not implementation details
  - **`screen.getByRole('button', { name: 'Save' })` > `document.querySelector('.btn-save')`**

#### STEP-BY-STEP Instructions

**Step 1: Test the Auth (login/register) component**

Start with Auth because it's the entry point and relatively simple — a form with validation.

```typescript
// client/src/features/auth/__tests__/Auth.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/render';
import { Auth } from '../components/Auth';

// Mock the api module
vi.mock('../../../api', () => ({
    api: {
        login: vi.fn(),
        register: vi.fn(),
    },
}));

describe('Auth Component', () => {
    it('should render login form by default', () => {
        render(<Auth onLogin={vi.fn()} />);
        expect(screen.getByRole('button', { name: /log in|sign in/i })).toBeInTheDocument();
    });

    it('should show validation error for empty username', async () => {
        render(<Auth onLogin={vi.fn()} />);
        const submitButton = screen.getByRole('button', { name: /log in|sign in/i });
        fireEvent.click(submitButton);
        // Expect: validation error message visible
        await waitFor(() => {
            expect(screen.getByText(/required|username/i)).toBeInTheDocument();
        });
    });

    it('should call login API with form data', async () => {
        const { api } = await import('../../../api');
        (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'test-token' });

        render(<Auth onLogin={vi.fn()} />);
        // Fill in form fields and submit
        // Expect: api.login called with { username, password }
    });

    it('should display error message on login failure', async () => {
        const { api } = await import('../../../api');
        (api.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid credentials'));

        render(<Auth onLogin={vi.fn()} />);
        // Submit with any data
        // Expect: error message shown to user
    });

    it('should switch to register form', () => {
        render(<Auth onLogin={vi.fn()} />);
        const switchLink = screen.getByText(/register|sign up|create account/i);
        fireEvent.click(switchLink);
        // Expect: register form visible
    });
});
```

**Step 2: Test LedgerPage / TransactionTable**

The transaction table is the most-used component. Test rendering, sorting, and filtering.

```typescript
// client/src/features/transactions/__tests__/LedgerPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/render';

const mockTransactions = [
    { id: '1', date: '2025-01-15', description: 'Woolworths', amount: -85.50, category: 'Groceries' },
    { id: '2', date: '2025-01-16', description: 'Client Payment', amount: 5000, category: 'Revenue' },
    { id: '3', date: '2025-01-17', description: 'Telstra', amount: -89.00, category: 'Utilities' },
];

describe('LedgerPage', () => {
    it('should render transaction rows', () => {
        // Render with mockTransactions
        // Expect: 3 rows visible with descriptions
        expect(screen.getByText('Woolworths')).toBeInTheDocument();
        expect(screen.getByText('Client Payment')).toBeInTheDocument();
    });

    it('should show loading skeleton when loading=true', () => {
        // Render with loading=true
        // Expect: skeleton elements visible, no transaction data
    });

    it('should show empty state when no transactions', () => {
        // Render with transactions=[]
        // Expect: "No transactions" or empty state message
    });

    it('should filter transactions by search text', async () => {
        // Type "Woolworths" in search box
        // Expect: only Woolworths row visible
    });

    it('should display amounts formatted as currency', () => {
        // Expect: "$85.50" or "-$85.50", not "85.5" or "-855"
    });
});
```

**Step 3: Test BASPage**

```typescript
// client/src/features/bas/__tests__/BASPage.test.tsx
describe('BASPage', () => {
    it('should render quarter selector', () => {
        // Expect: quarter dropdown or tabs visible
    });

    it('should display GST collected and GST paid', () => {
        // Mock API response with BAS data
        // Expect: GST amounts displayed correctly
    });

    it('should show lodgement status', () => {
        // Expect: "Draft", "Lodged", or "Overdue" badge
    });
});
```

**Step 4: Test InvoicingDashboard**

```typescript
// client/src/features/invoicing/__tests__/InvoicingDashboard.test.tsx
describe('InvoicingDashboard', () => {
    it('should render invoice list', () => {
        // Mock API response with invoices
        // Expect: invoice numbers and amounts displayed
    });

    it('should show create invoice button', () => {
        expect(screen.getByRole('button', { name: /create|new invoice/i })).toBeInTheDocument();
    });

    it('should filter invoices by status', async () => {
        // Click "Overdue" filter
        // Expect: only overdue invoices shown
    });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Querying by CSS class names | Brittle — breaks on style changes | Query by role, text, or label per Testing Library docs |
| Not mocking API calls | Tests make real HTTP requests, fail in CI | Mock `api` module with `vi.mock()` |
| Testing implementation details (state, hooks) | Tests break on refactor even if UI is correct | Test what the USER sees: rendered text, button states, form behavior |
| Not wrapping renders in act() | Async state updates cause warnings | Use `waitFor()` for async assertions, `fireEvent` handles act() |
| Snapshot testing everything | Snapshots are fragile and meaningless | Use targeted assertions on specific elements |

#### VERIFICATION

```bash
cd client && npx vitest run --coverage
# Target: >60% coverage on tested components
# All component tests pass
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-040: E2E Tests — Critical User Flows

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-031

#### WHY This Matters

Unit and integration tests verify code in isolation. E2E tests verify the ENTIRE system works end-to-end: the user opens a browser, clicks buttons, fills forms, and sees the expected results. If the client builds correctly but the server returns unexpected data, only E2E tests catch this. We use Playwright because it's fast, reliable in CI, and supports multiple browsers.

We test the 5 most critical user flows — these represent 80% of daily usage.

#### BEFORE YOU START

- [ ] REFACTOR-031 is complete (Playwright is configured)
- [ ] Branch: `git checkout -b refactor/REFACTOR-040-e2e-tests`
- [ ] Install Playwright and browsers:

  ```bash
  npm install -D @playwright/test
  npx playwright install chromium  # Only Chromium for speed in CI
  ```

- [ ] Create Playwright config:

  ```bash
  # Create playwright.config.ts in project root
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create Playwright config**

```typescript
// playwright.config.ts (project root)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,     // Fail CI if test.only is left in
    retries: process.env.CI ? 2 : 0,  // Retry flaky tests in CI
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',  // Vite dev server
        trace: 'on-first-retry',           // Capture trace on failure
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    // Start both server and client before tests
    webServer: [
        {
            command: 'cd server && npm run dev',
            port: 3501,
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'cd client && npm run dev',
            port: 5173,
            reuseExistingServer: !process.env.CI,
        },
    ],
});
```

**Step 2: E2E Flow 1 — Login → Dashboard**

```typescript
// e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login → Dashboard Flow', () => {
    test('should login and see dashboard', async ({ page }) => {
        await page.goto('/');

        // Should redirect to login page
        await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible();

        // Fill in credentials
        await page.getByLabel(/username/i).fill('testuser');
        await page.getByLabel(/password/i).fill('TestPassword123');
        await page.getByRole('button', { name: /sign in|log in/i }).click();

        // Should redirect to dashboard
        await expect(page).toHaveURL('/');
        await expect(page.getByText(/dashboard|overview/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/');
        await page.getByLabel(/username/i).fill('wronguser');
        await page.getByLabel(/password/i).fill('WrongPassword');
        await page.getByRole('button', { name: /sign in|log in/i }).click();

        // Should show error message
        await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
    });
});
```

**Step 3: E2E Flow 2 — Create/Edit/Delete Transaction**

```typescript
// e2e/transaction-flow.spec.ts
test.describe('Transaction CRUD Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login first (use a helper or API call to speed this up)
        await loginAsTestUser(page);
    });

    test('should create a new transaction', async ({ page }) => {
        await page.goto('/transactions');
        // Click "Add Transaction" or "+" button
        // Fill form: date, description, amount, category
        // Submit and verify it appears in the list
    });

    test('should edit an existing transaction', async ({ page }) => {
        await page.goto('/transactions');
        // Click on a transaction row
        // Modify the category
        // Save and verify the change persists
    });

    test('should delete a transaction', async ({ page }) => {
        await page.goto('/transactions');
        // Click delete on a transaction
        // Confirm deletion dialog
        // Verify transaction is removed from list
    });
});
```

**Step 4: E2E Flow 3 — Upload Bank Statement**

```typescript
// e2e/statement-upload-flow.spec.ts
test.describe('Statement Upload Flow', () => {
    test('should upload a CSV and see parsed transactions', async ({ page }) => {
        await loginAsTestUser(page);
        await page.goto('/accounts');

        // Click upload area or button
        // Select a test CSV file (keep test fixtures in e2e/fixtures/)
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('e2e/fixtures/sample-statement.csv');

        // Wait for processing
        await expect(page.getByText(/processing|parsing/i)).toBeVisible();
        await expect(page.getByText(/complete|success/i)).toBeVisible({ timeout: 30000 });

        // Verify transactions appear
    });
});
```

**Step 5: E2E Flow 4 — Generate Financial Report**

```typescript
// e2e/report-flow.spec.ts
test.describe('Report Generation Flow', () => {
    test('should generate Profit & Loss report', async ({ page }) => {
        await loginAsTestUser(page);
        await page.goto('/analytics');

        // Select P&L report type
        // Set date range
        // Click generate
        // Verify report displays with revenue and expenses
    });
});
```

**Step 6: E2E Flow 5 — Create and Send Invoice**

```typescript
// e2e/invoice-flow.spec.ts
test.describe('Invoice Flow', () => {
    test('should create and send an invoice', async ({ page }) => {
        await loginAsTestUser(page);
        await page.goto('/invoicing');

        // Click "Create Invoice"
        // Select customer, add line items, set due date
        // Save as draft
        // Click "Send"
        // Verify status changes to "Sent"
    });
});
```

**Step 7: Create test helpers and fixtures**

```typescript
// e2e/helpers/auth.ts
import { Page } from '@playwright/test';

export async function loginAsTestUser(page: Page) {
    await page.goto('/');
    await page.getByLabel(/username/i).fill('testuser');
    await page.getByLabel(/password/i).fill('TestPassword123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL('/');
}
```

Create `e2e/fixtures/sample-statement.csv` with 5-10 sample transactions in CBA CSV format.

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Using fixed `sleep()` for waiting | Flaky — timing varies between environments | Use Playwright's `expect().toBeVisible()` with auto-wait |
| Not cleaning up test data | Tests depend on data from previous runs | Use API calls in `beforeEach` to create fresh data |
| Testing in multiple browsers initially | Triples test time, diminishing returns | Start with Chromium only, add Firefox/WebKit later |
| Hardcoding selectors like `#btn-123` | Brittle — breaks on any ID change | Use role-based selectors: `getByRole`, `getByLabel`, `getByText` |
| Running E2E on every commit | Too slow for CI feedback loop | Run E2E nightly or on PR merge, unit/integration on every push |

#### VERIFICATION

```bash
npx playwright test --reporter=html
# Opens HTML report showing all test results
# All 5 critical flows pass
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-041: Coverage Enforcement

**Priority**: P1 — High | **Effort**: 2 hours | **Risk**: Low
**Depends On**: REFACTOR-032 through REFACTOR-040

#### WHY This Matters

Writing tests is only half the battle. Without ENFORCED coverage thresholds, coverage silently degrades over time. Every new feature or bug fix that skips tests erodes the safety net. Coverage enforcement in CI means the build FAILS if someone submits code without adequate tests — this is the only way to maintain test quality long-term.

Coverage thresholds should be realistic (not 100%) and ratchet upward over time.

#### BEFORE YOU START

- [ ] REFACTOR-032 through REFACTOR-040 are complete (tests exist to generate coverage)
- [ ] Branch: `git checkout -b refactor/REFACTOR-041-coverage-enforcement`
- [ ] Run current coverage to establish baseline:

  ```bash
  cd server && npx vitest run --coverage
  cd ../client && npx vitest run --coverage
  ```

#### STEP-BY-STEP Instructions

**Step 1: Configure server coverage thresholds**

Edit the server Vitest config to enforce minimum coverage:

```typescript
// server/vitest.config.ts — add to existing config
export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
            reportsDirectory: './coverage',
            // ENFORCE THESE THRESHOLDS — build fails if not met
            thresholds: {
                lines: 80,
                branches: 70,
                functions: 75,
                statements: 80,
            },
            // Include all source files (not just tested ones)
            include: ['src/**/*.ts'],
            // Exclude files that shouldn't count toward coverage
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/test/**',
                'src/**/*.d.ts',
                'src/**/index.ts',  // barrel files
            ],
        },
    },
});
```

> **WHY `include` matters**: Without `include`, Vitest only reports coverage for files that are imported by tests. Files with ZERO tests won't appear in the report, hiding the true coverage gap.

**Step 2: Configure client coverage thresholds**

Client starts with lower thresholds (60%) because component testing is harder and we're building up:

```typescript
// client/vitest.config.ts — add to existing config
export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
            reportsDirectory: './coverage',
            thresholds: {
                lines: 60,       // Lower than server — growing target
                branches: 50,
                functions: 55,
                statements: 60,
            },
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/test/**',
                'src/**/*.d.ts',
                'src/vite-env.d.ts',
            ],
        },
    },
});
```

**Step 3: Add coverage check to CI pipeline**

Update the GitHub Actions workflow (from REFACTOR-030):

```yaml
# .github/workflows/ci.yml — add after test step
- name: Server Tests with Coverage
  run: cd server && npx vitest run --coverage
  # Vitest will exit with code 1 if thresholds not met

- name: Client Tests with Coverage
  run: cd client && npx vitest run --coverage

- name: Upload Coverage Reports
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: coverage-reports
    path: |
      server/coverage/
      client/coverage/
```

**Step 4: Add coverage badge to README**

Use the `json-summary` reporter output to generate a badge:

```markdown
<!-- In README.md -->
![Server Coverage](https://img.shields.io/badge/server%20coverage-80%25-brightgreen)
![Client Coverage](https://img.shields.io/badge/client%20coverage-60%25-yellow)
```

For dynamic badges, use a CI step that reads `coverage/coverage-summary.json` and updates the badge via shields.io endpoint or a badge service.

**Step 5: Create a coverage ratchet script (optional but recommended)**

This script prevents coverage from DECREASING — it only allows it to go up:

```typescript
// scripts/check-coverage-ratchet.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';

const BASELINE_FILE = '.coverage-baseline.json';

interface CoverageSummary {
    total: { lines: { pct: number }; branches: { pct: number } };
}

function main() {
    const current: CoverageSummary = JSON.parse(
        readFileSync('coverage/coverage-summary.json', 'utf-8')
    );

    if (!existsSync(BASELINE_FILE)) {
        // First run — save current as baseline
        writeFileSync(BASELINE_FILE, JSON.stringify(current.total, null, 2));
        console.log('Baseline created:', current.total);
        return;
    }

    const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));

    if (current.total.lines.pct < baseline.lines.pct) {
        console.error(
            `Coverage decreased! Lines: ${current.total.lines.pct}% < ${baseline.lines.pct}%`
        );
        process.exit(1);
    }

    // Update baseline if coverage improved
    writeFileSync(BASELINE_FILE, JSON.stringify(current.total, null, 2));
    console.log('Coverage maintained or improved:', current.total);
}

main();
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Setting thresholds too high initially | CI fails on every PR, developers disable checks | Start at current coverage level, ratchet up 5% per sprint |
| Not including untested files | Coverage looks great but only counts tested files | Use `include: ['src/**/*.ts']` to count ALL source files |
| Excluding too many files | Hides real coverage gaps | Only exclude test files, type definitions, and generated code |
| Using only `text` reporter | Can't track trends or generate badges | Use `lcov` for CI tools, `json-summary` for badges |
| Not uploading coverage artifacts | Can't debug coverage failures in CI | Always upload coverage reports as CI artifacts |

#### VERIFICATION

```bash
# Server: should pass with >80% coverage
cd server && npx vitest run --coverage
# Look for: "All files | 80.xx | 70.xx | 75.xx | 80.xx"

# Client: should pass with >60% coverage
cd client && npx vitest run --coverage
# Look for: "All files | 60.xx | 50.xx | 55.xx | 60.xx"

# Verify CI catches low coverage:
# Temporarily lower a threshold, push, verify CI fails
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

## Phase 4: Performance (Weeks 13–16) — Bundle, DB, Caching Optimization

> **Phase Goal**: Optimize client bundle size, database queries, and server response times to meet enterprise performance standards.
> **Phase Entry Criteria**: Phase 3 complete (test safety net in place to catch regressions)

---

### REFACTOR-042: Implement Route-Based Code Splitting

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-021, REFACTOR-026

#### WHY This Matters

Currently `App.tsx` imports ALL 40+ feature components at the top of the file with static `import` statements. This means the browser downloads EVERY component's code on first load — even pages the user may never visit. For an accounting app, a user checking their dashboard shouldn't wait for the payroll, invoicing, BAS, and market data code to download.

Route-based code splitting with `React.lazy()` + `Suspense` creates separate JavaScript chunks per route. The browser only downloads the code for the page the user navigates to. This can reduce initial bundle size by 50-70%.

**Good news**: `client/src/routes.tsx` already defines lazy-loaded route configs — but `App.tsx` doesn't use them. This task wires them together.

#### BEFORE YOU START

- [ ] Branch: `git checkout -b refactor/REFACTOR-042-code-splitting`
- [ ] Understand the current state:
  - `client/src/routes.tsx` — Already has `React.lazy()` definitions for 17 routes ✅
  - `client/src/App.tsx` — Still uses static imports for ALL components ❌
- [ ] Measure current bundle size (baseline):

  ```bash
  cd client && npm run build
  # Note the total JS bundle size from Vite output
  ```

#### STEP-BY-STEP Instructions

**Step 1: Audit `routes.tsx` for completeness**

Open `client/src/routes.tsx` and verify every route in `App.tsx` has a lazy equivalent. Currently missing routes:

```typescript
// These routes exist in App.tsx but NOT in routes.tsx:
// - /settings/notifications (NotificationPreferences)
// - /settings/sync (SyncStatus + ConflictResolver)
// - The dashboard page (uses inline JSX with multiple components)
// - The accounts page (uses inline JSX with multiple components)
// - The streaming page (uses inline JSX with multiple components)
// - The settings page (uses inline JSX with multiple components)
// - The subscription page (uses inline JSX with multiple components)
```

For composite pages (dashboard, accounts, streaming, settings, subscription), create wrapper components:

```typescript
// client/src/features/dashboard/components/DashboardPage.tsx
// Extract the inline dashboard JSX from App.tsx into its own component
export function DashboardPage() {
    // Move the dashboardPage JSX here
    return (
        <div className="space-y-6 animate-in ...">
            {/* StatCards, CategoryChart, MonthlyTrendChart, etc. */}
        </div>
    );
}
```

**Step 2: Create wrapper components for composite pages**

For each inline page definition in `App.tsx` (dashboardPage, accountsPage, streamingPage, settingsPage, subscriptionPage), extract into a standalone component file:

1. `client/src/features/dashboard/components/DashboardPage.tsx` — Extract `dashboardPage` JSX
2. `client/src/features/accounts/components/AccountsPage.tsx` — Extract `accountsPage` JSX
3. `client/src/features/streaming/components/StreamingPage.tsx` — Extract `streamingPage` JSX
4. `client/src/features/settings/components/SettingsPage.tsx` — Extract `settingsPage` JSX
5. `client/src/features/subscription/components/SubscriptionPage.tsx` — Extract `subscriptionPage` JSX

Each wrapper receives the same props that `App.tsx` currently passes inline.

**Step 3: Add missing lazy imports to `routes.tsx`**

```typescript
// client/src/routes.tsx — add these lazy imports
const NotificationPreferencesPage = lazy(() =>
    import('./features/notifications').then((m) => ({
        default: m.NotificationPreferences,
    }))
);

const SyncPage = lazy(() =>
    import('./features/offline').then((m) => ({
        default: m.SyncStatus as ComponentType,
    }))
);
```

**Step 4: Refactor `App.tsx` to use route config**

Replace the static imports and inline `<Route>` definitions with a loop over the `routes` array:

```typescript
// client/src/App.tsx — AFTER refactoring
import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { routes } from './routes';
import { PageSpinner } from './components/ui/PageSpinner';
// Keep ONLY non-lazy imports: AppShell, FloatingChat, Toaster, etc.

function AppContent() {
    // ... existing state and hooks ...

    return (
        <AppShell ...>
            <Suspense fallback={<PageSpinner />}>
                <Routes>
                    {routes.map((route) => (
                        <Route
                            key={route.path}
                            path={route.path}
                            element={<route.component />}
                        />
                    ))}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </AppShell>
    );
}
```

> ⚠️ **IMPORTANT**: Some routes pass props (e.g., `/transactions` passes `transactions`, `accounts`, `loading`). These components need to fetch their own data instead of receiving props from App.tsx. This is a bigger refactor — for now, keep those specific routes as static imports and only lazy-load routes that DON'T receive props from App.tsx.

**Step 5: Remove unused static imports from App.tsx**

After switching to lazy routes, remove the static `import` statements for components that are now lazy-loaded. This is what actually reduces the bundle size.

```typescript
// REMOVE these from App.tsx (they're now lazy in routes.tsx):
// import { BASPage } from './features/bas/components/BASPage';
// import { TaxDashboard } from './features/tax/components/TaxDashboard';
// import { GSTPage } from './features/gst/components/GSTPage';
// import { AnalyticsDashboard } from './features/analytics/components/AnalyticsDashboard';
// import { MarketDashboard } from './features/market';
// import { PayrollDashboard } from './features/payroll/components/PayrollDashboard';
// import { APDashboard } from './features/ap/components/APDashboard';
// import { InvoicingDashboard } from './features/invoicing/components/InvoicingDashboard';
// ... etc.
```

**Step 6: Verify chunk splitting**

```bash
cd client && npm run build
# Vite output should now show multiple chunks:
# dist/assets/BASPage-[hash].js
# dist/assets/PayrollDashboard-[hash].js
# dist/assets/InvoicingDashboard-[hash].js
# etc.
```

Compare total initial JS size with the baseline from Step 0.

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Lazy-loading components that receive props from parent | Props won't be available when lazy component loads | Keep prop-receiving routes as static imports until data fetching is moved into the component |
| Not wrapping lazy routes in `Suspense` | React throws an error | Always have a `Suspense` boundary above lazy components |
| Creating too many tiny chunks | HTTP/2 helps but too many chunks add overhead | Group related features into shared chunks via Vite's `manualChunks` |
| Forgetting to test navigation | Lazy loading can break if import paths are wrong | Test every route in the browser after the change |
| Not measuring before and after | Can't prove the optimization worked | Record bundle sizes before and after |

#### VERIFICATION

```bash
# Build and check chunk sizes
cd client && npm run build 2>&1 | grep -E "\.js|\.css"
# Expect: multiple chunk files instead of one large bundle

# Run the app and check Network tab in DevTools:
# 1. Load the app — only dashboard chunk should load
# 2. Navigate to /payroll — PayrollDashboard chunk loads on demand
# 3. Navigate to /invoicing — InvoicingDashboard chunk loads on demand

# Run tests to verify nothing broke
cd client && npm test
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-043: Optimize Client Bundle Size

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-042

#### WHY This Matters

Even with code splitting, individual chunks can be bloated by large dependencies. `recharts` alone is ~200KB. PDF libraries, date-fns, and icon libraries add up. Bundle analysis reveals which dependencies dominate the bundle so you can tree-shake, lazy-load, or replace them.

Target: initial JS bundle <200KB gzipped, Lighthouse performance score >90.

#### BEFORE YOU START

- [ ] REFACTOR-042 is complete (code splitting in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-043-bundle-optimization`
- [ ] Install bundle analyzer:

  ```bash
  cd client && npm install -D rollup-plugin-visualizer
  ```

#### STEP-BY-STEP Instructions

**Step 1: Generate bundle analysis report**

Add the visualizer plugin to `vite.config.ts`:

```typescript
// client/vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
    plugins: [
        // ... existing plugins
        visualizer({
            filename: 'dist/bundle-analysis.html',
            open: true,       // Auto-open in browser
            gzipSize: true,   // Show gzipped sizes
            brotliSize: true, // Show brotli sizes
        }),
    ],
});
```

```bash
cd client && npm run build
# Opens bundle-analysis.html — study the treemap
```

**Step 2: Identify the top 5 largest dependencies**

In the treemap, look for the biggest rectangles. Typical culprits in this codebase:

- `recharts` (~200KB) — only needed on dashboard/analytics pages
- `lucide-react` — tree-shakeable but only if you import individual icons
- PDF libraries (`pdfjs-dist`, `@react-pdf/renderer`) — only needed for statement parsing and invoice PDF
- `date-fns` — tree-shakeable, but check if you're importing the entire library
- `zod` — small, but check if it's duplicated between server and client bundles

**Step 3: Lazy-load `recharts`**

`recharts` should only load on pages that display charts (dashboard, analytics, reports):

```typescript
// client/src/features/analytics/components/LazyChart.tsx
import { lazy, Suspense } from 'react';

const RechartsLineChart = lazy(() =>
    import('recharts').then((m) => ({ default: m.LineChart }))
);

export function LazyLineChart(props: any) {
    return (
        <Suspense fallback={<div className="h-64 animate-pulse bg-white/5 rounded-xl" />}>
            <RechartsLineChart {...props} />
        </Suspense>
    );
}
```

Or better — use Vite's `manualChunks` to group recharts into its own chunk:

```typescript
// client/vite.config.ts
export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-charts': ['recharts'],
                    'vendor-pdf': ['pdfjs-dist', '@react-pdf/renderer'],
                    'vendor-ui': ['lucide-react', 'sonner', 'framer-motion'],
                },
            },
        },
    },
});
```

**Step 4: Verify tree-shaking for `lucide-react`**

Ensure you import individual icons, NOT the entire library:

```typescript
// ✅ GOOD — tree-shakeable
import { TrendingUp, Wallet, Receipt } from 'lucide-react';

// ❌ BAD — imports everything
import * as Icons from 'lucide-react';
```

Search for bad patterns:

```bash
grep -rn "import \* as.*lucide" client/src/
grep -rn "from 'lucide-react'" client/src/ | head -20
```

**Step 5: Optimize `date-fns` imports**

```typescript
// ✅ GOOD — tree-shakeable
import { format, parseISO, differenceInDays } from 'date-fns';

// ❌ BAD — imports everything
import * as dateFns from 'date-fns';
```

**Step 6: Set build targets and compression**

```typescript
// client/vite.config.ts
export default defineConfig({
    build: {
        target: 'es2020',        // Modern browsers only
        minify: 'terser',        // Better minification than esbuild
        terserOptions: {
            compress: {
                drop_console: true,   // Remove console.log in production
                drop_debugger: true,
            },
        },
        chunkSizeWarningLimit: 250, // Warn if any chunk >250KB
    },
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Only looking at uncompressed sizes | Gzipped size is what matters for network transfer | Always check gzipped sizes in the visualizer |
| Removing dependencies without checking usage | Breaks features | Search for all imports before removing |
| Over-splitting into tiny chunks | Too many HTTP requests | Group related vendor libs into shared chunks |
| Forgetting to remove the visualizer plugin | Slows down production builds | Only enable in `analyze` script, not default build |

#### VERIFICATION

```bash
cd client && npm run build
# Compare with baseline from REFACTOR-042
# Target: initial JS <200KB gzipped
# No chunk >250KB

# Run Lighthouse audit:
# 1. Start the app: npm run preview
# 2. Open Chrome DevTools > Lighthouse > Performance
# Target: score >90
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-044: Database Connection Pooling

**Priority**: P1 — High | **Effort**: 3 hours | **Risk**: Medium
**Depends On**: REFACTOR-019

#### WHY This Matters

The codebase has THREE separate database connection setups: `server/src/schema.ts` (main, used everywhere), `server/src/db-adapter.ts` (unused duplicate), and `server/src/db/postgres-connection.ts` (well-configured but not wired in). The main `schema.ts` creates a PostgreSQL pool with `max: 20` but no idle timeout, no health checks, and no graceful shutdown. Under load, connections leak and the database runs out of available connections.

`postgres-connection.ts` already has proper pooling config — this task consolidates to use it.

#### BEFORE YOU START

- [ ] Branch: `git checkout -b refactor/REFACTOR-044-db-connection-pooling`
- [ ] Understand the three DB connection files:
  - `server/src/schema.ts` lines 103-122 — `createDb()` with basic `pg.Pool({ max: 20 })`
  - `server/src/db-adapter.ts` — Duplicate, likely unused
  - `server/src/db/postgres-connection.ts` — Well-configured with pool events, health checks, graceful shutdown
- [ ] Check which file is actually imported:

  ```bash
  grep -rn "from.*schema" server/src/ | grep -v node_modules | grep -v ".test." | head -20
  grep -rn "from.*db-adapter" server/src/ | head -10
  grep -rn "from.*postgres-connection" server/src/ | head -10
  ```

#### STEP-BY-STEP Instructions

**Step 1: Audit which DB connection is actually used**

The main app uses `db` from `server/src/schema.ts`. Verify this:

```bash
grep -rn "import.*db.*from.*schema" server/src/index.ts
# Expected: import { db, ... } from './schema'
```

**Step 2: Enhance the pool configuration in `schema.ts`**

Update the `createDb()` function in `schema.ts` to include proper pooling, borrowing from `postgres-connection.ts`:

```typescript
// server/src/schema.ts — update the PostgreSQL pool creation
function createDb() {
    if (usePostgres) {
        console.log('[DB] Using PostgreSQL');
        const pool = new pg.Pool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'ai_accountant',
            user: process.env.DB_USER || 'app_user',
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
            // Pool configuration
            max: parseInt(process.env.DB_POOL_MAX || '20', 10),
            min: parseInt(process.env.DB_POOL_MIN || '2', 10),
            idleTimeoutMillis: 30000,          // Close idle connections after 30s
            connectionTimeoutMillis: 10000,     // Fail if can't connect in 10s
            statement_timeout: 30000,           // Kill queries running >30s
        });

        // Pool event handlers for monitoring
        pool.on('connect', () => {
            console.log('[DB] New client connected to pool');
        });
        pool.on('error', (err) => {
            console.error('[DB] Unexpected pool error:', err);
        });

        const pgDb = drizzlePg(pool);
        return wrapPgDb(pgDb);
    } else {
        const client = createClient({ url: dbUrl });
        return drizzleSqlite(client);
    }
}
```

**Step 3: Add graceful shutdown**

Export a `closeDb()` function and call it on process exit:

```typescript
// server/src/schema.ts — add at the bottom
let pgPool: pg.Pool | null = null;

export async function closeDb(): Promise<void> {
    if (pgPool) {
        console.log('[DB] Closing connection pool...');
        await pgPool.end();
        pgPool = null;
        console.log('[DB] Pool closed');
    }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    await closeDb();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await closeDb();
    process.exit(0);
});
```

**Step 4: Add health check endpoint**

```typescript
// In the main app (index.ts or a health route)
app.get('/api/health', async (c) => {
    try {
        // Simple query to verify DB is responsive
        const start = Date.now();
        await db.execute(sql`SELECT 1`);
        const latencyMs = Date.now() - start;

        return c.json({
            status: 'healthy',
            db: { latencyMs },
            uptime: process.uptime(),
        });
    } catch (error) {
        return c.json({ status: 'unhealthy', error: String(error) }, 503);
    }
});
```

**Step 5: Remove duplicate `db-adapter.ts`**

If `db-adapter.ts` is not imported anywhere, archive it:

```bash
mkdir -p server/src/_deprecated
mv server/src/db-adapter.ts server/src/_deprecated/db-adapter.ts
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Setting `min` too high | Wastes DB connections when idle | Start with `min: 2`, increase based on load testing |
| No `idleTimeoutMillis` | Connections stay open forever, hitting DB limits | Always set idle timeout (30s is good default) |
| No `statement_timeout` | Runaway queries block the pool | Set 30s timeout for web requests |
| Not handling pool errors | Unhandled errors crash the process | Always add `pool.on('error', ...)` handler |
| Multiple pool instances | Each import creates a new pool | Ensure `createDb()` is called once (singleton pattern) |

#### VERIFICATION

```bash
# Start the server and hit the health endpoint
curl http://localhost:3501/api/health
# Expected: { "status": "healthy", "db": { "latencyMs": 5 }, "uptime": 123 }

# Verify pool config in logs
# Expected: "[DB] Using PostgreSQL" with pool events logged
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-045: Database Query Optimization

**Priority**: P1 — High | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-019, REFACTOR-044

#### WHY This Matters

Slow database queries are the #1 cause of API latency. The codebase already has ~35 indexes on the PostgreSQL schema (transactions has 7 indexes, accounts has 2, statements has 4), but there are likely N+1 query patterns in the route handlers — where a loop fetches related records one-by-one instead of using a single JOIN. Adding query logging reveals which queries are slow so you can fix them systematically.

#### BEFORE YOU START

- [ ] REFACTOR-044 is complete (connection pooling in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-045-query-optimization`
- [ ] Verify existing indexes:

  ```bash
  # Check what indexes exist in the PostgreSQL schema
  grep -rn "index(" server/src/db/postgres-schema.ts | head -30
  ```

#### STEP-BY-STEP Instructions

**Step 1: Add query logging middleware**

Create a Drizzle query logger that logs slow queries in development:

```typescript
// server/src/infrastructure/query-logger.ts
import { Logger } from 'drizzle-orm';

export class QueryLogger implements Logger {
    private slowQueryThresholdMs: number;

    constructor(slowQueryThresholdMs = 100) {
        this.slowQueryThresholdMs = slowQueryThresholdMs;
    }

    logQuery(query: string, params: unknown[]): void {
        const start = performance.now();
        // Log all queries in dev, only slow ones in prod
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[SQL] ${query}`);
            if (params.length > 0) {
                console.log(`[SQL] Params:`, params);
            }
        }
    }
}

// Usage in schema.ts:
// const pgDb = drizzlePg(pool, { logger: new QueryLogger(100) });
```

**Step 2: Identify missing indexes**

Check for queries that filter on columns without indexes. Common patterns to look for:

```bash
# Find WHERE clauses in route handlers
grep -rn "\.where(" server/src/index.ts | head -40
# Look for patterns like: .where(eq(table.columnWithoutIndex, value))
```

Key indexes that should exist (verify against `postgres-schema.ts`):

- `transactions.date` ✅ (exists)
- `transactions.userId` ✅ (exists)
- `transactions.accountId` ✅ (exists)
- `accounts.userId` ✅ (exists)
- `users.username` — Check if unique constraint acts as index ✅
- `tenantMembers.tenantId + userId` — Verify composite index exists
- `auditLog.timestamp` ✅ (exists)

**Step 3: Find and fix N+1 query patterns**

Search for loops that make individual DB queries:

```bash
# Find for-loops near db queries
grep -B5 -A5 "for.*of\|forEach" server/src/index.ts | grep -A5 "db\."
```

Common N+1 pattern to fix:

```typescript
// ❌ N+1 — one query per transaction
const transactions = await db.select().from(txns).where(...);
for (const tx of transactions) {
    const account = await db.select().from(accounts)
        .where(eq(accounts.id, tx.accountId)).get();
    tx.accountName = account?.accountName;
}

// ✅ FIXED — single JOIN query
const transactions = await db
    .select({
        ...getTableColumns(txns),
        accountName: accounts.accountName,
    })
    .from(txns)
    .leftJoin(accounts, eq(txns.accountId, accounts.id))
    .where(...);
```

**Step 4: Add EXPLAIN ANALYZE for critical queries**

For the most important queries (dashboard summary, transaction list, account balances), run EXPLAIN ANALYZE to verify index usage:

```sql
-- Run in psql or a migration script
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE user_id = 'test-user' AND date >= '2024-01-01'
ORDER BY date DESC LIMIT 50;
-- Should show "Index Scan using transactions_user_date_idx"
```

**Step 5: Add pagination to unbounded queries**

Search for queries that return all rows without LIMIT:

```bash
grep -rn "\.select()\.from(" server/src/index.ts | grep -v "\.limit(" | head -20
```

Add `.limit()` and `.offset()` to any query that could return hundreds of rows.

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Adding indexes on every column | Slows down INSERT/UPDATE operations | Only index columns used in WHERE, JOIN, ORDER BY |
| Not testing with realistic data | Queries seem fast with 10 rows, slow with 10,000 | Test with production-like data volumes |
| Using `SELECT *` with JOINs | Returns duplicate columns, wastes bandwidth | Use `getTableColumns()` or explicit column selection |
| Forgetting to add indexes in migrations | Schema has index but DB doesn't | Always create a migration file for new indexes |

#### VERIFICATION

```bash
# Run the app and check query logs
npm run dev
# Hit the dashboard endpoint and check console for [SQL] logs
# No query should take >100ms

# Check that all indexes exist in the database
psql -d ai_accountant -c "\di" | grep -E "transactions|accounts|users"
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-046: Implement Redis Caching Layer

**Priority**: P2 — Medium | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-019, REFACTOR-044

#### WHY This Matters

Some data rarely changes but is fetched on every request: chart of accounts, user permissions, dashboard summaries. Caching these in Redis avoids hitting the database repeatedly. Redis is already running in Docker (`redis:7-alpine` on port 6379) and `ioredis` is already installed — used by `CogneeSessionService` in `server/src/services/cognee-sessions.ts`. This task creates a general-purpose `CacheService` that any route handler can use.

#### BEFORE YOU START

- [ ] REFACTOR-044 is complete (DB pooling in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-046-redis-caching`
- [ ] Verify Redis is running: `docker compose up -d redis && redis-cli ping`
- [ ] Study the existing Redis usage in `server/src/services/cognee-sessions.ts` — it has `cacheQueryResult()`, `getCachedQueryResult()`, and TTL patterns

#### STEP-BY-STEP Instructions

**Step 1: Create a generic CacheService**

```typescript
// server/src/services/cache-service.ts
import Redis from 'ioredis';

export class CacheService {
    private redis: Redis | null = null;
    private connected = false;
    private prefix = 'gl:';  // GoldLedger namespace prefix

    constructor(redisUrl?: string) {
        const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
        try {
            this.redis = new Redis(url, {
                lazyConnect: true,
                maxRetriesPerRequest: 3,
                retryStrategy(times) {
                    if (times > 5) return null;
                    return Math.min(times * 200, 5000);
                },
            });
            this.redis.on('connect', () => { this.connected = true; });
            this.redis.on('close', () => { this.connected = false; });
            this.redis.on('error', (err) => {
                console.warn('[Cache] Redis error:', err.message);
            });
            this.redis.connect().catch(() => {
                console.warn('[Cache] Could not connect — operating without cache');
            });
        } catch {
            console.warn('[Cache] Redis unavailable — operating without cache');
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.connected || !this.redis) return null;
        try {
            const raw = await this.redis.get(this.prefix + key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
        if (!this.connected || !this.redis) return false;
        try {
            await this.redis.set(
                this.prefix + key,
                JSON.stringify(value),
                'EX', ttlSeconds
            );
            return true;
        } catch { return false; }
    }

    async invalidate(pattern: string): Promise<number> {
        if (!this.connected || !this.redis) return 0;
        try {
            const keys = await this.redis.keys(this.prefix + pattern);
            if (keys.length === 0) return 0;
            return await this.redis.del(...keys);
        } catch { return 0; }
    }

    async disconnect(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
            this.redis = null;
        }
    }
}

// Singleton instance
export const cacheService = new CacheService();
```

**Step 2: Define TTL strategies per data type**

```typescript
// server/src/services/cache-service.ts — add TTL constants
export const CACHE_TTL = {
    CHART_OF_ACCOUNTS: 300,   // 5 minutes — rarely changes
    USER_PERMISSIONS: 60,      // 1 minute — changes on role update
    DASHBOARD_SUMMARY: 30,     // 30 seconds — changes on new transactions
    ACCOUNT_BALANCES: 60,      // 1 minute
    TAX_RATES: 3600,           // 1 hour — changes annually
} as const;
```

**Step 3: Add cache to chart of accounts endpoint**

```typescript
// In the chart of accounts route handler:
app.get('/api/chart-of-accounts', async (c) => {
    const userId = getUserId(c);
    const cacheKey = `coa:${userId}`;

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) return c.json({ data: cached, fromCache: true });

    // Cache miss — fetch from DB
    const accounts = await db.select().from(chartOfAccounts)
        .where(eq(chartOfAccounts.userId, userId)).all();

    await cacheService.set(cacheKey, accounts, CACHE_TTL.CHART_OF_ACCOUNTS);
    return c.json({ data: accounts });
});
```

**Step 4: Add cache invalidation on mutations**

```typescript
// When chart of accounts is updated:
app.post('/api/chart-of-accounts', async (c) => {
    const userId = getUserId(c);
    // ... insert/update logic ...

    // Invalidate cache for this user's chart of accounts
    await cacheService.invalidate(`coa:${userId}`);

    return c.json({ data: result });
});
```

**Step 5: Add cache stats endpoint (dev only)**

```typescript
app.get('/api/cache/stats', async (c) => {
    if (process.env.NODE_ENV === 'production') {
        return c.json({ error: 'Not available in production' }, 403);
    }
    // Return basic Redis info
    return c.json({ status: 'connected', prefix: 'gl:' });
});
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Caching user-specific data without user ID in key | Users see each other's data | Always include `userId` or `tenantId` in cache keys |
| Not invalidating on mutations | Stale data served after updates | Invalidate cache in every POST/PUT/DELETE handler |
| TTL too long for frequently changing data | Users see stale dashboards | Use 30s for dashboards, 5min for reference data |
| Crashing when Redis is down | App becomes unavailable | Always gracefully degrade — return null, not throw |
| Using `KEYS *` in production | Blocks Redis for large keyspaces | Use `SCAN` instead of `KEYS` in production |

#### VERIFICATION

```bash
# Start Redis and the server
docker compose up -d redis
npm run dev

# Hit an endpoint twice — second should be faster
curl http://localhost:3501/api/chart-of-accounts
curl http://localhost:3501/api/chart-of-accounts
# Second response should include "fromCache: true"

# Verify Redis has the cached data
redis-cli KEYS "gl:*"
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-047: Add Response Compression

**Priority**: P2 — Medium | **Effort**: 1 hour | **Risk**: Low
**Depends On**: None

#### WHY This Matters

API responses (especially JSON arrays of transactions) can be large. Compression reduces response sizes by 60-80%, making the app feel faster on slow connections. Hono has a built-in `compress` middleware, and Brotli provides better compression than gzip for text content.

#### BEFORE YOU START

- [ ] Branch: `git checkout -b refactor/REFACTOR-047-response-compression`
- [ ] Measure current response sizes:

  ```bash
  curl -s -o /dev/null -w "%{size_download}" http://localhost:3501/api/transactions
  ```

#### STEP-BY-STEP Instructions

**Step 1: Add Hono compress middleware**

```typescript
// server/src/index.ts — add near the top with other middleware
import { compress } from 'hono/compress';

// Add compression for all responses
// Place BEFORE route handlers, AFTER CORS
app.use('*', compress());
```

Hono's `compress()` middleware automatically:

- Detects `Accept-Encoding` header from the client
- Applies gzip compression (Brotli if supported)
- Skips already-compressed content
- Adds `Content-Encoding` header to response

**Step 2: Skip compression for small responses and binary content**

For fine-grained control, you can configure thresholds:

```typescript
// Only compress responses larger than 1KB
app.use('*', compress({
    encoding: 'gzip',  // 'gzip' is most compatible
}));
```

> **Note**: Hono's built-in compress middleware is simple. For Brotli support, you may need `@hono/node-server` with Node.js native compression or a custom middleware.

**Step 3: Verify compression is working**

```bash
# Request with Accept-Encoding header
curl -H "Accept-Encoding: gzip" -s -o /dev/null \
    -w "Size: %{size_download} bytes\n" \
    http://localhost:3501/api/transactions

# Compare with uncompressed
curl -H "Accept-Encoding: identity" -s -o /dev/null \
    -w "Size: %{size_download} bytes\n" \
    http://localhost:3501/api/transactions
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Compressing already-compressed content (images, PDFs) | Wastes CPU, no size reduction | Compression middleware should skip binary content types |
| Placing compress middleware after route handlers | Responses bypass compression | Place `app.use('*', compress())` before routes |
| Not testing with real browser | curl may not send Accept-Encoding | Test in Chrome DevTools Network tab |

#### VERIFICATION

```bash
# Check response headers for Content-Encoding
curl -v -H "Accept-Encoding: gzip" http://localhost:3501/api/transactions 2>&1 | grep -i "content-encoding"
# Expected: Content-Encoding: gzip
```

#### ROLLBACK

```bash
git reset --hard HEAD~1
```

---

### REFACTOR-048: Implement Service Worker Caching

**Priority**: P2 — Medium | **Effort**: 6 hours | **Risk**: Medium
**Depends On**: REFACTOR-042

#### WHY This Matters

A service worker caches static assets (JS, CSS, images) and API responses in the browser. This means: (1) repeat visits load instantly from cache, (2) the app works offline for read operations, (3) API responses can use stale-while-revalidate for perceived instant loading. Workbox (by Google) is the standard library for service worker caching strategies.

#### BEFORE YOU START

- [ ] REFACTOR-042 is complete (code splitting in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-048-service-worker`
- [ ] Install Workbox Vite plugin:

  ```bash
  cd client && npm install -D vite-plugin-pwa
  ```

#### STEP-BY-STEP Instructions

**Step 1: Configure the PWA plugin in Vite**

```typescript
// client/vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        // ... existing plugins
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                // Cache JS, CSS, and image assets
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                // Runtime caching for API responses
                runtimeCaching: [
                    {
                        urlPattern: /^https?:\/\/localhost:3501\/api\//,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 300, // 5 minutes
                            },
                        },
                    },
                ],
            },
            manifest: {
                name: 'GoldLedger',
                short_name: 'GoldLedger',
                theme_color: '#1a1a2e',
                background_color: '#0a0a1a',
                display: 'standalone',
            },
        }),
    ],
});
```

**Step 2: Add offline indicator component**

```typescript
// client/src/components/ui/OfflineIndicator.tsx
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-amber-500/90 text-black
                        px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium">
            ⚠️ You're offline — showing cached data
        </div>
    );
}
```

**Step 3: Add the offline indicator to App.tsx**

```typescript
// client/src/App.tsx — add inside the main layout
import { OfflineIndicator } from './components/ui/OfflineIndicator';
// ... inside the return:
<OfflineIndicator />
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Caching POST/PUT/DELETE responses | Mutations should never be cached | Only cache GET requests |
| Not versioning the cache | Old cached assets served after deploy | Workbox handles this with `globPatterns` |
| Caching auth tokens in service worker | Security risk | Exclude `/auth/*` from runtime caching |
| Not testing cache invalidation | Users stuck with stale app | Use `registerType: 'autoUpdate'` for automatic updates |

#### VERIFICATION

```bash
cd client && npm run build && npm run preview
# Open Chrome DevTools > Application > Service Workers
# Verify service worker is registered and active
# Go to Network tab, check "Offline" checkbox
# Navigate the app — cached pages should still load
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
# Also unregister service worker in browser:
# DevTools > Application > Service Workers > Unregister
```

---

### REFACTOR-049: Server Startup Optimization

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-016, REFACTOR-023

#### WHY This Matters

The server currently imports and initializes ALL services at startup — including AI models, Cognee connections, market data feeds, and PDF parsers. This means cold start takes 10+ seconds. In a containerized environment (Cloud Run, Docker), slow cold starts mean users wait. The fix: lazy-load services that aren't needed until their first request.

#### BEFORE YOU START

- [ ] REFACTOR-016 and REFACTOR-023 are complete (routes extracted, DI container in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-049-startup-optimization`
- [ ] Measure current startup time:

  ```bash
  time node --import tsx server/src/index.ts
  # Note the time until "Server is running on port 3501"
  ```

#### STEP-BY-STEP Instructions

**Step 1: Identify heavy imports at the top of index.ts**

Look for imports that trigger expensive initialization:

```bash
# Find all imports in index.ts
grep "^import" server/src/index.ts | head -60
```

Typical heavy imports:

- AI SDK initialization (Anthropic, OpenAI clients)
- Cognee service (connects to external service)
- Market data feeds (ABS, RBA — may make HTTP calls on init)
- PDF parsing libraries (pdfjs-dist loads WASM)

**Step 2: Convert heavy services to lazy singletons**

```typescript
// server/src/services/lazy.ts
// Lazy singleton pattern — service is only created on first access

let _cogneeService: CogneeSessionService | null = null;
export function getCogneeService(): CogneeSessionService {
    if (!_cogneeService) {
        _cogneeService = new CogneeSessionService();
    }
    return _cogneeService;
}

let _absDataFeed: AbsDataFeed | null = null;
export function getAbsDataFeed(): AbsDataFeed {
    if (!_absDataFeed) {
        _absDataFeed = new AbsDataFeed();
    }
    return _absDataFeed;
}
```

**Step 3: Use dynamic imports for AI services**

```typescript
// Instead of:
import { orchestrator } from './services/claude/orchestrator.js';

// Use dynamic import in the route handler:
app.post('/api/chat', async (c) => {
    const { orchestrator } = await import('./services/claude/orchestrator.js');
    // ... use orchestrator
});
```

**Step 4: Parallelize independent startup tasks**

```typescript
// server/src/index.ts — startup sequence
async function startServer() {
    const startTime = performance.now();

    // These can run in parallel
    await Promise.all([
        initDatabase(),        // DB connection
        loadConfiguration(),   // Read env vars, validate config
    ]);

    // Start HTTP server immediately — health endpoint available
    const server = serve({ fetch: app.fetch, port });
    console.log(`[Startup] Server listening in ${(performance.now() - startTime).toFixed(0)}ms`);

    // Warm up services in background (non-blocking)
    setTimeout(async () => {
        await warmUpServices();
        console.log(`[Startup] Services warmed up in ${(performance.now() - startTime).toFixed(0)}ms`);
    }, 0);
}
```

**Step 5: Ensure health endpoint responds within 1 second**

The `/health` endpoint should NOT depend on any lazy-loaded service:

```typescript
app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// This route must be registered BEFORE any middleware that might be slow
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Lazy-loading the database connection | Every first request is slow | DB should be eager — it's needed for almost everything |
| Dynamic import in a hot path | Import overhead on every request | Import once, cache the module reference |
| Not measuring before and after | Can't prove optimization worked | Log startup time with `performance.now()` |
| Breaking circular dependencies with lazy imports | Hides architectural issues | Fix the circular dependency properly first |

#### VERIFICATION

```bash
# Measure startup time
time node --import tsx server/src/index.ts &
# Wait for "Server is running" message
# Kill the server

# Target: <3 seconds to "Server is running"
# Target: /health responds within 1 second of startup
curl http://localhost:3501/health
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-050: Performance Monitoring Setup

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: Low
**Depends On**: REFACTOR-008

#### WHY This Matters

You can't optimize what you can't measure. Performance monitoring tracks request duration, slow queries, memory usage, and error rates. This data tells you WHERE to focus optimization efforts. A `/api/metrics` endpoint exposes this data in Prometheus-compatible format for dashboards.

#### BEFORE YOU START

- [ ] REFACTOR-008 is complete (structured logger in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-050-performance-monitoring`

#### STEP-BY-STEP Instructions

**Step 1: Create request timing middleware**

```typescript
// server/src/middleware/request-timing.ts
import { MiddlewareHandler } from 'hono';

export function requestTiming(): MiddlewareHandler {
    return async (c, next) => {
        const start = performance.now();
        const method = c.req.method;
        const path = c.req.path;

        await next();

        const durationMs = performance.now() - start;
        const status = c.res.status;

        // Add timing header
        c.header('X-Response-Time', `${durationMs.toFixed(2)}ms`);

        // Log slow requests
        if (durationMs > 1000) {
            console.warn(`[SLOW] ${method} ${path} — ${durationMs.toFixed(0)}ms (${status})`);
        } else if (process.env.NODE_ENV !== 'production') {
            console.log(`[REQ] ${method} ${path} — ${durationMs.toFixed(0)}ms (${status})`);
        }

        // Record metrics
        recordRequestMetric(method, path, status, durationMs);
    };
}

// In-memory metrics store
const metrics = {
    requestCount: 0,
    requestDurationSum: 0,
    slowRequests: 0,
    errorCount: 0,
    statusCodes: new Map<number, number>(),
};

function recordRequestMetric(method: string, path: string, status: number, durationMs: number) {
    metrics.requestCount++;
    metrics.requestDurationSum += durationMs;
    if (durationMs > 1000) metrics.slowRequests++;
    if (status >= 500) metrics.errorCount++;
    metrics.statusCodes.set(status, (metrics.statusCodes.get(status) || 0) + 1);
}

export function getMetrics() { return metrics; }
```

**Step 2: Add memory usage tracking**

```typescript
// server/src/middleware/request-timing.ts — add to metrics
export function getSystemMetrics() {
    const mem = process.memoryUsage();
    return {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        uptimeSeconds: Math.round(process.uptime()),
    };
}
```

**Step 3: Create metrics endpoint**

```typescript
// server/src/index.ts or a dedicated metrics route
import { getMetrics, getSystemMetrics } from './middleware/request-timing.js';

app.get('/api/metrics', (c) => {
    const req = getMetrics();
    const sys = getSystemMetrics();

    // Prometheus-compatible text format
    const lines = [
        `# HELP http_requests_total Total HTTP requests`,
        `# TYPE http_requests_total counter`,
        `http_requests_total ${req.requestCount}`,
        `# HELP http_request_duration_ms_avg Average request duration`,
        `http_request_duration_ms_avg ${req.requestCount > 0 ? (req.requestDurationSum / req.requestCount).toFixed(2) : 0}`,
        `# HELP http_slow_requests_total Requests taking >1s`,
        `http_slow_requests_total ${req.slowRequests}`,
        `# HELP http_errors_total 5xx errors`,
        `http_errors_total ${req.errorCount}`,
        `# HELP process_heap_used_mb Heap memory used`,
        `process_heap_used_mb ${sys.heapUsedMB}`,
        `# HELP process_rss_mb Resident set size`,
        `process_rss_mb ${sys.rssMB}`,
        `# HELP process_uptime_seconds Server uptime`,
        `process_uptime_seconds ${sys.uptimeSeconds}`,
    ];

    return c.text(lines.join('\n'), 200, {
        'Content-Type': 'text/plain; version=0.0.4',
    });
});
```

**Step 4: Wire up the middleware**

```typescript
// server/src/index.ts — add BEFORE all route handlers
import { requestTiming } from './middleware/request-timing.js';
app.use('*', requestTiming());
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Logging every request in production | Fills up logs, slows down app | Only log slow requests (>1s) in production |
| Exposing metrics endpoint without auth | Leaks internal data | Restrict to internal network or require admin auth |
| Storing per-route metrics without aggregation | Memory grows unbounded | Aggregate by route pattern, not full URL |
| Not resetting metrics periodically | Numbers grow forever | Add a reset endpoint or use sliding windows |

#### VERIFICATION

```bash
# Start the server and make some requests
npm run dev
curl http://localhost:3501/api/transactions
curl http://localhost:3501/api/accounts

# Check metrics
curl http://localhost:3501/api/metrics
# Should show request count, duration, memory usage

# Check response timing header
curl -v http://localhost:3501/api/transactions 2>&1 | grep "X-Response-Time"
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

## Phase 5: Documentation (Weeks 17–18)

> **Goal**: Make the codebase self-documenting. API consumers get Swagger UI, designers get Storybook, architects get ADRs, developers get JSDoc and onboarding guides. Documentation is NOT optional — it's the difference between a codebase that scales with the team and one that only the original author can maintain.

---

### REFACTOR-051: OpenAPI/Swagger Documentation

**Priority**: P1 — High | **Effort**: 8 hours | **Risk**: Low
**Depends On**: REFACTOR-016

#### WHY This Matters

Without API documentation, every frontend developer has to read the server source code to understand what endpoints exist, what parameters they accept, and what they return. OpenAPI (formerly Swagger) is the industry standard — Xero, Stripe, and MYOB all publish OpenAPI specs. With `@hono/zod-openapi`, you can generate the spec directly from your existing Zod validation schemas, so the docs are always in sync with the code.

#### BEFORE YOU START

- [ ] REFACTOR-016 is complete (routes extracted into sub-apps)
- [ ] Branch: `git checkout -b refactor/REFACTOR-051-openapi-docs`
- [ ] Understand the current validation setup:

  ```bash
  # Check existing Zod schemas
  grep -rn "z\.object\|z\.string\|z\.number" server/src/validation/index.ts | head -20
  # Check which routes already use zValidator
  grep -rn "zValidator" server/src/ | head -20
  ```

#### STEP-BY-STEP Instructions

**Step 1: Install @hono/zod-openapi**

```bash
cd server && npm install @hono/zod-openapi
```

This package lets you define routes with Zod schemas AND automatically generates an OpenAPI 3.0 spec.

**Step 2: Create the OpenAPI app factory**

```typescript
// server/src/infrastructure/openapi.ts
import { OpenAPIHono } from '@hono/zod-openapi';

export function createOpenAPIApp() {
    return new OpenAPIHono({
        defaultHook: (result, c) => {
            if (!result.success) {
                return c.json(
                    {
                        success: false,
                        error: 'Validation failed',
                        details: result.error.flatten(),
                    },
                    400
                );
            }
        },
    });
}
```

**Step 3: Convert one route file to use OpenAPI route definitions**

Start with a simple route (e.g., accounts) to learn the pattern:

```typescript
// server/src/routes/account-routes.ts
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../infrastructure/openapi.js';

// Define the response schema
const AccountSchema = z.object({
    id: z.string().openapi({ example: 'acc_123' }),
    accountName: z.string().openapi({ example: 'Business Checking' }),
    accountType: z.string().openapi({ example: 'bank' }),
    balance: z.number().openapi({ example: 15420.50 }),
}).openapi('Account');

// Define the route
const listAccountsRoute = createRoute({
    method: 'get',
    path: '/api/accounts',
    tags: ['Accounts'],
    summary: 'List all accounts for the authenticated user',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'List of accounts',
            content: {
                'application/json': {
                    schema: z.object({
                        data: z.array(AccountSchema),
                    }),
                },
            },
        },
        401: { description: 'Unauthorized — missing or invalid JWT' },
    },
});

const app = createOpenAPIApp();

app.openapi(listAccountsRoute, async (c) => {
    // ... existing route handler logic (COPY as-is from index.ts)
    return c.json({ data: accounts });
});

export default app;
```

**Step 4: Register the OpenAPI spec and Swagger UI endpoints**

```typescript
// server/src/index.ts — add after all route registrations
import { swaggerUI } from '@hono/swagger-ui';

// Serve the OpenAPI JSON spec
app.doc('/api/openapi.json', {
    openapi: '3.0.0',
    info: {
        title: 'GoldLedger API',
        version: '1.0.0',
        description: 'Enterprise accounting platform API',
    },
    servers: [
        { url: 'http://localhost:3501', description: 'Development' },
    ],
    security: [{ bearerAuth: [] }],
});

// Serve Swagger UI at /api/docs
app.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));
```

**Step 5: Add security scheme definition**

```typescript
// In the doc() call, add components:
app.doc('/api/openapi.json', {
    // ... info, servers ...
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT access token from /auth/login',
            },
        },
    },
});
```

**Step 6: Gradually convert remaining routes**

Do NOT convert all routes at once. Convert 3-5 routes per PR:

1. Auth routes (`/auth/login`, `/auth/register`, `/auth/refresh`)
2. Transaction routes (`/api/transactions` CRUD)
3. Account routes (`/api/accounts` CRUD)
4. Dashboard routes (`/api/dashboard/*`)
5. Remaining routes (invoicing, payroll, tax, etc.)

For each route, define:

- Request body schema (for POST/PUT/PATCH)
- Query parameter schema (for GET with filters)
- Path parameter schema (for routes with `:id`)
- All possible response schemas (200, 400, 401, 403, 404, 500)

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Documenting only happy-path responses | Consumers don't know what errors look like | Always document 400, 401, 403, 404, 500 responses |
| Not adding `.openapi()` to Zod schemas | Schema names show as "anonymous" in Swagger UI | Call `.openapi('SchemaName')` on every reusable schema |
| Hardcoding server URL | Breaks when deployed to staging/production | Use environment variable for server URL |
| Converting all routes in one PR | Massive PR, hard to review | Convert 3-5 routes per PR |
| Not testing the Swagger UI | Spec may be valid JSON but UI may not render | Open `/api/docs` in browser after every change |

#### VERIFICATION

```bash
# Start the server
npm run dev

# Check the OpenAPI spec is valid JSON
curl http://localhost:3501/api/openapi.json | python -m json.tool

# Open Swagger UI in browser
open http://localhost:3501/api/docs
# Verify: all documented routes appear, "Try it out" works

# Validate the spec with an online tool
# Copy the JSON from /api/openapi.json to https://editor.swagger.io/
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
cd server && npm uninstall @hono/zod-openapi @hono/swagger-ui
```

---

### REFACTOR-052: Storybook for UI Components

**Priority**: P2 — Medium | **Effort**: 8 hours | **Risk**: Low
**Depends On**: REFACTOR-026

#### WHY This Matters

Storybook lets you develop, test, and document UI components in isolation — without running the full app. Designers can review components, QA can test edge cases (empty states, loading states, error states), and new developers can browse the component library. Xero and MYOB both use Storybook internally. The `client/src/components/ui/` directory has 13 shared components (button, card, input, badge, tabs, etc.) that are perfect Storybook candidates.

#### BEFORE YOU START

- [ ] REFACTOR-026 is complete (large components split)
- [ ] Branch: `git checkout -b refactor/REFACTOR-052-storybook`
- [ ] List all UI components:

  ```bash
  ls client/src/components/ui/
  # Expected: badge.tsx, button.tsx, card.tsx, input.tsx, label.tsx,
  # progress.tsx, select.tsx, skeleton.tsx, switch.tsx, tabs.tsx,
  # BottomSheet.tsx, PullToRefresh.tsx, SwipeableCard.tsx
  ```

#### STEP-BY-STEP Instructions

**Step 1: Install Storybook with Vite builder**

```bash
cd client
npx storybook@latest init --builder @storybook/builder-vite
```

This command will:

- Detect your React + Vite setup
- Install `@storybook/react-vite`, `@storybook/addon-essentials`, etc.
- Create `.storybook/main.ts` and `.storybook/preview.ts`
- Add `storybook` and `build-storybook` scripts to `package.json`

**Step 2: Configure Storybook to use your Tailwind CSS**

```typescript
// client/.storybook/preview.ts
import type { Preview } from '@storybook/react';
import '../src/index.css';  // Import your Tailwind CSS

const preview: Preview = {
    parameters: {
        controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
        backgrounds: {
            default: 'dark',
            values: [
                { name: 'dark', value: '#0a0a1a' },
                { name: 'light', value: '#ffffff' },
            ],
        },
    },
};

export default preview;
```

**Step 3: Write your first story — Button**

```typescript
// client/src/components/ui/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
    title: 'UI/Button',
    component: Button,
    tags: ['autodocs'],  // Auto-generate docs page
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon'],
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { children: 'Click me', variant: 'default' },
};

export const Destructive: Story = {
    args: { children: 'Delete', variant: 'destructive' },
};

export const Loading: Story = {
    args: { children: 'Saving...', disabled: true },
};

export const AllVariants: Story = {
    render: () => (
        <div className="flex gap-4 flex-wrap">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
        </div>
    ),
};
```

**Step 4: Write stories for remaining UI components**

Create one `.stories.tsx` file per component. Priority order:

1. `button.stories.tsx` ✅ (done above)
2. `card.stories.tsx` — show card with title, content, footer
3. `input.stories.tsx` — show default, error, disabled states
4. `badge.stories.tsx` — show all color variants
5. `tabs.stories.tsx` — show tab switching
6. `select.stories.tsx` — show with options
7. `skeleton.stories.tsx` — show loading placeholders
8. `switch.stories.tsx` — show on/off states
9. `progress.stories.tsx` — show 0%, 50%, 100%
10. `label.stories.tsx` — show with input
11. `BottomSheet.stories.tsx` — show open/closed
12. `PullToRefresh.stories.tsx` — show pull gesture
13. `SwipeableCard.stories.tsx` — show swipe actions

**Step 5: Add stories for critical feature components**

After UI components, add stories for key feature components:

```typescript
// Example: client/src/components/TransactionTable.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { TransactionTable } from './TransactionTable';

const meta: Meta<typeof TransactionTable> = {
    title: 'Features/TransactionTable',
    component: TransactionTable,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithData: Story = {
    args: {
        transactions: [
            { id: '1', date: '2024-01-15', description: 'Woolworths', amount: -85.50, category: 'Groceries' },
            { id: '2', date: '2024-01-14', description: 'Client Payment', amount: 2500.00, category: 'Income' },
        ],
    },
};

export const Empty: Story = {
    args: { transactions: [] },
};

export const Loading: Story = {
    args: { transactions: [], isLoading: true },
};
```

**Step 6: Add Storybook build to CI**

```yaml
# In .github/workflows/ci.yml — add a job:
storybook:
    runs-on: ubuntu-latest
    steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: cd client && npm ci
        - run: cd client && npm run build-storybook
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Not importing CSS in preview.ts | Components render without styles | Import `../src/index.css` in `.storybook/preview.ts` |
| Writing stories that depend on API calls | Stories break when server is down | Use mock data in story args, never real API calls |
| Skipping edge cases | Only happy-path stories | Always include: empty, loading, error, overflow states |
| Not using `tags: ['autodocs']` | No auto-generated docs page | Add `tags: ['autodocs']` to every meta |

#### VERIFICATION

```bash
cd client

# Run Storybook locally
npm run storybook
# Opens browser at http://localhost:6006
# Verify: all components appear in sidebar, controls work

# Build static Storybook
npm run build-storybook
# Output in client/storybook-static/
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
# Remove Storybook config
rm -rf client/.storybook client/storybook-static
```

---

### REFACTOR-053: Architecture Decision Records (ADRs)

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: None
**Depends On**: None

#### WHY This Matters

ADRs capture the "why" behind architectural decisions. Six months from now, a new developer will ask "Why SQLite for dev and PostgreSQL for prod?" or "Why Hono instead of Express?" Without ADRs, the answer is lost. ADRs are lightweight markdown files that follow a standard template: Context → Decision → Consequences. They're cheap to write and invaluable to read.

#### BEFORE YOU START

- [ ] Branch: `git checkout -b refactor/REFACTOR-053-adrs`
- [ ] Create the ADR directory: `mkdir -p docs/adr`

#### STEP-BY-STEP Instructions

**Step 1: Create the ADR template**

```markdown
<!-- docs/adr/TEMPLATE.md -->
# ADR-NNN: [Title]

**Date**: YYYY-MM-DD
**Status**: Accepted | Superseded | Deprecated
**Deciders**: [Team members involved]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- What becomes easier?

### Negative
- What becomes harder?

### Neutral
- What other changes are required?
```

**Step 2: Write ADR-001 — Monorepo Structure**

```markdown
<!-- docs/adr/001-monorepo-structure.md -->
# ADR-001: Monorepo with Client/Server Split

**Date**: 2024-01-15
**Status**: Accepted

## Context
GoldLedger has a React frontend and a Hono backend that share types
and are always deployed together. We needed to decide between a
monorepo (single git repo) and polyrepo (separate repos).

## Decision
Use a monorepo with `client/` and `server/` directories at the root.
Shared types live in a `shared/` package (see REFACTOR-011).

## Consequences
### Positive
- Single git clone, single CI pipeline
- Shared types prevent API contract drift
- Atomic commits across frontend and backend

### Negative
- Larger repo size
- Need workspace-aware tooling (npm workspaces)
```

**Step 3: Write remaining ADRs**

Create these files following the same template:

| File | Title | Key Decision |
|------|-------|-------------|
| `002-database-strategy.md` | Dual Database Strategy | SQLite for dev speed, PostgreSQL for prod reliability. Drizzle ORM abstracts the difference. |
| `003-authentication.md` | JWT + RBAC Authentication | JWT for stateless auth, bcrypt for passwords, role hierarchy (owner > admin > accountant > bookkeeper > viewer). |
| `004-ai-integration.md` | AI SDK Strategy | Vercel AI SDK as primary, direct Anthropic SDK for complex agents, OpenAI SDK for legacy compatibility. |
| `005-frontend-architecture.md` | React 19 + Feature-Based | React 19 with Vite, Tailwind CSS v4, feature-based directory structure, React.lazy for code splitting. |

**Step 4: Add an ADR index**

```markdown
<!-- docs/adr/README.md -->
# Architecture Decision Records

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-monorepo-structure.md) | Monorepo Structure | Accepted | 2024-01-15 |
| [002](002-database-strategy.md) | Dual Database Strategy | Accepted | 2024-01-15 |
| [003](003-authentication.md) | JWT + RBAC Authentication | Accepted | 2024-02-01 |
| [004](004-ai-integration.md) | AI SDK Strategy | Accepted | 2024-03-01 |
| [005](005-frontend-architecture.md) | React 19 + Feature-Based | Accepted | 2024-03-15 |
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Writing ADRs after the fact with no context | Loses the "why" | Write ADRs when the decision is made |
| Making ADRs too long | Nobody reads them | Keep each ADR to 1 page (50-100 lines) |
| Not updating status when decisions change | Misleading documentation | Mark old ADRs as "Superseded by ADR-NNN" |
| Skipping the "Consequences" section | Doesn't capture trade-offs | Always list positive AND negative consequences |

#### VERIFICATION

```bash
# Check all ADR files exist
ls docs/adr/
# Expected: TEMPLATE.md, README.md, 001-*.md through 005-*.md

# Check each ADR has required sections
for f in docs/adr/0*.md; do
    echo "=== $f ==="
    grep -c "## Context\|## Decision\|## Consequences" "$f"
    # Should output 3 for each file
done
```

#### ROLLBACK

```bash
git reset --hard HEAD~1
```

---

### REFACTOR-054: JSDoc Coverage for Public APIs

**Priority**: P2 — Medium | **Effort**: 8 hours | **Risk**: None
**Depends On**: REFACTOR-024, REFACTOR-025

#### WHY This Matters

JSDoc comments appear in IDE tooltips when you hover over a function. Without them, developers have to read the function body to understand what it does, what parameters it expects, and what it returns. For a codebase with 170K+ lines, this wastes enormous time. JSDoc also enables TypeScript's `@param` and `@returns` type checking in editors, catching bugs before runtime.

#### BEFORE YOU START

- [ ] REFACTOR-024 and REFACTOR-025 are complete (service files split)
- [ ] Branch: `git checkout -b refactor/REFACTOR-054-jsdoc`
- [ ] Count current JSDoc coverage:

  ```bash
  # Count exported functions without JSDoc
  grep -rn "^export function\|^export async function\|^export const.*=.*=>" server/src/ | wc -l
  grep -B1 "^export function\|^export async function" server/src/ | grep -c "/\*\*"
  ```

#### STEP-BY-STEP Instructions

**Step 1: Define the JSDoc standard**

Every exported function MUST have:

```typescript
/**
 * Brief one-line description of what this function does.
 *
 * @param paramName - Description of the parameter
 * @param options - Configuration options
 * @param options.limit - Maximum number of results (default: 50)
 * @returns Description of what is returned
 * @throws {ValidationError} When input validation fails
 * @throws {NotFoundError} When the resource doesn't exist
 *
 * @example
 * ```typescript
 * const result = await getTransactions(userId, { limit: 10 });
 * ```
 */
export async function getTransactions(
    userId: string,
    options?: { limit?: number }
): Promise<Transaction[]> {
    // ...
}
```

**Step 2: Start with service layer files**

These are the most important because they contain business logic:

```bash
# List all service files
ls server/src/services/*.ts
# Priority order:
# 1. transaction-service.ts (most used)
# 2. account-service.ts
# 3. auth.ts / admin-auth.ts
# 4. tax-service.ts / bas-service.ts
# 5. payroll-service.ts
# 6. invoice-service.ts
```

For each file, add JSDoc to every `export function` and `export class`.

**Step 3: Add JSDoc to repository layer**

```bash
ls server/src/repositories/*.ts
# Add JSDoc to every exported method
```

**Step 4: Add JSDoc to shared types**

```typescript
// shared/types/transaction.ts
/**
 * Represents a financial transaction in the system.
 * Transactions are created when bank statements are parsed
 * or when users manually enter them.
 */
export interface Transaction {
    /** Unique identifier (UUID v4) */
    id: string;
    /** ISO 8601 date string (YYYY-MM-DD) */
    date: string;
    /** Transaction description from bank statement */
    description: string;
    /** Amount in AUD — negative for debits, positive for credits */
    amount: number;
    /** Category assigned by AI or user */
    category: string | null;
    /** ID of the user who owns this transaction */
    userId: string;
}
```

**Step 5: Add ESLint rule to enforce JSDoc on exports**

```javascript
// In ESLint config (eslint.config.mjs):
import jsdoc from 'eslint-plugin-jsdoc';

export default [
    // ... existing config
    {
        plugins: { jsdoc },
        rules: {
            'jsdoc/require-jsdoc': ['warn', {
                require: {
                    FunctionDeclaration: true,
                    MethodDefinition: true,
                    ClassDeclaration: true,
                },
                contexts: [
                    'ExportNamedDeclaration > FunctionDeclaration',
                    'ExportNamedDeclaration > VariableDeclaration',
                ],
            }],
            'jsdoc/require-param-description': 'warn',
            'jsdoc/require-returns-description': 'warn',
        },
    },
];
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Writing JSDoc that just repeats the function name | `/** Gets transactions */` is useless | Describe WHAT, WHY, and edge cases |
| Not documenting `@throws` | Callers don't know what errors to catch | Always list thrown error types |
| Documenting private/internal functions | Noise, maintenance burden | Only document `export`ed functions |
| Not including `@example` for complex functions | Developers don't know how to call it | Add examples for functions with >2 params |

#### VERIFICATION

```bash
# Install JSDoc ESLint plugin
cd server && npm install -D eslint-plugin-jsdoc

# Run ESLint to check JSDoc coverage
npx eslint --rule '{"jsdoc/require-jsdoc": "warn"}' src/services/*.ts 2>&1 | head -30

# Count remaining undocumented exports
grep -rn "^export function\|^export async function" server/src/services/ | wc -l
# vs
grep -B1 "^export function\|^export async function" server/src/services/ | grep -c "/\*\*"
# Second number should equal first number
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-055: Developer Onboarding Guide

**Priority**: P2 — Medium | **Effort**: 4 hours | **Risk**: None
**Depends On**: REFACTOR-030

#### WHY This Matters

A new developer joins the team. Without an onboarding guide, they spend 2-3 days asking questions, reading random files, and guessing how things work. With a good guide, they're productive in 30 minutes. The onboarding guide is the single highest-ROI documentation you can write — it pays for itself every time someone new touches the codebase.

#### BEFORE YOU START

- [ ] REFACTOR-030 is complete (CI/CD pipeline in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-055-onboarding`

#### STEP-BY-STEP Instructions

**Step 1: Create docs/SETUP.md — Local Development Setup**

This file should get a developer from zero to running in <30 minutes:

```markdown
<!-- docs/SETUP.md -->
# Local Development Setup

## Prerequisites
- Node.js 20+ (`node --version`)
- Docker Desktop (for PostgreSQL and Redis)
- Git

## Quick Start (5 minutes)

1. Clone the repo:
   ```bash
   git clone <repo-url> && cd goldledger
   ```

1. Install dependencies:

   ```bash
   npm install          # Root workspace
   cd server && npm install
   cd ../client && npm install
   ```

2. Start infrastructure:

   ```bash
   docker compose up -d  # PostgreSQL + Redis
   ```

3. Set up environment:

   ```bash
   cp server/.env.example server/.env
   # Edit .env with your API keys (see below)
   ```

4. Run database migrations:

   ```bash
   cd server && npm run db:migrate
   ```

5. Start development servers:

   ```bash
   # Terminal 1: Server (port 3501)
   cd server && npm run dev
   # Terminal 2: Client (port 5173)
   cd client && npm run dev
   ```

6. Open <http://localhost:5173> in your browser.

## Required Environment Variables

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| JWT_SECRET | Any random string (32+ chars) | `openssl rand -hex 32` |
| DATABASE_URL | PostgreSQL connection string | Docker: `postgresql://...` |
| ANTHROPIC_API_KEY | Claude API key | <https://console.anthropic.com> |

## Common Issues

- **Port 3501 in use**: Kill the process: `lsof -i :3501` then `kill <PID>`
- **Docker not running**: Start Docker Desktop first
- **Migration fails**: Check DATABASE_URL in .env

```

**Step 2: Create docs/ARCHITECTURE.md — System Overview**

```markdown
<!-- docs/ARCHITECTURE.md -->
# System Architecture

## High-Level Overview
```

┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   React 19  │────▶│   Hono v4    │────▶│ PostgreSQL │
│   (Vite)    │     │   (Node.js)  │     │  (Drizzle) │
│  Port 5173  │     │  Port 3501   │     │  Port 5432 │
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────┴───────┐
                    │    Redis     │
                    │  Port 6379   │
                    └──────────────┘

```

## Directory Structure
- `client/` — React frontend (Vite + Tailwind CSS v4)
- `server/` — Hono backend (TypeScript + Drizzle ORM)
- `shared/` — Shared types between client and server
- `docs/` — Documentation and ADRs

## Key Patterns
- **Route → Service → Repository** layered architecture
- **JWT authentication** with RBAC (role-based access control)
- **Drizzle ORM** for type-safe database queries
- **AI agents** using Vercel AI SDK + Anthropic Claude
```

**Step 3: Create docs/CODING_STANDARDS.md**

```markdown
<!-- docs/CODING_STANDARDS.md -->
# Coding Standards

## TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- Zero `any` types — use `unknown` and narrow
- All functions must have explicit return types
- All exports must have JSDoc comments

## File Organization
- Max 300 lines per file
- One component/service/class per file
- Feature-based directory structure

## Naming Conventions
- Files: `kebab-case.ts` (e.g., `transaction-service.ts`)
- Components: `PascalCase.tsx` (e.g., `TransactionTable.tsx`)
- Functions: `camelCase` (e.g., `getTransactions`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- Types/Interfaces: `PascalCase` (e.g., `Transaction`)

## Git Conventions
- Branch: `refactor/REFACTOR-NNN-description`
- Commit: `refactor(REFACTOR-NNN): brief description`
- PR: One REFACTOR task per PR
```

**Step 4: Create docs/TESTING.md**

```markdown
<!-- docs/TESTING.md -->
# Testing Guide

## Running Tests
```bash
cd server && npm test        # Server unit + integration tests
cd client && npm test        # Client component tests
cd client && npm run test:e2e  # E2E tests (Playwright)
```

## Writing Tests

- Test files: `*.test.ts` or `*.test.tsx` next to source file
- Use Vitest (`describe`, `it`, `expect`)
- Mock external dependencies with `vi.mock()`
- Use `vi.hoisted()` for mock definitions

## Coverage Requirements

- Server: >80% line coverage
- Client: >70% line coverage
- New code: must not decrease coverage

```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Writing setup docs that assume prior knowledge | New devs get stuck on step 1 | Test the guide with someone unfamiliar with the project |
| Not keeping docs updated | Outdated docs are worse than no docs | Add "update docs" to PR checklist |
| Putting everything in one giant README | Nobody reads 500-line READMEs | Split into focused files: SETUP, ARCHITECTURE, CODING_STANDARDS, TESTING |
| Not including "Common Issues" section | Same questions asked repeatedly | Add every support question to the Common Issues section |

#### VERIFICATION

```bash
# Check all docs exist
ls docs/SETUP.md docs/ARCHITECTURE.md docs/CODING_STANDARDS.md docs/TESTING.md

# Test the setup guide yourself:
# 1. Clone to a fresh directory
# 2. Follow SETUP.md step by step
# 3. Time yourself — should be <30 minutes
# 4. Note any steps that were unclear
```

#### ROLLBACK

```bash
git reset --hard HEAD~1
```

---

## Phase 6: Security Hardening (Weeks 19–20)

> **Goal**: Harden the application to production-grade security. This is an accounting platform handling financial data — security is not optional. Every endpoint must validate input, check authorization, and rate-limit abuse. Tokens must expire, secrets must rotate, and dependencies must be audited. The existing codebase already has good foundations (`admin-auth.ts` has refresh tokens, `security.ts` has OWASP headers, `validation/index.ts` has Zod schemas) — this phase extends those patterns to cover ALL routes.

---

### REFACTOR-056: Implement Refresh Token Mechanism

**Priority**: P0 — Critical (Security) | **Effort**: 6 hours | **Risk**: High
**Depends On**: REFACTOR-012, REFACTOR-036

#### WHY This Matters

The current user auth (`server/src/auth.ts`) issues JWT tokens with a 24-hour TTL. If a token is stolen, the attacker has 24 hours of access. Industry standard is 15-minute access tokens with 7-day refresh tokens. The admin auth (`server/src/services/admin-auth.ts`) ALREADY implements this pattern with `ACCESS_TOKEN_EXPIRY_S` and `REFRESH_TOKEN_EXPIRY_S` — this task extends it to regular user authentication.

#### BEFORE YOU START

- [ ] REFACTOR-012 is complete (auth routes extracted)
- [ ] REFACTOR-036 is complete (auth tests exist)
- [ ] Branch: `git checkout -b refactor/REFACTOR-056-refresh-tokens`
- [ ] Study the existing admin refresh token implementation:

  ```bash
  grep -n "refreshToken\|REFRESH_TOKEN\|ACCESS_TOKEN" server/src/services/admin-auth.ts | head -20
  ```

- [ ] Study the current user auth:

  ```bash
  cat server/src/auth.ts
  # Note: generateToken() uses 24h TTL
  ```

#### STEP-BY-STEP Instructions

**Step 1: Add a refresh_tokens table to the database schema**

```typescript
// server/src/db/postgres-schema.ts — add this table
export const refreshTokens = pgTable('refresh_tokens', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),  // Store hash, NOT the raw token
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),  // null = active, set = revoked
    replacedByTokenId: text('replaced_by_token_id'),  // For rotation tracking
    userAgent: text('user_agent'),  // Track which device
    ipAddress: text('ip_address'),  // Track origin
});

// Add index for fast lookup
export const refreshTokensUserIdx = index('refresh_tokens_user_idx')
    .on(refreshTokens.userId);
```

**Step 2: Update the auth service with short-lived access tokens**

```typescript
// server/src/auth.ts — update token generation
import crypto from 'crypto';

const ACCESS_TOKEN_TTL_S = 15 * 60;      // 15 minutes
const REFRESH_TOKEN_TTL_S = 7 * 24 * 3600; // 7 days

export async function generateAccessToken(userId: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return sign(
        { sub: userId, type: 'access', iat: now, exp: now + ACCESS_TOKEN_TTL_S },
        JWT_SECRET
    );
}

export async function generateRefreshToken(userId: string): Promise<string> {
    // Generate a random token (NOT a JWT — just a random string)
    const rawToken = crypto.randomBytes(64).toString('hex');

    // Hash it before storing in DB
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store in database
    await db.insert(refreshTokens).values({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000),
    });

    return rawToken;  // Return raw token to client (stored in httpOnly cookie)
}
```

**Step 3: Create the /auth/refresh endpoint**

```typescript
// server/src/routes/auth-routes.ts — add refresh endpoint
app.post('/auth/refresh', async (c) => {
    const refreshToken = c.req.header('X-Refresh-Token')
        ?? (await c.req.json().catch(() => ({}))).refreshToken;

    if (!refreshToken) {
        return c.json({ error: 'Refresh token required' }, 401);
    }

    // Hash the incoming token to compare with DB
    const tokenHash = crypto.createHash('sha256')
        .update(refreshToken).digest('hex');

    // Find the token in DB
    const [stored] = await db.select().from(refreshTokens)
        .where(and(
            eq(refreshTokens.tokenHash, tokenHash),
            isNull(refreshTokens.revokedAt),
        )).limit(1);

    if (!stored) {
        return c.json({ error: 'Invalid refresh token' }, 401);
    }

    if (new Date(stored.expiresAt) < new Date()) {
        return c.json({ error: 'Refresh token expired' }, 401);
    }

    // Rotate: revoke old token, issue new pair
    await db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, stored.id));

    const newAccessToken = await generateAccessToken(stored.userId);
    const newRefreshToken = await generateRefreshToken(stored.userId);

    // Link old token to new one (for audit trail)
    // ... update replacedByTokenId

    return c.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    });
});
```

**Step 4: Update the login endpoint to return both tokens**

```typescript
// In /auth/login handler:
const accessToken = await generateAccessToken(user.id);
const refreshToken = await generateRefreshToken(user.id);

return c.json({
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_S,
    user: { id: user.id, username: user.username, role: user.role },
});
```

**Step 5: Add token revocation on logout**

```typescript
// POST /auth/logout
app.post('/auth/logout', async (c) => {
    const userId = getUserId(c);

    // Revoke ALL refresh tokens for this user
    await db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
        ));

    return c.json({ success: true });
});
```

**Step 6: Update the client to handle token refresh**

```typescript
// client/src/api.ts — add interceptor
async function fetchWithAuth(url: string, options: RequestInit = {}) {
    let response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${getAccessToken()}`,
        },
    });

    // If 401, try refreshing the token
    if (response.status === 401) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.success) {
            // Retry the original request with new token
            response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${refreshResult.accessToken}`,
                },
            });
        } else {
            // Refresh failed — redirect to login
            window.location.href = '/login';
        }
    }

    return response;
}
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Storing raw refresh tokens in DB | If DB is breached, all tokens are compromised | Always hash with SHA-256 before storing |
| Not rotating refresh tokens | Stolen token works forever until expiry | Issue new refresh token on every use, revoke old one |
| Sending refresh token in URL | Logged in server access logs, browser history | Use request body or httpOnly cookie |
| Not revoking on logout | User can't "log out" — tokens still valid | Revoke all user's refresh tokens on logout |
| Infinite retry loop on 401 | Client hammers server when token is truly invalid | Only retry ONCE, then redirect to login |

#### VERIFICATION

```bash
# Test the full flow:
# 1. Login — get access + refresh tokens
curl -X POST http://localhost:3501/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test123"}'
# Should return: { accessToken, refreshToken, expiresIn: 900 }

# 2. Use access token
curl http://localhost:3501/api/transactions \
    -H "Authorization: Bearer <accessToken>"

# 3. Refresh the token
curl -X POST http://localhost:3501/auth/refresh \
    -H "Content-Type: application/json" \
    -d '{"refreshToken":"<refreshToken>"}'
# Should return: new accessToken + new refreshToken

# 4. Verify old refresh token is revoked
curl -X POST http://localhost:3501/auth/refresh \
    -H "Content-Type: application/json" \
    -d '{"refreshToken":"<oldRefreshToken>"}'
# Should return: 401 Invalid refresh token
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
# Drop the refresh_tokens table if migration was run
```

---

### REFACTOR-057: Add Input Validation to All Routes

**Priority**: P0 — Critical (Security) | **Effort**: 8 hours | **Risk**: Medium
**Depends On**: REFACTOR-016, REFACTOR-022

#### WHY This Matters

Unvalidated input is the #1 cause of security vulnerabilities (SQL injection, XSS, command injection). The codebase already has a solid validation foundation — `server/src/validation/index.ts` has Zod schemas for auth, transactions, BAS/tax, chat, and pagination. Some routes already use `zValidator('json', schema)` from `@hono/zod-validator`. But many routes still do `await c.req.json()` with NO validation — any garbage data flows straight into business logic and the database. This task audits EVERY route and plugs the gaps.

#### BEFORE YOU START

- [ ] REFACTOR-016 is complete (routes extracted into sub-apps)
- [ ] REFACTOR-022 is complete (error handling framework in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-057-input-validation`
- [ ] Audit which routes already have validation:

  ```bash
  # Routes using zValidator (already validated)
  grep -rn "zValidator" server/src/ | grep -v node_modules
  # Routes using validateBody (already validated)
  grep -rn "validateBody" server/src/ | grep -v node_modules
  # Routes doing raw c.req.json() (NEED validation)
  grep -rn "c\.req\.json()" server/src/ | grep -v node_modules | wc -l
  ```

- [ ] Study the existing validation patterns:

  ```bash
  cat server/src/validation/index.ts
  ```

#### STEP-BY-STEP Instructions

**Step 1: Understand the two validation approaches**

The codebase uses TWO approaches. Pick ONE per route — do NOT mix them:

```typescript
// Approach A: zValidator middleware (PREFERRED — validates BEFORE handler runs)
import { zValidator } from '@hono/zod-validator';

app.post('/api/transactions',
    zValidator('json', transactionCreateSchema),  // Validates body
    zValidator('query', paginationSchema),         // Validates query params
    async (c) => {
        const body = c.req.valid('json');   // Already validated & typed
        const query = c.req.valid('query'); // Already validated & typed
    }
);

// Approach B: validateBody helper (validates INSIDE handler)
app.post('/api/transactions', async (c) => {
    const raw = await c.req.json();
    const body = validateBody(transactionCreateSchema, raw); // Throws ValidationError
});
```

**WHY Approach A is preferred**: It runs BEFORE your handler, so invalid requests never reach your code. It also gives you TypeScript types automatically via `c.req.valid('json')`.

**Step 2: Create missing schemas in validation/index.ts**

Audit each route file and add schemas for any endpoint that lacks one:

```typescript
// server/src/validation/index.ts — add these missing schemas

// Account schemas
export const accountCreateSchema = z.object({
    name: z.string().min(1, 'Account name required').max(200),
    type: z.enum(['checking', 'savings', 'credit', 'loan', 'investment', 'other']),
    institution: z.string().max(200).optional(),
    bsb: z.string().regex(/^\d{3}-?\d{3}$/, 'Invalid BSB format').optional(),
    accountNumber: z.string().max(20).optional(),
    currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('AUD'),
});

// Statement upload schema (query params)
export const statementUploadQuerySchema = z.object({
    accountId: uuidSchema.optional(),
    format: z.enum(['csv', 'pdf', 'ofx', 'qif']).optional(),
});

// Reconciliation schemas
export const reconcileSchema = z.object({
    transactionId: uuidSchema,
    matchedTransactionId: uuidSchema.optional(),
    status: z.enum(['matched', 'unmatched', 'manual']),
    notes: z.string().max(500).optional(),
});

// Path parameter schemas (reusable)
export const idParamSchema = z.object({
    id: uuidSchema,
});

export const userIdParamSchema = z.object({
    userId: uuidSchema,
});
```

**Step 3: Add validation to each route file — one file at a time**

Work through route files in this order (highest risk first):

1. **Auth routes** — login, register, password change (already mostly done)
2. **Transaction routes** — create, update, delete, bulk operations
3. **Account routes** — create, update, link
4. **Payroll routes** — employee data, pay runs
5. **Invoice routes** — create, send, mark paid
6. **AI/Chat routes** — chat messages, agent requests
7. **Admin routes** — user management, settings
8. **Remaining routes** — reports, exports, etc.

For each route, follow this pattern:

```typescript
// BEFORE (unsafe):
app.post('/api/accounts', async (c) => {
    const body = await c.req.json();  // ❌ No validation
    const account = await accountService.create(body);
    return c.json(account, 201);
});

// AFTER (safe):
app.post('/api/accounts',
    zValidator('json', accountCreateSchema),  // ✅ Validated
    async (c) => {
        const body = c.req.valid('json');  // ✅ Typed
        const account = await accountService.create(body);
        return c.json(account, 201);
    }
);
```

**Step 4: Add query parameter validation to GET routes**

```typescript
// BEFORE:
app.get('/api/transactions', async (c) => {
    const page = parseInt(c.req.query('page') || '1');  // ❌ No validation
    const limit = parseInt(c.req.query('limit') || '50');
});

// AFTER:
app.get('/api/transactions',
    zValidator('query', paginationSchema),  // ✅ Validated
    async (c) => {
        const { page, limit } = c.req.valid('query');  // ✅ Typed
    }
);
```

**Step 5: Add path parameter validation**

```typescript
// BEFORE:
app.get('/api/transactions/:id', async (c) => {
    const id = c.req.param('id');  // ❌ Could be anything
});

// AFTER:
app.get('/api/transactions/:id',
    zValidator('param', idParamSchema),  // ✅ Must be valid UUID
    async (c) => {
        const { id } = c.req.valid('param');
    }
);
```

**Step 6: Ensure consistent error response format**

All validation errors should return the same shape:

```typescript
// In your error handling middleware (from REFACTOR-022):
if (error instanceof ValidationError) {
    return c.json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,  // Array of { path, message }
    }, 400);
}
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Validating body but not query params | Attacker sends `?limit=999999` | Validate ALL inputs: body, query, params |
| Using `z.any()` or `z.unknown()` in schemas | Defeats the purpose of validation | Use specific types for every field |
| Not setting max lengths on strings | Attacker sends 10MB string in a field | Always add `.max()` to string fields |
| Forgetting to validate file uploads | Malicious files bypass validation | Validate file type, size, and name |
| Mixing zValidator and validateBody in same route | Confusing, inconsistent | Pick ONE approach per route (prefer zValidator) |
| Not validating array lengths | Attacker sends array with 1M items | Always add `.min()` and `.max()` to arrays |

#### VERIFICATION

```bash
# Count routes without validation (should be 0)
grep -rn "c\.req\.json()" server/src/routes/ | grep -v "zValidator\|validateBody" | wc -l
# Target: 0

# Count routes with validation
grep -rn "zValidator\|validateBody" server/src/routes/ | wc -l
# Should match total number of POST/PUT/PATCH routes

# Run the test suite to make sure validation doesn't break existing functionality
cd server && npm test

# Test that invalid input is rejected
curl -X POST http://localhost:3501/api/transactions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"amount": "not-a-number"}'
# Should return 400 with validation error details
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-058: Apply RBAC to All Routes

**Priority**: P0 — Critical (Security) | **Effort**: 6 hours | **Risk**: High
**Depends On**: REFACTOR-016, REFACTOR-036

#### WHY This Matters

Right now, most routes only check "is the user logged in?" (JWT auth middleware). They do NOT check "does this user have PERMISSION to do this?" A logged-in `viewer` can hit the same endpoints as an `owner`. The codebase already has RBAC infrastructure — `admin-auth.ts` has `adminAuthMiddleware(requiredPermission)`, `auth-middleware.ts` has `requireRole(minRole)`, and `tenant.ts` has permission checking. But these are only applied to a handful of routes. This task applies RBAC to EVERY route.

#### BEFORE YOU START

- [ ] REFACTOR-016 is complete (routes extracted into sub-apps)
- [ ] REFACTOR-036 is complete (auth tests exist)
- [ ] Branch: `git checkout -b refactor/REFACTOR-058-rbac`
- [ ] Study the existing RBAC middleware:

  ```bash
  cat server/src/services/auth-middleware.ts
  grep -n "requireRole\|ROLE_LEVEL" server/src/services/auth-middleware.ts
  ```

- [ ] Understand the role hierarchy:

  ```
  owner (5) > admin (4) > accountant (3) > bookkeeper (2) > viewer (1)
  ```

#### STEP-BY-STEP Instructions

**Step 1: Create a route permission matrix**

Before writing any code, create a spreadsheet or markdown table mapping EVERY route to its required role:

```markdown
| Route | Method | Min Role | Notes |
|-------|--------|----------|-------|
| /api/transactions | GET | viewer | Read own transactions |
| /api/transactions | POST | bookkeeper | Create transactions |
| /api/transactions/:id | PUT | bookkeeper | Edit transactions |
| /api/transactions/:id | DELETE | accountant | Delete requires higher role |
| /api/accounts | GET | viewer | Read own accounts |
| /api/accounts | POST | accountant | Create accounts |
| /api/payroll/* | GET | accountant | Payroll is sensitive |
| /api/payroll/* | POST/PUT | admin | Payroll mutations need admin |
| /api/settings/* | GET | admin | Settings are admin-only |
| /api/settings/* | PUT | owner | Changing settings needs owner |
| /api/admin/* | * | admin | All admin routes |
| /api/tenants/* | POST/DELETE | owner | Tenant management |
```

**Step 2: Apply requireRole middleware to route groups**

```typescript
// server/src/routes/transaction-routes.ts
import { requireRole } from '../services/auth-middleware.js';

const app = new Hono();

// Read routes — viewer and above
app.get('/transactions', requireRole('viewer'), async (c) => { /* ... */ });
app.get('/transactions/:id', requireRole('viewer'), async (c) => { /* ... */ });

// Write routes — bookkeeper and above
app.post('/transactions', requireRole('bookkeeper'), async (c) => { /* ... */ });
app.put('/transactions/:id', requireRole('bookkeeper'), async (c) => { /* ... */ });

// Delete routes — accountant and above
app.delete('/transactions/:id', requireRole('accountant'), async (c) => { /* ... */ });

// Bulk operations — admin only
app.post('/transactions/bulk-delete', requireRole('admin'), async (c) => { /* ... */ });
```

**Step 3: Add resource ownership checks**

RBAC alone isn't enough — a `bookkeeper` in Tenant A should NOT see Tenant B's data:

```typescript
// After role check, verify ownership
app.get('/transactions/:id', requireRole('viewer'), async (c) => {
    const userId = c.get('jwtPayload').sub;
    const { id } = c.req.valid('param');

    const transaction = await transactionService.getById(id);
    if (!transaction) {
        return c.json({ error: 'Transaction not found' }, 404);
    }

    // Ownership check: user can only see their own data
    // (unless they're admin/owner who can see all tenant data)
    const userRole = c.get('role');
    if (transaction.userId !== userId && !['admin', 'owner'].includes(userRole)) {
        return c.json({ error: 'Access denied' }, 403);
    }

    return c.json(transaction);
});
```

**Step 4: Protect sensitive routes with higher roles**

```typescript
// Payroll — sensitive financial data
app.use('/payroll/*', requireRole('accountant'));  // Base: accountant for reads
app.post('/payroll/*', requireRole('admin'));       // Mutations: admin only
app.put('/payroll/*', requireRole('admin'));
app.delete('/payroll/*', requireRole('admin'));

// Settings — admin/owner only
app.use('/settings/*', requireRole('admin'));
app.put('/settings/*', requireRole('owner'));  // Changes need owner

// Tenant management — owner only
app.post('/tenants', requireRole('owner'));
app.delete('/tenants/:id', requireRole('owner'));
```

**Step 5: Add RBAC audit logging**

```typescript
// Log every permission check for security audit trail
function requireRoleWithAudit(minRole: TenantRole) {
    return createMiddleware(async (c, next) => {
        const userId = c.get('jwtPayload')?.sub;
        const userRole = c.get('role');
        const path = c.req.path;
        const method = c.req.method;

        // Log the access attempt
        console.info(`[RBAC] ${method} ${path} — user=${userId} role=${userRole} required=${minRole}`);

        // Delegate to existing requireRole
        const middleware = requireRole(minRole);
        return middleware(c, next);
    });
}
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Only checking role, not ownership | User A sees User B's data | Always check `resource.userId === currentUserId` |
| Applying RBAC to route group but not individual routes | Bulk delete bypasses role check | Apply to EVERY route handler, not just `app.use()` |
| Hardcoding role names as strings | Typo = security hole | Use constants: `ROLES.ADMIN` not `'admin'` |
| Not testing with each role level | Viewer can delete transactions | Write tests for each role: viewer, bookkeeper, accountant, admin, owner |
| Forgetting to protect new routes added later | New feature has no auth | Add RBAC to PR checklist: "Does every new route have requireRole?" |

#### VERIFICATION

```bash
# Audit: find routes WITHOUT requireRole middleware
grep -rn "app\.\(get\|post\|put\|delete\|patch\)" server/src/routes/ | grep -v "requireRole\|adminAuth" | head -20
# Target: only public routes (health, login, register)

# Test with viewer role — should be denied on mutations
curl -X POST http://localhost:3501/api/transactions \
    -H "Authorization: Bearer <viewer-token>" \
    -H "Content-Type: application/json" \
    -d '{"amount": 100}'
# Should return 403 Insufficient role

# Test with admin role — should succeed
curl -X POST http://localhost:3501/api/transactions \
    -H "Authorization: Bearer <admin-token>" \
    -H "Content-Type: application/json" \
    -d '{"amount": 100}'
# Should return 201

cd server && npm test
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-059: Production-Ready CORS & Rate Limiting

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-016

#### WHY This Matters

The current CORS config hardcodes `localhost` origins — in production, this means either CORS blocks all requests or you set `origin: '*'` which allows any website to make authenticated requests to your API. The rate limiter is set to 1000 req/min (development mode) — in production, this is no protection at all. An attacker could hammer your AI endpoints (which cost real money per request) or brute-force passwords. This task makes both production-ready.

#### BEFORE YOU START

- [ ] REFACTOR-016 is complete (routes extracted)
- [ ] Branch: `git checkout -b refactor/REFACTOR-059-cors-rate-limiting`
- [ ] Study the current CORS config:

  ```bash
  grep -A5 "cors(" server/src/index.ts
  ```

- [ ] Study the current rate limiter config:

  ```bash
  grep -A10 "rateLimiter(" server/src/index.ts
  grep -n "RATE_LIMIT" server/src/services/rate-limiter.ts | head -10
  ```

#### STEP-BY-STEP Instructions

**Step 1: Make CORS origins environment-driven**

```typescript
// server/src/index.ts — replace hardcoded CORS

// BEFORE (hardcoded):
app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3501'],
    credentials: true,
}));

// AFTER (environment-driven):
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3501'];

app.use('/*', cors({
    origin: (origin) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return null;
        // Check against whitelist
        if (ALLOWED_ORIGINS.includes(origin)) return origin;
        // Reject unknown origins
        return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86400,  // Cache preflight for 24 hours
}));
```

**Step 2: Set production-appropriate rate limits**

```typescript
// server/src/index.ts — environment-aware rate limits

const isDev = process.env.NODE_ENV !== 'production';

// General API rate limiter
const generalLimiter = rateLimiter({
    windowMs: 60 * 1000,  // 1 minute window
    limit: isDev ? 1000 : 60,  // 60 req/min in production
    standardHeaders: true,
    keyGenerator: getRateLimitKey,
    message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for expensive AI endpoints
const chatLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: isDev ? 100 : 10,  // 10 req/min in production (AI costs money)
    standardHeaders: true,
    keyGenerator: getRateLimitKey,
    message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
});

// Auth limiter — prevent brute force
const authLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minute window
    limit: isDev ? 100 : 10,   // 10 login attempts per 15 min
    standardHeaders: true,
    keyGenerator: getRateLimitKey,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Apply auth limiter to login/register
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
```

**Step 3: Add per-user rate limiting (not just per-IP)**

Per-IP rate limiting fails when users share an IP (office, VPN). Add per-user limits for authenticated routes:

```typescript
// Per-user rate limiter (uses userId from JWT instead of IP)
const perUserLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: isDev ? 500 : 120,  // 120 req/min per user
    standardHeaders: true,
    keyGenerator: (c) => {
        // Use userId from JWT if available, fall back to IP
        const payload = c.get('jwtPayload');
        if (payload?.sub) return `user:${payload.sub}`;
        return getRateLimitKey(c);
    },
    message: { error: 'Rate limit exceeded for your account.' },
});

// Apply after auth middleware (so JWT is available)
app.use('/api/*', perUserLimiter);
```

**Step 4: Add Retry-After header to 429 responses**

```typescript
// The hono-rate-limiter already adds standard headers when
// standardHeaders: true is set. Verify these headers appear:
// X-RateLimit-Limit: 60
// X-RateLimit-Remaining: 42
// X-RateLimit-Reset: 1707123456
// Retry-After: 18  (seconds until window resets)
```

**Step 5: Add .env.example entries**

```bash
# In server/.env.example — add:
# CORS — comma-separated list of allowed origins
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
# For production: CORS_ORIGINS=https://app.goldledger.com.au
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Setting `origin: '*'` in production | Any website can make authenticated API calls | Use explicit whitelist from env var |
| Same rate limit for dev and prod | Dev is too strict or prod is too loose | Use `isDev` flag to switch limits |
| Rate limiting only by IP | Shared IPs (office) hit limit for all users | Add per-user rate limiting for authenticated routes |
| Not exposing rate limit headers | Client can't show "try again in X seconds" | Add `exposeHeaders` to CORS config |
| Forgetting to rate limit auth endpoints | Brute force attacks on login | Add separate `authLimiter` with strict limits |

#### VERIFICATION

```bash
# Test CORS — should allow localhost
curl -I -X OPTIONS http://localhost:3501/api/transactions \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: GET"
# Should include: Access-Control-Allow-Origin: http://localhost:5173

# Test CORS — should reject unknown origin
curl -I -X OPTIONS http://localhost:3501/api/transactions \
    -H "Origin: http://evil.com" \
    -H "Access-Control-Request-Method: GET"
# Should NOT include Access-Control-Allow-Origin

# Test rate limiting headers
curl -I http://localhost:3501/api/transactions \
    -H "Authorization: Bearer <token>"
# Should include: X-RateLimit-Limit, X-RateLimit-Remaining

cd server && npm test
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
```

---

### REFACTOR-060: Security Headers Audit

**Priority**: P1 — High | **Effort**: 2 hours | **Risk**: Low
**Depends On**: None

#### WHY This Matters

Security headers tell browsers how to behave when handling your site's content. Without them, browsers allow dangerous defaults: embedding your site in iframes (clickjacking), executing inline scripts (XSS), loading mixed HTTP/HTTPS content, and more. The GOOD NEWS: `server/src/middleware/security.ts` already has comprehensive headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP). This task is an AUDIT — verify everything is correct and fill any gaps.

#### BEFORE YOU START

- [ ] Branch: `git checkout -b refactor/REFACTOR-060-security-headers`
- [ ] Read the existing security middleware:

  ```bash
  cat server/src/middleware/security.ts
  ```

- [ ] Note: The file already has `DEFAULT_SECURITY_CONFIG` (production) and `DEV_SECURITY_CONFIG` (relaxed for HMR)

#### STEP-BY-STEP Instructions

**Step 1: Audit existing headers against OWASP checklist**

Open `server/src/middleware/security.ts` and check each header:

| Header | Expected Value | Already Present? | Action |
|--------|---------------|-------------------|--------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ✅ Yes | Verify `hstsPreload: true` for production |
| `X-Frame-Options` | `DENY` | ✅ Yes | No change needed |
| `X-Content-Type-Options` | `nosniff` | ✅ Yes | No change needed |
| `X-XSS-Protection` | `1; mode=block` | ✅ Yes | Consider removing (deprecated, can cause issues) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Yes | No change needed |
| `Permissions-Policy` | Deny unused APIs | ✅ Yes | Verify all dangerous APIs are denied |
| `Content-Security-Policy` | Strict policy | ✅ Yes | Audit directives (see Step 2) |
| `Cross-Origin-Opener-Policy` | `same-origin` | ✅ Yes | No change needed |
| `Cross-Origin-Resource-Policy` | `same-origin` | ✅ Yes | No change needed |
| `Cross-Origin-Embedder-Policy` | `require-corp` | ✅ Yes | No change needed |
| `Cache-Control` | `no-store` for API responses | ❓ Check | Add if missing (Step 3) |

**Step 2: Tighten the Content-Security-Policy**

Review the CSP directives in `DEFAULT_SECURITY_CONFIG`:

```typescript
// Verify these CSP directives are set correctly for production:
csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],           // NO 'unsafe-inline' or 'unsafe-eval'
    styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind needs unsafe-inline
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],          // Add your API domain if different
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],           // Block Flash/Java plugins
    mediaSrc: ["'none'"],
    frameSrc: ["'none'"],            // Block iframes
    baseUri: ["'self'"],             // Prevent base tag hijacking
    formAction: ["'self'"],          // Prevent form submission to external sites
    frameAncestors: ["'none'"],      // Prevent clickjacking (replaces X-Frame-Options)
    upgradeInsecureRequests: true,   // Force HTTPS for all resources
},
```

**Step 3: Add Cache-Control for API responses**

API responses containing financial data should NOT be cached by browsers or proxies:

```typescript
// In the security middleware, add after other headers:
if (c.req.path.startsWith('/api/')) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');  // HTTP/1.0 compatibility
    c.header('Expires', '0');
}
```

**Step 4: Enable HSTS preload for production**

```typescript
// In DEFAULT_SECURITY_CONFIG, change:
hstsPreload: true,  // Was false — enables HSTS preload list submission
```

After deploying, submit your domain to <https://hstspreload.org/> to be included in browser preload lists.

**Step 5: Remove deprecated X-XSS-Protection header**

The `X-XSS-Protection` header is deprecated and can actually CAUSE XSS in some edge cases (the browser's XSS filter can be tricked into removing legitimate content). Modern browsers use CSP instead.

```typescript
// In DEFAULT_SECURITY_CONFIG, change:
xssProtection: false,  // Deprecated — CSP handles this now
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Adding `'unsafe-inline'` to script-src | Allows XSS attacks | Use nonces or hashes instead |
| Setting HSTS in development | Locks localhost to HTTPS | Only enable HSTS when `NODE_ENV === 'production'` (already done) |
| Not testing CSP in report-only mode first | Breaks the app if too strict | Deploy with `Content-Security-Policy-Report-Only` first |
| Caching API responses with financial data | Sensitive data stored in browser cache | Add `Cache-Control: no-store` to all API responses |

#### VERIFICATION

```bash
# Start the server in production mode
NODE_ENV=production node dist/index.js

# Check all security headers
curl -I http://localhost:3501/api/transactions \
    -H "Authorization: Bearer <token>"
# Verify: Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options,
# Content-Security-Policy, Referrer-Policy, Permissions-Policy, Cache-Control

# Test with securityheaders.com (once deployed)
# Target: A+ rating

cd server && npm test
```

#### ROLLBACK

```bash
git reset --hard HEAD~1
```

---

### REFACTOR-061: Secrets Management Audit

**Priority**: P0 — Critical (Security) | **Effort**: 2 hours | **Risk**: Low
**Depends On**: REFACTOR-009

#### WHY This Matters

A single leaked API key or database password can compromise the entire system. This is an accounting platform — a breach means exposing financial data for every user. REFACTOR-009 moved secrets to environment variables. This task is the FINAL AUDIT: verify zero secrets remain in source code, document all required secrets, and establish a rotation procedure.

#### BEFORE YOU START

- [ ] REFACTOR-009 is complete (hardcoded secrets removed)
- [ ] Branch: `git checkout -b refactor/REFACTOR-061-secrets-audit`

#### STEP-BY-STEP Instructions

**Step 1: Scan for secrets in source code**

```bash
# Search for common secret patterns
grep -rn "password\s*=\s*['\"]" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v "test\|mock\|example\|schema\|type\|interface"
grep -rn "secret\s*=\s*['\"]" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v "process\.env\|test\|mock"
grep -rn "api[_-]?key\s*=\s*['\"]" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v "process\.env\|test\|mock"
grep -rn "Bearer\s\+[A-Za-z0-9]" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v "test\|mock\|example\|header"

# Search for hardcoded connection strings
grep -rn "postgresql://\|mysql://\|mongodb://" server/src/ --include="*.ts" | grep -v "process\.env\|example\|test"

# Search for private keys
grep -rn "BEGIN.*PRIVATE KEY\|BEGIN.*RSA" server/src/ client/src/

# Check .env files are gitignored
cat .gitignore | grep "\.env"
# Should include: .env, .env.local, .env.production
```

**Step 2: Verify .env.example is complete and documented**

```bash
# List all environment variables used in the codebase
grep -rn "process\.env\.\w\+" server/src/ --include="*.ts" -o | sort -u
```

Create or update `server/.env.example` with ALL required variables:

```bash
# server/.env.example
# ============================================================================
# GoldLedger Server Environment Variables
# Copy this file to .env and fill in the values
# ============================================================================

# --- Required ---
JWT_SECRET=                    # Random string, 32+ chars: openssl rand -hex 32
DATABASE_URL=                  # PostgreSQL: postgresql://user:pass@localhost:5432/goldledger

# --- AI Services ---
ANTHROPIC_API_KEY=             # From https://console.anthropic.com
OPENAI_API_KEY=                # From https://platform.openai.com (optional, for legacy)

# --- Optional Services ---
REDIS_URL=redis://localhost:6379  # Redis for caching and sessions
COGNEE_API_URL=                   # Cognee knowledge graph service

# --- Security ---
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
NODE_ENV=development           # development | production

# --- Admin ---
ADMIN_SECRET=                  # Admin panel access: openssl rand -hex 32
```

**Step 3: Document secrets rotation procedure**

Add to `docs/SECURITY.md`:

```markdown
# Secrets Rotation Procedure

## When to Rotate
- Immediately if a secret is suspected compromised
- Every 90 days for production secrets
- When a team member with access leaves

## How to Rotate

### JWT_SECRET
1. Generate new secret: `openssl rand -hex 32`
2. Update in deployment environment (GitHub Secrets / Cloud Run)
3. Deploy — all existing tokens will be invalidated
4. Users will need to log in again

### DATABASE_URL
1. Create new database password in PostgreSQL
2. Update connection string in deployment environment
3. Deploy — verify database connectivity
4. Remove old password from PostgreSQL

### API Keys (Anthropic, OpenAI)
1. Generate new key in provider dashboard
2. Update in deployment environment
3. Deploy and verify AI features work
4. Revoke old key in provider dashboard
```

**Step 4: Add secret scanning to CI**

```yaml
# .github/workflows/ci.yml — add secret scanning job
secret-scan:
    runs-on: ubuntu-latest
    steps:
        - uses: actions/checkout@v4
        - name: Run Gitleaks
          uses: gitleaks/gitleaks-action@v2
          env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Committing .env to git | Secrets in git history forever | Add .env to .gitignore BEFORE first commit |
| Using same secrets in dev and prod | Dev leak exposes production | Use different secrets per environment |
| Not rotating after team member leaves | Ex-employee has access | Rotate all secrets when someone leaves |
| Hardcoding test secrets in test files | Might accidentally match real secrets | Use obviously fake values: `test-secret-do-not-use` |

#### VERIFICATION

```bash
# Run secret scan
npx gitleaks detect --source . --verbose
# Target: 0 findings

# Verify .env.example has all variables
grep -c "=" server/.env.example
# Should match number of process.env references

# Verify .env is gitignored
git status server/.env
# Should show: nothing to commit (file is ignored)
```

#### ROLLBACK

```bash
git reset --hard HEAD~1
```

---

### REFACTOR-062: Dependency Security Audit

**Priority**: P1 — High | **Effort**: 2 hours | **Risk**: Low
**Depends On**: REFACTOR-027, REFACTOR-028, REFACTOR-029

#### WHY This Matters

Every npm package you install is code written by strangers running in your application. A single compromised dependency can steal secrets, exfiltrate data, or install backdoors. The `event-stream` incident (2018) and `ua-parser-js` incident (2021) both injected malware through popular npm packages. This task ensures all dependencies are audited, vulnerabilities are fixed, and automated monitoring is in place.

#### BEFORE YOU START

- [ ] REFACTOR-027 is complete (AI SDK dependencies consolidated)
- [ ] REFACTOR-028 is complete (PDF libraries consolidated)
- [ ] REFACTOR-029 is complete (@types moved to devDependencies)
- [ ] Branch: `git checkout -b refactor/REFACTOR-062-dependency-audit`

#### STEP-BY-STEP Instructions

**Step 1: Run npm audit on both packages**

```bash
# Server
cd server && npm audit
# Note the number of high/critical vulnerabilities

# Client
cd ../client && npm audit
# Note the number of high/critical vulnerabilities
```

**Step 2: Fix all high and critical vulnerabilities**

```bash
# Try automatic fix first
cd server && npm audit fix
cd ../client && npm audit fix

# If automatic fix doesn't resolve everything:
npm audit fix --force  # WARNING: may bump major versions

# For each remaining vulnerability, check manually:
# 1. Is there a patched version? → npm install package@latest
# 2. Is it a dev dependency only? → Lower risk, document and accept
# 3. Is there no fix available? → Document in ACCEPTED_RISKS.md
```

**Step 3: Document accepted risks**

For any vulnerability that CANNOT be fixed (no patch available, breaking change required):

```markdown
<!-- docs/ACCEPTED_RISKS.md -->
# Accepted Security Risks

| Package | Vulnerability | Severity | Reason for Acceptance | Review Date |
|---------|--------------|----------|----------------------|-------------|
| example-pkg@1.2.3 | CVE-2024-XXXXX | Moderate | No fix available, not exploitable in our usage (server-side only, no user input reaches this code) | 2024-03-15 |
```

**Step 4: Add npm audit to CI pipeline**

```yaml
# .github/workflows/ci.yml — add audit job
dependency-audit:
    runs-on: ubuntu-latest
    steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: cd server && npm ci && npm audit --audit-level=high
        - run: cd client && npm ci && npm audit --audit-level=high
```

This will FAIL the build if any new high/critical vulnerability is introduced.

**Step 5: Configure Dependabot for automated updates**

```yaml
# .github/dependabot.yml
version: 2
updates:
    - package-ecosystem: "npm"
      directory: "/server"
      schedule:
          interval: "weekly"
      open-pull-requests-limit: 10
      reviewers:
          - "team-lead"
      labels:
          - "dependencies"
          - "security"

    - package-ecosystem: "npm"
      directory: "/client"
      schedule:
          interval: "weekly"
      open-pull-requests-limit: 10
      reviewers:
          - "team-lead"
      labels:
          - "dependencies"
          - "security"
```

**Step 6: Review and remove unused dependencies**

```bash
# Check for unused dependencies
cd server && npx depcheck
cd ../client && npx depcheck

# Remove any unused packages
npm uninstall <unused-package>
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Running `npm audit fix --force` blindly | May break the app with major version bumps | Run without `--force` first, test after each fix |
| Ignoring moderate vulnerabilities | They can be chained with other vulns | Fix all high/critical, document moderate with justification |
| Not checking transitive dependencies | Vulnerability is in a sub-dependency | Use `npm ls <package>` to find which top-level dep pulls it in |
| Accepting risks without review date | Risk is never re-evaluated | Always include a review date (90 days max) |

#### VERIFICATION

```bash
# Both should show 0 high/critical
cd server && npm audit --audit-level=high
cd ../client && npm audit --audit-level=high

# Verify Dependabot config
cat .github/dependabot.yml

# Verify CI audit job
grep "npm audit" .github/workflows/ci.yml
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
# Restore package-lock.json from before the audit
git checkout HEAD~N -- server/package-lock.json client/package-lock.json
npm install
```

---

### REFACTOR-063: Account Lockout & Brute Force Protection

**Priority**: P1 — High | **Effort**: 4 hours | **Risk**: Medium
**Depends On**: REFACTOR-056

#### WHY This Matters

Without account lockout, an attacker can try millions of passwords against a single account. Even with rate limiting (REFACTOR-059), a determined attacker can use distributed IPs to bypass IP-based limits. Account lockout is the last line of defense — after 5 failed attempts, the account is locked regardless of the source IP. The admin auth (`server/src/services/admin-auth.ts`) ALREADY implements lockout (5 failures → 15 min lock). This task extends it to regular user authentication.

#### BEFORE YOU START

- [ ] REFACTOR-056 is complete (refresh token mechanism in place)
- [ ] Branch: `git checkout -b refactor/REFACTOR-063-account-lockout`
- [ ] Study the existing admin lockout implementation:

  ```bash
  grep -n "lockout\|failedAttempts\|MAX_FAILED\|LOCKOUT" server/src/services/admin-auth.ts
  ```

#### STEP-BY-STEP Instructions

**Step 1: Add login attempt tracking columns to users table**

```typescript
// server/src/db/postgres-schema.ts — add to users table
// Option A: Add columns to existing users table
export const users = pgTable('users', {
    // ... existing columns ...
    failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until'),  // null = not locked
    lastFailedLoginAt: timestamp('last_failed_login_at'),
    lastFailedLoginIp: text('last_failed_login_ip'),
});

// Option B: Create a separate table (if you don't want to modify users)
export const loginAttempts = pgTable('login_attempts', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
    success: boolean('success').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
});
```

**Step 2: Create the lockout service**

```typescript
// server/src/services/login-lockout.ts
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;  // 30 minutes
const PROGRESSIVE_DELAYS_MS = [0, 1000, 2000, 4000, 8000, 16000];  // 0s, 1s, 2s, 4s, 8s, 16s

export class LoginLockoutService {
    /**
     * Check if an account is currently locked.
     * @returns { locked: boolean, remainingMs?: number }
     */
    async isLocked(userId: string): Promise<{ locked: boolean; remainingMs?: number }> {
        const [user] = await db.select({
            failedLoginAttempts: users.failedLoginAttempts,
            lockedUntil: users.lockedUntil,
        }).from(users).where(eq(users.id, userId)).limit(1);

        if (!user) return { locked: false };

        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
            return { locked: true, remainingMs };
        }

        return { locked: false };
    }

    /**
     * Record a failed login attempt. Locks account after MAX_FAILED_ATTEMPTS.
     */
    async recordFailedAttempt(userId: string, ipAddress: string): Promise<void> {
        const [user] = await db.select({
            failedLoginAttempts: users.failedLoginAttempts,
        }).from(users).where(eq(users.id, userId)).limit(1);

        if (!user) return;

        const newCount = (user.failedLoginAttempts ?? 0) + 1;
        const updates: Record<string, unknown> = {
            failedLoginAttempts: newCount,
            lastFailedLoginAt: new Date(),
            lastFailedLoginIp: ipAddress,
        };

        // Lock the account after MAX_FAILED_ATTEMPTS
        if (newCount >= MAX_FAILED_ATTEMPTS) {
            updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }

        await db.update(users).set(updates).where(eq(users.id, userId));

        // Log for security monitoring
        console.warn(`[SECURITY] Failed login attempt ${newCount}/${MAX_FAILED_ATTEMPTS} for user=${userId} ip=${ipAddress}`);
    }

    /**
     * Reset failed attempts on successful login.
     */
    async recordSuccessfulLogin(userId: string): Promise<void> {
        await db.update(users).set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastFailedLoginAt: null,
            lastFailedLoginIp: null,
        }).where(eq(users.id, userId));
    }

    /**
     * Get the progressive delay for the current attempt number.
     */
    getProgressiveDelay(attemptNumber: number): number {
        const index = Math.min(attemptNumber, PROGRESSIVE_DELAYS_MS.length - 1);
        return PROGRESSIVE_DELAYS_MS[index];
    }

    /**
     * Admin: manually unlock an account.
     */
    async unlockAccount(userId: string): Promise<void> {
        await db.update(users).set({
            failedLoginAttempts: 0,
            lockedUntil: null,
        }).where(eq(users.id, userId));
    }
}

export const loginLockoutService = new LoginLockoutService();
```

**Step 3: Integrate lockout into the login handler**

```typescript
// In your auth routes (server/src/routes/auth-routes.ts):
import { loginLockoutService } from '../services/login-lockout.js';

app.post('/auth/login', async (c) => {
    const { username, password } = c.req.valid('json');
    const ipAddress = c.req.header('x-real-ip') || 'unknown';

    // Find user by username
    const [user] = await db.select().from(users)
        .where(eq(users.username, username)).limit(1);

    if (!user) {
        // Don't reveal whether username exists
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check if account is locked
    const lockStatus = await loginLockoutService.isLocked(user.id);
    if (lockStatus.locked) {
        const remainingMin = Math.ceil((lockStatus.remainingMs ?? 0) / 60000);
        return c.json({
            error: `Account locked. Try again in ${remainingMin} minutes.`,
            code: 'ACCOUNT_LOCKED',
            retryAfterSeconds: Math.ceil((lockStatus.remainingMs ?? 0) / 1000),
        }, 423);  // 423 Locked
    }

    // Apply progressive delay
    const delay = loginLockoutService.getProgressiveDelay(user.failedLoginAttempts);
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Verify password
    const passwordValid = await comparePassword(password, user.passwordHash);
    if (!passwordValid) {
        await loginLockoutService.recordFailedAttempt(user.id, ipAddress);
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Success — reset failed attempts
    await loginLockoutService.recordSuccessfulLogin(user.id);

    // Generate tokens (from REFACTOR-056)
    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    return c.json({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_S,
        user: { id: user.id, username: user.username, role: user.role },
    });
});
```

**Step 4: Add admin unlock endpoint**

```typescript
// In admin routes:
app.post('/admin/users/:userId/unlock',
    adminAuthMiddleware('manage_users'),
    zValidator('param', userIdParamSchema),
    async (c) => {
        const { userId } = c.req.valid('param');
        await loginLockoutService.unlockAccount(userId);
        return c.json({ success: true, message: `Account ${userId} unlocked` });
    }
);
```

#### COMMON MISTAKES

| Mistake | Why It's Bad | How to Avoid |
|---------|-------------|--------------|
| Revealing whether username exists | Attacker can enumerate valid usernames | Always return "Invalid credentials" for both bad username and bad password |
| Locking by IP instead of by account | Attacker uses different IPs | Lock the USER ACCOUNT, not the IP address |
| No progressive delay | Attacker gets 5 fast attempts before lockout | Add increasing delays: 0s, 1s, 2s, 4s, 8s |
| No admin unlock mechanism | Legitimate user locked out permanently | Add admin endpoint to unlock accounts |
| Not logging failed attempts | Can't detect brute force attacks | Log every failed attempt with IP and timestamp |
| Using `setTimeout` for delay in production | Blocks the event loop | Use `await new Promise(resolve => setTimeout(resolve, delay))` — this is non-blocking |

#### VERIFICATION

```bash
# Test lockout flow:
# 1. Attempt login with wrong password 5 times
for i in $(seq 1 5); do
    curl -X POST http://localhost:3501/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"test","password":"wrong"}'
    echo " --- attempt $i"
done
# Attempts 1-4: 401 Invalid credentials
# Attempt 5: 423 Account locked

# 2. Verify account is locked
curl -X POST http://localhost:3501/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"correct"}'
# Should return 423 even with correct password

# 3. Admin unlock
curl -X POST http://localhost:3501/admin/users/<userId>/unlock \
    -H "Authorization: Bearer <admin-token>"
# Should return 200

# 4. Verify login works again
curl -X POST http://localhost:3501/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"correct"}'
# Should return 200 with tokens

cd server && npm test
```

#### ROLLBACK

```bash
git reset --hard HEAD~N
# If migration was run, drop the new columns:
# ALTER TABLE users DROP COLUMN failed_login_attempts, DROP COLUMN locked_until, ...
```

---

## 🎯 Completion Checklist

When ALL 63 REFACTOR tasks are complete, verify:

- [ ] `npm run build` succeeds with zero errors in both `server/` and `client/`
- [ ] `npm test` passes with >80% coverage in `server/`, >70% in `client/`
- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] `npx eslint .` shows 0 errors (warnings acceptable)
- [ ] No file exceeds 300 lines
- [ ] Zero `any` types in the codebase
- [ ] All API routes have Zod validation, RBAC middleware, and rate limiting
- [ ] Security headers score A+ on securityheaders.com
- [ ] OpenAPI docs available at `/api/docs`
- [ ] Storybook builds successfully
- [ ] All ADRs written and indexed
- [ ] Developer onboarding guide tested with a fresh setup

**Congratulations — you've transformed GoldLedger into an enterprise-grade codebase.** 🏆
