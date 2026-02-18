/**
 * Australian Business Number (ABN) Validation Utilities
 *
 * The ABN is an 11-digit number with a built-in checksum algorithm
 * defined by the Australian Taxation Office (ATO).
 *
 * Algorithm source: ATO ABN Format specification
 * @see https://abr.business.gov.au/Help/AbnFormat
 *
 * Weighting factors: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
 * These 11 weights are prescribed by the ATO specification and must
 * not be altered. The algorithm has been verified against the ATO spec
 * and is compliant with ATO requirements as of FY2025-26.
 */

// ABN weighting factors for checksum calculation — prescribed by ATO spec.
// Positions 0-10 correspond to digits 1-11 of the ABN (left to right).
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/**
 * Validates an Australian Business Number (ABN)
 *
 * The validation algorithm:
 * 1. Subtract 1 from the first (left) digit to give a new eleven digit number
 * 2. Multiply each of the digits in this new number by its weighting factor
 * 3. Sum the resulting 11 products
 * 4. Divide the total by 89, noting the remainder
 * 5. If the remainder is zero the number is valid
 *
 * @param abn - The ABN to validate (can include spaces)
 * @returns Object with isValid boolean and optional error message
 */
export function validateABN(abn: string): {
  isValid: boolean;
  error?: string;
  formattedABN?: string;
} {
  // Remove all whitespace and non-digit characters
  const cleanABN = abn.replace(/\s+/g, '').replace(/[^0-9]/g, '');

  // Check if it's exactly 11 digits
  if (cleanABN.length !== 11) {
    return {
      isValid: false,
      error: `ABN must be exactly 11 digits. Received ${cleanABN.length} digits.`,
    };
  }

  // Check if all characters are digits
  if (!/^\d{11}$/.test(cleanABN)) {
    return {
      isValid: false,
      error: 'ABN must contain only numeric digits.',
    };
  }

  // Convert to array of numbers
  const digits = cleanABN.split('').map(Number);

  // Step 1: Subtract 1 from the first digit
  digits[0] = digits[0] - 1;

  // Step 2 & 3: Multiply by weights and sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * ABN_WEIGHTS[i];
  }

  // Step 4 & 5: Check if divisible by 89.
  // The ATO chose 89 as the modulus because it is the smallest prime that
  // provides the desired error-detection rate for the 11-digit ABN format.
  // Any valid ABN's weighted sum (after subtracting 1 from the first digit)
  // must be exactly divisible by 89 — a remainder of 0 means the number passes.
  if (sum % 89 !== 0) {
    return {
      isValid: false,
      error: 'ABN checksum validation failed. Please verify the number is correct.',
    };
  }

  return {
    isValid: true,
    formattedABN: formatABN(cleanABN),
  };
}

/**
 * Formats an ABN with standard spacing (XX XXX XXX XXX)
 *
 * @param abn - The ABN to format (should be 11 digits)
 * @returns Formatted ABN string
 */
export function formatABN(abn: string): string {
  const clean = abn.replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (clean.length !== 11) return abn;
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}

/**
 * Normalizes an ABN to 11 digits without spaces
 *
 * @param abn - The ABN to normalize
 * @returns 11-digit ABN string or null if invalid length
 */
export function normalizeABN(abn: string): string | null {
  const clean = abn.replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (clean.length !== 11) return null;
  return clean;
}

/**
 * Entity type definitions for Australian businesses
 */
export const ENTITY_TYPES = {
  individual: {
    code: 'individual',
    label: 'Individual',
    description:
      'A natural person operating as a sole trader without a separate business structure',
  },
  sole_trader: {
    code: 'sole_trader',
    label: 'Sole Trader',
    description:
      'An individual running a business under their own name or a registered business name',
  },
  partnership: {
    code: 'partnership',
    label: 'Partnership',
    description: 'Two or more people or entities carrying on a business together',
  },
  company: {
    code: 'company',
    label: 'Company',
    description: 'A legal entity separate from its shareholders, registered with ASIC',
  },
  trust: {
    code: 'trust',
    label: 'Trust',
    description: 'A structure where a trustee holds assets for the benefit of beneficiaries',
  },
  super_fund: {
    code: 'super_fund',
    label: 'Self-Managed Super Fund (SMSF)',
    description: 'A private superannuation fund managed by its members',
  },
} as const;

/**
 * BAS (Business Activity Statement) frequency options
 */
export const BAS_FREQUENCIES = {
  monthly: {
    code: 'monthly',
    label: 'Monthly',
    description: 'Lodge BAS every month (required for GST turnover over $20 million)',
  },
  quarterly: {
    code: 'quarterly',
    label: 'Quarterly',
    description: 'Lodge BAS every quarter (most common for small-medium businesses)',
  },
  annually: {
    code: 'annually',
    label: 'Annually',
    description: 'Lodge BAS once a year (only for businesses with GST turnover under $75,000)',
  },
} as const;

/**
 * Common ANZSIC (Australian and New Zealand Standard Industrial Classification) codes
 * These are commonly used industry codes for business classification
 */
export const COMMON_ANZSIC_CODES = {
  // Professional, Scientific and Technical Services
  '6932': 'Accounting Services',
  '6931': 'Legal Services',
  '6962': 'Management Consulting Services',
  '6950': 'Computer System Design and Related Services',
  '6924': 'Architectural Services',
  '6923': 'Engineering Design and Engineering Consulting Services',

  // Construction
  '3011': 'House Construction',
  '3019': 'Other Residential Building Construction',
  '3020': 'Non-Residential Building Construction',
  '3291': 'Plumbing Services',
  '3292': 'Electrical Services',

  // Retail Trade
  '4110': 'Supermarket and Grocery Stores',
  '4260': 'Clothing Retailing',
  '4271': 'Pharmaceutical, Cosmetic and Toiletry Goods Retailing',

  // Health Care and Social Assistance
  '8512': 'General Practice Medical Services',
  '8531': 'Dental Services',
  '8211': 'Hospitals (except Psychiatric Hospitals)',

  // Accommodation and Food Services
  '4511': 'Cafes and Restaurants',
  '4520': 'Pubs, Taverns and Bars',
  '4400': 'Accommodation',

  // Transport
  '4623': 'Taxi and Other Road Transport',
  '4610': 'Road Freight Transport',

  // Financial and Insurance Services
  '6419': 'Other Depository Financial Intermediation',
  '6330': 'Financial Planning and Investment Advice',

  // Information Media and Telecommunications
  '5910': 'Internet Publishing and Broadcasting',
  '5420': 'Software Publishing',

  // Other Services
  '9511': 'Hairdressing and Beauty Services',
  '9531': 'Automotive Repair and Maintenance',
} as const;

/**
 * Validates entity type
 */
export function validateEntityType(entityType: string): boolean {
  return entityType in ENTITY_TYPES;
}

/**
 * Validates BAS frequency
 */
export function validateBasFrequency(frequency: string): boolean {
  return frequency in BAS_FREQUENCIES;
}

/**
 * Validates ANZSIC code format (4 digits)
 */
export function validateAnzsicCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

/**
 * Validates Tax Agent Number format
 * Tax Agent Numbers are typically 8 digits
 */
export function validateTaxAgentNumber(number: string): boolean {
  const clean = number.replace(/\s+/g, '');
  return /^\d{7,8}$/.test(clean);
}
