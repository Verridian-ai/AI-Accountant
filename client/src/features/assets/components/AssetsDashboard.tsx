import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Calendar, Trash2, Plus } from 'lucide-react';
import { assetApi } from '@/api';
import type { AssetRegisterResponse, DepreciationScheduleResponse } from '@/api';
import { AssetSummaryCards } from './AssetSummaryCards';
import { AssetRegisterTable } from './AssetRegisterTable';
import { DepreciationScheduleView } from './DepreciationScheduleView';
import { AssetDisposalForm } from './AssetDisposalForm';
import { RegisterAssetForm } from './RegisterAssetForm';

const FINANCIAL_YEARS = ['2023-24', '2024-25', '2025-26'];

export function AssetsDashboard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AssetRegisterResponse | null>(null);
    const [schedule, setSchedule] = useState<DepreciationScheduleResponse | null>(null);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [financialYear, setFinancialYear] = useState('2024-25');

    const loadRegister = useCallback(async () => {
        setLoading(true);
        try {
            const result = await assetApi.getRegister();
            setData(result);
        } catch (err) {
            console.error('Failed to load asset register:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSchedule = useCallback(async () => {
        setScheduleLoading(true);
        try {
            const result = await assetApi.getDepreciationSchedule(financialYear);
            setSchedule(result);
        } catch (err) {
            console.error('Failed to load depreciation schedule:', err);
        } finally {
            setScheduleLoading(false);
        }
    }, [financialYear]);

    useEffect(() => {
        loadRegister();
    }, [loadRegister]);

    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    const handleRefresh = () => {
        loadRegister();
        loadSchedule();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Fixed Assets</h2>
                    <p className="text-sm text-zinc-500">
                        Asset register, depreciation schedules & disposal tracking
                    </p>
                </div>
                <Select value={financialYear} onValueChange={setFinancialYear}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Financial Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {FINANCIAL_YEARS.map(fy => (
                            <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <AssetSummaryCards data={data} loading={loading} />

            <Tabs defaultValue="register" className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="register">
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Asset Register
                    </TabsTrigger>
                    <TabsTrigger value="schedule">
                        <Calendar className="w-4 h-4 mr-2" />
                        Depreciation Schedule
                    </TabsTrigger>
                    <TabsTrigger value="disposals">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Disposals
                    </TabsTrigger>
                    <TabsTrigger value="add">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Asset
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="register">
                    <AssetRegisterTable assets={data?.assets ?? []} />
                </TabsContent>

                <TabsContent value="schedule">
                    <DepreciationScheduleView
                        schedule={schedule}
                        loading={scheduleLoading}
                        financialYear={financialYear}
                        onRefresh={handleRefresh}
                    />
                </TabsContent>

                <TabsContent value="disposals">
                    <AssetDisposalForm
                        assets={data?.assets ?? []}
                        onSuccess={handleRefresh}
                    />
                </TabsContent>

                <TabsContent value="add">
                    <RegisterAssetForm onSuccess={handleRefresh} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
