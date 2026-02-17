/**
 * Cognee Admin Module — Barrel Export
 */

export * from './types.js';
export { CogneeAdminService } from './admin-service.js';

import { CogneeAdminService } from './admin-service.js';

// Export singleton instance
export const cogneeAdmin = new CogneeAdminService();
