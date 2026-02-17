import { API_URL, getAuthHeaders } from './client';

type StubApi = Record<string, (...args: unknown[]) => Promise<unknown>>;

export const entityApi: StubApi = {
  createEntity: async (_data: unknown) => Promise.resolve({} as Record<string, unknown>),
  getHierarchy: async () => Promise.resolve({} as Record<string, unknown>),
  updateSettings: async (_id: string, _settings: unknown) => Promise.resolve(),
  getInterEntityTransactions: async (_filters: unknown) =>
    Promise.resolve([] as Record<string, unknown>[]),
  confirmInterEntityTransaction: async (_id: string, _entityId: string, _confirmed: boolean) =>
    Promise.resolve(),
  recordInterEntityTransaction: async (_data: unknown) => Promise.resolve(),
};

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

export const forecastApi: StubApi = {
  calculateAccuracy: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  updateActuals: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getById: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generate: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  archive: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  compare: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const intelligenceApi: StubApi = {
  findCorrelations: async (..._args: unknown[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  listInsights: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  updateInsightStatus: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  listSubscriptions: async (..._args: unknown[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  scanInsights: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getTimeline: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getConnections: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  subscribe: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deleteSubscription: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  listSavedQueries: async (..._args: unknown[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  executeQuery: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  saveQuery: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const knowledgeApi: StubApi = {
  listDataPoints: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createDataPoint: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deactivateDataPoint: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  activateDataPoint: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  feedbackStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  triggerMemify: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  graphStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getGraph: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  submitFeedback: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listOntologies: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createOntology: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
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

export const reconApi: StubApi = {
  listSessions: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  autoMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  completeSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  confirmMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  createManualMatch: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  getRules: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const budgetsApi: StubApi = {
  get: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  addLine: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  update: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  create: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getVariance: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getVarianceSummary: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
};

export const loanApi: StubApi = {
  calculateCarFinance: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculateHomeLoan: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculateRefinanceSavings: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculateBorrowingCapacity: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  calculatePersonalLoan: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
};

export const anomalyApi: StubApi = {
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  stats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  scan: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  acknowledge: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  resolve: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  dismiss: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const complianceApi: StubApi = {
  calendar: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  obligations: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  risk: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  report: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generateSchedule: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  lodge: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const consolidationApi: StubApi = {
  generate: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getSnapshots: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getSnapshotDetail: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  finalizeSnapshot: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
};

export const documentsApi: StubApi = {
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  delete: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  upload: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  process: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  get: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  classify: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getLineItems: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  batchProcess: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const forecastsApi: StubApi = {
  listScenarios: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createScenario: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generateForecast: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
  getScenario: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  compareScenarios: async (..._args: unknown[]) =>
    Promise.resolve({} as Record<string, unknown>),
};

export const transactionsApi = {
  fetchAuditLog: async (_options?: unknown) =>
    Promise.resolve({ entries: [] as unknown[], total: 0 }),
};

export const adminLogin = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchActivityLog = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchActivitySummary = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchAdminProfile = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchAdminUsers = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentConfigs = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentCosts = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentExecutions = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentStats = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchBestRates = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchCdrAlerts = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchCdrProducts = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchCogneeAdminDatasets = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchCogneeDatasetDetail = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchCogneeGraphStats = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchDataHolders = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchDiskUsage = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchFeatureFlags = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchHealthHistory = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchSystemHealth = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const fetchSystemMetrics = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const testCogneeSearch = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const reindexCogneeDataset = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const triggerCdrCrawl = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const compareCdrProducts = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const calculateSavings = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const createAdminUser = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const createCdrAlert = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const createFeatureFlag = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const deleteAdminUser = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const deleteCdrAlert = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const updateAdminUser = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const updateAgentConfig = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);
export const updateFeatureFlag = async (
  ..._args: unknown[]
): Promise<Record<string, unknown>> => Promise.resolve({} as Record<string, unknown>);

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
