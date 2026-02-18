import { Landmark } from 'lucide-react';

export function BankBadge({ bank }: { bank: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#FFCC00]/30 bg-[#FFCC00]/5 text-[8px] font-black uppercase tracking-widest text-[#FFCC00]">
      <Landmark className="h-2.5 w-2.5" />
      {bank}
    </span>
  );
}
