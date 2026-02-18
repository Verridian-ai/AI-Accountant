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
    <div className="absolute bottom-4 left-4 bg-[#1a1a2e]/90 border border-[#FFCC00]/20 rounded-lg px-3 py-2 text-xs font-mono text-gray-400 space-y-0.5 pointer-events-none select-none">
      <div>
        Nodes: <span className="text-[#FFCC00]">{nodeCount}</span>
      </div>
      <div>
        Edges: <span className="text-[#FFCC00]">{linkCount}</span>
      </div>
      <div>
        Datasets: <span className="text-[#FFCC00]">{datasetCount}</span>
      </div>
      <div>
        Types: <span className="text-[#FFCC00]">{typeCount}</span>
      </div>
    </div>
  );
}
