import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Lightbulb } from 'lucide-react';
import { assetApi } from '@/api';
import { toast } from 'sonner';

const ASSET_CATEGORIES = [
    { value: 'Motor Vehicles', life: 8 },
    { value: 'Plant & Equipment', life: 15 },
    { value: 'Office Equipment', life: 10 },
    { value: 'Furniture & Fittings', life: 13 },
    { value: 'Computer Equipment', life: 4 },
    { value: 'Building Improvements', life: 40 },
    { value: 'Low Value Pool', life: 0 },
    { value: 'Software', life: 5 },
    { value: 'Tooling', life: 5 },
    { value: 'Other', life: 10 },
];

const DEPRECIATION_METHODS = [
    { value: 'diminishing_value', label: 'Diminishing Value' },
    { value: 'prime_cost', label: 'Prime Cost (Straight Line)' },
    { value: 'instant_write_off', label: 'Instant Asset Write-Off' },
    { value: 'low_value_pool', label: 'Low Value Pool' },
];

const INSTANT_WRITE_OFF_THRESHOLD = 2000000; // $20,000 in cents

interface RegisterAssetFormProps {
    onSuccess: () => void;
}

export function RegisterAssetForm({ onSuccess }: RegisterAssetFormProps) {
    const [assetName, setAssetName] = useState('');
    const [category, setCategory] = useState('');
    const [purchaseDate, setPurchaseDate] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [residualValue, setResidualValue] = useState('0');
    const [depreciationMethod, setDepreciationMethod] = useState('diminishing_value');
    const [effectiveLife, setEffectiveLife] = useState('');
    const [location, setLocation] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const priceCents = Math.round((parseFloat(purchasePrice) || 0) * 100);
    const isWriteOffEligible = priceCents > 0 && priceCents < INSTANT_WRITE_OFF_THRESHOLD;

    const handleCategoryChange = (val: string) => {
        setCategory(val);
        const catDef = ASSET_CATEGORIES.find(c => c.value === val);
        if (catDef && catDef.life > 0) {
            setEffectiveLife(String(catDef.life));
        }
        if (val === 'Low Value Pool') {
            setDepreciationMethod('low_value_pool');
        }
    };

    const handleSubmit = async () => {
        if (!assetName || !category || !purchaseDate || !purchasePrice) return;

        const today = new Date().toISOString().split('T')[0];
        if (purchaseDate > today) {
            setError('Purchase date cannot be in the future');
            return;
        }

        if (priceCents <= 0) {
            setError('Purchase price must be positive');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await assetApi.registerAsset({
                assetName,
                category,
                purchaseDate,
                purchasePrice: priceCents,
                residualValue: Math.round((parseFloat(residualValue) || 0) * 100),
                depreciationMethod,
                effectiveLifeYears: parseFloat(effectiveLife) || 10,
                location: location || undefined,
                serialNumber: serialNumber || undefined,
                supplier: supplier || undefined,
            });
            toast.success('Asset registered successfully');
            setAssetName('');
            setCategory('');
            setPurchaseDate('');
            setPurchasePrice('');
            setResidualValue('0');
            setDepreciationMethod('diminishing_value');
            setEffectiveLife('');
            setLocation('');
            setSerialNumber('');
            setSupplier('');
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to register asset');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="neu-raised border-white/5">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#FFCC00]" />
                    Register New Asset
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Asset Name *</Label>
                        <Input placeholder="e.g., MacBook Pro 16-inch" value={assetName} onChange={e => setAssetName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select value={category} onValueChange={handleCategoryChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                                {ASSET_CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>
                                        {c.value} {c.life > 0 ? `(${c.life}y)` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Purchase Date *</Label>
                        <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Purchase Price ($) *</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Residual Value ($)</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={residualValue} onChange={e => setResidualValue(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Depreciation Method</Label>
                        <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DEPRECIATION_METHODS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Effective Life (years)</Label>
                        <Input type="number" min="1" max="100" placeholder="e.g., 10" value={effectiveLife} onChange={e => setEffectiveLife(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Location</Label>
                        <Input placeholder="Optional" value={location} onChange={e => setLocation(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Serial Number</Label>
                        <Input placeholder="Optional" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Supplier</Label>
                        <Input placeholder="Optional" value={supplier} onChange={e => setSupplier(e.target.value)} />
                    </div>
                </div>

                {isWriteOffEligible && (
                    <div className="neu-inset rounded-xl p-4 flex items-start gap-3">
                        <Lightbulb className="w-5 h-5 text-[#FFCC00] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-[#FFCC00]">Instant Write-Off Eligible</p>
                            <p className="text-xs text-zinc-400 mt-1">
                                This asset costs under $20,000 and may be eligible for the instant asset write-off under the ATO small business rules.
                                Consider selecting "Instant Asset Write-Off" as the depreciation method.
                            </p>
                        </div>
                    </div>
                )}

                {category === 'Low Value Pool' && (
                    <div className="neu-inset rounded-xl p-4 flex items-start gap-3">
                        <Lightbulb className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-blue-400">Low Value Pool</p>
                            <p className="text-xs text-zinc-400 mt-1">
                                Assets under $1,000 (or with WDV under $1,000) can be allocated to the low value pool.
                                Depreciation rate: 37.5% first year, 30% subsequent years.
                            </p>
                        </div>
                    </div>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <Button
                    onClick={handleSubmit}
                    disabled={submitting || !assetName || !category || !purchaseDate || !purchasePrice}
                    className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 font-bold"
                >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Register Asset
                </Button>
            </CardContent>
        </Card>
    );
}
