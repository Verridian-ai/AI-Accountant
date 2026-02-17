export interface DataPointDefinition {
  name: string;
  description?: string;
  datapointType:
    | 'FinancialTransaction'
    | 'BusinessRelationship'
    | 'TaxEvent'
    | 'MerchantProfile'
    | 'RecurringPattern'
    | 'ComplianceObligation'
    | 'custom';
  schemaDefinition: {
    fields: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean' | 'array';
      required?: boolean;
    }>;
  };
  extractionPrompt?: string;
  datasetName: string;
}

export interface DataPointFilters {
  datapointType?: string;
  isActive?: boolean;
  isPredefined?: boolean;
  datasetName?: string;
}

export interface ExtractionStats {
  totalExtractions: number;
  lastExtractionAt: string | null;
  accuracyScore: number | null;
  feedbackCount: number;
  sampleEntities: Record<string, unknown>[];
}
