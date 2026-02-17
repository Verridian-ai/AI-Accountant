# Agent 5: Gmail Integration - Task Specification

## Overview
Build Gmail API integration that auto-detects and imports bank statement PDFs.

## OAuth Setup (NextAuth.js)
- Provider: Google
- Scopes: `gmail.readonly`, `gmail.modify` (for labels)
- Store refresh tokens in database
- Support token refresh flow

## Gmail Search Queries
```
from:(commbank.com.au OR westpac.com.au OR anz.com.au OR nab.com.au OR macquarie.com.au OR stgeorge.com.au)
has:attachment filename:pdf
subject:(statement OR "account summary" OR "transaction history")
```

## Import Pipeline
1. Connect Gmail via OAuth → store tokens
2. Search for bank statement emails using above queries
3. Filter to unprocessed emails (check against import log)
4. Download PDF attachments
5. Detect bank from email sender domain
6. Trigger parsing pipeline for each PDF
7. Label email as "CBA-Parsed" in Gmail
8. Log import result (success/failure/duplicate)

## Database Schema
```prisma
model GmailImport {
  id          String   @id @default(cuid())
  messageId   String   @unique  // Gmail message ID
  threadId    String
  subject     String
  sender      String
  receivedAt  DateTime
  bank        String?           // detected bank
  status      String   @default("pending") // pending, processing, completed, failed, duplicate
  statementId String?           // link to parsed statement
  error       String?
  createdAt   DateTime @default(now())
}

model GmailSettings {
  id           String   @id @default(cuid())
  userId       String   @unique
  accessToken  String
  refreshToken String
  expiresAt    DateTime
  autoImport   Boolean  @default(false)
  importFreq   String   @default("daily") // hourly, daily, weekly, manual
  lastImportAt DateTime?
  bankFilters  String?  // JSON array of enabled banks
}
```

## API Routes
- `POST /api/gmail/connect` - Start OAuth flow
- `GET /api/gmail/callback` - OAuth callback
- `POST /api/gmail/search` - Search for statements
- `POST /api/gmail/import` - Import selected emails
- `POST /api/gmail/auto-import` - Run auto-import
- `GET /api/gmail/history` - Import history log
- `DELETE /api/gmail/disconnect` - Remove Gmail connection

## UI Components
- Gmail connection button with status indicator
- Bank filter checkboxes (CBA, ANZ, Westpac, NAB, etc.)
- Import frequency selector
- Import history table with status badges
- Manual import trigger button
