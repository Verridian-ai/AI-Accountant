/**
 * Cognee Tools — Domain Data Methods (CogneeTools)
 *
 * Extends CogneeToolsBase with domain-specific indexing/search:
 * customer profiles, invoices, entity hierarchy, consolidation patterns,
 * AP supplier/bill/PO data, payroll employee/pay structure data.
 */
import type { CogneeClient } from '../../cognee_client.js';
import type {
  CogneeToolConfig,
  SupplierProfileData,
  BillPatternData,
  POHistoryData,
} from './types.js';
import { COGNEE_DATASETS } from './types.js';
import { CogneeToolsBase } from './search-tools.js';
import {
  indexEmployee as _indexEmployee,
  indexPayStructure as _indexPayStructure,
  searchEmployees as _searchEmployees,
  searchPayStructures as _searchPayStructures,
} from './data-tools-payroll.js';

export class CogneeTools extends CogneeToolsBase {
  constructor(config: Partial<CogneeToolConfig> = {}, client?: CogneeClient) {
    super(config, client);
  }

  static override forUser(userId: string, client?: CogneeClient): CogneeTools {
    return new CogneeTools({ datasetPrefix: `user_${userId}`, userId }, client);
  }

  static override forTenant(tenantId: string, userId?: string, client?: CogneeClient): CogneeTools {
    return new CogneeTools(
      { datasetPrefix: userId ? `user_${userId}` : '', userId, tenantId },
      client,
    );
  }

  /**
   * Index a customer profile into the customer_profiles dataset.
   */
  async indexCustomerProfile(customer: {
    id: string;
    businessName: string;
    abn?: string;
    email?: string;
    paymentTerms: number;
    notes?: string;
  }): Promise<void> {
    const parts = [`Customer: ${customer.businessName}`];
    if (customer.abn) parts.push(`ABN: ${customer.abn}`);
    if (customer.email) parts.push(`Email: ${customer.email}`);
    parts.push(`Payment Terms: ${customer.paymentTerms} days`);
    if (customer.notes) parts.push(`Notes: ${customer.notes}`);
    const text = parts.join(', ');
    await this.index([text], COGNEE_DATASETS.customerProfiles);
  }

  /**
   * Search customer profiles by similarity.
   */
  async searchCustomers(query: string, topK?: number): Promise<string[]> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.customerProfiles);
    return this.client.search(
      query,
      dataset,
      topK ?? 5,
      'CHUNKS',
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index an invoice into the invoice_history dataset.
   */
  async indexInvoice(invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    totalCents: number;
    gstCents: number;
    status: string;
    issueDate: string;
    dueDate: string;
    lineItems: string[];
  }): Promise<void> {
    const total = (invoice.totalCents / 100).toFixed(2);
    const gst = (invoice.gstCents / 100).toFixed(2);
    const items = invoice.lineItems.join(', ');
    const text = `Invoice ${invoice.invoiceNumber} to ${invoice.customerName}: $${total} AUD (GST: $${gst}), Status: ${invoice.status}, Issued: ${invoice.issueDate}, Due: ${invoice.dueDate}. Items: ${items}`;
    await this.index([text], COGNEE_DATASETS.invoiceHistory);
  }

  /**
   * Search invoice history with relationship-aware reasoning.
   */
  async searchInvoiceHistory(query: string, topK?: number): Promise<string[]> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.invoiceHistory);
    return this.client.search(
      query,
      dataset,
      topK ?? 10,
      'GRAPH_COMPLETION',
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Search entity hierarchy for multi-entity consolidation.
   */
  async searchEntityHierarchy(query: string, topK?: number): Promise<any[]> {
    const dataset = this.prefixDataset('entity_hierarchy');
    return this.client.search(
      query,
      dataset,
      topK ?? this.config.searchTopK,
      'GRAPH_COMPLETION',
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Search consolidation patterns for multi-entity reporting.
   */
  async searchConsolidationPatterns(query: string, topK?: number): Promise<any[]> {
    const dataset = this.prefixDataset('consolidation_patterns');
    return this.client.search(
      query,
      dataset,
      topK ?? this.config.searchTopK,
      'CHUNKS',
      this.config.userId,
      this.config.tenantId,
    );
  }

  // ── Wave 10: Accounts Payable Cognee Methods ─────────────────────

  /**
   * Index a supplier profile into the supplier_profiles dataset.
   */
  async indexSupplierProfile(supplier: SupplierProfileData): Promise<void> {
    const avgSpend = (supplier.averageSpendCents / 100).toFixed(2);
    const parts = [`Supplier: ${supplier.businessName}`];
    if (supplier.abn) parts.push(`ABN: ${supplier.abn}`);
    if (supplier.contactName) parts.push(`Contact: ${supplier.contactName}`);
    if (supplier.email) parts.push(`Email: ${supplier.email}`);
    parts.push(`Payment Terms: ${supplier.paymentTermsDays} days`);
    parts.push(`Categories: ${supplier.typicalCategories.join(', ')}`);
    parts.push(`Avg Spend: $${avgSpend} AUD`);
    parts.push(`Reliability: ${supplier.paymentReliability}`);
    const text = parts.join(', ');
    await this.indexAndCognify([text], COGNEE_DATASETS.supplierProfiles);
  }

  /**
   * Search supplier profiles by similarity.
   */
  async searchSupplierProfiles(query: string, topK?: number): Promise<string[]> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.supplierProfiles);
    return this.client.search(
      query,
      dataset,
      topK ?? this.config.searchTopK,
      'CHUNKS',
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index a bill into the bill_patterns dataset.
   */
  async indexBillPattern(bill: BillPatternData): Promise<void> {
    const total = (bill.totalAmountCents / 100).toFixed(2);
    const gst = (bill.gstAmountCents / 100).toFixed(2);
    const items = bill.lineItems
      .map((li) => `${li.description}: $${(li.amountCents / 100).toFixed(2)}`)
      .join('; ');
    const parts = [
      `Bill ${bill.billNumber} from ${bill.supplierName}`,
      `Total: $${total} AUD (GST: $${gst})`,
      `Issued: ${bill.issueDate}, Due: ${bill.dueDate}`,
    ];
    if (bill.paidDate) parts.push(`Paid: ${bill.paidDate}`);
    if (bill.daysToPay != null) parts.push(`Days to Pay: ${bill.daysToPay}`);
    parts.push(`Items: ${items}`);
    const text = parts.join(', ');
    await this.indexAndCognify([text], COGNEE_DATASETS.billPatterns);
  }

  /**
   * Search bill patterns with relationship-aware reasoning.
   */
  async searchBillPatterns(query: string, topK?: number): Promise<string[]> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.billPatterns);
    return this.client.search(
      query,
      dataset,
      topK ?? this.config.searchTopK,
      'GRAPH_COMPLETION',
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index purchase order history into bill_patterns dataset.
   */
  async indexPurchaseOrderHistory(po: POHistoryData): Promise<void> {
    const total = (po.totalAmountCents / 100).toFixed(2);
    const items = po.lineItems
      .map((li) => `${li.description} x${li.quantity} @ $${(li.unitPriceCents / 100).toFixed(2)}`)
      .join('; ');
    const parts = [
      `PO ${po.poNumber} to ${po.supplierName}`,
      `Total: $${total} AUD`,
      `Items: ${items}`,
    ];
    if (po.receivedDate) parts.push(`Received: ${po.receivedDate}`);
    if (po.matchedBillNumber) parts.push(`Matched Bill: ${po.matchedBillNumber}`);
    if (po.matchStatus) parts.push(`Match Status: ${po.matchStatus}`);
    const text = parts.join(', ');
    await this.indexAndCognify([text], COGNEE_DATASETS.billPatterns);
  }

  /**
   * Multi-dataset AP context search across supplier_profiles + bill_patterns.
   */
  async searchAPContext(query: string, topK?: number): Promise<string[]> {
    const k = topK ?? this.config.searchTopK;
    const [supplierResults, billResults] = await Promise.all([
      this.client
        .search(
          query,
          this.prefixDataset(COGNEE_DATASETS.supplierProfiles),
          k,
          'CHUNKS',
          this.config.userId,
          this.config.tenantId,
        )
        .catch(() => [] as string[]),
      this.client
        .search(
          query,
          this.prefixDataset(COGNEE_DATASETS.billPatterns),
          k,
          'GRAPH_COMPLETION',
          this.config.userId,
          this.config.tenantId,
        )
        .catch(() => [] as string[]),
    ]);
    return [...supplierResults, ...billResults];
  }

  // ── Wave 4: Payroll Cognee Methods (delegated to data-tools-payroll.ts) ──

  async indexEmployee(
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      employmentType: string;
      status: string;
      startDate: string;
    },
    userId?: string,
  ): Promise<void> {
    return _indexEmployee(this.config, this.client, (d) => this.prefixDataset(d), employee, userId);
  }

  async indexPayStructure(
    structure: {
      employeeName: string;
      categoryName: string;
      rate: number;
      rateType: string;
      hoursPerWeek?: number;
      annualSalary?: number;
    },
    userId?: string,
  ): Promise<void> {
    return _indexPayStructure(
      this.config,
      this.client,
      (d) => this.prefixDataset(d),
      structure,
      userId,
    );
  }

  async searchEmployees(query: string, topK: number = 5, userId?: string): Promise<string[]> {
    return _searchEmployees(
      this.config,
      this.client,
      (d) => this.prefixDataset(d),
      query,
      topK,
      userId,
    );
  }

  async searchPayStructures(query: string, topK: number = 5, userId?: string): Promise<string[]> {
    return _searchPayStructures(
      this.config,
      this.client,
      (d) => this.prefixDataset(d),
      query,
      topK,
      userId,
    );
  }
}

export const cogneeTools = new CogneeTools();
