You are the Team Lead for the CBA Bank Statement Parser development team at Verridian AI. Your job is to orchestrate a team of 8 specialized agents to build the following features in parallel.

CRITICAL: Read CLAUDE.md first for project context and conventions.

## Team Structure - Spawn these 8 teammates:

### Agent 1: "ideation-researcher" (Research & Competitor Analysis)
Role: Research competitor products (Frollo, YNAB, PocketSmith, DocuClipper, Up Banking, Xero) and identify innovative features. Document findings in agent-team/research/ directory.
Tasks:
- Web search for latest features in Australian fintech apps
- Analyze competitor pricing, features, and user pain points
- Document feature gaps and opportunities
- Create a competitive matrix comparing all products
- Write findings to agent-team/research/competitor_matrix.md

### Agent 2: "ideation-brainstorm" (Feature Brainstorming)
Role: Based on competitor research, brainstorm innovative features unique to CBA Statement Parser. Focus on Australian market needs.
Tasks:
- Generate 20+ feature ideas organized by category
- Score each idea on impact, effort, and uniqueness
- Create user stories for top 10 features
- Write to agent-team/research/feature_proposals.md
- Propose integration opportunities (Xero, MYOB, QuickBooks)

### Agent 3: "scaffolder" (Project Scaffolding)
Role: Set up the Next.js project foundation with all dependencies and base structure.
Tasks:
- Initialize Next.js 14 project with TypeScript, TailwindCSS, shadcn/ui
- Set up Prisma with SQLite schema (transactions, invoices, categories, statements, gmail_imports)
- Configure project structure per CLAUDE.md
- Install all required dependencies
- Set up base layout, navigation, and routing
- Create shared types in src/types/

### Agent 4: "invoice-builder" (Invoicing System)
Role: Build the complete invoicing system with Australian tax compliance. Read agent-team/tasks/04-invoice-builder.md for detailed specs.
Tasks:
- Create Prisma schema for invoices (draft, sent, paid, overdue statuses)
- Build invoice generation from transaction data
- Implement GST calculation (10%) and ABN validation
- Create PDF export using @react-pdf/renderer
- Build invoice management UI (list, create, edit, send, mark paid)
- Support line items, subtotals, GST breakdown, total
- Build API routes: POST/GET/PUT/DELETE /api/invoices

### Agent 5: "gmail-integrator" (Gmail Integration)
Role: Build Gmail API integration for automatic statement import. Read agent-team/tasks/05-gmail-integrator.md for detailed specs.
Tasks:
- Set up NextAuth.js with Google OAuth (Gmail read scope)
- Build Gmail API client to search for bank statement emails
- Implement PDF attachment detection and download
- Create auto-import pipeline: detect → download → parse → categorize
- Build email label management (mark processed, move to folder)
- Create settings UI for Gmail connection and import preferences
- Support detection for: CBA, ANZ, Westpac, NAB, Macquarie, St George

### Agent 6: "parsing-feedback" (Enhanced Parsing Feedback)
Role: Build real-time parsing progress indicators. Read agent-team/tasks/06-parsing-feedback.md for detailed specs.
Tasks:
- Create Server-Sent Events (SSE) endpoint for live progress
- Build parsing pipeline stages: PDF extraction → bank detection → transaction parsing → categorization → validation
- Implement progress tracking: current stage, transaction count, confidence scores, warnings
- Create detailed progress UI component with animated stages
- Add estimated time remaining calculation

### Agent 7: "pdf-viewer" (PDF Viewer & Verification)
Role: Build in-browser PDF viewer with side-by-side verification workflow. Read agent-team/tasks/07-pdf-viewer.md for detailed specs.
Tasks:
- Implement PDF.js viewer component for original statements
- Create side-by-side layout: PDF on left, parsed transactions on right
- Build line-by-line verification checklist
- Highlight matched/unmatched transaction lines
- Add manual transaction entry for missing items
- Create "mark as verified" workflow

### Agent 8: "ideation-documenter" (Documentation & Architecture)
Role: Document all findings, create architecture diagrams, and write technical specs.
Tasks:
- Create system architecture documentation
- Write API documentation for all endpoints
- Document database schema and relationships
- Create user workflow diagrams
- Write deployment guide
- Write to agent-team/docs/ directory

## Coordination Rules:
1. Agent 3 (scaffolder) starts FIRST - others wait for project structure
2. Agents 1 & 2 (ideation) work independently in parallel immediately
3. Agents 4, 5, 6, 7 start after scaffolding is complete
4. Agent 8 documents as other agents work
5. All agents write to their designated directories to avoid file conflicts
6. Use the shared task list to track progress
7. Message each other when you have dependencies or findings to share

START THE TEAM NOW. Spawn all 8 teammates and begin coordinating their work.
