/**
 * OCR Processing Agent
 *
 * Australian document processing agent using Claude. Extracts, classifies,
 * and validates financial documents (invoices, receipts, bills, credit notes).
 * Handles ABN (11 digits), GST (10%), AUD currency.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { OCRProcessingService } from '../../ocr-processing.js';
import { db, ocrDocuments, ocrLineItems } from '../../../schema.js';
import { eq, asc } from 'drizzle-orm';
import type { OCRProcessingInput, OCRProcessingOutput } from '../types.js';

const ocrService = new OCRProcessingService();

export class OCRProcessingAgent extends ClaudeAgent<
  OCRProcessingInput,
  OCRProcessingOutput
> {
  protected systemPrompt = `You are an expert document processing agent for an Australian small business accounting platform.
You extract, classify, and validate financial documents including invoices, receipts, bills, and credit notes.

Key responsibilities:
- Extract all financial data from documents with high accuracy
- Classify documents into correct types (invoice, receipt, bill, etc.)
- Extract individual line items with descriptions, quantities, and amounts
- Validate extracted data for consistency (line items sum to subtotal, subtotal + GST = total)
- Identify and flag potential extraction errors or inconsistencies
- Handle Australian-specific formats: ABN (11 digits), GST (10%), AUD currency
- Recognize common Australian vendors and their document formats

Quality rules:
- Always validate GST: if GST-registered (ABN present), GST should be ~10% of subtotal
- Line items should sum to subtotal within $0.01 tolerance
- Dates should be in YYYY-MM-DD format
- ABN format: XX XXX XXX XXX (11 digits, may appear with or without spaces)

Analyze the input thoroughly using the available tools, then return a JSON object matching the OCRProcessingOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'extract_document_data',
      description: 'Extract all financial data from an uploaded document using Vision API. Returns full extraction result with document metadata, amounts, vendor info, and line items.',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: { type: 'string', description: 'The UUID of the document to extract data from' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'classify_document',
      description: 'Classify a document into a specific financial document type (invoice, receipt, bill, credit_note, statement, quote, purchase_order).',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: { type: 'string', description: 'The UUID of the document to classify' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'extract_line_items',
      description: 'Extract and categorize individual line items from a document. Returns array of line items with descriptions, amounts, GST, and category mappings.',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: { type: 'string', description: 'The UUID of the document to extract line items from' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'validate_extraction',
      description: 'Validate extracted data for mathematical consistency and completeness. Checks line item sums, GST calculations, totals, date validity, ABN format, and required fields.',
      input_schema: {
        type: 'object' as const,
        properties: {
          documentId: { type: 'string', description: 'The UUID of the document to validate' },
        },
        required: ['documentId'],
      },
    },
  ];

  protected toolHandlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<unknown>
  >([
    [
      'extract_document_data',
      async (input) => {
        const documentId = input.documentId as string;
        return await ocrService.processDocument(documentId);
      },
    ],
    [
      'classify_document',
      async (input) => {
        const documentId = input.documentId as string;
        const classification = await ocrService.classifyDocument(documentId);
        return { documentId, classification };
      },
    ],
    [
      'extract_line_items',
      async (input) => {
        const documentId = input.documentId as string;
        return await ocrService.extractLineItems(documentId);
      },
    ],
    [
      'validate_extraction',
      async (input) => {
        const documentId = input.documentId as string;
        return await validateExtraction(documentId);
      },
    ],
  ]);

  constructor() {
    super('ocr_processing');
  }
}

// ============================================================================
// Validation Helper
// ============================================================================

async function validateExtraction(documentId: string): Promise<{
  isValid: boolean;
  checks: Array<{ name: string; passed: boolean; expected?: any; actual?: any; message?: string }>;
  warnings: string[];
  suggestedFixes: Array<{ field: string; currentValue: any; suggestedValue: any; reason: string }>;
}> {
  const checks: Array<{ name: string; passed: boolean; expected?: any; actual?: any; message?: string }> = [];
  const warnings: string[] = [];
  const suggestedFixes: Array<{ field: string; currentValue: any; suggestedValue: any; reason: string }> = [];

  // Fetch document
  const doc: any = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc) {
    return {
      isValid: false,
      checks: [{ name: 'documentExists', passed: false, message: `Document not found: ${documentId}` }],
      warnings: [],
      suggestedFixes: [],
    };
  }

  // Fetch line items
  const lineItems: any[] = await db.select().from(ocrLineItems)
    .where(eq(ocrLineItems.documentId, documentId))
    .orderBy(asc(ocrLineItems.lineNumber))
    .all();

  const subtotal = doc.subtotal ?? null;
  const gstAmount = doc.gstAmount ?? doc.gst_amount ?? null;
  const totalAmount = doc.totalAmount ?? doc.total_amount ?? null;
  const documentDate = doc.documentDate ?? doc.document_date ?? null;
  const dueDate = doc.dueDate ?? doc.due_date ?? null;
  const vendorAbn = doc.vendorAbn ?? doc.vendor_abn ?? null;
  const documentType = doc.documentType ?? doc.document_type ?? null;

  // 1. Line items sum vs subtotal
  if (lineItems.length > 0 && subtotal != null) {
    const lineItemsSum = lineItems.reduce((sum: number, item: any) => sum + (item.amount ?? 0), 0);
    const diff = Math.abs(lineItemsSum - subtotal);
    const passed = diff <= 0.01;
    checks.push({
      name: 'lineItemsSum',
      passed,
      expected: subtotal,
      actual: lineItemsSum,
      message: passed
        ? 'Line items sum matches subtotal'
        : `Line items sum ($${lineItemsSum.toFixed(2)}) differs from subtotal ($${subtotal.toFixed(2)}) by $${diff.toFixed(2)}`,
    });
    if (!passed) {
      suggestedFixes.push({
        field: 'subtotal',
        currentValue: subtotal,
        suggestedValue: lineItemsSum,
        reason: 'Subtotal should match sum of line item amounts',
      });
    }
  } else if (lineItems.length === 0 && subtotal != null) {
    warnings.push('Subtotal present but no line items found');
  }

  // 2. GST calculation (~10% of subtotal)
  if (subtotal != null && gstAmount != null && subtotal > 0) {
    const expectedGst = subtotal * 0.1;
    const gstDiff = Math.abs(gstAmount - expectedGst);
    const tolerance = subtotal * 0.02; // 2% tolerance for rounding
    const passed = gstDiff <= tolerance;
    checks.push({
      name: 'gstCalculation',
      passed,
      expected: expectedGst,
      actual: gstAmount,
      message: passed
        ? 'GST is approximately 10% of subtotal'
        : `GST ($${gstAmount.toFixed(2)}) is not ~10% of subtotal ($${subtotal.toFixed(2)}). Expected ~$${expectedGst.toFixed(2)}`,
    });
    if (!passed) {
      if (vendorAbn) {
        suggestedFixes.push({
          field: 'gstAmount',
          currentValue: gstAmount,
          suggestedValue: Math.round(expectedGst * 100) / 100,
          reason: 'ABN present — vendor likely GST-registered, GST should be 10% of subtotal',
        });
      } else {
        warnings.push('GST mismatch but no ABN present — vendor may not be GST-registered');
      }
    }
  }

  // 3. Total = subtotal + GST
  if (subtotal != null && gstAmount != null && totalAmount != null) {
    const expectedTotal = subtotal + gstAmount;
    const diff = Math.abs(totalAmount - expectedTotal);
    const passed = diff <= 0.01;
    checks.push({
      name: 'totalCheck',
      passed,
      expected: expectedTotal,
      actual: totalAmount,
      message: passed
        ? 'Total matches subtotal + GST'
        : `Total ($${totalAmount.toFixed(2)}) differs from subtotal + GST ($${expectedTotal.toFixed(2)}) by $${diff.toFixed(2)}`,
    });
    if (!passed) {
      suggestedFixes.push({
        field: 'totalAmount',
        currentValue: totalAmount,
        suggestedValue: Math.round(expectedTotal * 100) / 100,
        reason: 'Total should equal subtotal + GST',
      });
    }
  }

  // 4. Date validity
  if (documentDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isValidFormat = dateRegex.test(documentDate);
    const isValidDate = isValidFormat && !isNaN(new Date(documentDate).getTime());
    checks.push({
      name: 'dateValidity',
      passed: isValidDate,
      actual: documentDate,
      message: isValidDate
        ? 'Document date is a valid ISO date'
        : `Document date "${documentDate}" is not a valid YYYY-MM-DD date`,
    });

    if (isValidDate && dueDate) {
      const dueDateValid = dateRegex.test(dueDate) && !isNaN(new Date(dueDate).getTime());
      if (dueDateValid && new Date(dueDate) < new Date(documentDate)) {
        warnings.push(`Due date (${dueDate}) is before document date (${documentDate})`);
        suggestedFixes.push({
          field: 'dueDate',
          currentValue: dueDate,
          suggestedValue: documentDate,
          reason: 'Due date should be on or after document date',
        });
      }
    }
  }

  // 5. ABN format (11 digits)
  if (vendorAbn) {
    const digits = vendorAbn.replace(/\s/g, '');
    const isValidAbn = /^\d{11}$/.test(digits);
    checks.push({
      name: 'abnFormat',
      passed: isValidAbn,
      actual: vendorAbn,
      message: isValidAbn
        ? 'ABN is valid 11-digit format'
        : `ABN "${vendorAbn}" is not a valid 11-digit format`,
    });
  }

  // 6. Required fields
  const hasDocType = documentType && documentType !== 'unknown';
  const hasTotal = totalAmount != null && totalAmount > 0;
  const hasLineItems = lineItems.length > 0;

  const requiredFieldsPassed = Boolean(hasDocType) && hasTotal && hasLineItems;
  const missing: string[] = [];
  if (!hasDocType) missing.push('documentType');
  if (!hasTotal) missing.push('totalAmount');
  if (!hasLineItems) missing.push('lineItems (at least 1)');

  checks.push({
    name: 'requiredFields',
    passed: requiredFieldsPassed,
    message: requiredFieldsPassed
      ? 'All required fields present'
      : `Missing required fields: ${missing.join(', ')}`,
  });

  const isValid = checks.every((c) => c.passed);

  return { isValid, checks, warnings, suggestedFixes };
}
