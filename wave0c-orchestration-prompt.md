# Wave 0C: Meta-Planning Agent Team — Orchestration Prompt (Waves 25–30)

You are the **Meta-Planning Team Lead** for GoldLedger. You coordinate **7 specialized agents** across 4 phases to produce comprehensive implementation plans, orchestration prompts, agent task files, and launch scripts for **Waves 25–30** — the next generation of GoldLedger features covering theming, code quality, UI/UX, and native apps.

## Mission

Waves 1–24 are either complete or in progress. Your team must produce complete, executable plans for **6 NEW waves** (Waves 25–30), each with:

1. An orchestration prompt (`waveN-orchestration-prompt.md`)
2. 10 agent task files (`waveN-agent-tasks/01-*.md` through `10-*.md`)
3. A launch script (`launch-waveN.sh`)

## CRITICAL CONTEXT: Waves 1–24 Already Exist

- **Waves 1–24**: All have orchestration prompts, agent task files, and launch scripts
- **Waves 1–3, 11–23**: Fully executed and complete
- **Waves 4, 7, 10, 24**: Currently executing
- **Waves 5, 6, 8, 9**: Waiting on dependencies (will execute after 4/7 complete)
- **Your waves (25–30) must integrate with ALL existing infrastructure**

## Wave 25–30 Specifications

### Wave 25: Light Mode Theme & Dual Theme System

- Design and implement a complete light mode theme alongside the existing neumorphic dark theme
- Create theme toggle system with user preference persistence (localStorage + DB)
- Ensure all 177+ UI components support both themes with proper contrast ratios (WCAG AA)
- Maintain gold (#FFCC00) accent across both themes
- Update all `neu-raised`/`neu-inset` Tailwind classes to work in light mode
- CSS custom properties / Tailwind dark: variant strategy
- Dependencies: None (can run independently after Wave 1)

### Wave 26: Code Quality & Technical Debt

- Comprehensive TypeScript strict mode migration (`strict: true` in all tsconfig files)
- ESLint/Prettier configuration and codebase-wide formatting
- Remove unused dependencies and optimize bundle size (tree-shaking audit)
- Refactor duplicated code patterns (DRY audit across server + client)
- Add comprehensive error boundaries and error handling (React ErrorBoundary, server try/catch)
- Performance profiling and optimization (Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Accessibility audit (WCAG 2.1 AA compliance — aria labels, keyboard nav, screen reader)
- Dependencies: Wave 25 (theme system must be in place for a11y audit)

### Wave 27: UI/UX Enhancement & Award-Winning Design

- Redesign landing page and marketing site (inspired by modern SaaS: clean, professional, Jetso.com aesthetic)
- Create customer-facing demo environment with sample data (read-only sandbox)
- Build interactive product tour and onboarding flow (step-by-step walkthrough)
- Add micro-interactions, animations, and delightful UX touches (Framer Motion)
- Design system documentation (Storybook integration for all components)
- Professional data visualization polish (building on Wave 22's Recharts foundation)
- Dependencies: Wave 25 (both themes), Wave 26 (clean codebase)

### Wave 28: iOS Native App (React Native)

- React Native setup with TypeScript and Expo
- Shared business logic layer between web and mobile (API client, types, validation)
- Native iOS UI components following Apple Human Interface Guidelines
- Biometric authentication (Face ID / Touch ID) via expo-local-authentication
- Offline-first architecture with sync (WatermelonDB or similar)
- Push notifications integration (APNs via expo-notifications)
- App Store submission preparation (screenshots, metadata, review guidelines)
- Dependencies: Wave 26 (shared types must be clean), Wave 27 (design system)

### Wave 29: Android Native App (React Native)

- Android-specific UI adaptations (Material Design 3 via react-native-paper)
- Biometric authentication (fingerprint/face unlock)
- Android-specific features (home screen widgets, deep linking, app shortcuts)
- Google Play Store submission preparation
- Cross-platform code sharing with iOS (Wave 28) — shared 80%+ codebase
- Dependencies: Wave 28 (iOS app provides the shared foundation)

### Wave 30: Windows Native App (Tauri)

- Native Windows desktop application using Tauri v2 (Rust backend, web frontend)
- System tray integration with quick actions
- Windows-specific features (toast notifications, file associations for .csv/.pdf)
- Auto-update mechanism (Tauri updater plugin)
- Installer/MSI package creation (WiX or NSIS via Tauri bundler)
- Code signing for Windows (Authenticode)
- Reuse existing React frontend with minimal modifications
- Dependencies: Wave 25 (theme system), Wave 26 (optimized bundle)

## Technology Stack Decisions (Research Required)

The researchers MUST investigate and recommend:

1. **React Native vs Flutter** for mobile (consider existing React/TypeScript expertise)
2. **Tauri vs Electron** for Windows desktop (consider bundle size, performance, security)
3. **Shared state management** across platforms (Zustand, Redux Toolkit, Jotai)
4. **API authentication for native apps** (OAuth2 PKCE, JWT refresh tokens, secure storage)
5. **Offline data sync strategy** (CRDTs, operational transformation, or last-write-wins)
6. **Theme architecture** (CSS custom properties, Tailwind dark: variant, or CSS-in-JS)

## Team Structure (7 Agents, 4 Phases)

### Phase A: Research (3 agents, parallel)

| Agent | ID | Focus |
|-------|----|-------|
| Platform & Theming Researcher | R01 | Current UI architecture, Tailwind config, theme patterns, React Native/Tauri ecosystem |
| Codebase & Quality Researcher | R02 | TypeScript strictness gaps, ESLint state, bundle analysis, duplicated code, a11y audit |
| Native App & Cross-Platform Researcher | R03 | React Native + Expo setup, Tauri v2 capabilities, offline sync, biometrics, app store requirements |

### Phase B: Synthesis (1 agent, sequential)

| Agent | ID | Focus |
|-------|----|-------|
| Plan Synthesizer & Writer | W01 | Create ALL 6 wave plans (6 orchestration prompts + 60 agent task files + 6 launch scripts = 72 files) |

### Phase C: Debate (2 agents, parallel)

| Agent | ID | Focus |
|-------|----|-------|
| Architecture & Integration Reviewer | D01 | Cross-platform architecture, API compatibility, theme system design, dependency graph |
| Quality & Completeness Reviewer | D02 | Template adherence, file completeness, testing criteria, security review, a11y standards |

### Phase D: Revision (W01 re-runs with feedback)

W01 reads D01 + D02 reviews and incorporates all HIGH/MEDIUM severity feedback.

## Phase Execution Order

```
Phase A: R01 + R02 + R03 (parallel) ──────────────────────► 3 research reports
                                                              │
Phase B: W01 (sequential, reads all research) ────────────► 72 files created
                                                              │
Phase C: D01 + D02 (parallel, read all wave files) ──────► 2 review reports
                                                              │
Phase D: W01 revision (reads reviews, updates files) ────► Final 72 files
```

## Sub-Agent Delegation Strategy

1. **Spawn early, spawn often**: If your task involves reading 5+ files, spawn sub-agents to read them in parallel
2. **Divide by domain**: Split research across logical boundaries (frontend, backend, mobile, desktop)
3. **Merge before writing**: Sub-agents report findings back to the parent agent, who synthesizes into the final output file
4. **Sub-agents inherit context**: Pass your task file content and relevant context to each sub-agent
5. **Sub-agent output**: Sub-agents write to temporary scratch files (e.g., `wave0c-research/.scratch-R01-theme.md`) that the parent agent reads and deletes after merging
6. **No cross-agent delegation**: Sub-agents only work within their parent agent's scope

## Coordination Rules

1. **Phase gates**: Phase B cannot start until ALL 3 researchers complete. Phase C cannot start until W01 completes. Phase D cannot start until ALL 2 debaters complete.
2. **Signal completion**: Each agent creates `.agent-done-0C-{ID}` (e.g., `.agent-done-0C-R01`, `.agent-done-0C-W01`, `.agent-done-0C-D02`).
3. **Research directory lock**: Only researchers (R01-R03) write to `wave0c-research/`.
4. **Review directory lock**: Only debaters (D01-D02) write to `wave0c-reviews/`.
5. **Plan directory lock**: Only W01 writes to `wave{N}-orchestration-prompt.md`, `wave{N}-agent-tasks/`, and `launch-wave{N}.sh` for N=25..30.
6. **No file conflicts**: Each researcher writes ONLY to their assigned output file.
7. **Sub-agent scratch files**: Sub-agents may write to `wave0c-research/.scratch-*` or `wave0c-reviews/.scratch-*` — parent agents clean these up after merging.
8. **Reference existing patterns**: All output must follow the patterns in `wave11-orchestration-prompt.md` and `wave11-agent-tasks/01-inventory-schema-builder.md`.
9. **10-point spec format**: Every wave plan must include ALL of these for each wave:
   - Dependencies & estimated complexity
   - Agent team composition (10 agents per wave)
   - Database schema changes (both SQLite AND PostgreSQL where applicable)
   - API endpoints (method, path, description)
   - UI components (file paths, component names)
   - Cognee integration (new datasets, index queries) where applicable
   - Testing criteria (specific assertions)
   - Performance benchmarks
   - Accessibility standards
   - Migration/setup file paths

## Key Reference Files

| File | Purpose | Read By |
|------|---------|---------|
| `wave11-orchestration-prompt.md` | Template for wave orchestration prompts | W01 |
| `wave11-agent-tasks/01-inventory-schema-builder.md` | Template for agent task files | W01 |
| `launch-wave11.sh` | Template for launch scripts | W01 |
| `docs/wave0-master-plan.md` | Master plan covering all 24 waves | R01, R02, R03, W01 |
| `client/tailwind.config.js` | Current Tailwind configuration | R01 |
| `client/src/App.tsx` | Current app structure and routing | R01, R02 |
| `client/src/index.css` | Current CSS and theme variables | R01 |
| `server/src/schema.ts` | SQLite schema (source of truth) | R02 |
| `server/src/db/postgres-schema.ts` | PostgreSQL schema | R02 |
| `client/package.json` | Frontend dependencies | R02, R03 |
| `server/package.json` | Backend dependencies | R02 |
| `docker-compose.yml` | Docker stack configuration | R03 |
| `wave24-orchestration-prompt.md` | PWA/mobile-responsive wave (closest to native apps) | R03 |

## Completion Checklist

- [ ] 6 wave directories exist (wave25 through wave30)
- [ ] Each wave has: `waveN-orchestration-prompt.md`, `waveN-agent-tasks/` (10 files), `launch-waveN.sh`
- [ ] All wave plans follow the 10-point spec format
- [ ] All launch scripts are executable and follow `launch-wave11.sh` pattern
- [ ] All agent task files follow `wave11-agent-tasks/01-inventory-schema-builder.md` pattern
- [ ] Cross-wave dependencies are documented and consistent
- [ ] Technology decisions (React Native, Tauri, theme strategy) are justified with research
- [ ] Wave execution order accounts for dependency chain: 25→26→27→28→29, 25+26→30
- [ ] Updated `docs/wave0-master-plan.md` to include Waves 25–30
- [ ] Backward compatibility with Waves 1–24 verified

## START THE TEAM NOW

Spawn all 7 teammates and begin coordinating their work according to the phase execution order above. Read each agent's task file from `wave0c-agent-tasks/` for detailed assignments. Researchers go first — all 3 in parallel.
