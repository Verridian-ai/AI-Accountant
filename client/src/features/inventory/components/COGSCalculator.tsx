import { useState, useEffect } from 'react';
import { inventoryApi } from '@/api';
import { Calculator, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemOption {
    id: string;
    name: string;
    sku: string;
    costPriceCents: number;
    salePriceCents: number;
}

interface COGSResult {
    itemId: string;
    itemName: string;
    quantity: number;
    unitCostCents: number;
    totalCOGSCents: number;
    marginPercent: number | null;
}

const formatAUD = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function COGSCalculator() {
    const [items, setItems] = useState<ItemOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [result, setResult] = useState<COGSResult | null>(null);
    const [history, setHistory] = useState<COGSResult[]>([]);

    useEffect(() => {
        const loadItems = async () => {
            try {
                const data = await inventoryApi.listItems({ isActive: true });
                const itemList = Array.isArray(data) ? data : data.items ?? [];
                setItems(itemList);
            } catch (err) {
                console.error('Failed to load items:', err);
            }
        };
        loadItems();
    }, []);

    const calculate = () => {
        const item = items.find(i => i.id === selectedItemId);
        if (!item || quantity <= 0) return;

        setLoading(true);

        // Weighted average COGS calculation (client-side based on item cost)
        const unitCostCents = item.costPriceCents;
        const totalCOGSCents = unitCostCents * quantity;
        const marginPercent = item.salePriceCents > 0
            ? ((item.salePriceCents - unitCostCents) / item.salePriceCents) * 100
            : null;

        const calcResult: COGSResult = {
            itemId: item.id,
            itemName: item.name,
            quantity,
            unitCostCents,
            totalCOGSCents,
            marginPercent,
        };

        setResult(calcResult);
        setHistory(prev => [calcResult, ...prev].slice(0, 10));
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            {/* Calculator Form */}
            <div className="neu-raised rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[#FFCC00]" />
                    <h3 className="text-lg font-bold text-zinc-100">COGS Calculator</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">Item</label>
                        <select
                            value={selectedItemId}
                            onChange={e => setSelectedItemId(e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
                        >
                            <option value="">Select an item...</option>
                            {items.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.sku} — {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500 font-semibold uppercase">Quantity Sold</label>
                        <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                            className="w-full mt-1 px-3 py-2.5 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
                        />
                    </div>
                </div>

                <button
                    onClick={calculate}
                    disabled={!selectedItemId || loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFD633] transition-colors disabled:opacity-50"
                >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Calculate COGS
                </button>
            </div>

            {/* Result */}
            {result && (
                <div className="neu-raised rounded-2xl p-6 border border-[#FFCC00]/10">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Calculation Result</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="neu-inset rounded-xl px-4 py-3">
                            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Item</p>
                            <p className="text-sm font-bold text-zinc-200 mt-1">{result.itemName}</p>
                        </div>
                        <div className="neu-inset rounded-xl px-4 py-3">
                            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Unit Cost</p>
                            <p className="text-lg font-bold text-zinc-200 mt-1">{formatAUD(result.unitCostCents)}</p>
                        </div>
                        <div className="neu-inset rounded-xl px-4 py-3">
                            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Total COGS</p>
                            <p className="text-lg font-bold text-[#FFCC00] mt-1">{formatAUD(result.totalCOGSCents)}</p>
                        </div>
                        <div className="neu-inset rounded-xl px-4 py-3">
                            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Margin</p>
                            <p className={cn(
                                "text-lg font-bold mt-1",
                                result.marginPercent != null && result.marginPercent > 0 ? "text-emerald-400" : "text-zinc-400"
                            )}>
                                {result.marginPercent != null ? `${result.marginPercent.toFixed(1)}%` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Explanation */}
            <div className="neu-raised rounded-2xl p-5 border border-blue-500/10">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-zinc-200">Weighted Average Method</h4>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                            COGS is calculated using the weighted average cost method. Each time inventory is purchased,
                            the average cost per unit is recalculated by dividing total inventory cost by total units on hand.
                            When items are sold, the COGS uses this average cost. This method smooths out price fluctuations
                            and is widely accepted by the ATO for inventory valuation.
                        </p>
                    </div>
                </div>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="neu-raised rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5">
                        <h4 className="text-sm font-bold text-zinc-300">Recent Calculations</h4>
                    </div>
                    <div className="divide-y divide-white/5">
                        {history.map((h, i) => (
                            <div key={i} className="px-5 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-zinc-200">{h.itemName}</p>
                                    <p className="text-xs text-zinc-500">{h.quantity} units @ {formatAUD(h.unitCostCents)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-[#FFCC00]">{formatAUD(h.totalCOGSCents)}</p>
                                    {h.marginPercent != null && (
                                        <p className="text-xs text-emerald-400">{h.marginPercent.toFixed(1)}% margin</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
