interface LedgerFooterProps {
  totalCount: number;
  filteredCount: number;
  loadedCount?: number;
  onLoadMore?: () => void;
}

export function LedgerFooter({
  totalCount,
  filteredCount,
  loadedCount,
  onLoadMore,
}: LedgerFooterProps) {
  const hasMore = loadedCount != null && loadedCount < totalCount;

  return (
    <div className="px-8 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">
            Total Transactions
          </span>
          <span className="text-sm font-bold text-zinc-400 tracking-tight">{totalCount}</span>
        </div>
        <div className="w-px h-6 bg-white/5" />
        <div className="flex flex-col">
          <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">
            Showing
          </span>
          <span className="text-sm font-bold text-[#FFCC00] tracking-tight">{filteredCount}</span>
        </div>
        {hasMore && (
          <>
            <div className="w-px h-6 bg-white/5" />
            <button
              onClick={onLoadMore}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#FFCC00] neu-raised-sm rounded-xl btn-press border border-[#FFCC00]/10 hover:border-[#FFCC00]/30 transition-colors"
            >
              Load More ({totalCount - (loadedCount ?? 0)} remaining)
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
          Secure Transaction Log
        </span>
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]/30 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
