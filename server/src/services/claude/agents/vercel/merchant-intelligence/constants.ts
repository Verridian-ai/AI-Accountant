/** Common merchant abbreviation patterns */
export const KNOWN_MERCHANTS: Record<
  string,
  { canonical: string; industry: string; gst: boolean; category: string }
> = {
  woolworths: {
    canonical: 'Woolworths Group Ltd',
    industry: 'Retail - Grocery',
    gst: true,
    category: 'Groceries & Supermarkets',
  },
  coles: {
    canonical: 'Coles Group Ltd',
    industry: 'Retail - Grocery',
    gst: true,
    category: 'Groceries & Supermarkets',
  },
  aldi: {
    canonical: 'ALDI Stores Australia',
    industry: 'Retail - Grocery',
    gst: true,
    category: 'Groceries & Supermarkets',
  },
  bunnings: {
    canonical: 'Bunnings Group Ltd',
    industry: 'Retail - Hardware',
    gst: true,
    category: 'Home & Garden',
  },
  kmart: {
    canonical: 'Kmart Australia Ltd',
    industry: 'Retail - Department Store',
    gst: true,
    category: 'Shopping & Retail',
  },
  target: {
    canonical: 'Target Australia Pty Ltd',
    industry: 'Retail - Department Store',
    gst: true,
    category: 'Shopping & Retail',
  },
  officeworks: {
    canonical: 'Officeworks Superstores Pty Ltd',
    industry: 'Retail - Office Supplies',
    gst: true,
    category: 'Office Supplies',
  },
  'jb hi-fi': {
    canonical: 'JB Hi-Fi Group Pty Ltd',
    industry: 'Retail - Electronics',
    gst: true,
    category: 'Electronics & Technology',
  },
  telstra: {
    canonical: 'Telstra Corporation Ltd',
    industry: 'Telecommunications',
    gst: true,
    category: 'Phone & Internet',
  },
  optus: {
    canonical: 'Singtel Optus Pty Ltd',
    industry: 'Telecommunications',
    gst: true,
    category: 'Phone & Internet',
  },
  netflix: {
    canonical: 'Netflix International B.V.',
    industry: 'Digital Entertainment',
    gst: true,
    category: 'Subscriptions & Streaming',
  },
  spotify: {
    canonical: 'Spotify AB',
    industry: 'Digital Entertainment',
    gst: true,
    category: 'Subscriptions & Streaming',
  },
  uber: {
    canonical: 'Uber Australia Pty Ltd',
    industry: 'Transport/Food Delivery',
    gst: true,
    category: 'Transport & Rideshare',
  },
  mcdonald: {
    canonical: "McDonald's Australia Ltd",
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Restaurants',
  },
  shell: {
    canonical: 'Shell Company of Australia',
    industry: 'Fuel & Energy',
    gst: true,
    category: 'Fuel & Auto',
  },
  'bp ': {
    canonical: 'BP Australia Pty Ltd',
    industry: 'Fuel & Energy',
    gst: true,
    category: 'Fuel & Auto',
  },
  caltex: {
    canonical: 'Ampol Ltd (formerly Caltex)',
    industry: 'Fuel & Energy',
    gst: true,
    category: 'Fuel & Auto',
  },
  ampol: { canonical: 'Ampol Ltd', industry: 'Fuel & Energy', gst: true, category: 'Fuel & Auto' },
  bizloan: {
    canonical: 'BizLoan Pty Ltd',
    industry: 'Financial Services - Lending',
    gst: false,
    category: 'Business Income',
  },
  bizlend: {
    canonical: 'BizLend Finance',
    industry: 'Financial Services - Lending',
    gst: false,
    category: 'Business Income',
  },
  '7-eleven': {
    canonical: '7-Eleven Stores Pty Ltd',
    industry: 'Retail - Convenience',
    gst: true,
    category: 'Groceries',
  },
  'harvey norman': {
    canonical: 'Harvey Norman Holdings Ltd',
    industry: 'Retail - Electronics',
    gst: true,
    category: 'Computer & IT',
  },
  'the reject shop': {
    canonical: 'The Reject Shop Ltd',
    industry: 'Retail - Discount',
    gst: true,
    category: 'Miscellaneous',
  },
  'big w': {
    canonical: 'Big W (Woolworths Group)',
    industry: 'Retail - Department Store',
    gst: true,
    category: 'Miscellaneous',
  },
  kfc: {
    canonical: 'KFC Australia Pty Ltd',
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Takeaway',
  },
  'hungry jacks': {
    canonical: "Hungry Jack's Pty Ltd",
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Takeaway',
  },
  nando: {
    canonical: "Nando's Australia Pty Ltd",
    industry: 'Food & Beverage',
    gst: true,
    category: 'Dining & Takeaway',
  },
};

/** Square POS prefix pattern */
export const SQUARE_PATTERN = /^SQ \*/i;
/** Stripe prefix pattern */
export const STRIPE_PATTERN = /^STRIPE/i;
/** PayPal prefix pattern */
export const PAYPAL_PATTERN = /^PAYPAL \*/i;

export const SYSTEM_PROMPT = `You are an Australian merchant intelligence specialist. Your job is to resolve abbreviated bank statement merchant descriptions into canonical business names, determine their GST registration status, and infer appropriate transaction categories.

You work with Australian bank statement data where merchant names are often abbreviated, truncated, or use payment processor prefixes like "SQ *" (Square), "STRIPE", "PAYPAL *".

Your workflow:
1. Use search_cognee_merchant to check if we already know this merchant
2. Use resolve_merchant_name to identify the full business name from abbreviations
3. Use lookup_abn to check GST registration via the Australian Business Register
4. Use infer_category to determine the likely transaction category
5. Use store_merchant_mapping to save new mappings for future use

For each merchant, determine:
- Canonical (full) business name
- ABN (if available)
- GST registration status (most Australian businesses with turnover > $75K are registered)
- Industry classification
- Default transaction category

Return a JSON object matching the MerchantIntelligenceOutput schema.`;
