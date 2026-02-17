import React, { useEffect, useState } from 'react';
import {
  Database,
  Plus,
  Shield,
  Power,
  PowerOff,
  Trash2,
  Loader2,
  CheckCircle,
  X,
} from 'lucide-react';
import { knowledgeApi } from '../../../api';

interface DataPointManagerProps {
  userId: string;
}

interface DataPoint {
  id: string;
  name: string;
  description: string;
  datapointType: string;
  datasetName: string;
  isActive: boolean;
  isPredefined: boolean;
  extractionCount: number;
  accuracy: number;
  schemaFields: Record<string, unknown>;
  extractionPrompt: string;
  createdAt: string;
}

const TYPE_OPTIONS = ['entity', 'relationship', 'attribute', 'metric', 'custom'];

export function DataPointManager({ userId }: DataPointManagerProps) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    name: '',
    description: '',
    datapointType: 'entity',
    datasetName: '',
    extractionPrompt: '',
    schemaFields: '',
  });
  const [creating, setCreating] = useState(false);

  const loadDataPoints = () => {
    setLoading(true);
    setError(null);
    knowledgeApi
      .listDataPoints(userId)
      .then(setDataPoints)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDataPoints();
  }, [userId]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      let parsedSchema: Record<string, unknown> = {};
      if (form.schemaFields.trim()) {
        try {
          parsedSchema = JSON.parse(form.schemaFields) as Record<string, unknown>;
        } catch {
          parsedSchema = { raw: form.schemaFields };
        }
      }
      await knowledgeApi.createDataPoint({
        userId,
        name: form.name,
        description: form.description,
        datapointType: form.datapointType,
        datasetName: form.datasetName || undefined,
        extractionPrompt: form.extractionPrompt || undefined,
        schemaFields: parsedSchema,
      });
      setShowCreate(false);
      setForm({
        name: '',
        description: '',
        datapointType: 'entity',
        datasetName: '',
        extractionPrompt: '',
        schemaFields: '',
      });
      loadDataPoints();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create datapoint');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (dp: DataPoint) => {
    setToggling(dp.id);
    try {
      if (dp.isActive) {
        await knowledgeApi.deactivateDataPoint(dp.id);
      } else {
        await knowledgeApi.activateDataPoint(dp.id);
      }
      loadDataPoints();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to toggle datapoint');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-zinc-200">DataPoints ({dataPoints.length})</h4>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Create DataPoint
        </button>
      </div>

      {error && (
        <div className="neu-inset rounded-xl p-3 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="neu-raised rounded-xl p-4 border border-[#FFCC00]/20 space-y-3">
          <h4 className="text-sm font-bold text-zinc-200">New DataPoint</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Merchant Entity"
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-200 bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Type
              </label>
              <select
                value={form.datapointType}
                onChange={(e) => setForm({ ...form, datapointType: e.target.value })}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-200 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this datapoint extracts..."
              className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-200 bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Dataset
              </label>
              <input
                type="text"
                value={form.datasetName}
                onChange={(e) => setForm({ ...form, datasetName: e.target.value })}
                placeholder="Optional dataset name"
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-200 bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Schema (JSON)
              </label>
              <input
                type="text"
                value={form.schemaFields}
                onChange={(e) => setForm({ ...form, schemaFields: e.target.value })}
                placeholder='{"field": "type"}'
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-200 bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Extraction Prompt
            </label>
            <textarea
              value={form.extractionPrompt}
              onChange={(e) => setForm({ ...form, extractionPrompt: e.target.value })}
              placeholder="Instructions for the AI to extract this datapoint..."
              rows={2}
              className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-200 bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 disabled:opacity-50 transition-colors"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {/* DataPoints Table */}
      {dataPoints.length === 0 ? (
        <div className="neu-inset rounded-xl p-8 text-center">
          <Database className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">
            No datapoints yet. Create one to start extracting knowledge.
          </p>
        </div>
      ) : (
        <div className="neu-raised rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Dataset</th>
                  <th className="text-center p-3">Active</th>
                  <th className="text-right p-3">Extractions</th>
                  <th className="text-center p-3">Accuracy</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dataPoints.map((dp) => (
                  <tr key={dp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-medium text-zinc-200">
                      <div className="flex items-center gap-1.5">
                        {dp.isPredefined && (
                          <Shield className="w-3.5 h-3.5 text-[#FFCC00] shrink-0" />
                        )}
                        <span className="truncate max-w-[160px]">{dp.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400">
                        {dp.datapointType}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400 truncate max-w-[120px]">
                      {dp.datasetName || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${dp.isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                      />
                    </td>
                    <td className="p-3 text-right text-zinc-300">{dp.extractionCount}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 neu-inset rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${(dp.accuracy ?? 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 w-8 text-right">
                          {((dp.accuracy ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggle(dp)}
                          disabled={toggling === dp.id}
                          className={`p-1.5 rounded-lg transition-colors ${dp.isActive ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-zinc-500 hover:bg-white/5'}`}
                          title={dp.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {toggling === dp.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : dp.isActive ? (
                            <Power className="w-3.5 h-3.5" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {!dp.isPredefined && (
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
