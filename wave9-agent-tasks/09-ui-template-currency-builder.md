# Agent 9: UI Template & Currency Builder

## Role
Build invoice template editor, currency selector, exchange rate manager, and logo uploader UI components.

## Priority: WAVE 9 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/invoicing/components/InvoiceTemplateEditor.tsx`
**Purpose**: WYSIWYG invoice template customization with live preview
**Pattern**: Follow form patterns from `client/src/features/invoicing/components/InvoiceEditor.tsx` (if exists from Wave 7)

**Features**:
- [ ] Template name input
- [ ] Header HTML editor (textarea or rich text)
- [ ] Footer HTML editor (textarea or rich text)
- [ ] Color scheme picker: primary, secondary, accent, background colors
  - Use color input elements or preset palettes
- [ ] Default template toggle
- [ ] Live preview panel showing how the invoice will look with current settings
- [ ] Save and Cancel buttons
- [ ] Template list with select/edit/delete actions

**API calls**:
```typescript
export const fetchInvoiceTemplates = async () => {
  const res = await fetch(`${BASE_URL}/api/invoice-templates`);
  return res.json();
};

export const createInvoiceTemplate = async (data: CreateTemplateInput) => {
  const res = await fetch(`${BASE_URL}/api/invoice-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateInvoiceTemplate = async (id: string, data: UpdateTemplateInput) => {
  const res = await fetch(`${BASE_URL}/api/invoice-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};
```

### 2. `client/src/features/invoicing/components/MultiCurrencySelector.tsx`
**Purpose**: Currency picker component for use in invoice creation
**Pattern**: Follow dropdown/select patterns from existing components

**Features**:
- [ ] Dropdown listing all active currencies (code + name + symbol)
- [ ] Search/filter support for quick currency finding
- [ ] Selected currency displays: symbol, code, and name
- [ ] Exchange rate preview when non-AUD currency selected
- [ ] Reusable component — accepts `value`, `onChange`, `disabled` props

**Props interface**:
```typescript
interface MultiCurrencySelectorProps {
  value: string;         // ISO currency code
  onChange: (code: string) => void;
  disabled?: boolean;
  showRate?: boolean;    // Show exchange rate to AUD
  label?: string;
}
```

### 3. `client/src/features/invoicing/components/ExchangeRateManager.tsx`
**Purpose**: Exchange rate dashboard with manual entry and API refresh
**Pattern**: Follow CRUD table patterns from existing admin components

**Features**:
- [ ] Current rates table: from → to, rate, effective date, source (manual/api)
- [ ] Filter by currency pair
- [ ] Manual rate entry form: from, to, rate, effective date
- [ ] "Refresh from API" button with loading state
- [ ] Historical rates chart for selected pair (simple line chart)
- [ ] Last refresh timestamp display

**API calls**:
```typescript
export const fetchExchangeRate = async (from: string, to: string, date?: string) => {
  const params = date ? `?date=${date}` : '';
  const res = await fetch(`${BASE_URL}/api/exchange-rates/${from}/${to}${params}`);
  return res.json();
};

export const refreshExchangeRates = async (baseCurrency?: string) => {
  const res = await fetch(`${BASE_URL}/api/exchange-rates/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseCurrency }),
  });
  return res.json();
};
```

### 4. `client/src/features/invoicing/components/LogoUploader.tsx`
**Purpose**: Logo upload component with preview and resize indication
**Pattern**: Follow file upload patterns from `client/src/features/documents/components/DocumentUpload.tsx` (if exists from Wave 14)

**Features**:
- [ ] Drag-and-drop zone for logo file
- [ ] File input as fallback
- [ ] Image preview after selection (before upload)
- [ ] File type validation: PNG, JPG, SVG only
- [ ] File size validation: max 2MB
- [ ] Upload progress indicator
- [ ] Current logo display with "Remove" option
- [ ] Accepts `templateId` prop for upload target

**API calls**:
```typescript
export const uploadTemplateLogo = async (templateId: string, file: File) => {
  const formData = new FormData();
  formData.append('logo', file);
  const res = await fetch(`${BASE_URL}/api/invoice-templates/${templateId}/logo`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
};
```

## Files to MODIFY

### 5. `client/src/api.ts`
**Purpose**: Add API functions for templates, currencies, exchange rates, and logo upload
- [ ] Add `fetchInvoiceTemplates()`, `createInvoiceTemplate()`, `updateInvoiceTemplate()`
- [ ] Add `fetchCurrencies()`, `fetchExchangeRate()`, `refreshExchangeRates()`
- [ ] Add `uploadTemplateLogo()`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] InvoiceTemplateEditor saves and loads templates correctly
- [ ] Color scheme picker updates live preview
- [ ] MultiCurrencySelector shows all active currencies with search filter
- [ ] ExchangeRateManager displays rates and supports manual entry
- [ ] LogoUploader handles drag-and-drop and validates file type/size
- [ ] All components use neumorphic dark theme styling
- [ ] Create marker file: `.agent-done-W09-09`

## Dependencies
- **Agent 7** must complete API endpoints
- **Agent 8** must complete api.ts modifications first (to avoid merge conflicts)
