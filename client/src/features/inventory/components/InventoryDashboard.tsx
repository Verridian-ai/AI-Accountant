import { useState, useEffect } from 'react';
import { inventoryApi } from '@/api';
import { Package, BarChart3, ArrowDownUp, Warehouse, DollarSign, Calculator, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InventoryItemList } from './InventoryItemList';
import { StockLevelPanel } from './StockLevelPanel';
import { MovementHistory } from './MovementHistory';
import { WarehouseManager } from './WarehouseManager';
import { ValuationReport } from './ValuationReport';
import { COGSCalculator } from './COGSCalculator';

type InventoryTab = 'items' | 'stock' | 'movements' | 'warehouses' | 'valuation' | 'cogs';

const tabs: { id: InventoryTab; label: string; icon: typeof Package }[] = [
    { id: 'items', label: 'Items', icon: Package },
    { id: 'stock', label: 'Stock Levels', icon: BarChart3 },
    { id: 'movements', label: 'Movements', icon: ArrowDownUp },
    { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
    { id: 'valuation', label: 'Valuation', icon: DollarSign },
    { id: 'cogs', label: 'COGS', icon: Calculator },
];

interface SummaryStats {
    totalItems: number;
    totalValueCents: number;
    lowStockCount: number;
}

const formatAUD = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function InventoryDashboard() {
    const [activeTab, setActiveTab] = useState<InventoryTab>('items');
    const [stats, setStats] = useState<SummaryStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            setStatsLoading(true);
            try {
                const [itemsData, stockData, valuationData] = await Promise.all([
                    inventoryApi.listItems().catch(() => []),
                    inventoryApi.getStockLevels({ belowReorder: true }).catch(() => []),
                    inventoryApi.getValuation().catch(() => null),
                ]);

                const items = Array.isArray(itemsData) ? itemsData : itemsData?.items ?? [];
                const lowStock = Array.isArray(stockData) ? stockData : stockData?.levels ?? [];

                setStats({
                    totalItems: items.length,
                    totalValueCents: valuationData?.totalValueCents ?? 0,
                    lowStockCount: lowStock.length,
                });
            } catch (err) {
                console.error('Failed to load inventory stats:', err);
            } finally {
                setStatsLoading(false);
            }
        };
        loadStats();
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">
                    Inventory Management
                </h2>
                <p className="text-sm text-zinc-500">
                    Track stock, warehouses, movements, valuation & COGS
                </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
                    <div className="neu-inset p-2.5 rounded-xl text-[#FFCC00]">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">Total Items</p>
                        {statsLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
                        ) : (
                            <p className="text-xl font-bold text-zinc-100">{stats?.totalItems ?? 0}</p>
                        )}
                    </div>
                </div>
                <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
                    <div className="neu-inset p-2.5 rounded-xl text-emerald-400">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">Total Value</p>
                        {statsLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
                        ) : (
                            <p className="text-xl font-bold text-gradient-gold">
                                {formatAUD(stats?.totalValueCents ?? 0)}
                            </p>
                        )}
                    </div>
                </div>
                <div className="neu-raised rounded-2xl p-4 flex items-center gap-3">
                    <div className={cn(
                        "neu-inset p-2.5 rounded-xl",
                        stats && stats.lowStockCount > 0 ? "text-amber-400" : "text-zinc-500"
                    )}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">Low Stock Alerts</p>
                        {statsLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mt-1" />
                        ) : (
                            <p className={cn(
                                "text-xl font-bold",
                                stats && stats.lowStockCount > 0 ? "text-amber-400" : "text-zinc-300"
                            )}>
                                {stats?.lowStockCount ?? 0}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300",
                            activeTab === tab.id
                                ? "bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]"
                                : "neu-raised text-zinc-400 hover:text-zinc-100"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'items' && <InventoryItemList />}
                {activeTab === 'stock' && <StockLevelPanel />}
                {activeTab === 'movements' && <MovementHistory />}
                {activeTab === 'warehouses' && <WarehouseManager />}
                {activeTab === 'valuation' && <ValuationReport />}
                {activeTab === 'cogs' && <COGSCalculator />}
            </div>
        </div>
    );
}
