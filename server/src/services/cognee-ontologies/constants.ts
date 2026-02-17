/**
 * Predefined ontology definitions for financial, tax, and business relationship graphs.
 */
export const PREDEFINED_ONTOLOGIES = {
  financial: {
    name: 'Financial Ontology',
    description:
      'Core financial entity relationships: accounts, transactions, merchants, categories',
    ontologyType: 'financial' as const,
    nodeTypes: [
      {
        name: 'Account',
        properties: [
          { name: 'account_number', type: 'string' },
          { name: 'account_type', type: 'string' },
          { name: 'balance', type: 'number' },
        ],
        color: '#FFCC00',
      },
      {
        name: 'Transaction',
        properties: [
          { name: 'amount', type: 'number' },
          { name: 'date', type: 'date' },
          { name: 'category', type: 'string' },
        ],
        color: '#4CAF50',
      },
      {
        name: 'Merchant',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'abn', type: 'string' },
          { name: 'industry', type: 'string' },
        ],
        color: '#2196F3',
      },
      {
        name: 'Category',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'parent', type: 'string' },
          { name: 'tax_deductible', type: 'boolean' },
        ],
        color: '#9C27B0',
      },
    ],
    edgeTypes: [
      { name: 'BELONGS_TO', sourceType: 'Transaction', targetType: 'Account' },
      { name: 'PAID_TO', sourceType: 'Transaction', targetType: 'Merchant' },
      { name: 'CATEGORIZED_AS', sourceType: 'Transaction', targetType: 'Category' },
      { name: 'CHILD_OF', sourceType: 'Category', targetType: 'Category' },
      { name: 'OPERATES_IN', sourceType: 'Merchant', targetType: 'Category' },
    ],
  },
  tax: {
    name: 'Tax Ontology',
    description: 'Australian tax obligations: entities, obligations, deductions, ATO rulings',
    ontologyType: 'tax' as const,
    nodeTypes: [
      {
        name: 'TaxEntity',
        properties: [
          { name: 'entity_type', type: 'string' },
          { name: 'abn', type: 'string' },
          { name: 'tfn', type: 'string' },
        ],
        color: '#F44336',
      },
      {
        name: 'TaxObligation',
        properties: [
          { name: 'type', type: 'string' },
          { name: 'period', type: 'string' },
          { name: 'amount', type: 'number' },
        ],
        color: '#FF9800',
      },
      {
        name: 'Deduction',
        properties: [
          { name: 'category', type: 'string' },
          { name: 'amount', type: 'number' },
          { name: 'substantiated', type: 'boolean' },
        ],
        color: '#8BC34A',
      },
      {
        name: 'ATORuling',
        properties: [
          { name: 'reference', type: 'string' },
          { name: 'topic', type: 'string' },
          { name: 'date', type: 'date' },
        ],
        color: '#607D8B',
      },
    ],
    edgeTypes: [
      { name: 'OWES', sourceType: 'TaxEntity', targetType: 'TaxObligation' },
      { name: 'CLAIMS', sourceType: 'TaxEntity', targetType: 'Deduction' },
      { name: 'GOVERNED_BY', sourceType: 'Deduction', targetType: 'ATORuling' },
      { name: 'APPLIES_TO', sourceType: 'ATORuling', targetType: 'TaxObligation' },
    ],
  },
  relationship: {
    name: 'Relationship Ontology',
    description: 'Business relationships: businesses, people, services',
    ontologyType: 'relationship' as const,
    nodeTypes: [
      {
        name: 'Business',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'abn', type: 'string' },
          { name: 'industry', type: 'string' },
        ],
        color: '#3F51B5',
      },
      {
        name: 'Person',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'role', type: 'string' },
        ],
        color: '#00BCD4',
      },
      {
        name: 'Service',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'recurring', type: 'boolean' },
        ],
        color: '#CDDC39',
      },
    ],
    edgeTypes: [
      { name: 'EMPLOYS', sourceType: 'Business', targetType: 'Person' },
      { name: 'PROVIDES', sourceType: 'Business', targetType: 'Service' },
      { name: 'CONSUMES', sourceType: 'Business', targetType: 'Service' },
      { name: 'PARTNER_OF', sourceType: 'Business', targetType: 'Business' },
      { name: 'DIRECTOR_OF', sourceType: 'Person', targetType: 'Business' },
    ],
  },
} as const;
