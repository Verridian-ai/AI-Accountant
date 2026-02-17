import { API_URL, getAuthHeaders } from './client';

export const entityApi: any = {
  createEntity: async (_data: any) => Promise.resolve({} as any),
  getHierarchy: async () => Promise.resolve({} as any),
  updateSettings: async (_id: string, _settings: any) => Promise.resolve(),
  getInterEntityTransactions: async (_filters: any) => Promise.resolve([] as any[]),
  confirmInterEntityTransaction: async (_id: string, _entityId: string, _confirmed: boolean) =>
    Promise.resolve(),
  recordInterEntityTransaction: async (_data: any) => Promise.resolve(),
};

export const assetApi: any = {
  disposeAsset: async (..._args: any[]) => Promise.resolve({} as any),
  getRegister: async (..._args: any[]) => Promise.resolve({ assets: [] } as any),
  getDepreciationSchedule: async (..._args: any[]) => Promise.resolve({} as any),
  runBatchDepreciation: async (..._args: any[]) => Promise.resolve({} as any),
  registerAsset: async (..._args: any[]) => Promise.resolve({} as any),
};

export const forecastApi: any = {
  calculateAccuracy: async (..._args: any[]) => Promise.resolve({} as any),
  updateActuals: async (..._args: any[]) => Promise.resolve({} as any),
  list: async (..._args: any[]) => Promise.resolve([] as any[]),
  getById: async (..._args: any[]) => Promise.resolve({} as any),
  generate: async (..._args: any[]) => Promise.resolve({} as any),
  archive: async (..._args: any[]) => Promise.resolve({} as any),
  compare: async (..._args: any[]) => Promise.resolve({} as any),
};

export const intelligenceApi: any = {
  findCorrelations: async (..._args: any[]) => Promise.resolve([] as any[]),
  listInsights: async (..._args: any[]) => Promise.resolve([] as any[]),
  updateInsightStatus: async (..._args: any[]) => Promise.resolve({} as any),
  listSubscriptions: async (..._args: any[]) => Promise.resolve([] as any[]),
  scanInsights: async (..._args: any[]) => Promise.resolve({} as any),
  getTimeline: async (..._args: any[]) => Promise.resolve({} as any),
  getConnections: async (..._args: any[]) => Promise.resolve({} as any),
  subscribe: async (..._args: any[]) => Promise.resolve({} as any),
  deleteSubscription: async (..._args: any[]) => Promise.resolve({} as any),
  listSavedQueries: async (..._args: any[]) => Promise.resolve([] as any[]),
  executeQuery: async (..._args: any[]) => Promise.resolve({} as any),
  saveQuery: async (..._args: any[]) => Promise.resolve({} as any),
};

export const knowledgeApi: any = {
  listDataPoints: async (..._args: any[]) => Promise.resolve([] as any[]),
  createDataPoint: async (..._args: any[]) => Promise.resolve({} as any),
  deactivateDataPoint: async (..._args: any[]) => Promise.resolve({} as any),
  activateDataPoint: async (..._args: any[]) => Promise.resolve({} as any),
  feedbackStats: async (..._args: any[]) => Promise.resolve({} as any),
  triggerMemify: async (..._args: any[]) => Promise.resolve({} as any),
  graphStats: async (..._args: any[]) => Promise.resolve({} as any),
  getGraph: async (..._args: any[]) => Promise.resolve({} as any),
  submitFeedback: async (..._args: any[]) => Promise.resolve({} as any),
  listOntologies: async (..._args: any[]) => Promise.resolve([] as any[]),
  createOntology: async (..._args: any[]) => Promise.resolve({} as any),
  applyOntology: async (..._args: any[]) => Promise.resolve({} as any),
};

export const inventoryApi: any = {
  listItems: async (..._args: any[]) => Promise.resolve([] as any[]),
  getStockLevels: async (..._args: any[]) => Promise.resolve([] as any[]),
  getValuation: async (..._args: any[]) => Promise.resolve({} as any),
  updateItem: async (..._args: any[]) => Promise.resolve({} as any),
  createItem: async (..._args: any[]) => Promise.resolve({} as any),
  deactivateItem: async (..._args: any[]) => Promise.resolve({} as any),
  getMovements: async (..._args: any[]) => Promise.resolve([] as any[]),
  listWarehouses: async (..._args: any[]) => Promise.resolve([] as any[]),
  createWarehouse: async (..._args: any[]) => Promise.resolve({} as any),
};

export const matchesApi: any = {
  autoMatch: async (..._args: any[]) => Promise.resolve({} as any),
  confirm: async (..._args: any[]) => Promise.resolve({} as any),
  reject: async (..._args: any[]) => Promise.resolve({} as any),
  getStats: async (..._args: any[]) => Promise.resolve({} as any),
  findCandidates: async (..._args: any[]) => Promise.resolve([] as any[]),
  scoreMatch: async (..._args: any[]) => Promise.resolve({} as any),
  listRules: async (..._args: any[]) => Promise.resolve([] as any[]),
  createRule: async (..._args: any[]) => Promise.resolve({} as any),
  deleteRule: async (..._args: any[]) => Promise.resolve({} as any),
};

export const reconApi: any = {
  listSessions: async (..._args: any[]) => Promise.resolve([] as any[]),
  createSession: async (..._args: any[]) => Promise.resolve({} as any),
  getSession: async (..._args: any[]) => Promise.resolve({} as any),
  autoMatch: async (..._args: any[]) => Promise.resolve({} as any),
  completeSession: async (..._args: any[]) => Promise.resolve({} as any),
  confirmMatch: async (..._args: any[]) => Promise.resolve({} as any),
  createManualMatch: async (..._args: any[]) => Promise.resolve({} as any),
  getRules: async (..._args: any[]) => Promise.resolve([] as any[]),
  createRule: async (..._args: any[]) => Promise.resolve({} as any),
};

export const budgetsApi: any = {
  get: async (..._args: any[]) => Promise.resolve({} as any),
  addLine: async (..._args: any[]) => Promise.resolve({} as any),
  update: async (..._args: any[]) => Promise.resolve({} as any),
  list: async (..._args: any[]) => Promise.resolve([] as any[]),
  create: async (..._args: any[]) => Promise.resolve({} as any),
  getVariance: async (..._args: any[]) => Promise.resolve({} as any),
  getVarianceSummary: async (..._args: any[]) => Promise.resolve({} as any),
};

export const loanApi: any = {
  calculateCarFinance: async (..._args: any[]) => Promise.resolve({} as any),
  calculateHomeLoan: async (..._args: any[]) => Promise.resolve({} as any),
  calculateRefinanceSavings: async (..._args: any[]) => Promise.resolve({} as any),
  calculateBorrowingCapacity: async (..._args: any[]) => Promise.resolve({} as any),
  calculatePersonalLoan: async (..._args: any[]) => Promise.resolve({} as any),
};

export const anomalyApi: any = {
  list: async (..._args: any[]) => Promise.resolve([] as any[]),
  stats: async (..._args: any[]) => Promise.resolve({} as any),
  scan: async (..._args: any[]) => Promise.resolve({} as any),
  acknowledge: async (..._args: any[]) => Promise.resolve({} as any),
  resolve: async (..._args: any[]) => Promise.resolve({} as any),
  dismiss: async (..._args: any[]) => Promise.resolve({} as any),
};

export const complianceApi: any = {
  calendar: async (..._args: any[]) => Promise.resolve([] as any[]),
  obligations: async (..._args: any[]) => Promise.resolve([] as any[]),
  risk: async (..._args: any[]) => Promise.resolve({} as any),
  report: async (..._args: any[]) => Promise.resolve({} as any),
  generateSchedule: async (..._args: any[]) => Promise.resolve({} as any),
  lodge: async (..._args: any[]) => Promise.resolve({} as any),
};

export const consolidationApi: any = {
  generate: async (..._args: any[]) => Promise.resolve({} as any),
  getSnapshots: async (..._args: any[]) => Promise.resolve([] as any[]),
  getSnapshotDetail: async (..._args: any[]) => Promise.resolve({} as any),
  finalizeSnapshot: async (..._args: any[]) => Promise.resolve({} as any),
};

export const documentsApi: any = {
  list: async (..._args: any[]) => Promise.resolve([] as any[]),
  delete: async (..._args: any[]) => Promise.resolve({} as any),
  upload: async (..._args: any[]) => Promise.resolve({} as any),
  process: async (..._args: any[]) => Promise.resolve({} as any),
  get: async (..._args: any[]) => Promise.resolve({} as any),
  classify: async (..._args: any[]) => Promise.resolve({} as any),
  getLineItems: async (..._args: any[]) => Promise.resolve([] as any[]),
  batchProcess: async (..._args: any[]) => Promise.resolve({} as any),
};

export const forecastsApi: any = {
  listScenarios: async (..._args: any[]) => Promise.resolve([] as any[]),
  createScenario: async (..._args: any[]) => Promise.resolve({} as any),
  generateForecast: async (..._args: any[]) => Promise.resolve({} as any),
  getScenario: async (..._args: any[]) => Promise.resolve({} as any),
  compareScenarios: async (..._args: any[]) => Promise.resolve({} as any),
};

export const transactionsApi = {
  fetchAuditLog: async (_options?: any) => Promise.resolve({ entries: [], total: 0 }),
};

export const adminLogin = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchActivityLog = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchActivitySummary = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchAdminProfile = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchAdminUsers = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchAgentConfigs = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchAgentCosts = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchAgentExecutions = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchAgentStats = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchBestRates = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchCdrAlerts = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchCdrProducts = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchCogneeAdminDatasets = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchCogneeDatasetDetail = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchCogneeGraphStats = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchDataHolders = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchDiskUsage = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchFeatureFlags = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchHealthHistory = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchSystemHealth = async (..._args: any[]) => Promise.resolve({} as any);
export const fetchSystemMetrics = async (..._args: any[]) => Promise.resolve({} as any);
export const testCogneeSearch = async (..._args: any[]) => Promise.resolve({} as any);
export const reindexCogneeDataset = async (..._args: any[]) => Promise.resolve({} as any);
export const triggerCdrCrawl = async (..._args: any[]) => Promise.resolve({} as any);
export const compareCdrProducts = async (..._args: any[]) => Promise.resolve({} as any);
export const calculateSavings = async (..._args: any[]) => Promise.resolve({} as any);
export const createAdminUser = async (..._args: any[]) => Promise.resolve({} as any);
export const createCdrAlert = async (..._args: any[]) => Promise.resolve({} as any);
export const createFeatureFlag = async (..._args: any[]) => Promise.resolve({} as any);
export const deleteAdminUser = async (..._args: any[]) => Promise.resolve({} as any);
export const deleteCdrAlert = async (..._args: any[]) => Promise.resolve({} as any);
export const updateAdminUser = async (..._args: any[]) => Promise.resolve({} as any);
export const updateAgentConfig = async (..._args: any[]) => Promise.resolve({} as any);
export const updateFeatureFlag = async (..._args: any[]) => Promise.resolve({} as any);

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
