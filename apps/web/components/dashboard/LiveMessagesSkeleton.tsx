import { cn } from "../../lib/utils";

interface LiveMessagesSkeletonProps {
  rows?: number;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-full bg-slate-200", className)} />;
}

export function LiveMessagesSkeleton({
  rows = 5,
}: LiveMessagesSkeletonProps) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`live-message-skeleton-${index}`}
          className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
        >
          <SkeletonBlock className="size-12 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-4 w-24 rounded-full" />
                <SkeletonBlock className="h-6 w-14 rounded-full" />
              </div>
              <SkeletonBlock className="h-4 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-4 flex-1 rounded-full" />
              <SkeletonBlock className="h-4 w-10 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
