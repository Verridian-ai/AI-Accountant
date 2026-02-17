/**
 * Cognee Client — Tenant Isolation Utilities
 *
 * Multi-tenant dataset prefixing (Wave 23):
 * - applyTenantPrefix: prefix a single dataset name
 * - applyTenantPrefixToAll: prefix an array of dataset names
 * - getTenantDatasetName: get the prefixed name for a tenant+dataset
 * - stripTenantPrefix: remove tenant prefix from a dataset name
 *
 * Shared datasets (gst_rules, ato_rulings) are NOT prefixed.
 */

// Datasets that are shared across all tenants (no prefix)
const SHARED_DATASETS = ['gst_rules', 'ato_rulings', 'tax_rulings'];

/**
 * Apply tenant prefix to a dataset name if tenantId is provided.
 * Returns original name for shared datasets.
 */
export function applyTenantPrefix(dataset: string, tenantId?: string): string {
  if (!tenantId) return dataset;
  if (SHARED_DATASETS.includes(dataset)) return dataset;
  return `tenant_${tenantId}_${dataset}`;
}

/**
 * Apply tenant prefix to an array of dataset names.
 */
export function applyTenantPrefixToAll(datasets: string[], tenantId?: string): string[] {
  if (!tenantId) return datasets;
  return datasets.map((ds) => applyTenantPrefix(ds, tenantId));
}

/**
 * Get the prefixed dataset name for a specific tenant.
 * Alias for applyTenantPrefix for backward compatibility.
 */
export function getTenantDatasetName(tenantId: string, dataset: string): string {
  return applyTenantPrefix(dataset, tenantId);
}

/**
 * Strip tenant prefix from a dataset name.
 * Returns the base dataset name without the tenant_<id>_ prefix.
 */
export function stripTenantPrefix(prefixedDataset: string): string {
  const match = prefixedDataset.match(/^tenant_[^_]+_(.+)$/);
  return match ? match[1] : prefixedDataset;
}
