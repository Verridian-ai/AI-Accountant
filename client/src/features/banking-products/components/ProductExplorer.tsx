import { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Check, X, ArrowUpDown, Building2 } from 'lucide-react';
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

const CATEGORIES = ['ALL', 'HOME_LOAN', 'PERSONAL_LOAN', 'SAVINGS', 'TERM_DEPOSIT', 'CREDIT_CARD', 'TRANSACTION'];
const RATE_TYPES = ['ALL', 'FIXED', 'VARIABLE', 'INTRODUCTORY'];
const SORT_OPTIONS = [
  { value: 'rate_asc', label: 'Rate: Low to High' },
  { value: 'rate_desc', label: 'Rate: High to Low' },
  { value: 'name_asc', label: 'Name: A-Z' },
  { value: 'provider_asc', label: 'Provider: A-Z' },
];
const PAGE_SIZE = 20;

export function ProductExplorer({ onCompare }: ProductExplorerProps) {
  const [products, setProducts] = useState<CdrProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('ALL');
  const [rateType, setRateType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('rate_asc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, string> = {};
      if (category !== 'ALL') filters.category = category;
      if (rateType !== 'ALL') filters.rateType = rateType;
      if (search) filters.search = search;
      filters.sort = sort;
      filters.page = String(page);
      filters.limit = String(PAGE_SIZE);
      const result = await fetchCdrProducts(filters);
      setProducts(result.products ?? result ?? []);
      setTotal(result.total ?? (result.products ?? result)?.length ?? 0);
    } catch (e) {
      setError('Failed to load products');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [category, rateType, search, sort, page]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 5) { next.add(id); }
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatRate = (rate: number | null) =>
    rate != null ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="neu-raised rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search products, providers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full neu-inset rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 bg-transparent placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "neu-raised-sm p-2.5 rounded-xl transition-colors",
              showFilters ? "text-[#FFCC00]" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5">
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-[#23272f]">{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1 block">Rate Type</label>
              <select
                value={rateType}
                onChange={(e) => { setRateType(e.target.value); setPage(1); }}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {RATE_TYPES.map(r => (
                  <option key={r} value={r} className="bg-[#23272f]">{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1 block">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value} className="bg-[#23272f]">{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 bg-zinc-700/40 rounded" />
              <div className="h-8 w-1/2 bg-zinc-700/40 rounded" />
              <div className="h-3 w-full bg-zinc-700/40 rounded" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="neu-raised rounded-2xl p-6 text-center text-red-400">
          <p>{error}</p>
          <button onClick={loadProducts} className="mt-2 text-sm text-[#FFCC00] hover:underline">Retry</button>
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && (
        <>
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>{total} product{total !== 1 ? 's' : ''} found</span>
            <span>Page {page} of {totalPages}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className={cn(
                  "neu-raised rounded-2xl p-5 space-y-3 transition-all duration-200 border",
                  selectedIds.has(product.id) ? "border-[#FFCC00]/50 shadow-[0_0_20px_rgba(255,204,0,0.1)]" : "border-transparent hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="neu-inset p-1.5 rounded-lg shrink-0">
                      <Building2 className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500 truncate">{product.dataHolderBrand}</p>
                      <p className="text-sm font-bold text-zinc-100 truncate">{product.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSelect(product.id)}
                    className={cn(
                      "shrink-0 p-1 rounded-lg transition-colors",
                      selectedIds.has(product.id)
                        ? "bg-[#FFCC00]/20 text-[#FFCC00]"
                        : "text-zinc-600 hover:text-zinc-400"
                    )}
                    title={selectedIds.has(product.id) ? "Remove from comparison" : "Add to comparison"}
                  >
                    {selectedIds.has(product.id) ? <Check className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
                  </button>
                </div>

                <div>
                  <span className="text-2xl font-black text-[#FFCC00]">{formatRate(product.baseRate)}</span>
                  {product.comparisonRate != null && (
                    <span className="text-xs text-zinc-500 ml-2">
                      {formatRate(product.comparisonRate)} comparison
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full neu-inset text-zinc-400 font-semibold uppercase">
                    {product.category?.replace(/_/g, ' ') ?? 'N/A'}
                  </span>
                  {product.rateType && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full neu-inset text-zinc-400 font-semibold uppercase">
                      {product.rateType}
                    </span>
                  )}
                </div>

                {product.features && product.features.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {product.features.slice(0, 3).map((f, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                        {f}
                      </span>
                    ))}
                    {product.features.length > 3 && (
                      <span className="text-[10px] text-zinc-600">+{product.features.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <div className="neu-raised rounded-2xl p-12 text-center">
              <p className="text-zinc-500">No products match your filters</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="neu-raised-sm p-2 rounded-xl text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const n = start + i;
                if (n > totalPages) return null;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-bold transition-colors",
                      page === n ? "bg-[#FFCC00] text-[#0a0a0f]" : "neu-raised-sm text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="neu-raised-sm p-2 rounded-xl text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Sticky Comparison Bar */}
      {selectedIds.size >= 2 && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 neu-raised rounded-2xl px-5 py-3 flex items-center gap-4 shadow-[0_0_30px_rgba(255,204,0,0.15)] border border-[#FFCC00]/20">
          <span className="text-sm font-bold text-zinc-200">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => onCompare?.(Array.from(selectedIds))}
            className="px-4 py-2 rounded-xl bg-[#FFCC00] text-[#0a0a0f] text-sm font-bold hover:bg-[#FFD633] transition-colors"
          >
            Compare
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
