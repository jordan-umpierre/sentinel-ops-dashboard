import type { EventActivity } from "../lib/api";

type Props = {
  activity: EventActivity;
};

/**
 * ActivitySparkline renders a 24-bar histogram of hourly event volume as an
 * inline SVG — no charting library required.
 *
 * Why SVG instead of a canvas or a library?
 * SVG is declarative, accessible, and trivially server-renderable. For a 24-bar
 * histogram it is the simplest correct tool, and not needing recharts or
 * chart.js keeps the bundle lean and the component dependency-free.
 */
export function ActivitySparkline({ activity }: Props) {
  const { buckets, total_24h, peak_hour } = activity;

  // Chart geometry constants — easy to adjust without touching the logic
  const SVG_WIDTH = 400;
  const SVG_HEIGHT = 56;
  const BAR_GAP = 2;
  const barWidth = (SVG_WIDTH - BAR_GAP * (buckets.length - 1)) / buckets.length;

  // Normalize bar heights against the peak bucket so the tallest bar always
  // fills the chart area — avoids flat charts when counts are low overall.
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>00:00 UTC</span>
        <span className="font-medium text-white">{total_24h} events in last 24h</span>
        <span>23:00 UTC</span>
      </div>

      {/* Responsive SVG wrapper — viewBox keeps the chart proportional at
          any container width without hard-coding pixel dimensions in CSS */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        aria-label="24-hour event volume histogram"
        role="img"
      >
        {buckets.map((bucket, index) => {
          const barHeight = (bucket.count / maxCount) * SVG_HEIGHT;
          const x = index * (barWidth + BAR_GAP);
          const y = SVG_HEIGHT - barHeight;
          const isPeak = bucket.hour === peak_hour && bucket.count > 0;
          const isEmpty = bucket.count === 0;

          return (
            <g key={bucket.hour}>
              {/* Background track — always rendered to show the time axis */}
              <rect
                x={x}
                y={0}
                width={barWidth}
                height={SVG_HEIGHT}
                fill="rgba(255,255,255,0.03)"
              />
              {/* Data bar — color-coded by significance */}
              {!isEmpty && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={isPeak ? "#f7b955" : "#38d8d8"}
                  fillOpacity={isPeak ? 0.9 : 0.55}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <LegendDot color="bg-signal-cyan/55" label="Events" />
        <LegendDot color="bg-signal-amber/90" label={`Peak (${peak_hour}:00 UTC)`} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 ${color}`} />
      {label}
    </div>
  );
}
