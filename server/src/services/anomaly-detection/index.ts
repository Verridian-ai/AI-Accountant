/**
 * Anomaly Detection Module — Barrel Export
 */

export * from './types.js';
export { AnomalyDetectionService } from './detection-service.js';
export { AlertManagement } from './alert-management.js';
export { detectCategoryDrift, detectScheduleDeviation } from './db-detectors.js';

import { AnomalyDetectionService } from './detection-service.js';

// Export singleton instance
export const anomalyDetectionService = new AnomalyDetectionService();
