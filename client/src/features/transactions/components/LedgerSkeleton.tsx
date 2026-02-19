import { Skeleton } from '@/components/ui/skeleton';
import { TransactionCardSkeleton } from './TransactionCard';

export function LedgerSkeletonMobile() {
  return (
    <div className="md:hidden space-y-4">
      {/* Mobile header skeleton */}
      <div className="p-4 bg-base border-b border-border/50 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="h-12 w-28 rounded-xl shrink-0" />
          <Skeleton className="h-12 w-28 rounded-xl shrink-0" />
          <Skeleton className="h-12 w-28 rounded-xl shrink-0" />
        </div>
      </div>
      {/* Card skeletons */}
      <div className="px-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <TransactionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function LedgerSkeletonDesktop() {
  return (
    <div className="hidden md:block space-y-6 p-1">
      {/* Header Skeleton */}
      <div className="neu-raised rounded-3xl flex flex-col border border-border">
        <div className="p-6 border-b border-border/50 bg-white/1 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-[200px] rounded-2xl" />
              <Skeleton className="h-12 w-32 rounded-2xl" />
              <div className="flex gap-2">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <Skeleton className="h-12 w-12 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-overlay border border-border/50 rounded-3xl overflow-hidden">
        <div className="p-8 space-y-4">
          <div className="flex gap-4 mb-6 px-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 items-center py-4 border-b border-border/50 px-3">
              <Skeleton className="h-6 w-20 rounded-lg" />
              <div className="flex items-center gap-3 w-64">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <Skeleton className="h-4 w-40 rounded" />
              </div>
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-xl" />
              <Skeleton className="h-6 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LedgerSkeleton() {
  return (
    <>
      <LedgerSkeletonMobile />
      <LedgerSkeletonDesktop />
    </>
  );
}
