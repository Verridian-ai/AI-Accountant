import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, BarChart3, History } from 'lucide-react';
import { BASPreFillReport } from './BASPreFillReport';
import { BASComparison } from './BASComparison';
import { BASDashboard } from './BASDashboard';

export function BASPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">BAS Reporting</h2>
        <p className="text-sm text-zinc-500">
          Calculate, pre-fill, and compare your Business Activity Statements
        </p>
      </div>

      <Tabs defaultValue="calculate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calculate">
            <History className="w-4 h-4 mr-2" />
            Calculate
          </TabsTrigger>
          <TabsTrigger value="prefill">
            <FileText className="w-4 h-4 mr-2" />
            Pre-Fill Report
          </TabsTrigger>
          <TabsTrigger value="compare">
            <BarChart3 className="w-4 h-4 mr-2" />
            Compare Periods
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculate">
          <BASDashboard />
        </TabsContent>

        <TabsContent value="prefill">
          <BASPreFillReport />
        </TabsContent>

        <TabsContent value="compare">
          <BASComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
}
