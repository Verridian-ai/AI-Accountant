import { useState, useEffect } from 'react';
import { inventoryApi } from '@/api';
import { AlertTriangle, ArrowRightLeft, Loader2, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockLevel {
    itemId: string;
    itemName: string;
    sku: string;
    warehouseId: string;
    warehouseName: string;
    quantityOnHand: number;
    quantityAvailable: number;
    reorderPoint: number;
}

export function StockLevelPanel() {
    const [levels, setLevels] = useState<StockLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [warehouseFilter, setWarehouseFilter] = useState('');

    const loadLevels = async () => {
        setLoading(true);
        try {
            const filters: { warehouseId?: string } = {};
            if (warehouseFilter) filters.warehouseId = warehouseFilter;
            const data = await inventoryApi.getStockLevels(filters);
            setLevels(Array.isArray(data) ? data : data.levels ?? []);
        } catch (err) {
            console.error('Failed to load stock levels:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLevels(); }, [warehouseFilter]);

    const warehouses = [...new Set(levels.map(l => l.warehouseName).filter(Boolean))];
    const lowStockItems = levels.filter(l => l.quantityOnHand < l.reorderPoint);
    const grouped = levels.reduce<Record<string, StockLevel[]>>((acc, l) => {
        const key = l.warehouseName || 'Default';
        if (!acc[key]) acc[key] = [];
        acc[key].push(l);
        return acc;
    }, {});

    const getStockPercent = (qty: number, reorder: number) => {
        if (reorder <= 0) return 100;
        return Math.min((qty / (reorder * 2)) * 100, 100);
    };

    const getStockColor = (qty: number, reorder: number) => {
        if (qty <= 0) return 'bg-red-500';
        if (qty < reorder) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
                <div className="neu-raised rounded-2xl p-5 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                            Low Stock Alerts ({lowStockItems.length})
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lowStockItems.map(item => (
                            <div key={`${item.itemId}-${item.warehouseId}`} className="neu-inset rounded-xl p-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-zinc-100">{item.itemName}</p>
                                        <p className="text-xs text-zinc-500">{item.sku} • {item.warehouseName}</p>
                                    </div>
                                    <span className="text-amber-400 font-bold text-sm">{item.quantityOnHand}</span>
                                </div>
                                <p className="text-[10px] text-zinc-600 mt-1">Reorder at: {item.reorderPoint}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter + Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                <select
                    value={warehouseFilter}
                    onChange={e => setWarehouseFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl neu-inset bg-transparent text-zinc-300 text-sm"
                >
                    <option value="">All Warehouses</option>
                    {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <div className="flex gap-2 ml-auto">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl neu-raised text-zinc-300 text-sm hover:text-[#FFCC00]">
                        <ArrowRightLeft className="w-4 h-4" /> Transfer
                    </button>
                </div>
            </div>

            {/* Warehouse Groups */}
            {Object.entries(grouped).map(([warehouse, warehouseItems]) => (
                <div key={warehouse} className="neu-raised rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-[#FFCC00]" />
                        <h3 className="text-sm font-bold text-zinc-200">{warehouse}</h3>
                        <span className="text-xs text-zinc-500 ml-auto">{warehouseItems.length} items</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {warehouseItems.map(item => (
                            <div key={`${item.itemId}-${item.warehouseId}`} className="px-5 py-3 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-100 truncate">{item.itemName}</p>
                                    <p className="text-xs text-zinc-500">{item.sku}</p>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
                                        <p className={cn(
                                            "text-sm font-bold",
                                            item.quantityOnHand < item.reorderPoint ? "text-amber-400" : "text-emerald-400"
                                        )}>
                                            {item.quantityOnHand}
                                        </p>
                                        <p className="text-[10px] text-zinc-600">avail: {item.quantityAvailable}</p>
                                    </div>
                                    <div className="w-24">
                                        <div className="w-full h-2 rounded-full bg-zinc-800">
                                            <div
                                                className={cn("h-full rounded-full transition-all", getStockColor(item.quantityOnHand, item.reorderPoint))}
                                                style={{ width: `${getStockPercent(item.quantityOnHand, item.reorderPoint)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {levels.length === 0 && (
                <div className="neu-raised rounded-2xl p-12 text-center">
                    <Warehouse className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-500">No stock levels data available</p>
                </div>
            )}
        </div>
    );
}
