import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "cyan" | "green" | "amber" | "red";
};

const toneClasses = {
  cyan: "border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan",
  green: "border-signal-green/30 bg-signal-green/10 text-signal-green",
  amber: "border-signal-amber/30 bg-signal-amber/10 text-signal-amber",
  red: "border-signal-red/30 bg-signal-red/10 text-signal-red"
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "cyan" }: MetricCardProps) {
  return (
    <article className="border border-white/10 bg-ink-850 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center border ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-400">{detail}</p>
    </article>
  );
}
