export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-primary-light rounded-2xl border border-border p-5 animate-pulse ${className}`}>
      <div className="h-3 w-24 bg-surface rounded mb-4" />
      <div className="h-8 w-36 bg-surface rounded mb-2" />
      <div className="h-3 w-20 bg-surface/60 rounded" />
    </div>
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-primary-light rounded-2xl border border-border p-5 animate-pulse ${className}`}>
      <div className="h-3 w-32 bg-surface rounded mb-4" />
      <div className="h-40 bg-surface rounded-xl" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`bg-primary-light rounded-2xl border border-border p-5 animate-pulse ${className}`}>
      <div className="h-3 w-28 bg-surface rounded mb-5" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <div className="h-4 w-4 bg-surface rounded flex-shrink-0" />
            <div className="h-4 flex-1 bg-surface rounded" />
            <div className="h-4 w-20 bg-surface rounded" />
            <div className="h-4 w-16 bg-surface rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
