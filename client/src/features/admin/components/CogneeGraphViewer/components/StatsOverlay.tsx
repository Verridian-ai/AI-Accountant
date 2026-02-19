export function StatsOverlay({
  nodeCount,
  linkCount,
  datasetCount,
  typeCount,
}: {
  nodeCount: number;
  linkCount: number;
  datasetCount: number;
  typeCount: number;
}) {
  return (
    <div className="absolute bottom-4 left-4 bg-[#1a1a2e]/90 border border-cba-gold/20 rounded-lg px-3 py-2 text-xs font-mono text-gray-400 space-y-0.5 pointer-events-none select-none">
      <div>
        Nodes: <span className="text-cba-gold">{nodeCount}</span>
      </div>
      <div>
        Edges: <span className="text-cba-gold">{linkCount}</span>
      </div>
      <div>
        Datasets: <span className="text-cba-gold">{datasetCount}</span>
      </div>
      <div>
        Types: <span className="text-cba-gold">{typeCount}</span>
      </div>
    </div>
  );
}
