import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_NAMES } from '../constants/categories';
import { getCategoryColor } from '../constants/categoryColors';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean; // For filter bar - adds "All" option
  className?: string;
  'aria-label'?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CategorySelect({
  value,
  onChange,
  includeAll = false,
  className,
  'aria-label': ariaLabel = 'Select category',
  size = 'md',
}: CategorySelectProps) {
  const options = includeAll ? ['All', ...CATEGORY_NAMES] : CATEGORY_NAMES;

  const sizeClasses = {
    sm: 'py-2 px-3 text-xs',
    md: 'py-3 px-4 text-sm',
    lg: 'py-4 px-5 text-base',
  };

  // Get the color for the selected category for visual feedback
  const selectedColor = value && value !== 'All' ? getCategoryColor(value) : null;

  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full neu-inset rounded-xl text-[#FFCC00] font-bold bg-transparent border-none focus-gold appearance-none cursor-pointer pr-10",
          sizeClasses[size],
          className
        )}
        style={selectedColor ? {
          borderLeftColor: selectedColor.border.replace('border-', '').replace('-500', ''),
        } : undefined}
      >
        {options.map(cat => (
          <option
            key={cat}
            value={cat}
            className="bg-[#12121a] text-zinc-300"
          >
            {cat}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFCC00]/50 pointer-events-none" />
    </div>
  );
}

export function CategorySelectWithBadge({
  value,
  onChange,
  ...props
}: CategorySelectProps) {
  const color = getCategoryColor(value || 'Uncategorized');

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-3 h-3 rounded-full shrink-0",
          color.dot
        )}
      />
      <CategorySelect value={value} onChange={onChange} {...props} />
    </div>
  );
}
