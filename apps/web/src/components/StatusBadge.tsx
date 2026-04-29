type BadgeProps = {
  value: string;
  tone?: "neutral" | "green" | "amber" | "red" | "cyan";
};

const toneClasses = {
  neutral: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  green: "border-signal-green/30 bg-signal-green/10 text-signal-green",
  amber: "border-signal-amber/30 bg-signal-amber/10 text-signal-amber",
  red: "border-signal-red/30 bg-signal-red/10 text-signal-red",
  cyan: "border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan"
};

export function StatusBadge({ value, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-6 items-center border px-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses[tone]}`}
    >
      {value.replace("_", " ")}
    </span>
  );
}
