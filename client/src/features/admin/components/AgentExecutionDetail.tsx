import { useState } from 'react';
import {
  Bot,
  Clock,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Hash,
} from 'lucide-react';

interface ExecutionData {
  id: string;
  agentType: string;
  status: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  createdAt: string;
  input?: unknown;
  output?: unknown;
  toolCalls?: Array<{ name: string; durationMs: number; timestamp: string }>;
  error?: string;
}

interface AgentExecutionDetailProps {
  execution: ExecutionData;
  onClose: () => void;
}

export function AgentExecutionDetail({ execution, onClose }: AgentExecutionDetailProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    input: false,
    output: false,
    tools: true,
  });

  const toggleSection = (s: string) => setExpandedSections((prev) => ({ ...prev, [s]: !prev[s] }));

  const totalTokens = (execution.inputTokens || 0) + (execution.outputTokens || 0);
  const inputPct = totalTokens > 0 ? ((execution.inputTokens || 0) / totalTokens) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#1a1a2e]">
              <Bot className="w-6 h-6 text-cba-gold" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary">
                {execution.agentType?.replace(/_/g, ' ')}
              </h3>
              <p className="text-xs text-muted font-mono">{execution.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                execution.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : execution.status === 'failed'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-yellow-500/10 text-yellow-400'
              }`}
            >
              {execution.status}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-primary text-xl"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-[#1a1a2e] p-3 text-center">
            <Clock className="w-4 h-4 text-muted mx-auto mb-1" />
            <p className="text-lg font-bold text-primary">
              {(execution.durationMs / 1000).toFixed(2)}s
            </p>
            <p className="text-[10px] text-muted">Duration</p>
          </div>
          <div className="rounded-xl bg-[#1a1a2e] p-3 text-center">
            <Hash className="w-4 h-4 text-muted mx-auto mb-1" />
            <p className="text-lg font-bold text-primary">{totalTokens.toLocaleString()}</p>
            <p className="text-[10px] text-muted">Total Tokens</p>
          </div>
          <div className="rounded-xl bg-[#1a1a2e] p-3 text-center">
            <DollarSign className="w-4 h-4 text-muted mx-auto mb-1" />
            <p className="text-lg font-bold text-cba-gold">
              ${((execution.costCents || 0) / 100).toFixed(4)}
            </p>
            <p className="text-[10px] text-muted">Cost</p>
          </div>
          <div className="rounded-xl bg-[#1a1a2e] p-3 text-center">
            <Bot className="w-4 h-4 text-muted mx-auto mb-1" />
            <p className="text-lg font-bold text-primary">{execution.toolCalls?.length || 0}</p>
            <p className="text-[10px] text-muted">Tool Calls</p>
          </div>
        </div>

        {/* Token Usage Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Input: {(execution.inputTokens || 0).toLocaleString()}</span>
            <span>Output: {(execution.outputTokens || 0).toLocaleString()}</span>
          </div>
          <div className="h-3 rounded-full bg-[#1a1a2e] overflow-hidden flex">
            <div className="h-full bg-blue-500 rounded-l-full" style={{ width: `${inputPct}%` }} />
            <div
              className="h-full bg-emerald-500 rounded-r-full"
              style={{ width: `${100 - inputPct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-1 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Input
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Output
            </span>
          </div>
        </div>

        {/* Error Section */}
        {execution.error && (
          <div className="mb-6 rounded-xl bg-red-500/5 border border-red-500/20 p-4">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-bold">Error</span>
            </div>
            <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
              {execution.error}
            </pre>
          </div>
        )}

        {/* Collapsible Sections */}
        {['input', 'output', 'tools'].map((section) => (
          <div key={section} className="mb-3">
            <button
              type="button"
              onClick={() => toggleSection(section)}
              className="w-full flex items-center gap-2 py-2 text-sm font-bold text-secondary hover:text-primary"
            >
              {expandedSections[section] ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {section === 'input'
                ? 'Input Data'
                : section === 'output'
                  ? 'Output Data'
                  : 'Tool Calls'}
            </button>
            {expandedSections[section] && (
              <div className="rounded-xl bg-[#1a1a2e] p-4 max-h-60 overflow-y-auto">
                {section === 'tools' && execution.toolCalls ? (
                  <div className="space-y-2">
                    {execution.toolCalls.map((tc, i) => (
                      <div
                        key={tc.name ?? `sk-${i}`}
                        className="flex items-center justify-between text-xs py-2 border-b border-border/50 last:border-0"
                      >
                        <span className="text-primary font-mono">{tc.name}</span>
                        <span className="text-muted">{(tc.durationMs / 1000).toFixed(2)}s</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-xs text-secondary whitespace-pre-wrap font-mono">
                    {JSON.stringify(
                      section === 'input' ? execution.input : execution.output,
                      null,
                      2,
                    ) || 'No data'}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}

        <p className="text-[10px] text-zinc-600 mt-4">
          Created: {new Date(execution.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
