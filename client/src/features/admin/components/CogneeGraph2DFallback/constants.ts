export const NODE_COLORS: Record<string, string> = {
  merchant: '#FFCC00',
  transaction: '#4CAF50',
  category: '#2196F3',
  account: '#FF9800',
  product: '#E91E63',
  rate: '#9C27B0',
  indicator: '#00BCD4',
  person: '#FF5722',
  organization: '#795548',
  concept: '#607D8B',
  default: '#9E9E9E',
};

export const EDGE_COLORS: Record<string, string> = {
  categorized_as: '#4CAF50',
  paid_to: '#FFCC00',
  belongs_to: '#2196F3',
  has_rate: '#9C27B0',
  related_to: '#607D8B',
  default: '#424242',
};

export const MAX_NODES = 500;
