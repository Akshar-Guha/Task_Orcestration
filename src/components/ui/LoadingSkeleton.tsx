'use client';

interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
          <div className="w-6 h-6 rounded-full bg-slate-800 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-slate-800 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-slate-800/70 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
