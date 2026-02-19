export * from './client';
export * from './types';
export * from './auth';
export * from './transactions';
export * from './statements';
export * from './accounts';
export * from './reports';
export * from './settings';
export * from './tax';
export * from './payroll';
export * from './ap';
export * from './invoicing';
export * from './tenants';
export * from './agents';
export * from './market';
export * from './analytics';
export * from './misc';

import * as auth from './auth';
import * as transactions from './transactions';
import * as statements from './statements';
import * as accounts from './accounts';
import * as reports from './reports';
import * as settings from './settings';
import { basApi, taxApi, gstApi } from './tax';
import { apApi } from './ap';
import { invoicingApi } from './invoicing';
import { tenantApi } from './tenants';
import { mutationApi, streamingApi, migrationApi, schemaApi, sendChatMessage } from './agents';
import { multiBankApi } from './market';
import { analyticsApi } from './analytics';
import {
  dashboardApi,
  transactionsApi,
  adminLogin,
  fetchActivityLog,
  fetchActivitySummary,
  fetchAdminProfile,
  fetchAdminUsers,
  fetchAgentConfigs,
  fetchAgentCosts,
  fetchAgentExecutions,
  fetchAgentStats,
  fetchBestRates,
  fetchCdrAlerts,
  fetchCdrProducts,
  fetchCogneeAdminDatasets,
  fetchCogneeDatasetDetail,
  fetchCogneeGraphStats,
  fetchDataHolders,
  fetchDiskUsage,
  fetchFeatureFlags,
  fetchHealthHistory,
  fetchSystemHealth,
  fetchSystemMetrics,
  testCogneeSearch,
  reindexCogneeDataset,
  triggerCdrCrawl,
  compareCdrProducts,
  calculateSavings,
  createAdminUser,
  createCdrAlert,
  createFeatureFlag,
  deleteAdminUser,
  deleteCdrAlert,
  updateAdminUser,
  updateAgentConfig,
  updateFeatureFlag,
  fetchAdminLedgerSummary,
  fetchAdminBasSummary,
} from './misc';

import {
  createTransactionInterceptor,
  createAccountInterceptor,
  createUpdateTransactionInterceptor,
  createDeleteTransactionInterceptor,
} from '../services/offline-interceptor';

// Legacy api object for backward compatibility
export const api = {
  ...auth,
  ...transactions,
  ...statements,
  ...accounts,
  ...reports,
  ...settings,
  ...basApi,
  ...taxApi,
  ...gstApi,
  ...apApi,
  ...invoicingApi,
  ...tenantApi,
  ...mutationApi,
  ...streamingApi,
  ...migrationApi,
  ...schemaApi,
  sendChatMessage,
  ...multiBankApi,
  ...analyticsApi,
  ...dashboardApi,
  transactionsApi,
  adminLogin,
  fetchActivityLog,
  fetchActivitySummary,
  fetchAdminProfile,
  fetchAdminUsers,
  fetchAgentConfigs,
  fetchAgentCosts,
  fetchAgentExecutions,
  fetchAgentStats,
  fetchBestRates,
  fetchCdrAlerts,
  fetchCdrProducts,
  fetchCogneeAdminDatasets,
  fetchCogneeDatasetDetail,
  fetchCogneeGraphStats,
  fetchDataHolders,
  fetchDiskUsage,
  fetchFeatureFlags,
  fetchHealthHistory,
  fetchSystemHealth,
  fetchSystemMetrics,
  testCogneeSearch,
  reindexCogneeDataset,
  triggerCdrCrawl,
  compareCdrProducts,
  calculateSavings,
  createAdminUser,
  createCdrAlert,
  createFeatureFlag,
  deleteAdminUser,
  deleteCdrAlert,
  updateAdminUser,
  updateAgentConfig,
  updateFeatureFlag,
  fetchAdminLedgerSummary,
  fetchAdminBasSummary,
};

// Apply offline interceptors to the legacy object
api.fetchTransactions = createTransactionInterceptor(api.fetchTransactions);
api.fetchAccounts = createAccountInterceptor(api.fetchAccounts);
api.updateTransaction = createUpdateTransactionInterceptor(api.updateTransaction);
api.deleteTransaction = createDeleteTransactionInterceptor(api.deleteTransaction);
