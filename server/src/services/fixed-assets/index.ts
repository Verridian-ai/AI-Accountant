/**
 * Fixed Assets Service — Barrel re-export
 */

export type {
  AssetCategory,
  DepreciationMethod,
  AssetStatus,
  FixedAsset,
  AssetDisposal,
  DepreciationResult,
} from './types.js';
export {
  ATO_EFFECTIVE_LIVES,
  INSTANT_WRITE_OFF_THRESHOLD,
  LOW_VALUE_POOL_THRESHOLD,
  LVP_FIRST_YEAR_RATE,
  LVP_SUBSEQUENT_RATE,
  parseFY,
  getFYForDate,
  daysBetween,
} from './types.js';
export { FixedAssetService, fixedAssetService } from './fixed-asset-service.js';
