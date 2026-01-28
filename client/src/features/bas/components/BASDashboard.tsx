import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calculator, FileText, History, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { basApi } from '@/api';
import type { BASCalculation, BASQuarter } from '@/types/tax';

const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(cents / 100);
};

const getCurrentQuarter = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    // Australian financial year quarters
    if (month >= 6 && month <= 8) return { year, quarter: 1 }; // Jul-Sep
    if (month >= 9 && month <= 11) return { year, quarter: 2 }; // Oct-Dec
    if (month >= 0 && month <= 2) return { year: year - 1, quarter: 3 }; // Jan-Mar
    return { year: year - 1, quarter: 4 }; // Apr-Jun
};

export function BASDashboard() {
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [selectedQuarter, setSelectedQuarter] = useState<string>('');
    const [method, setMethod] = useState<'accrual' | 'cash'>('accrual');
    const [basData, setBASData] = useState<BASCalculation | null>(null);
    const [history, setHistory] = useState<BASQuarter[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
        // Set default quarter
        const { year, quarter } = getCurrentQuarter();
        setSelectedQuarter(`${year}-Q${quarter}`);
    }, []);

    const loadHistory = async () => {
        try {
            const data = await basApi.fetchHistory();
            setHistory(data);
        } catch (err) {
            console.error('Failed to load BAS history:', err);
        }
    };

    const calculateBAS = async () => {
        if (!selectedQuarter) return;

        setCalculating(true);
        setError(null);

        try {
            const data = await basApi.calculateBAS(selectedQuarter, method);
            setBASData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to calculate BAS');
        } finally {
            setCalculating(false);
        }
    };

    const saveBAS = async () => {
        if (!selectedQuarter || !basData) return;

        setLoading(true);
        try {
            await basApi.saveBAS(selectedQuarter, basData);
            await loadHistory();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save BAS');
        } finally {
            setLoading(false);
        }
    };

    const generateQuarterOptions = () => {
        const options = [];
        const currentYear = new Date().getFullYear();

        for (let year = currentYear; year >= currentYear - 2; year--) {
            for (let q = 4; q >= 1; q--) {
                options.push({
                    value: `${year}-Q${q}`,
                    label: `Q${q} ${year}-${(year + 1).toString().slice(2)} (${getQuarterDates(year, q as 1 | 2 | 3 | 4)})`,
                });
            }
        }

        return options;
    };

    const getQuarterDates = (year: number, quarter: 1 | 2 | 3 | 4) => {
        const periods = {
            1: `Jul-Sep ${year}`,
            2: `Oct-Dec ${year}`,
            3: `Jan-Mar ${year + 1}`,
            4: `Apr-Jun ${year + 1}`,
        };
        return periods[quarter];
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Business Activity Statement</h2>
                    <p className="text-muted-foreground">
                        Calculate and manage your quarterly BAS returns
                    </p>
                </div>
            </div>

            <Tabs defaultValue="calculate" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="calculate">
                        <Calculator className="w-4 h-4 mr-2" />
                        Calculate
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <History className="w-4 h-4 mr-2" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="calculate" className="space-y-4">
                    {/* Controls */}
                    <Card>
                        <CardHeader>
                            <CardTitle>BAS Period</CardTitle>
                            <CardDescription>
                                Select the quarter and accounting method
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-4 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select quarter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {generateQuarterOptions().map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <Select value={method} onValueChange={(v) => setMethod(v as 'accrual' | 'cash')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Accounting method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="accrual">Accrual Basis</SelectItem>
                                        <SelectItem value="cash">Cash Basis</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={calculateBAS} disabled={calculating || !selectedQuarter}>
                                {calculating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Calculate BAS
                            </Button>
                        </CardContent>
                    </Card>

                    {error && (
                        <Card className="border-destructive">
                            <CardContent className="pt-6">
                                <p className="text-destructive">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    {basData && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">GST on Sales (G9)</CardTitle>
                                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatCurrency(basData.g9_gst_on_sales)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            Total taxable sales: {formatCurrency(basData.g1_total_sales)}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">GST Credits (G19)</CardTitle>
                                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatCurrency(basData.g19_gst_credits)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            Total purchases: {formatCurrency(basData.g12_g10_plus_g11)}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">
                                            {basData.net_amount_payable > 0 ? 'Amount Payable' : 'Refund Due'}
                                        </CardTitle>
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className={`text-2xl font-bold ${basData.net_amount_payable > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                            {formatCurrency(Math.abs(basData.net_amount_payable || basData.net_refund))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Net GST (G20): {formatCurrency(basData.g20_net_gst)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detailed BAS Labels */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>GST Calculation Details</CardTitle>
                                    <CardDescription>
                                        Breakdown of all BAS labels
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        {/* Sales Section */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold border-b pb-2">Sales</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G1 - Total Sales</span>
                                                    <span className="font-medium">{formatCurrency(basData.g1_total_sales)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G2 - Export Sales</span>
                                                    <span className="font-medium">{formatCurrency(basData.g2_export_sales)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G3 - GST-Free Sales</span>
                                                    <span className="font-medium">{formatCurrency(basData.g3_gst_free_sales)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G4 - Input Taxed Sales</span>
                                                    <span className="font-medium">{formatCurrency(basData.g4_input_taxed_sales)}</span>
                                                </div>
                                                <div className="flex justify-between font-semibold">
                                                    <span>G9 - GST on Sales</span>
                                                    <span>{formatCurrency(basData.g9_gst_on_sales)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Purchases Section */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold border-b pb-2">Purchases</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G10 - Capital Purchases</span>
                                                    <span className="font-medium">{formatCurrency(basData.g10_capital_purchases)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G11 - Non-Capital Purchases</span>
                                                    <span className="font-medium">{formatCurrency(basData.g11_non_capital_purchases)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">G12 - Total Purchases</span>
                                                    <span className="font-medium">{formatCurrency(basData.g12_g10_plus_g11)}</span>
                                                </div>
                                                <div className="flex justify-between font-semibold">
                                                    <span>G19 - GST Credits</span>
                                                    <span>{formatCurrency(basData.g19_gst_credits)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* PAYG Section */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold border-b pb-2">PAYG Withholding</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">W1 - Gross Wages</span>
                                                    <span className="font-medium">{formatCurrency(basData.w1_gross_wages)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">W2 - Amounts Withheld</span>
                                                    <span className="font-medium">{formatCurrency(basData.w2_amounts_withheld)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">5A - PAYG Instalment</span>
                                                    <span className="font-medium">{formatCurrency(basData.payg_instalment_5a)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Other Section */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold border-b pb-2">Other</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">7C - Fuel Tax Credits</span>
                                                    <span className="font-medium">{formatCurrency(basData.fuel_tax_credits_7c)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">7D - Wine Equalisation</span>
                                                    <span className="font-medium">{formatCurrency(basData.wine_equalisation_7d)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="mt-6 pt-4 border-t">
                                        <div className="flex justify-between items-center text-lg font-bold">
                                            <span>Net Amount {basData.net_amount_payable > 0 ? 'Payable' : 'Refundable'}</span>
                                            <span className={basData.net_amount_payable > 0 ? 'text-destructive' : 'text-green-600'}>
                                                {formatCurrency(Math.abs(basData.net_amount_payable || basData.net_refund))}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex justify-end gap-4">
                                <Button variant="outline" onClick={() => setBASData(null)}>
                                    Clear
                                </Button>
                                <Button onClick={saveBAS} disabled={loading}>
                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Save Draft
                                </Button>
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>BAS History</CardTitle>
                            <CardDescription>
                                Previous BAS submissions and drafts
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {history.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    No BAS history found. Calculate your first BAS to get started.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {history.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-4 border rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    Q{item.quarter} {item.year}-{(item.year + 1).toString().slice(2)}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {item.startDate} - {item.endDate}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge
                                                    variant={
                                                        item.status === 'lodged'
                                                            ? 'default'
                                                            : item.status === 'draft'
                                                            ? 'secondary'
                                                            : 'outline'
                                                    }
                                                >
                                                    {item.status}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedQuarter(`${item.year}-Q${item.quarter}`);
                                                        calculateBAS();
                                                    }}
                                                >
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
