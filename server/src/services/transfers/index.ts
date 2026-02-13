/**
 * Transfer Detection Module
 *
 * Exports transfer detection functionality.
 */

export {
  TransferDetector,
  detectTransfers,
  excludeTransfers,
  generateTransferReport,
  type TransferCandidate,
  type AccountContext,
  type TransferMatch,
  type TransferDetectorConfig,
} from './detector';

export {
  persistTransferMatches,
  markOwnerContributions,
  type PersistTransferOptions,
  type PersistResult,
} from './persistence';
