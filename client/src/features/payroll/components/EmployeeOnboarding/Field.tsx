import { AlertCircle } from 'lucide-react';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/40"
      />
      {hint && (
        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {hint}
        </p>
      )}
    </div>
  );
}
