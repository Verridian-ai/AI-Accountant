import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/80',
        secondary: 'border-transparent bg-white/10 text-zinc-100 hover:bg-white/20',
        destructive: 'border-transparent bg-red-500/10 text-red-400 hover:bg-red-500/20',
        outline: 'text-zinc-100 border-white/20',
        success: 'border-transparent bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
        warning: 'border-transparent bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
