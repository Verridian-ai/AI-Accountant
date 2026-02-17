/**
 * CDR Open Banking Crawler — Data Mapping
 *
 * Transforms CDR Register API responses into internal data holder
 * and product records for database storage.
 */

import type { CdrRegisterBrand, DataHolderRecord, CdrProductSummary } from './types.js';

// ============================================================================
// Brand → DataHolderRecord mapping
// ============================================================================

/**
 * Extracts the publicBaseUri from a CDR register brand entry.
 * Returns empty string if neither endpointDetail.publicBaseUri nor registerUri are set.
 */
export function extractPublicBaseUri(brand: CdrRegisterBrand): string {
  const uri = brand.endpointDetail?.publicBaseUri ?? brand.registerUri ?? '';
  return uri.replace(/\/$/, '');
}

/**
 * Converts a CDR Register brand entry into an internal DataHolderRecord.
 */
export function brandToDataHolderRecord(brand: CdrRegisterBrand): DataHolderRecord {
  return {
    id: brand.dataHolderBrandId,
    dataHolderBrandId: brand.dataHolderBrandId,
    brandName: brand.brandName,
    publicBaseUri: extractPublicBaseUri(brand),
  };
}

// ============================================================================
// Brand → DB insert/update values
// ============================================================================

export function brandToInsertValues(brand: CdrRegisterBrand, now: string) {
  const publicBaseUri = extractPublicBaseUri(brand);
  return {
    id: brand.dataHolderBrandId,
    dataHolderBrandId: brand.dataHolderBrandId,
    brandName: brand.brandName,
    abn: brand.abn ?? null,
    acn: brand.acn ?? null,
    logoUri: brand.logoUri ?? null,
    status: brand.status,
    registerUri: brand.registerUri ?? '',
    publicBaseUri,
    industry: brand.industry ?? 'banking',
    createdAt: now,
    updatedAt: now,
  };
}

export function brandToUpdateValues(brand: CdrRegisterBrand, now: string) {
  const publicBaseUri = extractPublicBaseUri(brand);
  return {
    brandName: brand.brandName,
    abn: brand.abn ?? null,
    acn: brand.acn ?? null,
    logoUri: brand.logoUri ?? null,
    status: brand.status,
    publicBaseUri,
    registerUri: brand.registerUri ?? '',
    updatedAt: now,
  };
}

// ============================================================================
// Product Summary → DB insert/update values
// ============================================================================

export function productToInsertValues(
  product: CdrProductSummary,
  dataHolderId: string,
  compositeId: string,
  now: string,
) {
  return {
    id: compositeId,
    dataHolderId,
    productId: product.productId,
    name: product.name,
    description: product.description ?? null,
    brand: product.brand ?? null,
    brandName: product.brandName ?? null,
    productCategory: product.productCategory,
    isTailored: product.isTailored ?? false,
    effectiveFrom: product.effectiveFrom ?? null,
    effectiveTo: product.effectiveTo ?? null,
    applicationUri: product.applicationUri ?? null,
    additionalInfoUri: product.additionalInformation?.overviewUri ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function productToUpdateValues(product: CdrProductSummary, now: string) {
  return {
    name: product.name,
    description: product.description ?? null,
    brand: product.brand ?? null,
    brandName: product.brandName ?? null,
    productCategory: product.productCategory,
    isTailored: product.isTailored ?? false,
    effectiveFrom: product.effectiveFrom ?? null,
    effectiveTo: product.effectiveTo ?? null,
    applicationUri: product.applicationUri ?? null,
    additionalInfoUri: product.additionalInformation?.overviewUri ?? null,
    updatedAt: now,
  };
}
