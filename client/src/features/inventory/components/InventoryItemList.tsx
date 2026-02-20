import { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '@/api';
import { Search, Plus, Edit2, XCircle, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPriceCents: number;
  salePriceCents: number;
  currentStockQty: number;
  reorderPoint: number;
  isActive: boolean;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function InventoryItemList() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    unit: 'each',
    costPriceCents: 0,
    salePriceCents: 0,
    reorderPoint: 10,
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { search?: string; category?: string } = {};
      if (search) filters.search = search;
      if (categoryFilter) filters.category = categoryFilter;
      const data = await inventoryApi.listItems(filters);
      setItems(Array.isArray(data) ? data : (data.items ?? []));
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  const handleSubmit = async () => {
    try {
      if (editItem) {
        await inventoryApi.updateItem(editItem.id, formData);
      } else {
        await inventoryApi.createItem(formData);
      }
      setShowForm(false);
      setEditItem(null);
      setFormData({
        sku: '',
        name: '',
        category: '',
        unit: 'each',
        costPriceCents: 0,
        salePriceCents: 0,
        reorderPoint: 10,
      });
      loadItems();
    } catch (err) {
      console.error('Failed to save item:', err);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await inventoryApi.deactivateItem(id);
      loadItems();
    } catch (err) {
      console.error('Failed to deactivate item:', err);
    }
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      costPriceCents: item.costPriceCents,
      salePriceCents: item.salePriceCents,
      reorderPoint: item.reorderPoint,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl neu-inset bg-transparent text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl neu-inset bg-transparent text-primary text-sm focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setEditItem(null);
            setFormData({
              sku: '',
              name: '',
              category: '',
              unit: 'each',
              costPriceCents: 0,
              salePriceCents: 0,
              reorderPoint: 10,
            });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cba-gold text-base font-bold text-sm hover:bg-[#FFD633] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="neu-raised rounded-2xl p-6 space-y-4 border border-cba-gold/10">
          <h3 className="text-lg font-bold text-zinc-100">{editItem ? 'Edit Item' : 'New Item'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="inven-f1" className="text-xs text-muted font-semibold uppercase">
                SKU
              </label>
              <input
                id="inven-f1"
                value={formData.sku}
                onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inven-f2" className="text-xs text-muted font-semibold uppercase">
                Name
              </label>
              <input
                id="inven-f2"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inven-f3" className="text-xs text-muted font-semibold uppercase">
                Category
              </label>
              <input
                id="inven-f3"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inven-f4" className="text-xs text-muted font-semibold uppercase">
                Unit
              </label>
              <input
                id="inven-f4"
                value={formData.unit}
                onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inven-f5" className="text-xs text-muted font-semibold uppercase">
                Cost Price (cents)
              </label>
              <input
                id="inven-f5"
                type="number"
                value={formData.costPriceCents}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, costPriceCents: Number(e.target.value) }))
                }
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inven-f6" className="text-xs text-muted font-semibold uppercase">
                Sale Price (cents)
              </label>
              <input
                id="inven-f6"
                type="number"
                value={formData.salePriceCents}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, salePriceCents: Number(e.target.value) }))
                }
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inven-f7" className="text-xs text-muted font-semibold uppercase">
                Reorder Point
              </label>
              <input
                id="inven-f7"
                type="number"
                value={formData.reorderPoint}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, reorderPoint: Number(e.target.value) }))
                }
                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-cba-gold text-base font-bold text-sm"
            >
              {editItem ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditItem(null);
              }}
              className="px-5 py-2 rounded-xl neu-raised text-secondary font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
        </div>
      ) : items.length === 0 ? (
        <div className="neu-raised rounded-2xl p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-muted">No inventory items found</p>
        </div>
      ) : (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    SKU
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted uppercase">
                    Unit
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Cost
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Sale Price
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Stock
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Reorder
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted uppercase">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-white/[0.02] transition-colors',
                      item.currentStockQty < item.reorderPoint && 'bg-amber-500/5',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-secondary">{item.sku}</td>
                    <td className="px-4 py-3 text-zinc-100 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-secondary">{item.category}</td>
                    <td className="px-4 py-3 text-muted">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-primary">
                      {formatAUD(item.costPriceCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-primary">
                      {formatAUD(item.salePriceCents)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-bold',
                        item.currentStockQty < item.reorderPoint
                          ? 'text-amber-400'
                          : 'text-emerald-400',
                      )}
                    >
                      {item.currentStockQty}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{item.reorderPoint}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                          item.isActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-zinc-500/10 text-muted',
                        )}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-overlay text-muted hover:text-cba-gold"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(item.id)}
                          className="p-1.5 rounded-lg hover:bg-overlay text-muted hover:text-red-400"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
