import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileUploadState } from '../types.js';

export function StatusBadge({ status }: { status: FileUploadState['status'] }) {
  const config = {
    pending: {
      label: 'Queued',
      classes: 'bg-zinc-800 text-zinc-500 border-zinc-700',
      icon: <Clock className="h-2.5 w-2.5" />,
    },
    uploading: {
      label: 'Uploading',
      classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
    },
    parsing: {
      label: 'Parsing...',
      classes: 'bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/20',
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
    },
    completed: {
      label: 'Complete',
      classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
    },
    error: {
      label: 'Error',
      classes: 'bg-red-500/10 text-red-400 border-red-500/20',
      icon: <AlertCircle className="h-2.5 w-2.5" />,
    },
  };

  const c = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest',
        c.classes,
      )}
    >
      {c.icon}
      {c.label}
    </span>
  );
}
