# Agent R07: Frontend & UI Architecture Researcher

## Role

Map the complete frontend architecture — all components, features, tabs, routing, API layer, and UI patterns. Identify what exists and what patterns new waves must follow.

## Phase: A (Research — Start Immediately, Parallel with R01-R06, R08-R10)

## Research Tasks

### 1. App Structure

- [ ] Read `client/src/App.tsx` — document tab navigation, routing, layout structure
- [ ] Read `client/src/components/layout/BottomNavigation.tsx` — document TabId type (currently 9 tabs: dashboard, transactions, accounts, analytics, bas, tax, gst, transfers, loans)
- [ ] List ALL feature folders in `client/src/features/` — for each: component count, purpose
- [ ] Document the feature-based folder structure pattern

### 2. UI Library & Design System

- [ ] Document UI library: shadcn/ui (Radix UI + Tailwind CSS)
- [ ] Document icon library: lucide-react
- [ ] List ALL shadcn/ui components currently used (Button, Card, Dialog, etc.)
- [ ] Document any custom theme or design tokens
- [ ] Document responsive design approach (mobile-first? breakpoints?)

### 3. API Layer

- [ ] Read `client/src/api.ts` — document ALL API methods, their types, and groupings
- [ ] Document the API client pattern (fetch wrapper? axios? custom?)
- [ ] Document error handling pattern in API calls
- [ ] Document SSE context for real-time updates

### 4. Chat Architecture

- [ ] Read `client/src/features/chat/components/FloatingChat.tsx` — document current chat UI
- [ ] Document: How does chat currently work? (POST /api/chat → plain text response)
- [ ] Document: What's missing for agent-controlled chat? (intent routing, streaming, transaction editing)
- [ ] Identify what needs to change for chat → agent bridge

### 5. Component Patterns

- [ ] Identify common component patterns: list views, detail views, forms, dashboards, charts
- [ ] Document chart library (recharts? chart.js? custom?)
- [ ] Document form handling pattern (react-hook-form? controlled components?)
- [ ] Document state management (React context? zustand? redux?)
- [ ] Document data fetching pattern (useEffect? react-query? SWR?)

### 6. New Tab Projections

- [ ] Based on Waves 11-24, project new tabs needed:
  - `inventory` — Inventory management
  - `invoicing` — Customer invoicing
  - `ap` — Accounts payable
  - `payroll` — Full payroll system
  - `admin` — Admin backend (system-level)
  - `reports` — Financial reporting
- [ ] Assess: Is the current tab navigation scalable to 15+ tabs? Need sidebar instead?

## Output Format

Write findings to `wave0-research/R07-frontend-architecture.md` with these sections:

1. **App Structure** — Tabs, routing, layout, feature folders
2. **Design System** — UI library, icons, theme, responsive approach
3. **API Layer** — Client API methods, patterns, SSE
4. **Chat Architecture** — Current state, gaps for agent integration
5. **Component Patterns** — Common patterns, libraries, state management
6. **Navigation Scalability** — Can current nav handle 15+ tabs? Recommendations
7. **New Feature Folder Template** — Standard structure for new feature folders

## Completion

- [ ] All sections populated with specific file paths and component names
- [ ] Create marker file: `.agent-done-R07`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **React Component Analysis** | Parse JSX/TSX, understand hooks, context, component composition | Expert |
| **UI Library Assessment** | Evaluate shadcn/ui, Radix UI, Tailwind CSS patterns and extensibility | Expert |
| **API Layer Mapping** | Document fetch/axios patterns, typed API methods, error handling | Expert |
| **Navigation Architecture** | Assess tab/sidebar/routing patterns for scalability | Advanced |
| **State Management Patterns** | Identify React context, zustand, redux, or custom state patterns | Advanced |
| **Chat/Agent UX Design** | Evaluate chat interfaces for agent interaction, streaming, tool use | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel frontend analysis | Advanced |

## Sub-Agent Delegation Plan

```
R07 (Frontend Architecture Researcher):
├── Sub-agent A: App Shell & Navigation
│   ├── Read client/src/App.tsx
│   ├── Read client/src/components/layout/BottomNavigation.tsx
│   ├── List all feature folders in client/src/features/
│   ├── Document tab system, routing, layout structure
│   └── Output: wave0-research/.scratch-R07-navigation.md
│
├── Sub-agent B: API Layer & Chat
│   ├── Read client/src/api.ts (all API methods)
│   ├── Read client/src/features/chat/components/FloatingChat.tsx
│   ├── Document SSE context, error handling, data fetching patterns
│   └── Output: wave0-research/.scratch-R07-api.md
│
├── Sub-agent C: Component Patterns & Design System
│   ├── Read 3-4 representative feature folders
│   ├── Document shadcn/ui components used, chart library, form patterns
│   ├── Document state management approach
│   └── Output: wave0-research/.scratch-R07-components.md
│
└── R07 Parent: Merge and produce scalability assessment
    ├── Read all .scratch-R07-*.md files
    ├── Assess navigation scalability for 15+ tabs
    ├── Produce new feature folder template
    ├── Write final wave0-research/R07-frontend-architecture.md
    └── Delete scratch files
```

### Delegation Rules for R07

- Sub-agents write ONLY to `wave0-research/.scratch-R07-*.md` files
- Sub-agents should include component names and exact file paths
- Sub-agent A should count components per feature folder

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
