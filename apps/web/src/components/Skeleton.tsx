/**
 * Skeleton loading primitives that replace spinner text during data fetches.
 *
 * Using shimmer placeholders instead of "Loading..." text keeps the layout
 * stable (no content-layout shift when data arrives) and looks more polished
 * during a live demo. The shimmer animation is defined in global CSS so every
 * component can use it without duplicating keyframes.
 */

type SkeletonProps = {
  className?: string;
};

/** Single rectangular shimmer block — compose these to match any content shape. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-none bg-white/[0.06] ${className}`}
      aria-hidden="true"
    />
  );
}

/** Placeholder for a KPI / MetricCard row (4 equal columns). */
export function MetricCardSkeleton() {
  return (
    <div className="border border-white/10 bg-ink-850 p-5 shadow-panel">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

/** Placeholder for a table row in the assets or events list. */
export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Skeleton className={`h-4 ${i === 0 ? "w-36" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}

/** Placeholder for an incident queue item (left-panel list row). */
export function IncidentRowSkeleton() {
  return (
    <div className="border-b border-white/10 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-5 w-14" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/** Placeholder for the incident detail header panel. */
export function IncidentDetailSkeleton() {
  return (
    <div className="border border-white/10 bg-ink-850 p-5 shadow-panel space-y-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-80" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-3 md:grid-cols-3 mt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-white/10 bg-ink-950 p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for the asset detail side panel. */
export function AssetDetailSkeleton() {
  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-white/10 bg-ink-950 p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-white/10 bg-ink-950 px-3 py-2 flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
