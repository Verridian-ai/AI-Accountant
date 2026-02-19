import React, { useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export function FileUpload({
  onFilesSelected,
  className,
  accept = '.pdf,.csv',
  multiple = true,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      // Reset input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative h-full min-h-[300px] w-full flex flex-col items-center justify-center cursor-pointer',
        'rounded-[2.5rem] border-2 border-dashed border-border/50 bg-white/[0.005]',
        'hover:border-cba-gold/30 hover:bg-cba-gold/[0.02]',
        'transition-all duration-500 ease-out',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label="Upload bank statements"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
      />

      {/* Main Icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-cba-gold blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-full" />
        <div className="w-24 h-24 neu-inset rounded-[2rem] flex items-center justify-center group-hover:scale-110 group-hover:neu-raised transition-all duration-500 relative z-10 border border-border/50">
          <Upload className="h-10 w-10 text-zinc-600 group-hover:text-cba-gold transition-colors duration-300" />
        </div>

        {/* Floating Indicators */}
        <div className="absolute -right-4 -top-4 bg-surface border border-border p-2 rounded-xl shadow-xl transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-75">
          <FileText className="h-4 w-4 text-red-400" />
        </div>
        <div className="absolute -left-4 -bottom-4 bg-surface border border-border p-2 rounded-xl shadow-xl transform -translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">
          <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      {/* Text Content */}
      <div className="text-center space-y-3 relative z-10 max-w-xs mx-auto px-4">
        <h3 className="text-sm font-black text-secondary uppercase tracking-[0.25em] group-hover:text-cba-gold transition-colors duration-300">
          Upload Statements
        </h3>
        <p className="text-[11px] text-muted leading-relaxed font-medium">
          Drop your PDF or CSV bank statements here, or click to browse files.
        </p>
      </div>

      {/* Supported Formats */}
      <div className="mt-8 flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-overlay border border-border/50 text-[9px] font-bold text-secondary uppercase tracking-wider">
          <FileText className="h-3 w-3" /> PDF
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-overlay border border-border/50 text-[9px] font-bold text-secondary uppercase tracking-wider">
          <FileSpreadsheet className="h-3 w-3" /> CSV
        </div>
      </div>

      {/* Hover Action Indicator */}
      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
        <div className="p-2 rounded-full bg-cba-gold/10 text-cba-gold">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
