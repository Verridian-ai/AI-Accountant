# Agent 7: PDF Viewer & Verification - Task Specification

## Overview
In-browser PDF viewer with side-by-side verification workflow.

## Architecture
- Use `pdfjs-dist` (Mozilla's PDF.js) for rendering
- Split-pane layout: PDF left (60%), transactions right (40%)
- Resizable divider between panes

## Verification Workflow
1. User opens a parsed statement
2. PDF renders on left, parsed transactions on right
3. Each PDF line maps to a transaction row (or "unmatched")
4. User clicks through each transaction to verify
5. Matched lines highlighted green, unmatched red, uncertain yellow
6. User can manually add missing transactions
7. User can correct amounts/descriptions
8. "Mark as Verified" button when satisfied
9. Verification status persists on the statement

## Database Schema
```prisma
model StatementVerification {
  id            String   @id @default(cuid())
  statementId   String   @unique
  status        String   @default("unverified") // unverified, in_progress, verified
  totalLines    Int
  matchedLines  Int
  unmatchedLines Int
  addedManually Int      @default(0)
  verifiedAt    DateTime?
  verifiedBy    String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## API Routes
- `GET /api/statements/:id/pdf` - Serve original PDF
- `GET /api/statements/:id/verify` - Get verification status
- `POST /api/statements/:id/verify` - Update verification
- `POST /api/statements/:id/transactions/manual` - Add manual transaction

## UI Components
- `<PdfViewer url={pdfUrl} onPageChange={} />` - PDF renderer
- `<VerificationPanel statementId={id} />` - Transaction checklist
- `<SideBySideLayout />` - Split pane container
- `<TransactionMatcher />` - Line matching UI
- `<VerificationSummary />` - Coverage stats (e.g., "47/50 lines matched - 94%")
