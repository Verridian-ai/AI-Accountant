/** Cognee DataPoint Management Service — thin orchestrator */

import type { DataPointDefinition, DataPointFilters, ExtractionStats } from './types.js';
import { PREDEFINED_DATAPOINTS, type PredefinedName } from './constants.js';
import {
  defineDataPoint,
  listDataPoints,
  getDataPoint,
  updateDataPoint,
  deactivateDataPoint,
  deleteDataPoint,
} from './datapoints-crud.js';
import { activateExtraction, getExtractionStats } from './datapoints-extraction.js';
import { createOrUpdateDataPoint, registerWave3DataPoints } from './datapoints-wave3.js';

export class CogneeDataPointService {
  async defineDataPoint(
    userId: string,
    config: DataPointDefinition,
  ): Promise<Record<string, unknown>> {
    return defineDataPoint(userId, config);
  }

  async activateExtraction(datapointId: string, userId?: string): Promise<void> {
    return activateExtraction(datapointId, userId);
  }

  async listDataPoints(
    userId: string,
    filters?: DataPointFilters,
  ): Promise<Record<string, unknown>[]> {
    return listDataPoints(userId, filters);
  }

  async getDataPoint(datapointId: string): Promise<Record<string, unknown> | null> {
    return getDataPoint(datapointId);
  }

  async updateDataPoint(
    datapointId: string,
    updates: Partial<
      Pick<
        DataPointDefinition,
        'description' | 'schemaDefinition' | 'extractionPrompt' | 'datasetName'
      >
    > & { name?: string; datapointType?: string },
    userId?: string,
  ): Promise<Record<string, unknown> | null> {
    return updateDataPoint(datapointId, updates, userId);
  }

  async deactivateDataPoint(datapointId: string): Promise<void> {
    return deactivateDataPoint(datapointId);
  }

  async deleteDataPoint(datapointId: string): Promise<void> {
    return deleteDataPoint(datapointId);
  }

  async getExtractionStats(datapointId: string, userId?: string): Promise<ExtractionStats> {
    return getExtractionStats(datapointId, userId);
  }

  getPredefinedDataPoints(): Array<{
    name: PredefinedName;
    datapointType: PredefinedName;
    schemaDefinition: (typeof PREDEFINED_DATAPOINTS)[PredefinedName];
  }> {
    return (Object.keys(PREDEFINED_DATAPOINTS) as PredefinedName[]).map((key) => ({
      name: key,
      datapointType: key,
      schemaDefinition: PREDEFINED_DATAPOINTS[key],
    }));
  }

  async createOrUpdateDataPoint(config: {
    userId: string;
    name: string;
    description: string;
    fields: string;
    targetDataset: string;
  }): Promise<void> {
    return createOrUpdateDataPoint(config);
  }

  async registerWave3DataPoints(userId: string, datasetPrefix: string): Promise<number> {
    return registerWave3DataPoints(this, userId, datasetPrefix);
  }
}

/** Singleton instance */
export const cogneeDataPointService = new CogneeDataPointService();
