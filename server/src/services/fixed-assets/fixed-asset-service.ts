/**
 * Fixed Asset Service — Singleton class facade
 *
 * Wraps modular functions to preserve the original FixedAssetService class API.
 */

import type {
  AssetCategory,
  AssetStatus,
  DepreciationMethod,
  FixedAsset,
  AssetDisposal,
  DepreciationResult,
} from './types.js';
import * as register from './asset-register.js';
import * as depr from './depreciation.js';
import * as schedule from './schedule-report.js';

export class FixedAssetService {
  async registerAsset(params: Parameters<typeof register.registerAsset>[0]): Promise<FixedAsset> {
    return register.registerAsset(params);
  }

  async updateAsset(
    assetId: string,
    updates: {
      assetName?: string;
      location?: string;
      serialNumber?: string;
      depreciationMethod?: DepreciationMethod;
    },
  ): Promise<void> {
    return register.updateAsset(assetId, updates);
  }

  async calculateDepreciation(assetId: string, financialYear: string): Promise<DepreciationResult> {
    return depr.calculateDepreciation(assetId, financialYear);
  }

  async runBatchDepreciation(userId: string, financialYear: string, entityId?: string) {
    return depr.runBatchDepreciation(userId, financialYear, entityId);
  }

  async recordDisposal(
    params: Parameters<typeof register.recordDisposal>[0],
  ): Promise<AssetDisposal> {
    return register.recordDisposal(params);
  }

  async getAssetRegister(
    userId: string,
    filters?: {
      entityId?: string;
      category?: AssetCategory;
      status?: AssetStatus;
      purchaseDateFrom?: string;
      purchaseDateTo?: string;
    },
  ) {
    return register.getAssetRegister(userId, filters);
  }

  async getDepreciationSchedule(userId: string, financialYear: string, _entityId?: string) {
    return schedule.getDepreciationSchedule(userId, financialYear, _entityId);
  }
}

export const fixedAssetService = new FixedAssetService();
