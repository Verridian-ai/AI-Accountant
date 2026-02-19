import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border border-border bg-base px-4 py-2 text-sm transition-all neu-inset file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cba-gold/50 focus:border-cba-gold/50 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
