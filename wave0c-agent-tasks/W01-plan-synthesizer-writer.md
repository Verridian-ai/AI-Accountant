# Agent W01: Plan Synthesizer & Document Writer

## Role

Synthesize ALL research from R01-R03 into complete, executable wave plans for Waves 25-30. You are the ONLY agent that creates the actual wave files. This is the most critical role in Wave 0C.

## Phase: B (Synthesis — After ALL 3 researchers complete)

## Prerequisites

Wait for ALL of these marker files before starting:
`.agent-done-0C-R01`, `.agent-done-0C-R02`, `.agent-done-0C-R03`

Then read ALL 3 research files from `wave0c-research/`.

## Deliverables

For EACH of Waves 25-30, create:

1. **`waveN-orchestration-prompt.md`** — Following `wave11-orchestration-prompt.md` pattern
2. **`waveN-agent-tasks/`** — Directory with 10 agent task files (`01-*.md` through `10-*.md`)
3. **`launch-waveN.sh`** — Executable launch script following `launch-wave11.sh` pattern

That's **6 orchestration prompts + 60 agent task files + 6 launch scripts = 72 files total**.

## Template Files (READ THESE FIRST)

- `wave11-orchestration-prompt.md` — Structure: Architecture Refs, Current State, Dependencies, Schema, Endpoints, Agents, UI, Cognee, Tests, Execution Order
- `wave11-agent-tasks/01-inventory-schema-builder.md` — Structure: Role, Sub-wave, Tasks, Output, Completion marker
- `launch-wave11.sh` — Structure: Prerequisites check, file verification, tmux session creation, agent launch

## Writing Rules

### Orchestration Prompts Must Include:

1. Architecture reference files table
2. Current state (what exists BEFORE this wave runs)
3. Dependencies (which waves must complete first)
4. Database schema changes — BOTH SQLite AND PostgreSQL table definitions (where applicable)
5. API endpoints — method, path, description, handler file
6. New Claude agents — following `ClaudeAgent<TInput, TOutput>` pattern (where applicable)
7. UI components — file paths, component names, props
8. Cognee integration — datasets, index queries (where applicable)
9. Testing criteria — specific assertions
10. Execution order — sub-waves with parallel/sequential phases

### Agent Task Files Must Include:

1. Agent role and sub-wave assignment
2. Specific file paths to create/modify
3. Detailed implementation instructions
4. Completion marker: `.agent-done-W{N}-{XX}` format (e.g., `.agent-done-W25-01`)
5. Dependencies on other agents within the same wave

### Launch Scripts Must Include:

1. Prerequisite wave completion checks (marker files)
2. File existence verification (orchestration prompt + 10 task files)
3. Output directory creation
4. tmux session: `goldledger-wave{N}`
5. Claude Code launch with `--dangerously-skip-permissions`
6. Prompt passed as CLI argument

## Wave-Specific Notes

### Wave 25 (Light Mode Theme & Dual Theme System)
- CSS custom properties for all colors — `var(--bg-primary)`, `var(--text-primary)`, etc.
- Tailwind `dark:` variant strategy — light mode as default, dark mode via class toggle
- Gold accent (#FFCC00) must work on BOTH light and dark backgrounds
- Theme toggle component with localStorage + DB persistence
- Must update ALL 177+ UI components — use R01's component inventory
- No new database tables needed (just a `theme_preference` column on users table)

### Wave 26 (Code Quality & Technical Debt)
- TypeScript `strict: true` migration — use R02's `any` count and strictness gaps
- ESLint + Prettier unified config — use R02's current state analysis
- Bundle optimization — tree-shaking, code splitting, lazy loading
- Error boundaries for every route-level component
- WCAG 2.1 AA compliance — use R02's accessibility baseline
- No new features — purely refactoring and quality improvements

### Wave 27 (UI/UX Enhancement & Award-Winning Design)
- Landing page redesign — modern SaaS aesthetic (Jetso.com inspired)
- Storybook integration for ALL shared components
- Framer Motion animations — page transitions, micro-interactions
- Interactive product tour (react-joyride or similar)
- Demo environment with read-only sample data
- Polish Wave 22's Recharts visualizations

### Wave 28 (iOS Native App — React Native)
- Expo SDK 52+ with TypeScript — use R03's recommended setup
- Shared `packages/shared/` for types, API client, validation
- Apple Human Interface Guidelines compliance
- Face ID / Touch ID via expo-local-authentication
- Offline-first with sync — use R03's recommended strategy
- APNs push notifications via expo-notifications
- App Store submission preparation

### Wave 29 (Android Native App — React Native)
- Shares 80%+ codebase with Wave 28
- Material Design 3 via react-native-paper
- Android biometric authentication
- Home screen widgets, deep linking, app shortcuts
- Google Play Store submission preparation
- Android-specific testing (different screen sizes, API levels)

### Wave 30 (Windows Native App — Tauri)
- Tauri v2 wrapping existing React frontend — use R03's Tauri assessment
- System tray with quick actions (view balance, recent transactions)
- Auto-updater plugin for seamless updates
- File associations (.csv, .pdf, .qif import)
- MSI installer via Tauri bundler
- Windows code signing (Authenticode)

## Completion

- [ ] All 72 files created and verified
- [ ] Cross-wave dependency chain validated: 25→26→27→28→29, 25+26→30
- [ ] Create marker file: `.agent-done-0C-W01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Technical Writing | Produce clear, actionable implementation plans | Expert |
| Architecture Design | Design agent teams and execution orders | Expert |
| Template Synthesis | Apply patterns consistently across 6 waves | Expert |
| Cross-Reference | Ensure consistency across 72 files | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Write Wave 25-26 files (orchestration + 10 tasks + launch each)
- **Sub-agent B**: Write Wave 27-28 files
- **Sub-agent C**: Write Wave 29-30 files
- W01 reviews all sub-agent output for consistency, then creates markers

