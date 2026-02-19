import { useState, useEffect } from 'react';
import { inventoryApi } from '@/api';
import { ChevronLeft, ChevronRight, Loader2, ArrowDownUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Movement {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  movementType: 'purchase' | 'sale' | 'adjustment' | 'transfer';
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  warehouseId: string;
  warehouseName: string;
  notes: string | null;
  createdAt: string;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const typeColors: Record<string, string> = {
  purchase: 'bg-emerald-500/10 text-emerald-400',
  sale: 'bg-red-500/10 text-red-400',
  transfer: 'bg-blue-500/10 text-blue-400',
  adjustment: 'bg-amber-500/10 text-amber-400',
};

const PAGE_SIZE = 20;

export function MovementHistory() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadMovements = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (typeFilter) filters.movementType = typeFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const data = await inventoryApi.getMovements(filters);
      const items = Array.isArray(data) ? data : (data.movements ?? []);
      setMovements(items);
      setHasMore(items.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load movements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [offset, typeFilter, startDate, endDate]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setOffset(0);
          }}
          className="px-4 py-2.5 rounded-xl neu-inset bg-transparent text-primary text-sm"
        >
          <option value="">All Types</option>
          <option value="purchase">Purchase</option>
          <option value="sale">Sale</option>
          <option value="transfer">Transfer</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setOffset(0);
          }}
          className="px-4 py-2.5 rounded-xl neu-inset bg-transparent text-primary text-sm"
          placeholder="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setOffset(0);
          }}
          className="px-4 py-2.5 rounded-xl neu-inset bg-transparent text-primary text-sm"
          placeholder="End date"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
        </div>
      ) : movements.length === 0 ? (
        <div className="neu-raised rounded-2xl p-12 text-center">
          <ArrowDownUp className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-muted">No movements found</p>
        </div>
      ) : (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Item
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted uppercase">
                    Type
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Qty
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Unit Cost
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Total
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Warehouse
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-secondary">
                      {new Date(m.createdAt).toLocaleDateString('en-AU')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-100 font-medium">{m.itemName}</p>
                      <p className="text-xs text-muted">{m.itemSku}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                          typeColors[m.movementType] ?? 'bg-zinc-500/10 text-secondary',
                        )}
                      >
                        {m.movementType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{m.quantity}</td>
                    <td className="px-4 py-3 text-right text-secondary">
                      {formatAUD(m.unitCostCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-primary font-medium">
                      {formatAUD(m.totalCostCents)}
                    </td>
                    <td className="px-4 py-3 text-secondary">{m.warehouseName}</td>
                    <td className="px-4 py-3 text-muted text-xs max-w-[200px] truncate">
                      {m.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Showing {offset + 1}–{offset + movements.length}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="p-2 rounded-lg neu-raised text-secondary disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!hasMore}
            className="p-2 rounded-lg neu-raised text-secondary disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
