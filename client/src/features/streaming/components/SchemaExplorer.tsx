/**
 * SchemaExplorer — View registered Zod schemas and validation stats
 *
 * Fetches from GET /api/schemas and lets users validate test JSON.
 */

import { useState, useEffect, useCallback } from 'react';
import { BASE_URL, getAuthHeaders } from '../../../api';
import { Code2, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const API_URL = `${BASE_URL}/api`;

interface SchemaInfo {
  agentType: string;
  schemaName: string;
  version: number;
  isActive: boolean;
  validationStats: { total: number; passed: number; failed: number };
  jsonSchema?: unknown;
}

export function SchemaExplorer() {
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testAgent, setTestAgent] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ valid: boolean; errors?: string[] } | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchSchemas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/schemas`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSchemas(Array.isArray(data) ? data : (data.schemas ?? []));
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  const handleValidate = async () => {
    if (!testAgent || !testInput.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const parsed = JSON.parse(testInput);
      const res = await fetch(`${API_URL}/schemas/${testAgent}/validate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: parsed }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      setTestResult({
        valid: false,
        errors: [err instanceof Error ? err.message : 'Invalid JSON'],
      });
    } finally {
      setTesting(false);
    }
  };

  const formatAgent = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading schemas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100">Output Schemas</h3>
        <button
          onClick={fetchSchemas}
          className="neu-raised-sm p-2 rounded-lg text-zinc-400 hover:text-[#FFCC00]"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Schema list */}
      <div className="space-y-2">
        {schemas.map((schema) => (
          <div key={schema.agentType} className="neu-inset rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === schema.agentType ? null : schema.agentType)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <Code2 className="w-4 h-4 text-[#FFCC00]" />
                <span className="text-sm font-medium text-zinc-200">
                  {formatAgent(schema.agentType)}
                </span>
                <span className="text-[10px] text-zinc-500">v{schema.version}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400">{schema.validationStats.passed}✓</span>
                  <span className="text-red-400">{schema.validationStats.failed}✗</span>
                  <span className="text-zinc-500">{schema.validationStats.total} total</span>
                </div>
                {expanded === schema.agentType ? (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                )}
              </div>
            </button>
            {expanded === schema.agentType && !!schema.jsonSchema && (
              <div className="px-4 pb-4 border-t border-white/5 pt-3">
                <p className="text-xs text-zinc-500 mb-2">Schema: {schema.schemaName}</p>
                {schema.jsonSchema && (
                  <pre className="text-[11px] text-zinc-400 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48">
                    {JSON.stringify(schema.jsonSchema, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Validation test panel */}
      <div className="neu-raised rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-bold text-zinc-200">Test Validation</h4>
        <select
          value={testAgent ?? ''}
          onChange={(e) => {
            setTestAgent(e.target.value || null);
            setTestResult(null);
          }}
          className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-300 bg-transparent border border-white/10"
        >
          <option value="">Select agent schema...</option>
          {schemas.map((s) => (
            <option key={s.agentType} value={s.agentType}>
              {formatAgent(s.agentType)}
            </option>
          ))}
        </select>
        <textarea
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="Paste JSON output to validate..."
          rows={4}
          className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-300 bg-transparent border border-white/10 font-mono resize-none"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={handleValidate}
            disabled={!testAgent || !testInput.trim() || testing}
            className="neu-raised px-4 py-2 rounded-lg text-sm font-bold text-[#FFCC00] disabled:text-zinc-600 transition-colors"
          >
            {testing ? 'Validating...' : 'Validate'}
          </button>
          {testResult && (
            <div className="flex items-center gap-2">
              {testResult.valid ? (
                <span className="flex items-center gap-1 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Valid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-400">
                  <XCircle className="w-4 h-4" /> Invalid
                </span>
              )}
            </div>
          )}
        </div>
        {testResult?.errors && testResult.errors.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <ul className="space-y-1">
              {testResult.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-400">
                  • {err}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
