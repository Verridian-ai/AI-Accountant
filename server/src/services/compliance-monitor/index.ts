/**
 * Compliance Monitor Module — Barrel re-export
 */

export * from './types.js';
export { ComplianceMonitorService } from './monitor-service.js';

import { ComplianceMonitorService } from './monitor-service.js';
export const complianceMonitorService = new ComplianceMonitorService();
