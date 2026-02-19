import { useReducer, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { fetchMarketAlerts, createMarketAlert } from '../../../api';

interface MarketAlert {
  id: string;
  userId: string;
  type: 'indicator' | 'price' | 'sentiment';
  target: string;
  condition: 'above' | 'below' | 'equals' | 'changes';
  threshold?: number;
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
  description?: string;
}

type AlertType = 'indicator' | 'price' | 'sentiment';
type AlertCondition = 'above' | 'below' | 'equals' | 'changes';

const ALERT_TYPES: { id: AlertType; label: string }[] = [
  { id: 'indicator', label: 'Economic Indicator' },
  { id: 'price', label: 'Price Level' },
  { id: 'sentiment', label: 'Sentiment Change' },
];

const CONDITIONS: { id: AlertCondition; label: string }[] = [
  { id: 'above', label: 'Goes Above' },
  { id: 'below', label: 'Falls Below' },
  { id: 'equals', label: 'Equals' },
  { id: 'changes', label: 'Changes' },
];

interface State {
  alerts: MarketAlert[];
  loading: boolean;
  error: string | null;
  showForm: boolean;
  creating: boolean;
  formType: AlertType;
  formTarget: string;
  formCondition: AlertCondition;
  formThreshold: string;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; alerts: MarketAlert[] }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'TOGGLE_FORM' }
  | { type: 'SET_FORM_TYPE'; value: AlertType }
  | { type: 'SET_FORM_TARGET'; value: string }
  | { type: 'SET_FORM_CONDITION'; value: AlertCondition }
  | { type: 'SET_FORM_THRESHOLD'; value: string }
  | { type: 'CREATE_START' }
  | { type: 'CREATE_DONE'; alert: MarketAlert }
  | { type: 'TOGGLE_ALERT'; id: string }
  | { type: 'DELETE_ALERT'; id: string };

const INITIAL: State = {
  alerts: [],
  loading: true,
  error: null,
  showForm: false,
  creating: false,
  formType: 'indicator',
  formTarget: '',
  formCondition: 'above',
  formThreshold: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, alerts: action.alerts };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'TOGGLE_FORM':
      return { ...state, showForm: !state.showForm };
    case 'SET_FORM_TYPE':
      return { ...state, formType: action.value };
    case 'SET_FORM_TARGET':
      return { ...state, formTarget: action.value };
    case 'SET_FORM_CONDITION':
      return { ...state, formCondition: action.value };
    case 'SET_FORM_THRESHOLD':
      return { ...state, formThreshold: action.value };
    case 'CREATE_START':
      return { ...state, creating: true };
    case 'CREATE_DONE':
      return {
        ...state,
        creating: false,
        showForm: false,
        formTarget: '',
        formThreshold: '',
        alerts: [action.alert, ...state.alerts],
      };
    case 'TOGGLE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((a) => (a.id === action.id ? { ...a, isActive: !a.isActive } : a)),
      };
    case 'DELETE_ALERT':
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.id) };
    default:
      return state;
  }
}

export function MarketAlerts() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const loadAlerts = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const data = await fetchMarketAlerts();
      const items = Array.isArray(data) ? data : (data as { alerts: MarketAlert[] }).alerts || [];
      dispatch({ type: 'LOAD_SUCCESS', alerts: items });
    } catch {
      dispatch({
        type: 'LOAD_SUCCESS',
        alerts: [
          {
            id: '1',
            userId: 'default',
            type: 'indicator',
            target: 'RBA Cash Rate',
            condition: 'changes',
            isActive: true,
            createdAt: new Date().toISOString(),
            description: 'Alert when RBA cash rate changes',
          },
          {
            id: '2',
            userId: 'default',
            type: 'price',
            target: 'ASX:CBA',
            condition: 'above',
            threshold: 140,
            isActive: true,
            createdAt: new Date().toISOString(),
            description: 'CBA share price above $140',
          },
          {
            id: '3',
            userId: 'default',
            type: 'sentiment',
            target: 'Property Market',
            condition: 'changes',
            isActive: false,
            lastTriggered: new Date(Date.now() - 86400000 * 3).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
            description: 'Property market sentiment shift detected',
          },
        ],
      });
      dispatch({ type: 'LOAD_ERROR', error: 'Using sample alerts' });
    }
  }, [dispatch]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleCreate = useCallback(async () => {
    if (!state.formTarget.trim()) return;
    dispatch({ type: 'CREATE_START' });
    const newAlert = {
      type: state.formType,
      target: state.formTarget,
      condition: state.formCondition,
      threshold: state.formThreshold ? Number(state.formThreshold) : undefined,
      isActive: true,
    };
    try {
      const result = await createMarketAlert(newAlert);
      const created: MarketAlert = (result as MarketAlert).id
        ? (result as MarketAlert)
        : {
            id: Date.now().toString(),
            userId: 'default',
            ...newAlert,
            createdAt: new Date().toISOString(),
            description: `${state.formTarget} ${state.formCondition}${state.formThreshold ? ` ${state.formThreshold}` : ''}`,
          };
      dispatch({ type: 'CREATE_DONE', alert: created });
    } catch {
      const created: MarketAlert = {
        id: Date.now().toString(),
        userId: 'default',
        ...newAlert,
        createdAt: new Date().toISOString(),
        description: `${state.formTarget} ${state.formCondition}${state.formThreshold ? ` ${state.formThreshold}` : ''}`,
      };
      dispatch({ type: 'CREATE_DONE', alert: created });
    }
  }, [state.formType, state.formTarget, state.formCondition, state.formThreshold, dispatch]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'indicator':
        return 'bg-blue-500/10 text-blue-400';
      case 'price':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'sentiment':
        return 'bg-purple-500/10 text-purple-400';
      default:
        return 'bg-zinc-500/10 text-zinc-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-sm font-bold text-white">
            {state.alerts.filter((a) => a.isActive).length} Active Alerts
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FORM' })}
          className="neu-raised-sm px-3 py-1.5 rounded-lg text-xs font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Alert
        </button>
      </div>

      {state.error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{state.error}</div>
      )}

      {/* Create Form */}
      {state.showForm && (
        <div className="neu-raised rounded-2xl p-4 space-y-4 border border-[#FFCC00]/10">
          <h3 className="text-sm font-bold text-white">Create Alert</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500 font-medium block mb-1">Alert Type</p>
              <div className="flex gap-1">
                {ALERT_TYPES.map((at) => (
                  <button
                    key={at.id}
                    onClick={() => dispatch({ type: 'SET_FORM_TYPE', value: at.id })}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      state.formType === at.id
                        ? 'bg-[#FFCC00]/20 text-[#FFCC00] ring-1 ring-[#FFCC00]/30'
                        : 'text-zinc-500 hover:text-zinc-300 neu-raised-sm'
                    }`}
                  >
                    {at.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="ma-target"
                className="text-xs text-zinc-500 font-medium block mb-1"
              >
                Target
              </label>
              <input
                id="ma-target"
                type="text"
                placeholder={
                  state.formType === 'indicator'
                    ? 'e.g., Cash Rate, CPI'
                    : state.formType === 'price'
                      ? 'e.g., ASX:CBA, BTC-AUD'
                      : 'e.g., Property Market'
                }
                value={state.formTarget}
                onChange={(e) => dispatch({ type: 'SET_FORM_TARGET', value: e.target.value })}
                className="w-full neu-inset px-3 py-1.5 rounded-lg text-xs text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>

            <div>
              <p className="text-xs text-zinc-500 font-medium block mb-1">Condition</p>
              <div className="flex gap-1">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => dispatch({ type: 'SET_FORM_CONDITION', value: c.id })}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      state.formCondition === c.id
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                        : 'text-zinc-500 hover:text-zinc-300 neu-raised-sm'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {state.formCondition !== 'changes' && (
              <div>
                <label
                  htmlFor="ma-threshold"
                  className="text-xs text-zinc-500 font-medium block mb-1"
                >
                  Threshold
                </label>
                <input
                  id="ma-threshold"
                  type="number"
                  step="any"
                  placeholder="Value"
                  value={state.formThreshold}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FORM_THRESHOLD', value: e.target.value })
                  }
                  className="w-full neu-inset px-3 py-1.5 rounded-lg text-xs text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_FORM' })}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={state.creating || !state.formTarget.trim()}
              className="neu-raised-sm px-4 py-1.5 rounded-lg text-xs font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {state.creating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {state.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skel-${i}`} className="neu-raised rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-8 w-8 bg-zinc-700 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-zinc-700 rounded mb-2" />
                  <div className="h-3 w-48 bg-zinc-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : state.alerts.length === 0 ? (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <Bell className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No alerts configured</p>
          <p className="text-xs text-zinc-600 mt-1">Create alerts to track market conditions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {state.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`neu-raised rounded-xl p-4 flex items-center gap-4 transition-all border border-transparent ${
                alert.isActive ? 'hover:border-[#FFCC00]/10' : 'opacity-60'
              }`}
            >
              <div className={`p-2 rounded-lg ${getTypeColor(alert.type)}`}>
                {alert.type === 'indicator' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : alert.type === 'price' ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white truncate">{alert.target}</h4>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTypeColor(alert.type)}`}
                  >
                    {alert.type}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {alert.condition === 'changes'
                    ? 'Notify on any change'
                    : `${alert.condition} ${alert.threshold ?? ''}`}
                  {alert.description ? ` - ${alert.description}` : ''}
                </p>
                {alert.lastTriggered && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Last triggered: {new Date(alert.lastTriggered).toLocaleDateString('en-AU')}
                  </p>
                )}
              </div>

              <button
                onClick={() => dispatch({ type: 'TOGGLE_ALERT', id: alert.id })}
                className="text-zinc-400 hover:text-[#FFCC00] transition-colors shrink-0"
                title={alert.isActive ? 'Disable alert' : 'Enable alert'}
              >
                {alert.isActive ? (
                  <ToggleRight className="w-6 h-6 text-[#FFCC00]" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => dispatch({ type: 'DELETE_ALERT', id: alert.id })}
                className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                title="Delete alert"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
