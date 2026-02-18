/**
 * CDR Open Banking Crawler — Type Definitions
 *
 * All interfaces and types used by the CDR crawler subsystem.
 */

// ============================================================================
// Crawler Configuration & Results
// ============================================================================

export interface CdrCrawlerConfig {
  registerBaseUrl: string;
  rateLimit: number;
  maxConcurrentHolders: number;
  retryAttempts: number;
  retryDelayMs: number;
  requestTimeoutMs: number;
  userAgent: string;
}

export interface CrawlResult {
  holdersDiscovered: number;
  holdersProcessed: number;
  productsDiscovered: number;
  productsDetailed: number;
  errors: CrawlError[];
  durationMs: number;
}

export interface CrawlError {
  dataHolderId?: string;
  productId?: string;
  stage: 'discovery' | 'catalog' | 'detail';
  message: string;
  statusCode?: number;
}

// ============================================================================
// Internal Data Records
// ============================================================================

export interface DataHolderRecord {
  id: string;
  dataHolderBrandId: string;
  brandName: string;
  publicBaseUri: string;
  [key: string]: unknown;
}

// ============================================================================
// CDR Register API Response Shapes
// ============================================================================

/** CDR Register API response shape for data holder brands */
export interface CdrRegisterBrand {
  dataHolderBrandId: string;
  brandName: string;
  abn?: string;
  acn?: string;
  logoUri?: string;
  status: string;
  endpointDetail?: {
    publicBaseUri?: string;
  };
  registerUri?: string;
  industry?: string;
}

/** CDR product list response */
export interface CdrProductListResponse {
  data: {
    products: CdrProductSummary[];
  };
  links: {
    self: string;
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
  meta: {
    totalRecords: number;
    totalPages: number;
  };
}

export interface CdrProductSummary {
  productId: string;
  name: string;
  description?: string;
  brand?: string;
  brandName?: string;
  productCategory: string;
  isTailored?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  applicationUri?: string;
  additionalInformation?: {
    overviewUri?: string;
    termsUri?: string;
    eligibilityUri?: string;
    feesAndPricingUri?: string;
    bundleUri?: string;
  };
}

export interface CdrProductDetailResponse {
  data: CdrProductDetail;
}

export interface CdrProductDetail extends CdrProductSummary {
  lastUpdated?: string;
  additionalInformation?: {
    overviewUri?: string;
    termsUri?: string;
    eligibilityUri?: string;
    feesAndPricingUri?: string;
    bundleUri?: string;
  };
  bundles?: unknown[];
  features?: CdrFeatureData[];
  constraints?: unknown[];
  eligibility?: CdrEligibilityData[];
  fees?: CdrFeeData[];
  depositRates?: CdrDepositRateData[];
  lendingRates?: CdrLendingRateData[];
}

export interface CdrFeatureData {
  featureType: string;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
  isActivated?: boolean;
}

export interface CdrEligibilityData {
  eligibilityType: string;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}

export interface CdrFeeData {
  name: string;
  feeType: string;
  amount?: string;
  balanceRate?: string;
  transactionRate?: string;
  accruedRate?: string;
  accrualFrequency?: string;
  currency?: string;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
  discounts?: unknown[];
}

export interface CdrDepositRateData {
  depositRateType: string;
  rate: string;
  calculationFrequency?: string;
  applicationFrequency?: string;
  tiers?: unknown[];
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}

export interface CdrLendingRateData {
  lendingRateType: string;
  rate: string;
  comparisonRate?: string;
  calculationFrequency?: string;
  applicationFrequency?: string;
  interestPaymentDue?: string;
  repaymentType?: string;
  loanPurpose?: string;
  tiers?: unknown[];
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}
