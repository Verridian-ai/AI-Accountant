export const DEMO_BAR_DATA = [
  { name: 'Jan', value: 4200 },
  { name: 'Feb', value: 3800 },
  { name: 'Mar', value: 5100 },
  { name: 'Apr', value: 4600 },
  { name: 'May', value: 5800 },
  { name: 'Jun', value: 4900 },
];

export const DEMO_LINE_DATA = [
  { date: 'Jan', value: 1200 },
  { date: 'Feb', value: 1900 },
  { date: 'Mar', value: 1600 },
  { date: 'Apr', value: 2200 },
  { date: 'May', value: 2800 },
  { date: 'Jun', value: 2400 },
];

export const DEMO_PIE_DATA = [
  { name: 'Revenue', value: 42000 },
  { name: 'Expenses', value: 28000 },
  { name: 'Savings', value: 14000 },
];

export const DEMO_SCATTER_DATA = [
  { x: 10, y: 20 },
  { x: 20, y: 35 },
  { x: 30, y: 45 },
  { x: 40, y: 30 },
  { x: 50, y: 55 },
  { x: 60, y: 48 },
];

export const DEMO_TREEMAP_DATA = [
  { name: 'Housing', value: 1800 },
  { name: 'Food', value: 600 },
  { name: 'Transport', value: 400 },
  { name: 'Utilities', value: 300 },
  { name: 'Entertainment', value: 200 },
];

export const DEMO_SANKEY = {
  nodes: [
    { name: 'Income' },
    { name: 'Expenses' },
    { name: 'Savings' },
    { name: 'Housing' },
    { name: 'Food' },
  ],
  links: [
    { source: 0, target: 1, value: 3000 },
    { source: 0, target: 2, value: 2000 },
    { source: 1, target: 3, value: 1800 },
    { source: 1, target: 4, value: 600 },
  ],
};
