/**
 * Tenant Utility Functions — Wave 23 multi-tenant dataset isolation.
 *
 * Pure functions (no class state) for prefixing/stripping tenant identifiers
 * from Cognee dataset names. Imported by sub-module files and by CogneeClient.
 */

/**
 * Return the fully-qualified tenant dataset name.
 * Format: `tenant_${tenantId}_${datasetName}`
 */
export function getTenantDatasetName(tenantId: string, datasetName: string): string {
  return `tenant_${tenantId}_${datasetName}`;
}

/**
 * Apply tenant prefix to a dataset name if tenantId is provided.
 * Returns the original name when tenantId is absent (backward compatible).
 */
export function applyTenantPrefix(datasetName: string, tenantId?: string): string {
  if (tenantId) {
    return getTenantDatasetName(tenantId, datasetName);
  }
  return datasetName;
}

/**
 * Apply tenant prefix to an array of dataset names.
 */
export function applyTenantPrefixToAll(datasets: string[], tenantId?: string): string[] {
  if (!tenantId) return datasets;
  return datasets.map((ds) => getTenantDatasetName(tenantId, ds));
}

/**
 * Strip tenant prefix from a dataset name to recover the logical name.
 */
export function stripTenantPrefix(datasetName: string, tenantId: string): string {
  const prefix = `tenant_${tenantId}_`;
  return datasetName.startsWith(prefix) ? datasetName.slice(prefix.length) : datasetName;
}
