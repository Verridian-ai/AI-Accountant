/**
 * Predefined DataPoint schemas for common financial entity types.
 */
export const PREDEFINED_DATAPOINTS = {
  FinancialTransaction: {
    fields: [
      { name: 'amount', type: 'number' as const, required: true },
      { name: 'merchant', type: 'string' as const, required: true },
      { name: 'category', type: 'string' as const, required: true },
      { name: 'date', type: 'date' as const, required: true },
      { name: 'gst_amount', type: 'number' as const, required: false },
      { name: 'account_id', type: 'string' as const, required: false },
    ],
  },
  BusinessRelationship: {
    fields: [
      { name: 'entity_a', type: 'string' as const, required: true },
      { name: 'entity_b', type: 'string' as const, required: true },
      { name: 'relationship_type', type: 'string' as const, required: true },
      { name: 'frequency', type: 'number' as const, required: false },
      { name: 'total_value', type: 'number' as const, required: false },
    ],
  },
  TaxEvent: {
    fields: [
      { name: 'event_type', type: 'string' as const, required: true },
      { name: 'amount', type: 'number' as const, required: true },
      { name: 'tax_impact', type: 'number' as const, required: false },
      { name: 'ruling_ref', type: 'string' as const, required: false },
      { name: 'period', type: 'string' as const, required: true },
      { name: 'entity_type', type: 'string' as const, required: false },
    ],
  },
} as const;

export type PredefinedName = keyof typeof PREDEFINED_DATAPOINTS;
