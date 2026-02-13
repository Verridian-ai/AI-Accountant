import { useState, useEffect } from 'react';
import { inventoryApi } from '@/api';
import { Plus, Loader2, Warehouse, MapPin, Star } from 'lucide-react';

interface WarehouseData {
    id: string;
    name: string;
    location: string | null;
    isDefault: boolean;
    itemCount?: number;
    totalValueCents?: number;
}

const formatAUD = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function WarehouseManager() {
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', location: '', isDefault: false });

    const loadWarehouses = async () => {
        setLoading(true);
        try {
            const data = await inventoryApi.listWarehouses();
            setWarehouses(Array.isArray(data) ? data : data.warehouses ?? []);
        } catch (err) {
            console.error('Failed to load warehouses:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadWarehouses(); }, []);

    const handleCreate = async () => {
        try {
            await inventoryApi.createWarehouse({
                name: formData.name,
                location: formData.location || undefined,
                isDefault: formData.isDefault,
            });
            setShowForm(false);
            setFormData({ name: '', location: '', isDefault: false });
            loadWarehouses();
        } catch (err) {
            console.error('Failed to create warehouse:', err);
        }
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">{warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''}</p>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFD633] transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Warehouse
                </button>
            </div>

            {/* Add Warehouse Form */}
            {showForm && (
                <div className="neu-raised rounded-2xl p-6 space-y-4 border border-[#FFCC00]/10">
                    <h3 className="text-lg font-bold text-zinc-100">New Warehouse</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-500 font-semibold uppercase">Name</label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
                                placeholder="Main Warehouse"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 font-semibold uppercase">Location</label>
                            <input
                                value={formData.location}
                                onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 rounded-lg neu-inset bg-transparent text-zinc-100 text-sm"
                                placeholder="Sydney, NSW"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isDefault}
                            onChange={e => setFormData(p => ({ ...p, isDefault: e.target.checked }))}
                            className="rounded border-zinc-600"
                        />
                        Set as default warehouse
                    </label>
                    <div className="flex gap-3">
                        <button onClick={handleCreate} disabled={!formData.name} className="px-5 py-2 rounded-xl bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm disabled:opacity-50">
                            Create
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl neu-raised text-zinc-400 font-bold text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Warehouse Cards */}
            {warehouses.length === 0 ? (
                <div className="neu-raised rounded-2xl p-12 text-center">
                    <Warehouse className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-500">No warehouses configured</p>
                    <p className="text-xs text-zinc-600 mt-1">Add a warehouse to start tracking stock locations</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {warehouses.map(wh => (
                        <div key={wh.id} className="neu-raised rounded-2xl p-5 space-y-3 hover:border-[#FFCC00]/20 border border-transparent transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="neu-inset p-2 rounded-xl text-[#FFCC00]">
                                        <Warehouse className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-100">{wh.name}</h3>
                                        {wh.location && (
                                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                                                <MapPin className="w-3 h-3" />
                                                {wh.location}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {wh.isDefault && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFCC00]/10 text-[#FFCC00] text-[10px] font-bold uppercase">
                                        <Star className="w-3 h-3" /> Default
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="neu-inset rounded-xl px-3 py-2">
                                    <p className="text-[10px] text-zinc-600 uppercase font-semibold">Items</p>
                                    <p className="text-lg font-bold text-zinc-200">{wh.itemCount ?? 0}</p>
                                </div>
                                <div className="neu-inset rounded-xl px-3 py-2">
                                    <p className="text-[10px] text-zinc-600 uppercase font-semibold">Value</p>
                                    <p className="text-lg font-bold text-[#FFCC00]">
                                        {wh.totalValueCents != null ? formatAUD(wh.totalValueCents) : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
