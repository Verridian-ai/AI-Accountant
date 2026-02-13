import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ArrowLeftRight, Layers, Settings, GitBranch, AlertCircle } from 'lucide-react';
import { entityApi } from '@/api';
import type { EntityHierarchyResponse, EntityData } from '@/api';
import { EntityHierarchyView } from './EntityHierarchyView';
import { InterEntityTransactionsView } from './InterEntityTransactionsView';
import { ConsolidationView } from './ConsolidationView';
import { EntitySettingsPanel } from './EntitySettingsPanel';

const FINANCIAL_YEARS = ['2023-24', '2024-25', '2025-26'];

export function EntitiesDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<EntityHierarchyResponse | null>(null);
  const [financialYear, setFinancialYear] = useState('2024-25');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');

  const loadHierarchy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await entityApi.getHierarchy();
      setHierarchy(result);
    } catch (err) {
      console.error('Failed to load entity hierarchy:', err);
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  const entities = hierarchy?.entities ?? [];
  const totalEntities = hierarchy?.totalEntities ?? 0;
  const linkedAccounts = entities.reduce((sum: number, e: any) => sum + e.accounts.length, 0);
  const consolidatedParents = entities.filter((e: any) => e.isConsolidatedParent).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Entities</h2>
          <p className="text-sm text-zinc-500">
            Multi-entity management, inter-entity transactions & consolidation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entities.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={financialYear} onValueChange={setFinancialYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="FY" />
            </SelectTrigger>
            <SelectContent>
              {FINANCIAL_YEARS.map((fy) => (
                <SelectItem key={fy} value={fy}>
                  FY {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="neu-raised border-0">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <Building2 className="w-4 h-4" />
                  Total Entities
                </div>
                <p className="text-2xl font-bold text-zinc-100">{totalEntities}</p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <GitBranch className="w-4 h-4" />
                  Linked Accounts
                </div>
                <p className="text-2xl font-bold text-zinc-100">{linkedAccounts}</p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <Layers className="w-4 h-4" />
                  Consolidated Groups
                </div>
                <p className="text-2xl font-bold text-zinc-100">{consolidatedParents}</p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <ArrowLeftRight className="w-4 h-4" />
                  FY Period
                </div>
                <p className="text-2xl font-bold text-[#FFCC00]">{financialYear}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {error && (
        <div className="neu-raised border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="hierarchy">
            <GitBranch className="w-4 h-4 mr-2" />
            Entity Hierarchy
          </TabsTrigger>
          <TabsTrigger value="inter-entity">
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Inter-Entity Txns
          </TabsTrigger>
          <TabsTrigger value="consolidation">
            <Layers className="w-4 h-4 mr-2" />
            Consolidation
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy">
          <EntityHierarchyView hierarchy={hierarchy} loading={loading} onRefresh={loadHierarchy} />
        </TabsContent>

        <TabsContent value="inter-entity">
          <InterEntityTransactionsView entities={entities} selectedEntityId={selectedEntityId} />
        </TabsContent>

        <TabsContent value="consolidation">
          <ConsolidationView entities={entities} financialYear={financialYear} />
        </TabsContent>

        <TabsContent value="settings">
          <EntitySettingsPanel entities={entities} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
