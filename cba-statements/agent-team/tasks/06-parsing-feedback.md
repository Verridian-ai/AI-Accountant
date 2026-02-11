# Agent 6: Parsing Feedback - Task Specification

## Overview
Build real-time parsing progress with Server-Sent Events (SSE).

## Parsing Pipeline Stages
1. `upload` - File received, validating
2. `extracting` - Extracting text from PDF
3. `detecting` - Detecting bank format
4. `parsing` - Parsing transaction lines
5. `categorizing` - AI categorization
6. `validating` - Cross-checking totals
7. `complete` - Done
8. `error` - Failed with details

## SSE Event Format
```typescript
interface ParseProgress {
  jobId: string;
  stage: string;
  stageNumber: number;
  totalStages: number;
  progress: number; // 0-100
  message: string;
  transactionsFound: number;
  bankDetected: string | null;
  bankConfidence: number; // 0-1
  categoryConfidence: number; // avg 0-1
  warnings: string[];
  errors: string[];
  estimatedTimeRemaining: number | null; // seconds
  startedAt: string;
}
```

## API
- `POST /api/parse` - Start parsing job, returns jobId
- `GET /api/parse/progress/:jobId` - SSE endpoint for live progress

## UI Component
Build `<ParsingProgress jobId={id} />` component that shows:
- Stage progress bar with labeled steps
- Transaction counter (animated increment)
- Bank detection badge with confidence
- Warning/error list
- Time remaining estimate
- Cancel button
