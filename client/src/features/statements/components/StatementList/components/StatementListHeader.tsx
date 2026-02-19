import type { RefObject, ChangeEvent } from 'react';
import { FileText, Upload, Loader2 } from 'lucide-react';

interface StatementListHeaderProps {
  statementsCount: number;
  isUploading: boolean;
  completeCount: number;
  totalCount: number;
  fileInputRef: RefObject<HTMLInputElement>;
  onUploadChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function StatementListHeader({
  statementsCount,
  isUploading,
  completeCount,
  totalCount,
  fileInputRef,
  onUploadChange,
}: StatementListHeaderProps) {
  return (
    <div className="p-6 border-b border-border/50 flex items-center justify-between sticky top-0 z-10 bg-surface/80 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="neu-inset p-3 rounded-2xl">
          <FileText className="h-6 w-6 text-cba-gold" />
        </div>
        <div className="text-left">
          <h3 className="font-black text-zinc-100 text-sm uppercase tracking-widest">Statements</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
              {statementsCount} Nodes Indexed
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onUploadChange}
          className="hidden"
          accept=".pdf,.csv"
          multiple
          aria-label="Upload bank statements"
        />
        <button
          type="button"
          title="Upload PDF statements"
          aria-label="Upload PDF statements"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 px-5 h-11 text-[10px] font-black uppercase tracking-[0.2em] text-base cba-gold-gradient cba-gold-glow rounded-2xl btn-press disabled:opacity-50 transition-all active:scale-95"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="hidden xs:inline">
            {isUploading ? `${completeCount}/${totalCount}` : 'Inject'}
          </span>
        </button>
      </div>
    </div>
  );
}
