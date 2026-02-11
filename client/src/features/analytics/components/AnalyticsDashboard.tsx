import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, RotateCcw, LineChart, Target, ShieldAlert, TrendingUp } from 'lucide-react';
import { CategoryBreakdown } from './CategoryBreakdown';
import { RecurringPayments } from './RecurringPayments';
import { SpendingTrends } from './SpendingTrends';
import { BudgetVsActual } from './BudgetVsActual';
import { AnomalyDetection } from './AnomalyDetection';
import { CashFlowForecast } from './CashFlowForecast';

export function AnalyticsDashboard() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Analytics & Insights</h2>
                <p className="text-sm text-zinc-500">
                    Deep-dive into spending patterns, budgets, and forecasts
                </p>
            </div>

            <Tabs defaultValue="categories" className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="categories">
                        <PieChart className="w-4 h-4 mr-2" />
                        Categories
                    </TabsTrigger>
                    <TabsTrigger value="recurring">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Recurring
                    </TabsTrigger>
                    <TabsTrigger value="trends">
                        <LineChart className="w-4 h-4 mr-2" />
                        Trends
                    </TabsTrigger>
                    <TabsTrigger value="budget">
                        <Target className="w-4 h-4 mr-2" />
                        Budget
                    </TabsTrigger>
                    <TabsTrigger value="anomalies">
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Anomalies
                    </TabsTrigger>
                    <TabsTrigger value="forecast">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Forecast
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
