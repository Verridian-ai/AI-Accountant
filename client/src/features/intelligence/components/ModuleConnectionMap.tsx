import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { intelligenceApi } from '../../../api';

interface ModuleConnectionMapProps {
  connections?: Connection[];
}

interface Connection {
  id: string;
  sourceModule: string;
  targetModule: string;
  connectionType: 'data_flow' | 'trigger' | 'dependency' | 'correlation' | 'enrichment';
  strength: number;
  description: string;
}

const MODULES = [
  'transactions',
  'analytics',
  'tax',
  'bas',
  'gst',
  'knowledge',
  'documents',
  'matching',
  'intelligence',
];

const CONNECTION_COLORS: Record<string, string> = {
  data_flow: '#3b82f6',
  trigger: '#f97316',
  dependency: '#ef4444',
  correlation: '#a855f7',
  enrichment: '#22c55e',
};

const MODULE_COLORS: Record<string, string> = {
  transactions: '#22c55e',
  analytics: '#a855f7',
  tax: '#f97316',
  bas: '#8b5cf6',
  gst: '#10b981',
  knowledge: '#06b6d4',
  documents: '#f43f5e',
  matching: '#eab308',
  intelligence: '#FFCC00',
};

export function ModuleConnectionMap({ connections: propConnections }: ModuleConnectionMapProps) {
  const [connections, setConnections] = useState<Connection[]>(propConnections ?? []);
  const [loading, setLoading] = useState(!propConnections);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Only load on mount; propConnections is intentionally excluded since
    // the caller controls the data externally when provided
    if (!propConnections) loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await intelligenceApi.getConnections();
      setConnections(Array.isArray(data) ? data : (data.connections ?? []));
      setError(null);
    } catch {
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  // Calculate module positions in a circle
  const width = 600;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 180;

  const modulePositions = MODULES.reduce<Record<string, { x: number; y: number }>>(
    (acc, mod, i) => {
      const angle = (2 * Math.PI * i) / MODULES.length - Math.PI / 2;
      acc[mod] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
      return acc;
    },
    {},
  );

  const getModuleConnections = (mod: string) => {
    const incoming = connections.filter((c) => c.targetModule === mod);
    const outgoing = connections.filter((c) => c.sourceModule === mod);
    return { incoming, outgoing };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cba-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="neu-raised p-4 rounded-lg text-red-400 text-center">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* SVG Map */}
        <div className="flex-1 neu-raised rounded-lg p-4 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto max-h-[500px]"
          >
            {/* Connections */}
            {connections.map((conn) => {
              const src = modulePositions[conn.sourceModule];
              const tgt = modulePositions[conn.targetModule];
              if (!src || !tgt) return null;
              const color = CONNECTION_COLORS[conn.connectionType] ?? '#666';
              const strokeWidth = Math.max(1, conn.strength * 4);
              const isSelected = selectedConnection?.id === conn.id;

              return (
                <g key={conn.id}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={color}
                    strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                    strokeOpacity={isSelected ? 1 : 0.4}
                    className="cursor-pointer transition-all"
                    onClick={() => setSelectedConnection(isSelected ? null : conn)}
                  />
                  {/* Arrow head */}
                  <circle
                    cx={tgt.x + (src.x - tgt.x) * 0.15}
                    cy={tgt.y + (src.y - tgt.y) * 0.15}
                    r={3}
                    fill={color}
                    opacity={isSelected ? 1 : 0.6}
                  />
                </g>
              );
            })}

            {/* Module nodes */}
            {MODULES.map((mod) => {
              const pos = modulePositions[mod];
              const color = MODULE_COLORS[mod] ?? '#888';
              const isSelected = selectedModule === mod;

              return (
                <g
                  key={mod}
                  className="cursor-pointer"
                  onClick={() => setSelectedModule(isSelected ? null : mod)}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isSelected ? 32 : 28}
                    fill={`${color}20`}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 1.5}
                    className="transition-all"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={color}
                    fontSize="9"
                    fontWeight="bold"
                    className="pointer-events-none uppercase"
                  >
                    {mod.slice(0, 5)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {Object.entries(CONNECTION_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-4 h-1 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-muted uppercase font-medium">
                  {type.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {(selectedModule || selectedConnection) && (
          <div className="w-full lg:w-72 neu-raised rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-cba-gold">
                {selectedModule ? `Module: ${selectedModule}` : 'Connection Detail'}
              </h4>
              <button
                onClick={() => {
                  setSelectedModule(null);
                  setSelectedConnection(null);
                }}
                className="text-muted hover:text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedModule &&
              (() => {
                const { incoming, outgoing } = getModuleConnections(selectedModule);
                return (
                  <>
                    <div>
                      <p className="text-xs text-muted font-medium mb-1">
                        Incoming ({incoming.length})
                      </p>
                      {incoming.map((c) => (
                        <div key={c.id} className="text-xs text-secondary py-0.5">
                          ← {c.sourceModule}{' '}
                          <span className="text-zinc-600">({c.connectionType})</span>
                        </div>
                      ))}
                      {incoming.length === 0 && <p className="text-xs text-zinc-600">None</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium mb-1">
                        Outgoing ({outgoing.length})
                      </p>
                      {outgoing.map((c) => (
                        <div key={c.id} className="text-xs text-secondary py-0.5">
                          → {c.targetModule}{' '}
                          <span className="text-zinc-600">({c.connectionType})</span>
                        </div>
                      ))}
                      {outgoing.length === 0 && <p className="text-xs text-zinc-600">None</p>}
                    </div>
                  </>
                );
              })()}

            {selectedConnection && (
              <>
                <div className="text-sm text-primary">
                  <span className="font-medium">{selectedConnection.sourceModule}</span>
                  <span className="text-zinc-600"> → </span>
                  <span className="font-medium">{selectedConnection.targetModule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Type:</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: `${CONNECTION_COLORS[selectedConnection.connectionType]}20`,
                      color: CONNECTION_COLORS[selectedConnection.connectionType],
                    }}
                  >
                    {selectedConnection.connectionType.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted">Strength:</span>
                  <div className="mt-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cba-gold"
                      style={{ width: `${selectedConnection.strength * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-secondary">{selectedConnection.description}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
