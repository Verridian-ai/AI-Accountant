import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_NAMES_BY_TYPE } from '../constants/categories';
import { getCategoryColor } from '../constants/categoryColors';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  className?: string;
  'aria-label'?: string;
  size?: 'sm' | 'md' | 'lg';
}

const GROUP_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  cogs: 'Cost of Goods Sold',
  expense: 'Expenses',
  system: 'System',
};

const GROUP_ORDER = ['revenue', 'cogs', 'expense', 'system'];

export function CategorySelect({
  value,
  onChange,
  includeAll = false,
  className,
  'aria-label': ariaLabel = 'Select category',
  size = 'md',
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sizeClasses = {
    sm: 'py-2 px-3 text-xs',
    md: 'py-3 px-4 text-sm',
    lg: 'py-4 px-5 text-base',
  };

  // Build flat list of all options for keyboard nav
  const allOptions = useMemo(() => {
    const options: string[] = [];
    if (includeAll) options.push('All');
    for (const group of GROUP_ORDER) {
      const items = CATEGORY_NAMES_BY_TYPE[group];
      if (items) options.push(...items);
    }
    return options;
  }, [includeAll]);

  const selectedColor = value && value !== 'All' ? getCategoryColor(value) : null;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
          setHighlightIndex(allOptions.indexOf(value));
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, allOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightIndex >= 0 && allOptions[highlightIndex]) {
            onChange(allOptions[highlightIndex]);
            setOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, highlightIndex, allOptions, value, onChange],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-controls="category-listbox"
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full neu-inset rounded-xl text-cba-gold font-bold bg-transparent border-none focus-gold cursor-pointer pr-10 text-left flex items-center gap-2',
          sizeClasses[size],
          className,
        )}
      >
        {selectedColor && (
          <span className={cn('w-2 h-2 rounded-full shrink-0', selectedColor.dot)} />
        )}
        <span className="truncate">{value || 'Select...'}</span>
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cba-gold/50 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          id="category-listbox"
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto neu-raised rounded-xl border border-border bg-surface shadow-2xl scrollbar-thin animate-in fade-in zoom-in-95 duration-150"
          onKeyDown={handleKeyDown}
        >
          {includeAll && (
            <li
              role="option"
              aria-selected={value === 'All' ? 'true' : 'false'}
              tabIndex={-1}
              className={cn(
                'px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors',
                value === 'All' ? 'text-cba-gold bg-cba-gold/5' : 'text-primary hover:bg-overlay',
                highlightIndex === 0 && 'bg-overlay-hover',
              )}
              onClick={() => {
                onChange('All');
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange('All');
                  setOpen(false);
                }
              }}
            >
              All Categories
            </li>
          )}

          {GROUP_ORDER.map((group) => {
            const items = CATEGORY_NAMES_BY_TYPE[group];
            if (!items || items.length === 0) return null;
            return (
              <li key={group} role="group">
                <div className="px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 bg-black/30 sticky top-0">
                  {GROUP_LABELS[group]}
                </div>
                {items.map((cat) => {
                  const color = getCategoryColor(cat);
                  const flatIndex = allOptions.indexOf(cat);
                  return (
                    <div
                      key={cat}
                      role="option"
                      aria-selected={value === cat ? 'true' : 'false'}
                      tabIndex={-1}
                      className={cn(
                        'px-4 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center gap-2',
                        value === cat
                          ? 'text-cba-gold bg-cba-gold/5'
                          : 'text-primary hover:bg-overlay',
                        highlightIndex === flatIndex && 'bg-overlay-hover',
                      )}
                      onClick={() => {
                        onChange(cat);
                        setOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onChange(cat);
                          setOpen(false);
                        }
                      }}
                    >
                      <span className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
                      {cat}
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CategorySelectWithBadge({ value, onChange, ...props }: CategorySelectProps) {
  const color = getCategoryColor(value || 'Uncategorized');

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-3 h-3 rounded-full shrink-0', color.dot)} />
      <CategorySelect value={value} onChange={onChange} {...props} />
    </div>
  );
}
