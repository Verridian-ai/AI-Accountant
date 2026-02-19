import { useEffect, useCallback, useReducer } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ArrowUpDown,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchCdrProducts } from '@/api';

interface CdrProduct {
  id: string;
  productId: string;
  dataHolderBrand: string;
  name: string;
  description: string;
  category: string;
  rateType: string;
  baseRate: number | null;
  comparisonRate: number | null;
  features: string[];
  loanPurpose: string | null;
  isActive: boolean;
}

interface ProductExplorerProps {
  onCompare?: (productIds: string[]) => void;
}

const CATEGORIES = [
  'ALL', 'HOME_LOAN', 'PERSONAL_LOAN', 'SAVINGS', 'TERM_DEPOSIT', 'CREDIT_CARD', 'TRANSACTION',
];
const RATE_TYPES = ['ALL', 'FIXED', 'VARIABLE', 'INTRODUCTORY'];
const SORT_OPTIONS = [
  { value: 'rate_asc', label: 'Rate: Low to High' },
  { value: 'rate_desc', label: 'Rate: High to Low' },
  { value: 'name_asc', label: 'Name: A-Z' },
  { value: 'provider_asc', label: 'Provider: A-Z' },
];
const PAGE_SIZE = 20;

interface State {
  products: CdrProduct[];
  loading: boolean;
  error: string | null;
  category: string;
  rateType: string;
  search: string;
  sort: string;
  page: number;
  total: number;
  selectedIds: Set<string>;
  showFilters: boolean;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; products: CdrProduct[]; total: number }
  | { type: 'LOAD_ERROR' }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'SET_RATE_TYPE'; value: string }
  | { type: 'SET_SEARCH'; value: string }
  | { type: 'SET_SORT'; value: string }
  | { type: 'SET_PAGE'; value: number }
  | { type: 'TOGGLE_SELECT'; id: string }
  | { type: 'CLEAR_SELECTED' }
  | { type: 'TOGGLE_FILTERS' };

const INITIAL: State = {
  products: [],
  loading: true,
  error: null,
  category: 'ALL',
  rateType: 'ALL',
  search: '',
  sort: 'rate_asc',
  page: 1,
  total: 0,
  selectedIds: new Set(),
  showFilters: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, products: action.products, total: action.total };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: 'Failed to load products' };
    case 'SET_CATEGORY':
      return { ...state, category: action.value, page: 1 };
    case 'SET_RATE_TYPE':
      return { ...state, rateType: action.value, page: 1 };
    case 'SET_SEARCH':
      return { ...state, search: action.value, page: 1 };
    case 'SET_SORT':
      return { ...state, sort: action.value };
    case 'SET_PAGE':
      return { ...state, page: action.value };
    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else if (next.size < 5) {
        next.add(action.id);
      }
      return { ...state, selectedIds: next };
    }
    case 'CLEAR_SELECTED':
      return { ...state, selectedIds: new Set() };
    case 'TOGGLE_FILTERS':
      return { ...state, showFilters: !state.showFilters };
    default:
      return state;
  }
}

export function ProductExplorer({ onCompare }: ProductExplorerProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const loadProducts = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const filters: Record<string, string> = {};
      if (state.category !== 'ALL') filters.category = state.category;
      if (state.rateType !== 'ALL') filters.rateType = state.rateType;
      if (state.search) filters.search = state.search;
      filters.sort = state.sort;
      filters.page = String(state.page);
      filters.limit = String(PAGE_SIZE);
      const result = await fetchCdrProducts(filters);
      dispatch({
        type: 'LOAD_SUCCESS',
        products: result.products ?? result ?? [],
        total: result.total ?? (result.products ?? result)?.length ?? 0,
      });
    } catch (e) {
      dispatch({ type: 'LOAD_ERROR' });
      console.error(e);
    }
  }, [state.category, state.rateType, state.search, state.sort, state.page, dispatch]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const formatRate = (rate: number | null) =>
    rate != null ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="neu-raised rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search products, providers..."
              value={state.search}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
              className="w-full neu-inset rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 bg-transparent placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_FILTERS' })}
            className={cn(
              'neu-raised-sm p-2.5 rounded-xl transition-colors',
              state.showFilters ? 'text-cba-gold' : 'text-secondary hover:text-primary',
            )}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {state.showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
            <div>
              <label
                htmlFor="pe-category"
                className="text-xs text-muted font-semibold uppercase tracking-wider mb-1 block"
              >
                Category
              </label>
              <select
                id="pe-category"
                value={state.category}
                onChange={(e) => dispatch({ type: 'SET_CATEGORY', value: e.target.value })}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#23272f]">
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="pe-rate-type"
                className="text-xs text-muted font-semibold uppercase tracking-wider mb-1 block"
              >
                Rate Type
              </label>
              <select
                id="pe-rate-type"
                value={state.rateType}
                onChange={(e) => dispatch({ type: 'SET_RATE_TYPE', value: e.target.value })}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {RATE_TYPES.map((r) => (
                  <option key={r} value={r} className="bg-[#23272f]">
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="pe-sort"
                className="text-xs text-muted font-semibold uppercase tracking-wider mb-1 block"
              >
                Sort
              </label>
              <select
                id="pe-sort"
                value={state.sort}
                onChange={(e) => dispatch({ type: 'SET_SORT', value: e.target.value })}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#23272f]">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {state.loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`skel-${i}`} className="neu-raised rounded-2xl p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 bg-zinc-700/40 rounded" />
              <div className="h-8 w-1/2 bg-zinc-700/40 rounded" />
              <div className="h-3 w-full bg-zinc-700/40 rounded" />
            </div>
          ))}
        </div>
      )}

      {state.error && (
        <div className="neu-raised rounded-2xl p-6 text-center text-red-400">
          <p>{state.error}</p>
          <button onClick={loadProducts} className="mt-2 text-sm text-cba-gold hover:underline">
            Retry
          </button>
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {state.total} product{state.total !== 1 ? 's' : ''} found
            </span>
            <span>
              Page {state.page} of {totalPages}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {state.products.map((product) => (
              <div
                key={product.id}
                className={cn(
                  'neu-raised rounded-2xl p-5 space-y-3 transition-all duration-200 border',
                  state.selectedIds.has(product.id)
                    ? 'border-cba-gold/50 shadow-[0_0_20px_rgba(255,204,0,0.1)]'
                    : 'border-transparent hover:border-border',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="neu-inset p-1.5 rounded-lg shrink-0">
                      <Building2 className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted truncate">{product.dataHolderBrand}</p>
                      <p className="text-sm font-bold text-zinc-100 truncate">{product.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_SELECT', id: product.id })}
                    className={cn(
                      'shrink-0 p-1 rounded-lg transition-colors',
                      state.selectedIds.has(product.id)
                        ? 'bg-cba-gold/20 text-cba-gold'
                        : 'text-zinc-600 hover:text-secondary',
                    )}
                    title={
                      state.selectedIds.has(product.id)
                        ? 'Remove from comparison'
                        : 'Add to comparison'
                    }
                  >
                    {state.selectedIds.has(product.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div>
                  <span className="text-2xl font-black text-cba-gold">
                    {formatRate(product.baseRate)}
                  </span>
                  {product.comparisonRate != null && (
                    <span className="text-xs text-muted ml-2">
                      {formatRate(product.comparisonRate)} comparison
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full neu-inset text-secondary font-semibold uppercase">
                    {product.category?.replace(/_/g, ' ') ?? 'N/A'}
                  </span>
                  {product.rateType && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full neu-inset text-secondary font-semibold uppercase">
                      {product.rateType}
                    </span>
                  )}
                </div>

                {product.features && product.features.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {product.features.slice(0, 3).map((f) => (
                      <span
                        key={f}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium"
                      >
                        {f}
                      </span>
                    ))}
                    {product.features.length > 3 && (
                      <span className="text-[10px] text-zinc-600">
                        +{product.features.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {state.products.length === 0 && (
            <div className="neu-raised rounded-2xl p-12 text-center">
              <p className="text-muted">No products match your filters</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => dispatch({ type: 'SET_PAGE', value: Math.max(1, state.page - 1) })}
                disabled={state.page <= 1}
                className="neu-raised-sm p-2 rounded-xl text-secondary hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(state.page - 2, totalPages - 4));
                const n = start + i;
                if (n > totalPages) return null;
                return (
                  <button
                    key={n}
                    onClick={() => dispatch({ type: 'SET_PAGE', value: n })}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-bold transition-colors',
                      state.page === n
                        ? 'bg-cba-gold text-base'
                        : 'neu-raised-sm text-secondary hover:text-primary',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                onClick={() =>
                  dispatch({ type: 'SET_PAGE', value: Math.min(totalPages, state.page + 1) })
                }
                disabled={state.page >= totalPages}
                className="neu-raised-sm p-2 rounded-xl text-secondary hover:text-primary disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {state.selectedIds.size >= 2 && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 neu-raised rounded-2xl px-5 py-3 flex items-center gap-4 shadow-[0_0_30px_rgba(255,204,0,0.15)] border border-cba-gold/20">
          <span className="text-sm font-bold text-primary">{state.selectedIds.size} selected</span>
          <button
            onClick={() => onCompare?.(Array.from(state.selectedIds))}
            className="px-4 py-2 rounded-xl bg-cba-gold text-base text-sm font-bold hover:bg-[#FFD633] transition-colors"
          >
            Compare
          </button>
          <button
            onClick={() => dispatch({ type: 'CLEAR_SELECTED' })}
            className="p-1.5 rounded-lg text-secondary hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
