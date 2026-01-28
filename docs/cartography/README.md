# CBA Statements Parser - Codebase Cartography

A comprehensive, machine-readable and human-navigable map of the CBA Statements Parser codebase.

## Overview

This cartography documents all UI elements, API endpoints, database schema, state management, and cross-references for the CBA Statements Parser application.

**Tech Stack:**
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Radix UI
- **Backend**: Hono.js + Drizzle ORM + SQLite
- **AI**: OpenRouter API + Cognee RAG
- **Parsers**: 8 Australian bank statement parsers

**By the Numbers:**
- 65+ API endpoints
- 30+ database tables
- 55 frontend API methods
- 37+ UI components
- 62 icons
- 42 backend functions
- 35 user actions
- 8 bank parsers
- 4 AI agents

---

## Quick Navigation

### Core Documents

| Document | Purpose |
|----------|---------|
| [MASTER_REGISTRY.md](MASTER_REGISTRY.md) | Single source of truth with all elements |
| [Architecture Diagram](diagrams/architecture-master.md) | System architecture overview |
| [Data Flow Diagrams](diagrams/data-flow.md) | Request flows and state changes |

### Raw Data (JSON)

| File | Content |
|------|---------|
| [database-schema.json](raw/database-schema.json) | 30+ table definitions with columns and relationships |
| [backend-routes.json](raw/backend-routes.json) | 65 API routes with methods and handlers |
| [api-calls.json](raw/api-calls.json) | 55 frontend API methods |
| [ui-elements.json](raw/ui-elements.json) | Components, buttons, inputs, forms |
| [icons.json](raw/icons.json) | 62 Lucide icons with usage locations |
| [state-management.json](raw/state-management.json) | Contexts, hooks, app state |
| [functions.json](raw/functions.json) | 42 service functions |
| [configuration.json](raw/configuration.json) | Full client/server config |
| [actions.json](raw/actions.json) | 35 user actions with flows |

### Searchable Indexes

| Index | Description |
|-------|-------------|
| [By Element Type](indexes/by-element-type.md) | Components, hooks, services grouped |
| [By File](indexes/by-file.md) | Alphabetical file listing |
| [By API Endpoint](indexes/by-api-endpoint.md) | REST endpoint reference |
| [By Database Table](indexes/by-database-table.md) | Schema quick reference |
| [By Feature](indexes/by-feature.md) | Feature-based grouping |

---

## Element ID Conventions

All elements have unique IDs for cross-referencing:

| Prefix | Type | Example |
|--------|------|---------|
| `ui-btn-` | Button | `ui-btn-save-transaction` |
| `ui-inp-` | Input | `ui-inp-search-filter` |
| `ui-cmp-` | Component | `ui-cmp-transaction-table` |
| `route-` | Backend route | `route-get-transactions` |
| `table-` | Database table | `table-transactions` |
| `api-call-` | Frontend API call | `api-call-fetch-transactions` |
| `state-` | State variable | `state-transactions-list` |
| `hook-` | Custom hook | `hook-use-undo-redo` |
| `ctx-` | Context | `ctx-sse` |
| `icon-` | Icon | `icon-lucide-wallet` |
| `svc-` | Backend service | `svc-pipeline` |
| `parser-` | Bank parser | `parser-cba` |
| `action-` | User action | `action-upload-statement` |

---

## Feature Modules

The application is organized into 9 feature modules:

| Feature | Description | Components |
|---------|-------------|------------|
| **Auth** | Login/registration | Auth form |
| **Accounts** | Bank account management | AccountsOverview, DebtPlanner, AccountSetupWizard |
| **Analytics** | Charts and insights | MonthlyTrendChart, CategoryChart |
| **BAS** | Business Activity Statement | BASDashboard |
| **Chat** | AI chat interface | FloatingChat |
| **Settings** | User preferences | SettingsModal, MerchantMemoryManager |
| **Statements** | PDF upload/processing | FileUpload, StatementList |
| **Tax** | Tax calculations | TaxDashboard, TaxCalculator, DeductionManager, CGTAssetRegister |
| **Transactions** | Transaction management | TransactionTable, PendingCategorizationReview |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React 19)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │   Auth  │ │  Trans  │ │Accounts │ │   BAS   │  ...      │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
│       │           │           │           │                 │
│       └───────────┴───────────┴───────────┘                 │
│                       │                                     │
│               ┌───────┴───────┐                            │
│               │    api.ts     │                            │
│               │ (55 methods)  │                            │
│               └───────┬───────┘                            │
└───────────────────────┼─────────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────┼─────────────────────────────────────┐
│                       │                                     │
│               ┌───────┴───────┐                            │
│               │   Hono.js    │                             │
│               │  (65 routes) │                             │
│               └───────┬───────┘                            │
│                       │                                     │
│       ┌───────────────┼───────────────┐                    │
│       │               │               │                    │
│  ┌────┴────┐    ┌─────┴─────┐   ┌─────┴─────┐             │
│  │Pipeline │    │    AI     │   │   BAS/Tax  │             │
│  │ Service │    │  Service  │   │  Services  │             │
│  └────┬────┘    └─────┬─────┘   └─────┬─────┘             │
│       │               │               │                    │
│       │         ┌─────┴─────┐         │                    │
│       │         │ OpenRouter│         │                    │
│       │         │    API    │         │                    │
│       │         └───────────┘         │                    │
│       │                               │                    │
│       └───────────────┬───────────────┘                    │
│                       │                                     │
│               ┌───────┴───────┐                            │
│               │   SQLite DB   │                            │
│               │  (30+ tables) │                            │
│               └───────────────┘                            │
│                    Server (Hono.js)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
docs/cartography/
├── README.md                    # This file
├── MASTER_REGISTRY.md           # Central registry of all elements
├── raw/                         # Machine-readable JSON data
│   ├── database-schema.json
│   ├── backend-routes.json
│   ├── api-calls.json
│   ├── ui-elements.json
│   ├── icons.json
│   ├── state-management.json
│   ├── functions.json
│   ├── configuration.json
│   └── actions.json
├── diagrams/                    # Mermaid architecture diagrams
│   ├── architecture-master.md
│   └── data-flow.md
├── indexes/                     # Searchable indexes
│   ├── by-element-type.md
│   ├── by-file.md
│   ├── by-api-endpoint.md
│   ├── by-database-table.md
│   └── by-feature.md
└── line-tracking/               # Critical file documentation
    ├── schema.md
    ├── api.md
    ├── App.md
    ├── index.md
    └── TransactionTable.md
```

---

## Generated

- **Date**: 2026-01-29
- **Total Elements Documented**: 500+
- **Files Analyzed**: 82
