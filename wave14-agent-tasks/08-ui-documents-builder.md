# Agent 8: UI Documents Builder

## Role
Build 5 React components for the OCR document processing feature: dashboard, upload area, document viewer, line item editor, and processing queue.

## Priority: WAVE 14 (After Agent 7 completes API routes)

## Wait Condition
Check for `.agent-done-W14-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Table, Progress)
- Icons: lucide-react (FileUp, FileText, Eye, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Trash2)
- Existing pattern: `client/src/features/statements/` (file upload + processing)
- API layer: `client/src/api.ts` -- add new `documentsApi` object
- No `documents/` feature folder exists yet -- must create it

## Files to MODIFY

### 1. `client/src/api.ts`
- [ ] Add TypeScript interfaces:
```typescript
export interface OCRDocument {
  id: string; userId: string; accountId?: string;
  fileName: string; filePath: string; fileSize: number; mimeType: string;
  documentType: string; documentNumber?: string;
  vendorName?: string; vendorAbn?: string;
  documentDate?: string; dueDate?: string;
  subtotal?: number; gstAmount?: number; totalAmount?: number; currency: string;
  extractedData?: any; confidenceScore: number;
  status: string; errorMessage?: string;
  processedAt?: string; createdAt: string;
}
export interface OCRLineItem {
  id: string; documentId: string; lineNumber: number;
  description: string; quantity: number; unitPrice?: number;
  amount: number; gstAmount: number; gstInclusive: boolean;
  category?: string; accountCode?: string; confidenceScore: number;
}
```

- [ ] Add `documentsApi` object:
```typescript
export const documentsApi = {
  upload: (file: File, userId?: string, accountId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId ?? 'default');
    if (accountId) formData.append('accountId', accountId);
    return fetch(`${API_URL}/documents/upload`, { method: 'POST', headers: getAuthHeaders(), body: formData }).then(r => r.json());
  },
  process: (id: string) =>
    fetch(`${API_URL}/documents/${id}/process`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),
  classify: (id: string) =>
    fetch(`${API_URL}/documents/${id}/classify`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),
  getLineItems: (id: string) =>
    fetch(`${API_URL}/documents/${id}/line-items`, { headers: getAuthHeaders() }).then(r => r.json()),
  list: (status?: string, documentType?: string) =>
    fetch(`${API_URL}/documents?userId=default${status ? `&status=${status}` : ''}${documentType ? `&documentType=${documentType}` : ''}`, { headers: getAuthHeaders() }).then(r => r.json()),
  get: (id: string) =>
    fetch(`${API_URL}/documents/${id}`, { headers: getAuthHeaders() }).then(r => r.json()),
  delete: (id: string) =>
    fetch(`${API_URL}/documents/${id}`, { method: 'DELETE', headers: getAuthHeaders() }).then(r => r.json()),
  batchProcess: (documentIds: string[]) =>
    fetch(`${API_URL}/documents/batch-process`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'default', documentIds }) }).then(r => r.json()),
};
```

### 2. `client/src/App.tsx`
- [ ] Add import: `import { DocumentsDashboard } from './features/documents/components/DocumentsDashboard';`
- [ ] Add "Documents" tab to navigation (use FileText icon from lucide-react)
- [ ] Add route rendering `<DocumentsDashboard />` when Documents tab is active

## Files to CREATE

### 3. `client/src/features/documents/components/DocumentsDashboard.tsx`
**Purpose**: Main dashboard for document management with tabs
- [ ] Tabs: All Documents | Upload | Processing Queue
- [ ] Status filter bar: All | Pending | Processing | Extracted | Verified | Matched | Failed
- [ ] Document type filter: All | Invoice | Receipt | Bill | Credit Note | Statement
- [ ] Sort options: Date (newest first), Vendor, Amount, Status
- [ ] Summary stats at top: Total Documents | Pending OCR | Extracted | Matched
- [ ] Click document to open DocumentViewer

### 4. `client/src/features/documents/components/DocumentUpload.tsx`
**Purpose**: Drag-and-drop file upload area with batch support
- [ ] Drag-and-drop zone with dashed border (matches existing statement upload style)
- [ ] File type validation: PDF, PNG, JPG, WEBP only
- [ ] File size validation: max 10MB per file, warning above 5MB
- [ ] Multi-file support: drag multiple files or click to select
- [ ] Upload progress indicator per file (Progress component)
- [ ] Auto-process toggle: immediately start OCR after upload
- [ ] Account selector dropdown: associate uploads with specific accounts
- [ ] Upload queue showing: filename, size, status (uploading/processing/done/error), confidence score
- [ ] "Process All" button for batch processing
- [ ] Error display for failed uploads with retry button

### 5. `client/src/features/documents/components/DocumentViewer.tsx`
**Purpose**: View document details and extracted data side-by-side
- [ ] Props: `{ documentId: string, onBack: () => void }`
- [ ] Two-column layout:
  - Left: Document metadata (type badge, vendor, ABN, dates, amounts, confidence)
  - Right: Extracted data JSON viewer (collapsible sections)
- [ ] Status badge with color: pending (gray), processing (blue pulse), extracted (green), matched (gold), failed (red)
- [ ] Confidence score as progress bar: <50% red, 50-80% amber, >80% green
- [ ] Action buttons: "Re-process", "Find Matches", "Delete"
- [ ] GST summary: Subtotal + GST = Total (with validation check mark)
- [ ] Vendor info card: name, ABN (with ABN lookup link if present)
- [ ] Line items table (renders LineItemEditor component)

### 6. `client/src/features/documents/components/LineItemEditor.tsx`
**Purpose**: View and edit extracted line items with category mapping
- [ ] Props: `{ documentId: string, readOnly?: boolean }`
- [ ] Fetch line items via `documentsApi.getLineItems(documentId)`
- [ ] Table: # | Description | Qty | Unit Price | Amount | GST | Category | Confidence
- [ ] Category column: dropdown populated from categories.ts constants
- [ ] Inline editing: click cell to edit description, qty, unit price, amount
- [ ] Auto-calculate: Qty x Unit Price = Amount (recalculate on edit)
- [ ] GST indicator: green tick if GST-inclusive, gray dash if not
- [ ] Confidence per line: color-coded badge (<50% red, 50-80% amber, >80% green)
- [ ] Total row: sum of all line item amounts
- [ ] Validation row: "Items sum: $X | Document subtotal: $Y | Difference: $Z"
- [ ] Flag mismatches between sum and document subtotal in red

### 7. `client/src/features/documents/components/ProcessingQueue.tsx`
**Purpose**: View and manage the document processing queue
- [ ] Fetch documents with status 'pending' or 'processing'
- [ ] Table: Document Name | Type | Status | Attempts | Scheduled | Actions
- [ ] Status indicators: queued (clock icon), processing (spinner), completed (check), failed (X)
- [ ] Retry button for failed documents
- [ ] Cancel button for queued documents
- [ ] Auto-refresh every 5 seconds (polling interval)
- [ ] Batch action buttons: "Process All Pending", "Retry All Failed", "Clear Completed"
- [ ] Progress summary bar: X queued, Y processing, Z completed, W failed

## Component Pattern:
```tsx
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileUp, FileText, Eye, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { documentsApi } from '@/api';
import type { OCRDocument } from '@/api';

export function DocumentsDashboard() {
    const [documents, setDocuments] = useState<OCRDocument[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const data = await documentsApi.list(statusFilter || undefined);
            setDocuments(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => { loadDocuments(); }, [loadDocuments]);
    // ... render
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 5 components render without errors
- [ ] Navigation to Documents tab works
- [ ] File upload works: drag-and-drop + click-to-select
- [ ] Document viewer shows extracted data correctly
- [ ] Line item editor allows category mapping
- [ ] Processing queue auto-refreshes
- [ ] Neumorphic styling matches existing components (dark theme, gold #FFCC00 accents, neu-raised/neu-inset classes)
- [ ] Create marker file: `.agent-done-W14-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W14-07`) -- API routes must exist
- **IMPORTANT**: Only this agent creates files in `client/src/features/documents/`
- **Coordinate with**: Agent 9 on client/src/App.tsx and client/src/api.ts modifications
