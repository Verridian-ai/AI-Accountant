# Agent 4: Invoice Template Service

## Role
Build the invoice template service with logo upload, HTML rendering, color scheme management, and PDF generation support.

## Priority: WAVE 9 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/invoice-templates.ts`
**Purpose**: Invoice template management with branding customization
**Pattern**: Follow `server/src/services/ocr-processing.ts` for file upload handling

**Class**: `InvoiceTemplateService`

**Methods**:

- [ ] `listTemplates(userId: string): Promise<InvoiceTemplate[]>`
  - Return all templates for user, sorted by isDefault DESC, name ASC
  - Include logo URL if logoPath exists

- [ ] `createTemplate(userId: string, data: CreateTemplateInput): Promise<InvoiceTemplate>`
  - Create new template with name, headerHtml, footerHtml, colorScheme
  - If isDefault=true, set all other user templates to isDefault=false first
  - Generate UUID for id
  - Validate colorScheme JSON structure if provided

- [ ] `updateTemplate(templateId: string, data: UpdateTemplateInput): Promise<InvoiceTemplate>`
  - Partial update — only provided fields are changed
  - If setting isDefault=true, unset other defaults first
  - Validate template belongs to user

- [ ] `uploadLogo(templateId: string, file: File): Promise<{ logoPath: string }>`
  - Accept image file (PNG, JPG, SVG — max 2MB)
  - Save to `server/uploads/logos/{templateId}.{ext}`
  - Resize to max 400x200px if larger (use sharp or canvas if available, otherwise store as-is)
  - Update template.logoPath
  - Return the relative path for serving

- [ ] `getDefaultTemplate(userId: string): Promise<InvoiceTemplate | null>`
  - Return the user's default template, or null if none set

- [ ] `renderInvoiceHTML(invoiceId: string, templateId?: string): Promise<string>`
  - Combine template (header, footer, colors) with invoice data
  - If no templateId, use user's default template
  - If no default, use built-in minimal template
  - Return complete HTML string suitable for PDF generation
  - Include: logo, business details, customer details, line items table, totals, payment terms

- [ ] `deleteTemplate(templateId: string): Promise<void>`
  - Soft-delete or hard-delete template
  - Remove logo file if exists
  - Cannot delete if it's the only template and isDefault

**Interfaces**:

```typescript
interface CreateTemplateInput {
  name: string;
  logoPath?: string;
  headerHtml?: string;
  footerHtml?: string;
  colorScheme?: {
    primary: string;    // hex color for header/accents
    secondary: string;  // hex color for secondary elements
    accent: string;     // hex color for call-to-action
    background: string; // hex color for page background
  };
  isDefault?: boolean;
}

interface UpdateTemplateInput {
  name?: string;
  headerHtml?: string;
  footerHtml?: string;
  colorScheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };
  isDefault?: boolean;
}
```

**Implementation notes**:
- Logo upload uses Node.js `fs.writeFile` to save to uploads directory
- Upload directory: `server/uploads/logos/` — create if not exists
- Validate file type by checking magic bytes or file extension
- Default built-in template uses GoldLedger gold (#FFCC00) accent
- Template HTML uses inline CSS for PDF compatibility (no external stylesheets)
- `renderInvoiceHTML` queries the invoice, customer, business profile, and line items

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Template CRUD works with proper isDefault toggle logic
- [ ] Logo upload saves file and updates template.logoPath
- [ ] File type validation rejects non-image files
- [ ] `renderInvoiceHTML` produces valid HTML with all invoice fields
- [ ] Create marker file: `.agent-done-W09-04`

## Dependencies
- **Agent 1** must complete schema (invoice_templates table)
- **Runtime dependency**: Requires `invoices`, `invoice_lines`, `customers`, `business_profiles` tables
