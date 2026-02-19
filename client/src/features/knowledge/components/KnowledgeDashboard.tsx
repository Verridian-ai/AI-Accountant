import React, { useState, useEffect } from 'react';

async function fetchDatasetList(baseUrl: string): Promise<string[]> {
  const r = await fetch(`${baseUrl}/api/knowledge/datasets`);
  if (!r.ok) return [];
  const data = (await r.json()) as Array<Record<string, unknown> | string>;
  return data
    .map((d) => (typeof d === 'string' ? d : ((d.name ?? d.datasetName ?? '') as string)))
    .filter(Boolean);
}
import { Network, Database, GitBranch, MessageSquare, BarChart3, Loader2 } from 'lucide-react';
import { knowledgeApi } from '../../../api';
import { KnowledgeGraphExplorer } from './KnowledgeGraphExplorer';
import { DataPointManager } from './DataPointManager';
import { OntologyManager } from './OntologyManager';
import { FeedbackPanel } from './FeedbackPanel';
import { GraphStatsPanel } from './GraphStatsPanel';

const TABS = [
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
  { id: 'datapoints', label: 'DataPoints', icon: Database },
  { id: 'ontologies', label: 'Ontologies', icon: GitBranch },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'stats', label: 'Graph Stats', icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface QuickStat {
  label: string;
  value: string | number;
  color: string;
}

export function KnowledgeDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('graph');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasets, setDatasets] = useState<string[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const userId = 'default'; // Would come from auth context in production

  // Load datasets — initialized to true via useState(true), no sync setState needed
  useEffect(() => {
    const baseUrl = (window as unknown as Record<string, string>).__BASE_URL ?? '';
    knowledgeApi
      .getGraph('', { maxNodes: 0 })
      .then(() => fetchDatasetList(baseUrl).catch(() => [] as string[]))
      .then((names) => {
        const list = names.length > 0 ? names : ['transactions', 'gst-rulings', 'merchants'];
        setDatasets(list);
        setSelectedDataset(list[0]);
      })
      .catch(() => {
        setDatasets(['transactions', 'gst-rulings', 'merchants']);
        setSelectedDataset('transactions');
      })
      .finally(() => setLoadingDatasets(false));
  }, []);

  // Load quick stats when dataset changes
  useEffect(() => {
    if (!selectedDataset) return;
    knowledgeApi
      .graphStats(selectedDataset)
      .then((stats: Record<string, unknown>) => {
        setQuickStats([
          { label: 'Total Nodes', value: stats.nodeCount ?? 0, color: 'text-cba-gold' },
          { label: 'Total Edges', value: stats.edgeCount ?? 0, color: 'text-blue-400' },
          {
            label: 'DataPoints Active',
            value: stats.activeDataPoints ?? '-',
            color: 'text-emerald-400',
          },
          {
            label: 'Feedback Score',
            value: stats.feedbackScore != null ? `${(stats.feedbackScore * 100).toFixed(0)}%` : '-',
            color: 'text-purple-400',
          },
        ]);
      })
      .catch(() => {
        setQuickStats([
          { label: 'Total Nodes', value: '-', color: 'text-cba-gold' },
          { label: 'Total Edges', value: '-', color: 'text-blue-400' },
          { label: 'DataPoints Active', value: '-', color: 'text-emerald-400' },
          { label: 'Feedback Score', value: '-', color: 'text-purple-400' },
        ]);
      });
  }, [selectedDataset]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Knowledge Graph</h2>
          <p className="text-sm text-muted">
            Explore, manage, and improve your AI knowledge base
          </p>
        </div>
        {/* Dataset Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="knowledge-dataset-select" className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Dataset:
          </label>
          {loadingDatasets ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted" />
          ) : (
            <select
              id="knowledge-dataset-select"
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="neu-inset rounded-lg px-3 py-1.5 text-sm text-primary bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {datasets.map((ds) => (
                <option key={ds} value={ds}>
                  {ds}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickStats.map((stat) => (
          <div key={stat.label} className="neu-raised rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-cba-gold text-base shadow-[0_0_20px_rgba(255,204,0,0.2)]'
                : 'text-secondary hover:text-zinc-100 hover:bg-overlay'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'graph' && <KnowledgeGraphExplorer datasetName={selectedDataset} />}
        {activeTab === 'datapoints' && <DataPointManager userId={userId} />}
        {activeTab === 'ontologies' && <OntologyManager userId={userId} />}
        {activeTab === 'feedback' && <FeedbackPanel userId={userId} />}
        {activeTab === 'stats' && <GraphStatsPanel datasetName={selectedDataset} />}
      </div>
    </div>
  );
}
