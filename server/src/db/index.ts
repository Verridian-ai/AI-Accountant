/**
 * Database entry point - exports correct schema and db based on environment
 *
 * In production (NODE_ENV=production): Uses PostgreSQL
 * In development: Uses SQLite
 */

import dotenv from 'dotenv';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
dotenv.config();

const isProduction = config.isProduction;
const dbUrl = config.databaseUrl;
const usePostgres =
  isProduction || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

logger.info(
  `[DB] Environment: ${isProduction ? 'production' : 'development'}, Using: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`,
);

// Export based on environment — use dynamic import() for ESM compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exportedModule: Record<string, any>;
if (usePostgres) {
  logger.info('[DB] Loading PostgreSQL schema and connection');
  exportedModule = await import('./postgres-exports.js');
} else {
  logger.info('[DB] Loading SQLite schema');
  exportedModule = await import('../schema.js');
}

export const db = exportedModule.db;
export const users = exportedModule.users;
export const accounts = exportedModule.accounts;
export const transactions = exportedModule.transactions;
export const statements = exportedModule.statements;
export const statementAccounts = exportedModule.statementAccounts;
export const transactionHistory = exportedModule.transactionHistory;
export const transferLinks = exportedModule.transferLinks;
export const merchantMemory = exportedModule.merchantMemory;
export const pendingCategorization = exportedModule.pendingCategorization;
export const reconciliationAlerts = exportedModule.reconciliationAlerts;
export const businessProfiles = exportedModule.businessProfiles;
export const basPeriods = exportedModule.basPeriods;
export const basCalculations = exportedModule.basCalculations;
export const taxCodes = exportedModule.taxCodes;
export const taxBrackets = exportedModule.taxBrackets;
export const deductions = exportedModule.deductions;
export const cgtAssets = exportedModule.cgtAssets;
export const cgtEvents = exportedModule.cgtEvents;
export const depreciableAssets = exportedModule.depreciableAssets;
export const depreciationSchedule = exportedModule.depreciationSchedule;
export const taxYearSummary = exportedModule.taxYearSummary;
export const auditLog = exportedModule.auditLog;
export const sessions = exportedModule.sessions;
export const teams = exportedModule.teams;
export const teamMembers = exportedModule.teamMembers;
export const teamInvitations = exportedModule.teamInvitations;
export const subscriptions = exportedModule.subscriptions;
export const exportHistory = exportedModule.exportHistory;
export const parserMetrics = exportedModule.parserMetrics;
export const parserAccuracyAggregates = exportedModule.parserAccuracyAggregates;
export const parserFeedback = exportedModule.parserFeedback;
export const chartOfAccounts = exportedModule.chartOfAccounts;
export const journalEntries = exportedModule.journalEntries;
export const journalEntryLines = exportedModule.journalEntryLines;
export const accountingPeriods = exportedModule.accountingPeriods;
export const accountBalances = exportedModule.accountBalances;
export const ragNamespaces = exportedModule.ragNamespaces;
export const ragChunks = exportedModule.ragChunks;
export const ragDocuments = exportedModule.ragDocuments;
export const ragCitations = exportedModule.ragCitations;
export const taxOffsets = exportedModule.taxOffsets;
export const capitalLosses = exportedModule.capitalLosses;
export const uploadQueue = exportedModule.uploadQueue;
export const dashboardLayouts = exportedModule.dashboardLayouts;
export const savedCharts = exportedModule.savedCharts;
export const cogneeUserAccounts = exportedModule.cogneeUserAccounts;
export const cogneeSessions = exportedModule.cogneeSessions;
export const datapointConfigs = exportedModule.datapointConfigs;
export const graphSchemas = exportedModule.graphSchemas;
export const cogneeFeedback = exportedModule.cogneeFeedback;
export const agentSessions = exportedModule.agentSessions;
export const agentMutations = exportedModule.agentMutations;
export const agentAuditLog = exportedModule.agentAuditLog;
export const tenants = exportedModule.tenants;
export const tenantMembers = exportedModule.tenantMembers;
export const tenantInvitations = exportedModule.tenantInvitations;
export const permissions = exportedModule.permissions;
export const rolePermissions = exportedModule.rolePermissions;
export const subscriptionPlans = exportedModule.subscriptionPlans;
export const subscriptionHistory = exportedModule.subscriptionHistory;
export const apiRateLimits = exportedModule.apiRateLimits;
export const ownerEquityEvents = exportedModule.ownerEquityEvents;
export const economicDataCache = exportedModule.economicDataCache;
export const reportSnapshots = exportedModule.reportSnapshots;
export const budgets = exportedModule.budgets;
export const budgetLines = exportedModule.budgetLines;
export const budgetVsActual = exportedModule.budgetVsActual;
export const forecastScenarios = exportedModule.forecastScenarios;
export const forecastPeriods = exportedModule.forecastPeriods;
export const kpiMetrics = exportedModule.kpiMetrics;
export const ocrDocuments = exportedModule.ocrDocuments;
export const ocrLineItems = exportedModule.ocrLineItems;
export const paymentMatchRules = exportedModule.paymentMatchRules;
export const paymentMatches = exportedModule.paymentMatches;
export const documentQueue = exportedModule.documentQueue;
export const cashFlowForecasts = exportedModule.cashFlowForecasts;
export const cashFlowForecastPeriods = exportedModule.cashFlowForecastPeriods;
export const anomalyAlerts = exportedModule.anomalyAlerts;
export const complianceChecks = exportedModule.complianceChecks;
export const complianceSchedules = exportedModule.complianceSchedules;
export const temporalQueries = exportedModule.temporalQueries;
export const crossModuleInsights = exportedModule.crossModuleInsights;
export const intelligenceSubscriptions = exportedModule.intelligenceSubscriptions;
export const moduleConnections = exportedModule.moduleConnections;
export const suppliers = exportedModule.suppliers;
export const bills = exportedModule.bills;
export const billLines = exportedModule.billLines;
export const billPayments = exportedModule.billPayments;
export const purchaseOrders = exportedModule.purchaseOrders;
export const poLines = exportedModule.poLines;
export const poReceipts = exportedModule.poReceipts;
export const poReceiptLines = exportedModule.poReceiptLines;
export const supplierPaymentRuns = exportedModule.supplierPaymentRuns;
export const supplierPaymentRunItems = exportedModule.supplierPaymentRunItems;
export const pushSubscriptions = exportedModule.pushSubscriptions;
export const notificationPreferences = exportedModule.notificationPreferences;
export const offlineSyncLog = exportedModule.offlineSyncLog;
export const customers = exportedModule.customers;
export const customerContacts = exportedModule.customerContacts;
export const invoices = exportedModule.invoices;
export const invoiceLines = exportedModule.invoiceLines;
export const userSettings = exportedModule.userSettings;
// Payroll tables (schema/payroll.ts) — previously missing from exports
export const employees = exportedModule.employees;
export const employeeBankDetails = exportedModule.employeeBankDetails;
export const employeeSuperFunds = exportedModule.employeeSuperFunds;
export const employeeTaxDeclarations = exportedModule.employeeTaxDeclarations;
export const payCategories = exportedModule.payCategories;
export const payStructures = exportedModule.payStructures;
export const employeeDocuments = exportedModule.employeeDocuments;
// Banking / invoicing tables (schema/banking.ts, schema/invoicing.ts) — previously missing
export const accountBalanceHistory = exportedModule.accountBalanceHistory;
export const invoiceNumberSequences = exportedModule.invoiceNumberSequences;
export const invoicePayments = exportedModule.invoicePayments;
