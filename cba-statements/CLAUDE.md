# CBA Statements Parse - AI-Powered Bank Statement Parser

## Project Overview
AI-powered CBA bank statement parser and expense categorizer for Australian personal finance management. Built by Verridian AI.

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM, SQLite
- **AI**: OpenAI API for transaction categorization with fallback to rule-based matching
- **PDF Parsing**: pdf-parse, pdf-lib for extraction and viewing
- **Authentication**: NextAuth.js with Google OAuth (for Gmail integration)
- **Email**: Gmail API for statement auto-import
- **Invoicing**: PDF generation with @react-pdf/renderer
- **Testing**: Jest, React Testing Library, Playwright

## Architecture Principles
- Privacy-first: No bank credential sharing, PDF upload only
- Offline-capable: Local SQLite database, works without internet for core features
- Australian-focused: GST compliance, ATO categories, Australian FY (July-June)
- Self-hosted: No dependency on third-party services for core functionality

## Agent Team Guidelines
When working as part of the agent team:
1. Each agent owns their feature domain - coordinate via the task list
2. Use `src/` directory structure consistently
3. All new API routes go in `src/app/api/`
4. All new UI components go in `src/components/`
5. Share types via `src/types/`
6. Share utilities via `src/lib/`
7. Database schema changes go through Prisma migrations
8. Write tests for all new features
9. Use Australian English in user-facing text
10. All financial amounts in AUD, formatted with 2 decimal places

## Directory Structure
```
src/
├── app/                  # Next.js App Router
│   ├── api/              # API routes
│   │   ├── parse/        # PDF parsing endpoints
│   │   ├── transactions/ # Transaction CRUD
│   │   ├── invoices/     # Invoicing system
│   │   ├── gmail/        # Gmail integration
│   │   └── categories/   # Category management
│   ├── dashboard/        # Main dashboard
│   ├── statements/       # Statement management
│   ├── invoices/         # Invoice views
│   ├── verify/           # PDF verification
│   └── settings/         # App settings
├── components/           # React components
│   ├── ui/               # shadcn/ui components
│   ├── parsing/          # Parsing progress UI
│   ├── pdf-viewer/       # PDF viewer components
│   ├── invoices/         # Invoice components
│   └── gmail/            # Gmail integration UI
├── lib/                  # Shared utilities
│   ├── parsers/          # Bank-specific parsers
│   ├── categorization/   # AI + rule-based categorization
│   ├── gmail/            # Gmail API client
│   ├── invoicing/        # Invoice generation
│   └── db/               # Database utilities
├── types/                # TypeScript type definitions
└── prisma/               # Database schema
```

## Key Conventions
- Use `zod` for all input validation
- Use `react-query` for data fetching
- Use `zustand` for client-side state management
- Error boundaries on all page-level components
- Structured logging with `pino`
- All monetary values stored as integers (cents) in the database
