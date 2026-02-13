import { useState, useEffect } from 'react';
import { fetchCogneeDatasetDetail } from '../../../api';
import { Database, FileText, Layers, ArrowLeft } from 'lucide-react';

interface DatasetDetailData {
  name: string;
  category?: string;
  documentCount?: number;
  entityCount?: number;
  relationshipCount?: number;
  lastIndexed?: string;
  entityTypes?: Record<string, number>;
  relationshipTypes?: Record<string, number>;
  documents?: Array<{ id: string; name: string; addedAt: string; size?: number }>;
}

interface CogneeDatasetDetailProps {
  datasetName: string;
  onBack: () => void;
}

export function CogneeDatasetDetail({ datasetName, onBack }: CogneeDatasetDetailProps) {
  const [data, setData] = useState<DatasetDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetail();
  }, [datasetName]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await fetchCogneeDatasetDetail(datasetName);
      setData(res);
    } catch {
      /* */
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />;
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-[#16213e] p-12 text-center">
        <p className="text-zinc-500">Dataset not found</p>
        <button type="button" onClick={onBack} className="mt-4 text-[#FFCC00] text-sm">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl bg-[#16213e] text-zinc-400 hover:text-[#FFCC00]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{data.name}</h2>
          <p className="text-sm text-zinc-500">{data.category || 'Uncategorized'} dataset</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 text-center">
          <FileText className="w-5 h-5 text-[#FFCC00] mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{data.documentCount ?? 0}</p>
          <p className="text-xs text-zinc-500">Documents</p>
        </div>
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 text-center">
          <Database className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{data.entityCount ?? 0}</p>
          <p className="text-xs text-zinc-500">Entities</p>
        </div>
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 text-center">
          <Layers className="w-5 h-5 text-violet-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{data.relationshipCount ?? 0}</p>
          <p className="text-xs text-zinc-500">Relationships</p>
        </div>
      </div>

      {/* Entity Types */}
      {data.entityTypes && Object.keys(data.entityTypes).length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-white mb-4">Entity Types</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.entityTypes).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1a1a2e]"
              >
                <span className="text-xs text-zinc-300">{type}</span>
                <span className="text-xs font-bold text-[#FFCC00]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationship Types */}
      {data.relationshipTypes && Object.keys(data.relationshipTypes).length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-white mb-4">Relationship Types</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.relationshipTypes).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1a1a2e]"
              >
                <span className="text-xs text-zinc-300">{type}</span>
                <span className="text-xs font-bold text-violet-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents List */}
      {data.documents && data.documents.length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-white mb-4">Documents</h3>
          <div className="space-y-2">
            {data.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1a1a2e] text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-zinc-500" />
                  <span className="text-zinc-300">{doc.name}</span>
                </div>
                <span className="text-zinc-500">{new Date(doc.addedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.lastIndexed && (
        <p className="text-[10px] text-zinc-600">
          Last indexed: {new Date(data.lastIndexed).toLocaleString()}
        </p>
      )}
    </div>
  );
}
