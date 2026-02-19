import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function FeedbackQueueSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={`sk-${i}`} className="neu-raised rounded-2xl p-4 border border-border/50">
            <Skeleton className="w-24 h-3 rounded mb-2" />
            <Skeleton className="w-12 h-8 rounded" />
          </div>
        ))}
      </div>
      <div className="neu-raised rounded-[2rem] p-6 border border-border/50">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-32 h-5 rounded" />
            <Skeleton className="w-48 h-3 rounded" />
          </div>
        </div>
        <div className="flex gap-3 mb-6">
          <Skeleton className="flex-1 h-10 rounded-xl" />
          <Skeleton className="w-[150px] h-10 rounded-xl" />
          <Skeleton className="w-[140px] h-10 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={`sk-${i}`} className="w-full h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
