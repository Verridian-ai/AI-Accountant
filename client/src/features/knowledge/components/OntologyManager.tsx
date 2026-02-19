import React, { useEffect, useState } from 'react';
import { GitBranch, Plus, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { knowledgeApi } from '../../../api';

interface OntologyManagerProps {
  userId: string;
}

interface Ontology {
  id: string;
  name: string;
  ontologyType: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  appliedDatasets: string[];
  version: number;
  createdAt: string;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  financial: 'bg-cba-gold/10 text-cba-gold',
  generic: 'bg-blue-500/10 text-blue-400',
  custom: 'bg-purple-500/10 text-purple-400',
  domain: 'bg-emerald-500/10 text-emerald-400',
};

export function OntologyManager({ userId }: OntologyManagerProps) {
  const [ontologies, setOntologies] = useState<Ontology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applyDataset, setApplyDataset] = useState('');

  // Create form state
  const [form, setForm] = useState({
    name: '',
    ontologyType: 'custom',
    description: '',
    nodeTypes: '',
    edgeTypes: '',
  });
  const [creating, setCreating] = useState(false);

  const loadOntologies = () => {
    setLoading(true);
    setError(null);
    knowledgeApi
      .listOntologies(userId)
      .then(setOntologies)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOntologies();
  }, [userId]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await knowledgeApi.createOntology({
        userId,
        name: form.name,
        ontologyType: form.ontologyType,
        description: form.description,
        nodeTypes: form.nodeTypes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        edgeTypes: form.edgeTypes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowCreate(false);
      setForm({ name: '', ontologyType: 'custom', description: '', nodeTypes: '', edgeTypes: '' });
      loadOntologies();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create ontology');
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async (ontologyId: string) => {
    if (!applyDataset.trim()) return;
    setApplying(ontologyId);
    try {
      await knowledgeApi.applyOntology(ontologyId, applyDataset);
      setApplyDataset('');
      setApplying(null);
      loadOntologies();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to apply ontology');
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-primary">Ontologies ({ontologies.length})</h4>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cba-gold text-base hover:bg-cba-gold/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Create Ontology
        </button>
      </div>

      {error && <div className="neu-inset rounded-xl p-3 text-xs text-red-400">{error}</div>}

      {/* Create Modal */}
      {showCreate && (
        <div className="neu-raised rounded-xl p-4 border border-cba-gold/20 space-y-3">
          <h4 className="text-sm font-bold text-primary">New Ontology</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Financial Ontology"
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-primary bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Type
              </label>
              <select
                value={form.ontologyType}
                onChange={(e) => setForm({ ...form, ontologyType: e.target.value })}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-primary bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                <option value="custom">Custom</option>
                <option value="financial">Financial</option>
                <option value="generic">Generic</option>
                <option value="domain">Domain</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the ontology purpose..."
              rows={2}
              className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-primary bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Node Types (comma-separated)
              </label>
              <input
                type="text"
                value={form.nodeTypes}
                onChange={(e) => setForm({ ...form, nodeTypes: e.target.value })}
                placeholder="entity, concept, document"
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-primary bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Edge Types (comma-separated)
              </label>
              <input
                type="text"
                value={form.edgeTypes}
                onChange={(e) => setForm({ ...form, edgeTypes: e.target.value })}
                placeholder="related_to, part_of"
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-primary bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-cba-gold text-base hover:bg-cba-gold/90 disabled:opacity-50 transition-colors"
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

      {/* Ontology Cards */}
      {ontologies.length === 0 ? (
        <div className="neu-inset rounded-xl p-8 text-center">
          <GitBranch className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-muted">
            No ontologies yet. Create one to structure your knowledge graph.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ontologies.map((ont) => {
            const badgeClass = TYPE_BADGE_COLORS[ont.ontologyType] ?? 'bg-overlay text-secondary';
            return (
              <div key={ont.id} className="neu-raised rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-zinc-100">{ont.name}</h5>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}
                    >
                      {ont.ontologyType}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600">v{ont.version}</span>
                </div>
                {ont.description && (
                  <p className="text-xs text-secondary line-clamp-2">{ont.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>{ont.nodeCount} nodes</span>
                  <span>{ont.edgeCount} edges</span>
                </div>
                {ont.appliedDatasets.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ont.appliedDatasets.map((ds) => (
                      <span
                        key={ds}
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-overlay text-secondary"
                      >
                        {ds}
                      </span>
                    ))}
                  </div>
                )}
                {/* Apply to dataset */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Dataset name..."
                    value={applying === ont.id ? applyDataset : ''}
                    onFocus={() => setApplying(ont.id)}
                    onChange={(e) => {
                      setApplying(ont.id);
                      setApplyDataset(e.target.value);
                    }}
                    className="flex-1 neu-inset rounded-lg px-2 py-1 text-xs text-primary bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleApply(ont.id)}
                    disabled={applying !== ont.id || !applyDataset.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-cba-gold hover:bg-cba-gold/10 disabled:opacity-30 transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" /> Apply
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
