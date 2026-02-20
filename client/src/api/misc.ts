import { API_URL, getAuthHeaders } from './client';

/** Auth headers using admin JWT (separate from user JWT). */
function getAdminAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type StubApi = Record<string, (...args: unknown[]) => Promise<unknown>>;

export const entityApi = {
  // GET /api/tenants — lists tenants (entities in multi-company context)
  list: async (): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/tenants`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`entity list failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // TODO: no server route for create entity
  createEntity: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for entity hierarchy
  getHierarchy: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for entity settings
  updateSettings: async (..._args: unknown[]) => Promise.resolve(),
  // TODO: no server route for inter-entity transactions
  getInterEntityTransactions: async (..._args: unknown[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  // TODO: no server route for inter-entity transaction confirm
  confirmInterEntityTransaction: async (..._args: unknown[]) => Promise.resolve(),
  // TODO: no server route for inter-entity transaction record
  recordInterEntityTransaction: async (..._args: unknown[]) => Promise.resolve(),
};

// TODO: no server route for assets — asset register not yet implemented server-side
export const assetApi: StubApi = {
  disposeAsset: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getRegister: async (..._args: unknown[]) =>
    Promise.resolve({ assets: [] } as Record<string, unknown>),
  getDepreciationSchedule: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  runBatchDepreciation: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  registerAsset: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const forecastApi = {
  // GET /api/analytics/cash-flow-forecast
  list: async (_userId?: string, status?: string): Promise<unknown> => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const res = await fetch(`${API_URL}/analytics/cash-flow-forecast?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`forecast list failed: ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    return json.data ?? json;
  },
  // GET /api/analytics/forecasts/:id
  getById: async (forecastId: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/analytics/forecasts/${forecastId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`forecast getById failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // POST /api/analytics/forecasts/generate
  generate: async (params: Record<string, string>): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/analytics/forecasts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`forecast generate failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // POST /api/analytics/forecasts/:id/archive
  archive: async (forecastId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/forecasts/${forecastId}/archive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`forecast archive failed: ${res.status}`);
  },
  // TODO: no server route for forecast accuracy calculation
  calculateAccuracy: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for updating actuals
  updateActuals: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for comparing forecasts
  compare: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// TODO: no server routes for intelligence API — cross-module intelligence service
// exists (server/src/services/cross-module-intelligence) but is not wired to any routes
export const intelligenceApi: StubApi = {
  findCorrelations: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  listInsights: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  updateInsightStatus: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  listSubscriptions: async (..._args: unknown[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  scanInsights: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getTimeline: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getConnections: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  subscribe: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deleteSubscription: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listSavedQueries: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  executeQuery: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  saveQuery: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// knowledgeApi — wired to /api/cognee/* where server routes exist.
// Confirmed routes: POST /api/cognee/memify/trigger, GET /api/cognee/graph/:userId
// datapoints, ontologies, feedback have no registered server routes yet.
export const knowledgeApi = {
  // TODO: no server endpoint yet — /api/knowledge/datapoints GET not registered
  listDataPoints: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  // TODO: no server endpoint yet — /api/knowledge/datapoints POST not registered
  createDataPoint: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — /api/knowledge/datapoints/:id/deactivate not registered
  deactivateDataPoint: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — /api/knowledge/datapoints/:id/activate not registered
  activateDataPoint: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — /api/knowledge/feedback/stats not registered
  feedbackStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // POST /api/cognee/memify/trigger
  triggerMemify: async (datasets: string[]): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/cognee/memify/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ datasets }),
    });
    if (!res.ok) throw new Error(`triggerMemify failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // GET /api/cognee/graph/:userId — returns graph metadata and dataset list
  graphStats: async (userId: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/cognee/graph/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`graphStats failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // GET /api/cognee/graph/:userId — same endpoint as graphStats
  getGraph: async (userId: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/cognee/graph/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`getGraph failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // TODO: no server endpoint yet — /api/knowledge/feedback POST not registered
  submitFeedback: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — /api/knowledge/ontologies GET not registered
  listOntologies: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  // TODO: no server endpoint yet — /api/knowledge/ontologies POST not registered
  createOntology: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — /api/knowledge/ontologies/:id/apply not registered
  applyOntology: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const inventoryApi: StubApi = {
  listItems: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getStockLevels: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getValuation: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  updateItem: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  createItem: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deactivateItem: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getMovements: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  listWarehouses: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createWarehouse: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// TODO: no server routes for matches API — PaymentMatchingService exists in
// server/src/services/payment-matching but is not exposed via any HTTP routes
export const matchesApi: StubApi = {
  autoMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  confirm: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  reject: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  findCandidates: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  scoreMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listRules: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deleteRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const reconApi = {
  // GET /api/reconciliation-alerts — list reconciliation alerts
  listAlerts: async (params?: { showResolved?: boolean }): Promise<Record<string, unknown>[]> => {
    const qp = new URLSearchParams();
    if (params?.showResolved) qp.set('showResolved', 'true');
    const res = await fetch(`${API_URL}/reconciliation-alerts?${qp}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`reconciliation alerts list failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>[]>;
  },
  // POST /api/reconciliation-alerts/:id/resolve — resolve a reconciliation alert
  resolveAlert: async (alertId: string, notes?: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/reconciliation-alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ notes: notes ?? null }),
    });
    if (!res.ok) throw new Error(`resolve alert failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // TODO: no server route — BankReconciliationService exists but is not wired to HTTP routes
  listSessions: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  autoMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  completeSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  confirmMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  createManualMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getRules: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// budgetsApi — wired to /api/analytics/budgets where server routes exist.
// Confirmed routes: GET /api/analytics/budgets, POST /api/analytics/budgets
// get/:id, addLine, update, getVariance, getVarianceSummary have no registered routes.
export const budgetsApi = {
  // GET /api/analytics/budgets
  list: async (params?: { status?: string }): Promise<Record<string, unknown>> => {
    const qp = new URLSearchParams();
    if (params?.status) qp.set('status', params.status);
    const res = await fetch(`${API_URL}/analytics/budgets?${qp}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`budgets list failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // POST /api/analytics/budgets
  create: async (body: {
    name: string;
    budgetType: string;
    periodStart: string;
    periodEnd: string;
    accountId?: string;
    autoGenerate?: boolean;
    lookbackMonths?: number;
  }): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/analytics/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`budgets create failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // TODO: no server endpoint yet — GET /api/analytics/budgets/:id not registered
  get: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — POST /api/analytics/budgets/:id/lines not registered
  addLine: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — PATCH /api/analytics/budgets/:id not registered
  update: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — GET /api/analytics/budgets/:id/variance not registered
  getVariance: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server endpoint yet — GET /api/analytics/budgets/:id/variance-summary not registered
  getVarianceSummary: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// TODO: no server routes for loan API — LoanCalculatorService exists in
// server/src/services/loan-calculator but is not exposed via any HTTP routes
export const loanApi: StubApi = {
  calculateCarFinance: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculateHomeLoan: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  calculateRefinanceSavings: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculateBorrowingCapacity: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculatePersonalLoan: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
};

export const anomalyApi = {
  // GET /api/analytics/anomalies
  list: async (params?: {
    severity?: string;
    status?: string;
  }): Promise<Record<string, unknown>[]> => {
    const qp = new URLSearchParams();
    if (params?.severity) qp.set('severity', params.severity);
    if (params?.status) qp.set('status', params.status);
    const res = await fetch(`${API_URL}/analytics/anomalies?${qp}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`anomaly list failed: ${res.status}`);
    const json = (await res.json()) as
      | { data?: Record<string, unknown>[] }
      | Record<string, unknown>[];
    return Array.isArray(json) ? json : ((json as { data?: Record<string, unknown>[] }).data ?? []);
  },
  // POST /api/analytics/anomalies/:id/dismiss
  dismiss: async (alertId: string, reason?: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/analytics/anomalies/${alertId}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason: reason ?? 'dismissed' }),
    });
    if (!res.ok) throw new Error(`anomaly dismiss failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },
  // TODO: no server route for anomaly stats
  stats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for anomaly scan trigger
  scan: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for anomaly acknowledge
  acknowledge: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  // TODO: no server route for anomaly resolve
  resolve: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const complianceApi: StubApi = {
  calendar: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  obligations: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  risk: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  report: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generateSchedule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  lodge: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const consolidationApi: StubApi = {
  generate: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getSnapshots: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getSnapshotDetail: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  finalizeSnapshot: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const documentsApi = {
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  delete: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  upload: async (..._args: unknown[]) =>
    Promise.resolve({} as { id?: string } & Record<string, unknown>),
  process: async (..._args: unknown[]) =>
    Promise.resolve({} as { confidenceScore?: number } & Record<string, unknown>),
  get: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  classify: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getLineItems: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  batchProcess: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const forecastsApi: StubApi = {
  listScenarios: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createScenario: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generateForecast: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getScenario: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  compareScenarios: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const transactionsApi = {
  fetchAuditLog: async (_options?: unknown) =>
    Promise.resolve({ entries: [] as unknown[], total: 0 }),
};

export const adminLogin = async (
  username: string,
  password: string,
): Promise<{ token: string; refreshToken?: string; user?: { username: string; role: string } }> => {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(data.error || `Login failed (${res.status})`);
  }
  return res.json();
};
// TODO: no server route for activity log
export const fetchActivityLog = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for activity summary
export const fetchActivitySummary = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// GET /api/admin/me — admin profile (uses admin JWT)
export const fetchAdminProfile = async (): Promise<Record<string, unknown>> => {
  const res = await fetch(`${API_URL}/admin/me`, { headers: getAdminAuthHeaders() });
  if (!res.ok) throw new Error(`Admin profile fetch failed (${res.status})`);
  const data = await res.json();
  return data.admin ?? data;
};
// TODO: no server route for admin user list
export const fetchAdminUsers = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for agent configs
export const fetchAgentConfigs = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for agent costs
export const fetchAgentCosts = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for agent executions
export const fetchAgentExecutions = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for agent stats
export const fetchAgentStats = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for best rates (CDR not mounted in index.ts)
export const fetchBestRates = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for CDR alerts
export const fetchCdrAlerts = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for CDR products
export const fetchCdrProducts = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for Cognee admin datasets
export const fetchCogneeAdminDatasets = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for Cognee dataset detail
export const fetchCogneeDatasetDetail = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for Cognee graph stats
export const fetchCogneeGraphStats = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for CDR data holders
export const fetchDataHolders = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for disk usage
export const fetchDiskUsage = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for feature flags
export const fetchFeatureFlags = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for health history
export const fetchHealthHistory = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for system health dashboard
export const fetchSystemHealth = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for system metrics
export const fetchSystemMetrics = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for Cognee search test
export const testCogneeSearch = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// POST /api/cognee/reindex — triggers re-indexing of datasets for a user
export const reindexCogneeDataset = async (
  userId: string,
  datasets?: string[],
): Promise<Record<string, unknown>> => {
  const res = await fetch(`${API_URL}/cognee/reindex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ userId, datasets }),
  });
  if (!res.ok) throw new Error(`reindexCogneeDataset failed: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
};
// TODO: no server route for CDR crawl trigger
export const triggerCdrCrawl = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for CDR product comparison
export const compareCdrProducts = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for savings calculation
export const calculateSavings = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for admin user creation
export const createAdminUser = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for CDR alert creation
export const createCdrAlert = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for feature flag creation
export const createFeatureFlag = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for admin user deletion
export const deleteAdminUser = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for CDR alert deletion
export const deleteCdrAlert = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for admin user update
export const updateAdminUser = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for agent config update
export const updateAgentConfig = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);
// TODO: no server route for feature flag update
export const updateFeatureFlag = async (..._args: unknown[]): Promise<Record<string, unknown>> =>
  Promise.resolve({} as Record<string, unknown>);

export interface LedgerSummary {
  totalTransactions: number;
  totalUsers: number;
  totalIncomeCents: number;
  totalExpensesCents: number;
  earliestTransaction: string | null;
  latestTransaction: string | null;
}

export interface BASSummary {
  totalPeriods: number;
  lodgedCount: number;
  draftCount: number;
  usersWithBas: number;
}

export const fetchAdminLedgerSummary = async (): Promise<LedgerSummary> => {
  const res = await fetch(`${API_URL}/admin/ledger-summary`, { headers: getAdminAuthHeaders() });
  if (!res.ok) throw new Error(`Ledger summary failed (${res.status})`);
  return res.json();
};

export const fetchAdminBasSummary = async (): Promise<BASSummary> => {
  const res = await fetch(`${API_URL}/admin/bas-summary`, { headers: getAdminAuthHeaders() });
  if (!res.ok) throw new Error(`BAS summary failed (${res.status})`);
  return res.json();
};

export const dashboardApi = {
  fetchDashboards: async (): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/dashboards?userId=default`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboards');
    return res.json();
  },

  fetchDashboard: async (id: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/dashboards/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  createDashboard: async (data: {
    name: string;
    description?: string;
    layout: unknown;
  }): Promise<unknown> => {
    const res = await fetch(`${API_URL}/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create dashboard');
    return res.json();
  },

  updateDashboard: async (
    id: string,
    data: { name?: string; description?: string; layout?: unknown; isDefault?: boolean },
  ): Promise<unknown> => {
    const res = await fetch(`${API_URL}/dashboards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update dashboard');
    return res.json();
  },

  deleteDashboard: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/dashboards/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete dashboard');
  },

  fetchSavedCharts: async (dashboardId?: string): Promise<unknown[]> => {
    const params = new URLSearchParams({ userId: 'default' });
    if (dashboardId) params.set('dashboardId', dashboardId);
    const res = await fetch(`${API_URL}/charts?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch saved charts');
    return res.json();
  },

  saveChart: async (data: {
    dashboardId?: string;
    chartType: string;
    title: string;
    config: unknown;
  }): Promise<unknown> => {
    const res = await fetch(`${API_URL}/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save chart');
    return res.json();
  },

  deleteChart: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/charts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete chart');
  },
};
