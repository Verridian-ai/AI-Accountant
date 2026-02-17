/**
 * Claude Agent Framework — Cognee RAG Tools
 *
 * Thin wrapper around cogneeClient (the single source of truth for Cognee HTTP).
 * Adds dataset-prefix support and batch chunking for agent use.
 *
 * Wave 3: Per-user dataset isolation with pooling strategy:
 * - Shared datasets (reference data): no prefix, global access
 * - Row-filtered datasets: no prefix, user_id metadata filtering
 * - Private datasets: user_{userId} prefix for full isolation
 */

import { cogneeClient, CogneeClient } from '../cognee_client.js';
import type { CogneeSearchType } from '../cognee_client.js';

// Wave 3: Shared reference datasets — never per-user prefixed.
// These contain global data (ATO rules, GST tables) shared across all users.
const SHARED_DATASETS = new Set([
  'gst_rules',
  'ato_rulings',
  'award_rates',
  'stp_compliance',
  'tax_tables',
  'deduction_patterns',
]);

// Wave 3: Row-filtered datasets — no prefix, use user_id metadata filtering.
// Multiple users contribute to the same dataset; filtering happens at query time.
const ROW_FILTERED_DATASETS = new Set(['merchant_data', 'matching_patterns']);

// ── AP Data Interfaces (Wave 10) ────────────────────────────────────
export interface SupplierProfileData {
  businessName: string;
  abn?: string;
  contactName?: string;
  email?: string;
  paymentTermsDays: number;
  typicalCategories: string[];
  averageSpendCents: number;
  paymentReliability: string; // 'excellent' | 'good' | 'fair' | 'poor'
}

export interface BillPatternData {
  supplierName: string;
  billNumber: string;
  totalAmountCents: number;
  gstAmountCents: number;
  lineItems: Array<{ description: string; amountCents: number }>;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  daysToPay?: number;
}

export interface POHistoryData {
  poNumber: string;
  supplierName: string;
  totalAmountCents: number;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
  receivedDate?: string;
  matchedBillNumber?: string;
  matchStatus?: string;
}

export interface CogneeToolConfig {
  searchTopK: number;
  indexBatchSize: number;
  datasetPrefix: string;
  userId?: string; // Wave 3: user context for per-user isolation
  tenantId?: string; // Wave 23: tenant context for multi-tenant isolation
}

const DEFAULT_CONFIG: CogneeToolConfig = {
  searchTopK: 5,
  indexBatchSize: 50,
  datasetPrefix: '',
};

export class CogneeTools {
  private config: CogneeToolConfig;
  private client: CogneeClient;

  constructor(config: Partial<CogneeToolConfig> = {}, client?: CogneeClient) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = client ?? cogneeClient;
  }

  /**
   * Create a CogneeTools instance scoped to a specific user (Wave 3).
   * Uses dataset pooling strategy (D03 B3):
   * - Shared reference datasets: no prefix, global access
   * - Private datasets: user_{userId} prefix
   * - Row-filtered datasets: no prefix, user_id metadata filtering
   */
  static forUser(userId: string, client?: CogneeClient): CogneeTools {
    return new CogneeTools(
      {
        datasetPrefix: `user_${userId}`,
        userId,
      },
      client,
    );
  }

  /**
   * Create a CogneeTools instance scoped to a specific tenant (Wave 23).
   * All dataset operations will be prefixed with tenant_${tenantId}_ at the CogneeClient level.
   * Optionally also scoped to a specific user within that tenant.
   */
  static forTenant(tenantId: string, userId?: string, client?: CogneeClient): CogneeTools {
    return new CogneeTools(
      {
        datasetPrefix: userId ? `user_${userId}` : '',
        userId,
        tenantId,
      },
      client,
    );
  }

  /**
   * Search Cognee knowledge graph for relevant context.
   * Supports configurable search type for different use cases.
   * F7: Now accepts sessionId for conversational memory
   */
  async search(
    query: string,
    dataset: string,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    sessionId?: string,
  ): Promise<string[]> {
    // F7: Use searchWithSession if sessionId provided
    if (sessionId) {
      return this.client.searchWithSession(
        query,
        this.prefixDataset(dataset),
        sessionId,
        this.config.searchTopK,
        searchType,
        this.config.userId,
        this.config.tenantId,
      );
    }

    return this.client.search(
      query,
      this.prefixDataset(dataset),
      this.config.searchTopK,
      searchType,
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index data into a Cognee dataset.
   * Delegates to cogneeClient.add() which uses multipart FormData.
   * For row-filtered datasets, wraps data with user metadata.
   */
  async index(data: string[], dataset: string): Promise<void> {
    if (ROW_FILTERED_DATASETS.has(dataset) && this.config.userId) {
      // Row-filtered: tag each item with user_id for filtering
      for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
        const batch = data.slice(i, i + this.config.indexBatchSize);
        await this.addWithUserMetadata(batch, dataset);
      }
    } else {
      for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
        const batch = data.slice(i, i + this.config.indexBatchSize);
        await this.client.add(
          batch,
          this.prefixDataset(dataset),
          this.config.userId,
          this.config.tenantId,
        );
      }
    }
  }

  /**
   * Build knowledge graph from indexed data.
   * Passes dataset name to cognify (required — empty body returns 400).
   */
  async cognify(dataset: string): Promise<void> {
    await this.client.cognify(
      [this.prefixDataset(dataset)],
      true,
      undefined,
      this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Index data and then trigger cognify in one step.
   */
  async indexAndCognify(data: string[], dataset: string): Promise<void> {
    await this.index(data, dataset);
    await this.cognify(dataset);
  }

  /**
   * Search using a DataPoint-structured entity query.
   * Delegates to CHUNKS search on the datapoint-specific dataset.
   */
  async searchWithDataPoint(query: string, dataPointType: string, sessionId?: string): Promise<string[]> {
    const dataset = `datapoint_${dataPointType.toLowerCase()}`;
    return this.search(query, dataset, 'CHUNKS');
  }

  /**
   * Search with ontology-based context.
   * Uses GRAPH_COMPLETION for ontology-aware results.
   */
  async searchWithOntology(query: string, ontologyType: string, sessionId?: string): Promise<string[]> {
    const dataset = `ontology_${ontologyType.toLowerCase()}`;
    return this.search(query, dataset, 'GRAPH_COMPLETION');
  }

  /**
   * Submit feedback on a search result for Cognee learning loop.
   */
  async submitSearchFeedback(
    query: string,
    resultId: string,
    feedback: 'relevant' | 'partial' | 'irrelevant',
    context?: string,
  ): Promise<void> {
    // Best-effort feedback — index as text for future retrieval
    const feedbackText = `Feedback: query="${query}" resultId=${resultId} feedback=${feedback}${context ? ` context="${context}"` : ''}`;
    try {
      await this.index([feedbackText], 'search_feedback');
    } catch {
      // Non-fatal: don't break caller flow
    }
  }

  /**
   * Temporal search — search within a time range on a specific dataset.
   * Augments the query with date range context.
   */
  async temporalSearch(
    query: string,
    dataset: string,
    timeRange: { start: string; end: string },
  ): Promise<string[]> {
    const augmented = `${query} [period: ${timeRange.start} to ${timeRange.end}]`;
    return this.search(augmented, dataset, 'CHUNKS');
  }

  /**
   * Cross-module search — search across multiple datasets and merge results.
   */
  async crossModuleSearch(query: string, modules: string[]): Promise<string[]> {
    const allResults: string[] = [];
    for (const mod of modules) {
      try {
        const results = await this.search(query, mod, 'CHUNKS');
        allResults.push(...results);
      } catch {
        // Non-fatal: skip unavailable modules
      }
    }
    return allResults;
  }

  /**
   * Search timeline — search for events within a date range across specified modules.
   */
  async searchTimeline(
    query: string,
    timeRange: { start: string; end: string },
    modules: string[],
  ): Promise<string[]> {
    const augmented = `${query} [timeline: ${timeRange.start} to ${timeRange.end}]`;
    return this.crossModuleSearch(augmented, modules);
  }

  /**
   * Wave 3: Apply dataset prefix with pooling strategy.
   * - Shared reference datasets: never prefix (global access)
   * - Row-filtered datasets: never prefix (user_id metadata filtering)
   * - Private datasets: apply user prefix for full isolation
   */
  private prefixDataset(dataset: string): string {
    // Shared reference datasets — never prefix
    if (SHARED_DATASETS.has(dataset)) {
      return dataset;
    }
    // Row-filtered datasets — no prefix, metadata filtering instead
    if (ROW_FILTERED_DATASETS.has(dataset)) {
      return dataset;
    }
    // Private datasets — apply user prefix
    if (this.config.datasetPrefix) {
      return `${this.config.datasetPrefix}_${dataset}`;
    }
    return dataset;
  }

  /**
   * Wave 3: When adding data to row-filtered datasets, include user_id in metadata
   * so searches can be filtered by user without per-user dataset copies.
   */
  private async addWithUserMetadata(data: string[], dataset: string): Promise<void> {
    const userId = this.config.userId;
    // Prefix each line with user tag for row-level filtering
    const taggedData = data.map((item) => `[user:${userId}] ${item}`);
    await this.client.add(taggedData, dataset, userId, this.config.tenantId);
  }

  /**
   * Map a logical module name to its Cognee dataset name (Wave 4+).
   * Used by cross-module intelligence to resolve human-friendly module IDs.
   * Returns the module name itself as fallback for unknown modules.
   */
  _moduleToDataset(module: string): string {
    switch (module) {
      case 'transactions':
        return COGNEE_DATASETS.bankTransactions;
      case 'merchants':
        return COGNEE_DATASETS.merchantMappings;
      case 'gst':
        return COGNEE_DATASETS.gstRules;
      case 'tax':
        return COGNEE_DATASETS.taxTables;
      case 'forecasting':
        return COGNEE_DATASETS.forecastPatterns;
      case 'compliance':
        return COGNEE_DATASETS.complianceRulings;
      case 'anomalies':
        return COGNEE_DATASETS.anomalyHistory;
      case 'reports':
        return COGNEE_DATASETS.financialReports;
      case 'budgets':
        return COGNEE_DATASETS.budgetTemplates;
      case 'customers':
        return COGNEE_DATASETS.customerProfiles;
      case 'invoicing':
        return COGNEE_DATASETS.invoiceHistory;
      case 'suppliers':
        return COGNEE_DATASETS.supplierProfiles;
      case 'bills':
        return COGNEE_DATASETS.billPatterns;
      case 'inventory':
        return COGNEE_DATASETS.inventoryCatalog;
      case 'reconciliation':
        return COGNEE_DATASETS.reconPatterns;
      // Wave 4: Payroll datasets
      case 'payroll':
      case 'employees':
        return COGNEE_DATASETS.employeeProfiles;
      case 'pay_structures':
      case 'pay':
        return COGNEE_DATASETS.payStructures;
      default:
        return module;
    }
  }

  /**
   * Index a customer profile into the customer_profiles dataset.
   * Uses CHUNKS search type for vector similarity lookup.
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
   * Uses CHUNKS search type for fast vector matching.
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
   * Uses GRAPH_COMPLETION for relationship reasoning.
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
   * Uses GRAPH_COMPLETION search type.
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
   * Formats supplier data as structured text for CHUNKS vector similarity.
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
   * Uses CHUNKS search type for fast vector lookup:
   *   "Which supplier sells office supplies?", "Supplier with ABN 12345678901"
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
   * Formats bill data as structured text for GRAPH_COMPLETION reasoning.
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
   * Uses GRAPH_COMPLETION for queries like:
   *   "What's our average monthly spend with supplier X?", "Recurring bill patterns"
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
   * Index purchase order history into bill_patterns dataset (combined AP context).
   * Includes line items, receiving status, and bill matching info.
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
   * Uses GRAPH_COMPLETION for complex queries like:
   *   "What's our payment history with X supplier?"
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

  // ── Wave 4: Payroll Cognee Methods ──────────────────────────────────

  /**
   * Index employee profile data for NL queries (Wave 4).
   * Indexes: name, email, employment type, status, start date.
   * Uses employee_profiles dataset with CHUNKS_LEXICAL for name matching.
   */
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
    const dataset = this.prefixDataset(COGNEE_DATASETS.employeeProfiles);
    const data = [
      `Employee: ${employee.firstName} ${employee.lastName}`,
      `Email: ${employee.email ?? 'not provided'}`,
      `Type: ${employee.employmentType}`,
      `Status: ${employee.status}`,
      `Start Date: ${employee.startDate}`,
      `Employee ID: ${employee.id}`,
    ].join('\n');

    await this.client.add([data], dataset, userId ?? this.config.userId, this.config.tenantId);
  }

  /**
   * Index pay structure data for NL queries (Wave 4).
   * Converts cents to dollars for display in search results.
   * Uses pay_structures dataset with CHUNKS for semantic matching.
   */
  async indexPayStructure(
    structure: {
      employeeName: string;
      categoryName: string;
      rate: number; // cents
      rateType: string;
      hoursPerWeek?: number;
      annualSalary?: number; // cents
    },
    userId?: string,
  ): Promise<void> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.payStructures);
    const rateDollars = (structure.rate / 100).toFixed(2);
    const salaryDollars = structure.annualSalary
      ? (structure.annualSalary / 100).toFixed(2)
      : 'N/A';

    const data = [
      `Employee: ${structure.employeeName}`,
      `Pay Category: ${structure.categoryName}`,
      `Rate: $${rateDollars} (${structure.rateType})`,
      `Hours/Week: ${structure.hoursPerWeek ?? 'N/A'}`,
      `Annual Salary: $${salaryDollars}`,
    ].join('\n');

    await this.client.add([data], dataset, userId ?? this.config.userId, this.config.tenantId);
  }

  /**
   * Search employees by name or attribute (Wave 4).
   * Uses CHUNKS_LEXICAL for keyword-based name matching (no embeddings needed).
   */
  async searchEmployees(query: string, topK: number = 5, userId?: string): Promise<string[]> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.employeeProfiles);
    return this.client.search(
      query,
      dataset,
      topK,
      'CHUNKS_LEXICAL',
      userId ?? this.config.userId,
      this.config.tenantId,
    );
  }

  /**
   * Search pay structures and rates (Wave 4).
   * Uses CHUNKS for semantic matching on rates and categories.
   */
  async searchPayStructures(query: string, topK: number = 5, userId?: string): Promise<string[]> {
    const dataset = this.prefixDataset(COGNEE_DATASETS.payStructures);
    return this.client.search(
      query,
      dataset,
      topK,
      'CHUNKS',
      userId ?? this.config.userId,
      this.config.tenantId,
    );
  }
}

/**
 * Named dataset constants used across agents and indexers.
 * Provides a typed, single source of truth for dataset name strings.
 */
export const COGNEE_DATASETS = {
  // Core transaction datasets
  bankTransactions: 'bank_transactions',
  bankFormats: 'bank_formats',
  merchantMappings: 'merchant_mappings',
  merchantCorrections: 'merchant_corrections',
  transferPatterns: 'transfer_patterns',
  searchFeedback: 'search_feedback',

  // GST & tax reference (shared — never per-user prefixed)
  gstRules: 'gst_rules',
  atoRulings: 'ato_rulings',
  taxTables: 'tax_tables',
  deductionPatterns: 'deduction_patterns',

  // Payroll reference (shared)
  awardRates: 'award_rates',
  stpCompliance: 'stp_compliance',

  // Row-filtered (shared mutable)
  merchantData: 'merchant_data',
  matchingPatterns: 'matching_patterns',

  // Financial reporting & budgets
  financialReports: 'financial_reports',
  budgetTemplates: 'budget_templates',
  kpiHistory: 'kpi_history',

  // Forecasting & compliance
  forecastPatterns: 'forecast_patterns',
  anomalyHistory: 'anomaly_history',
  complianceRulings: 'compliance_rulings',

  // Knowledge graph
  temporalPatterns: 'temporal_patterns',
  crossModuleInsights: 'cross_module_insights',
  moduleRelationships: 'module_relationships',

  // CDR / banking products
  cdrProducts: 'cdr_products',
  cdrRates: 'cdr_rates',
  bankingProductKnowledge: 'banking_product_knowledge',

  // Market intelligence
  marketIntelligence: 'market_intelligence',
  marketSentiment: 'market_sentiment',
  rbaStatistics: 'rba_statistics',
  absStatistics: 'abs_statistics',
  asxMarketData: 'asx_market_data',

  // Inventory & reconciliation
  inventoryCatalog: 'inventory_catalog',
  reconPatterns: 'recon_patterns',

  // OCR & document processing
  ocrExtractions: 'ocr_extractions',

  // Invoicing domain (Wave 7)
  customerProfiles: 'customer_profiles',
  invoiceHistory: 'invoice_history',

  // Accounts payable (Wave 10)
  supplierProfiles: 'supplier_profiles',
  billPatterns: 'bill_patterns',

  // Wave 4: Payroll datasets
  employeeProfiles: 'employee_profiles',
  payStructures: 'pay_structures',

  // DataPoint & ontology prefixed datasets
  datapointPrefix: 'datapoint_',
  ontologyPrefix: 'ontology_',
} as const;

export const cogneeTools = new CogneeTools();
