import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div className="neu-raised rounded-[2.5rem] overflow-hidden flex flex-col h-full max-h-[550px] border border-border/50 shadow-2xl relative">
      {/* Header Skeleton */}
      <div className="p-6 border-b border-border/50 flex items-center justify-between sticky top-0 z-10 bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-32 rounded-2xl" />
        </div>
      </div>

      {/* List Skeleton */}
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="neu-raised-sm rounded-3xl p-5 border border-border/50 flex items-start justify-between gap-4"
          >
            <div className="flex items-center gap-4 w-full">
              <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-24 rounded-lg" />
                  <Skeleton className="h-4 w-20 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
