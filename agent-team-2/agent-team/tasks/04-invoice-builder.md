# Agent 4: Invoice Builder - Task Specification

## Overview
Build a complete invoicing system integrated with the CBA Statement Parser that supports Australian tax compliance.

## Database Schema (Prisma)
```prisma
model Invoice {
  id            String   @id @default(cuid())
  invoiceNumber String   @unique
  status        String   @default("draft") // draft, sent, paid, overdue, cancelled
  clientName    String
  clientEmail   String?
  clientAddress String?
  clientABN     String?
  issuerName    String
  issuerABN     String?
  issuerAddress String?
  subtotalCents Int
  gstCents      Int
  totalCents    Int
  issueDate     DateTime @default(now())
  dueDate       DateTime
  paidDate      DateTime?
  lineItems     InvoiceLineItem[]
  notes         String?
  paymentTerms  String?  @default("Net 30")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model InvoiceLineItem {
  id          String  @id @default(cuid())
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description String
  quantity    Float   @default(1)
  unitPrice   Int     // cents
  totalCents  Int
  gstIncluded Boolean @default(true)
  category    String?
}
```

## API Routes
- `POST /api/invoices` - Create invoice
- `GET /api/invoices` - List with filters (status, date range)
- `GET /api/invoices/:id` - Get single invoice
- `PUT /api/invoices/:id` - Update invoice
- `POST /api/invoices/:id/send` - Mark as sent
- `POST /api/invoices/:id/paid` - Mark as paid
- `GET /api/invoices/:id/pdf` - Generate PDF

## GST Rules (Australian)
- Standard GST rate: 10%
- GST-inclusive: GST = price / 11
- GST-exclusive: GST = price * 0.10
- ABN: 11 digits with checksum validation
- Tax Invoice requirements: ABN, GST amounts, "Tax Invoice" header
