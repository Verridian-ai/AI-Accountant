import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, RotateCcw, LineChart, Target, ShieldAlert, TrendingUp } from 'lucide-react';
import { Sparkline, CHART_COLORS } from '../../../components/charts';
import { CategoryBreakdown } from './CategoryBreakdown';
import { RecurringPayments } from './RecurringPayments';
import { SpendingTrends } from './SpendingTrends';
import { BudgetVsActual } from './BudgetVsActual';
import { AnomalyDetection } from './AnomalyDetection';
import { CashFlowForecast } from './CashFlowForecast';

// Mock sparkline trend data for KPI summary cards
const INCOME_TREND = [4200, 4500, 4350, 4800, 5100, 5400];
const EXPENSE_TREND = [3100, 3300, 2900, 3400, 3200, 3500];
const NET_TREND = [1100, 1200, 1450, 1400, 1900, 1900];
const COUNT_TREND = [42, 38, 45, 41, 50, 47];

export function AnalyticsDashboard() {
    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-gradient-gold">Analytics & Insights</h2>
                <p className="text-xs sm:text-sm text-zinc-500">
                    Deep-dive into spending patterns, budgets, and forecasts
                </p>
            </div>

            {/* KPI Summary Cards with Sparklines */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <div className="neu-raised rounded-2xl border border-white/5 p-3 sm:p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Income</p>
                        <p className="text-base sm:text-lg font-black text-emerald-400 tabular-nums">$5,400</p>
                    </div>
                    <Sparkline data={INCOME_TREND} width={60} height={20} color={CHART_COLORS.revenue} showArea trend="up" />
                </div>
                <div className="neu-raised rounded-2xl border border-white/5 p-3 sm:p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Expenses</p>
                        <p className="text-base sm:text-lg font-black text-red-400 tabular-nums">$3,500</p>
                    </div>
                    <Sparkline data={EXPENSE_TREND} width={60} height={20} color={CHART_COLORS.expense} showArea trend="up" />
                </div>
                <div className="neu-raised rounded-2xl border border-white/5 p-3 sm:p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Net</p>
                        <p className="text-base sm:text-lg font-black text-[#FFCC00] tabular-nums">$1,900</p>
                    </div>
                    <Sparkline data={NET_TREND} width={60} height={20} color={CHART_COLORS.primary} showArea trend="up" />
                </div>
                <div className="neu-raised rounded-2xl border border-white/5 p-3 sm:p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Transactions</p>
                        <p className="text-base sm:text-lg font-black text-zinc-200 tabular-nums">47</p>
                    </div>
                    <Sparkline data={COUNT_TREND} width={60} height={20} color={CHART_COLORS.axis} trend="flat" />
                </div>
            </div>

            <Tabs defaultValue="categories" className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto">
                    <TabsTrigger value="categories" className="min-h-[44px]">
                        <PieChart className="w-4 h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Categories</span>
                        <span className="sm:hidden">Cat.</span>
                    </TabsTrigger>
                    <TabsTrigger value="recurring" className="min-h-[44px]">
                        <RotateCcw className="w-4 h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Recurring</span>
                        <span className="sm:hidden">Rec.</span>
                    </TabsTrigger>
                    <TabsTrigger value="trends" className="min-h-[44px]">
                        <LineChart className="w-4 h-4 mr-1 sm:mr-2" />
                        Trends
                    </TabsTrigger>
                    <TabsTrigger value="budget" className="min-h-[44px]">
                        <Target className="w-4 h-4 mr-1 sm:mr-2" />
                        Budget
                    </TabsTrigger>
                    <TabsTrigger value="anomalies" className="min-h-[44px]">
                        <ShieldAlert className="w-4 h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Anomalies</span>
                        <span className="sm:hidden">Alert</span>
                    </TabsTrigger>
                    <TabsTrigger value="forecast" className="min-h-[44px]">
                        <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Forecast</span>
                        <span className="sm:hidden">Fore.</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="categories">
                    <CategoryBreakdown />
                </TabsContent>

                <TabsContent value="recurring">
                    <RecurringPayments />
                </TabsContent>

                <TabsContent value="trends">
                    <SpendingTrends />
                </TabsContent>

                <TabsContent value="budget">
                    <BudgetVsActual />
                </TabsContent>

                <TabsContent value="anomalies">
                    <AnomalyDetection />
                </TabsContent>

                <TabsContent value="forecast">
                    <CashFlowForecast />
                </TabsContent>
            </Tabs>
        </div>
    );
}
