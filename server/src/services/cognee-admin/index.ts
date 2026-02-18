/**
 * Cognee Admin Module — Barrel Export
 */

export * from './types.js';
export { categorizeDataset, findComponents } from './helpers.js';
export { listDatasets, getDatasetDetail, createDataset, deleteDataset } from './dataset-ops.js';
export { reindexDataset, reindexAll } from './reindex-ops.js';
export { findOrphanedNodes, pruneStaleNodes, mergeDuplicateNodes } from './graph-maintenance.js';
export { getGraphStats } from './graph-stats.js';
export { testSearch } from './search-tester.js';
export { getDataQualityReport } from './data-quality.js';
export { CogneeAdminService } from './admin-service.js';

import { CogneeAdminService } from './admin-service.js';

// Export singleton instance
export const cogneeAdmin = new CogneeAdminService();
