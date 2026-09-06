import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`bg-zinc-800/50 animate-pulse rounded-lg border border-zinc-800/30 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-5 rounded-2xl flex flex-col justify-between h-[230px]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-20 h-3" />
            </div>
          </div>
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <Skeleton className="w-full h-3 mb-2" />
        <Skeleton className="w-3/4 h-3 mb-4" />
      </div>

      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-14 h-5 rounded-md" />
          <Skeleton className="w-16 h-5 rounded-md" />
        </div>
        <Skeleton className="w-24 h-7 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-zinc-800/60">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton className={`h-4 ${i === 0 ? "w-40" : i === cols - 1 ? "w-16 ml-auto" : "w-24"}`} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonMetric() {
  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="w-24 h-3.5" />
        <Skeleton className="w-6 h-6 rounded-lg" />
      </div>
      <Skeleton className="w-16 h-8 mb-2" />
      <Skeleton className="w-36 h-3" />
    </div>
  );
}
