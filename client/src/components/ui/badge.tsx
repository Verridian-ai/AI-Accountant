import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-cba-gold text-base hover:bg-cba-gold/80 font-bold',
        secondary: 'border-transparent bg-overlay-hover text-primary hover:bg-overlay',
        destructive: 'border-transparent bg-danger/10 text-danger hover:bg-danger/20',
        outline: 'text-primary border-border',
        success: 'border-transparent bg-success/10 text-success hover:bg-success/20',
        warning: 'border-transparent bg-cba-gold/10 text-cba-gold-dark hover:bg-cba-gold/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
