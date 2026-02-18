import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function UserManagementSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-32 h-5 rounded" />
            <Skeleton className="w-20 h-3 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-20 h-8 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-3 mb-6">
        <Skeleton className="flex-1 h-10 rounded-xl" />
        <Skeleton className="w-[140px] h-10 rounded-xl" />
        <Skeleton className="w-[140px] h-10 rounded-xl" />
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="w-full h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
