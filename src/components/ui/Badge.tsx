export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "amber" | "rival" | "success" }) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-navy-800 text-ink-300",
    amber: "bg-accent-500/20 text-accent-400",
    rival: "bg-danger-500/20 text-danger-500",
    success: "bg-positive-500/20 text-positive-500",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function StatBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct > 70 ? "bg-accent-400" : pct > 40 ? "bg-navy-500" : "bg-danger-500/70";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-ink-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-data text-ink-300">{Math.round(value)}</span>
    </div>
  );
}
