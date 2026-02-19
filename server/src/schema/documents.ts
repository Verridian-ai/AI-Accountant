import { pgTable, text, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

// NOTE: .references() to users/accounts/transactions omitted until core.ts and banking.ts
// migrate to pgTable (TASK-045/046). DB-level FK constraints remain intact in SQL migrations.

// ============================================================================
// AI OCR DOCUMENT PROCESSING & PAYMENT MATCHING (Wave 14)
// ============================================================================

export const ocrDocuments = pgTable('ocr_documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  accountId: text('account_id'), // FK → accounts(id) SET NULL
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  documentType: text('document_type'),
  documentNumber: text('document_number'),
  vendorName: text('vendor_name'),
  vendorAbn: text('vendor_abn'),
  documentDate: text('document_date'),
  dueDate: text('due_date'),
  subtotal: integer('subtotal'),
  gstAmount: integer('gst_amount'),
  totalAmount: integer('total_amount'),
  currency: text('currency').default('AUD'),
  extractedData: text('extracted_data'),
  confidenceScore: doublePrecision('confidence_score').default(0),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  processedAt: text('processed_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const ocrLineItems = pgTable('ocr_line_items', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(), // FK → ocr_documents(id) CASCADE
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  quantity: doublePrecision('quantity').default(1),
  unitPrice: integer('unit_price'),
  amount: integer('amount').notNull(),
  gstAmount: integer('gst_amount').default(0),
  gstInclusive: integer('gst_inclusive').default(1),
  category: text('category'),
  accountCode: text('account_code'),
  confidenceScore: doublePrecision('confidence_score').default(0),
});

export const paymentMatchRules = pgTable('payment_match_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(),
  vendorPattern: text('vendor_pattern'),
  amountExact: integer('amount_exact'),
  amountMin: integer('amount_min'),
  amountMax: integer('amount_max'),
  amountTolerance: integer('amount_tolerance').default(1),
  dateToleranceDays: integer('date_tolerance_days').default(7),
  categoryFilter: text('category_filter'),
  priority: integer('priority').default(100),
  isActive: boolean('is_active').default(true),
  matchCount: integer('match_count').default(0),
  lastMatchedAt: text('last_matched_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const paymentMatches = pgTable('payment_matches', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(), // FK → ocr_documents(id) CASCADE
  transactionId: text('transaction_id').notNull(), // FK → transactions(id) CASCADE
  ruleId: text('rule_id'), // FK → payment_match_rules(id) SET NULL
  matchScore: doublePrecision('match_score').notNull(),
  matchMethod: text('match_method').notNull(),
  amountDifference: integer('amount_difference').default(0),
  dateDifference: integer('date_difference').default(0),
  status: text('status').notNull().default('suggested'),
  confirmedBy: text('confirmed_by'),
  confirmedAt: text('confirmed_at'),
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const documentQueue = pgTable('document_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  documentId: text('document_id').notNull(), // FK → ocr_documents(id) CASCADE
  action: text('action').notNull(),
  priority: integer('priority').default(100),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  errorMessage: text('error_message'),
  scheduledAt: text('scheduled_at').default('CURRENT_TIMESTAMP'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});
