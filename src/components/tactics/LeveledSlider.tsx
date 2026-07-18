"use client";

// Renders a discrete value (e.g. TempoLevel = "slow"|"normal"|"fast") as a
// slider-styled track with a snapping thumb — visually matching the
// reference mockups' sliders, while the underlying data stays an authentic,
// named football decision rather than a continuous 0-100 number. The thumb
// only ever rests on one of `levels.length` positions; there's no hidden
// in-between granularity being faked.
export function LeveledSlider<T extends string>({
  label, value, levels, labels, onChange,
}: {
  label: string;
  value: T;
  levels: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (v: T) => void;
}) {
  const index = Math.max(0, levels.indexOf(value));
  const pct = levels.length > 1 ? (index / (levels.length - 1)) * 100 : 0;
  const displayLabel = labels?.[value] ?? value.replace(/-/g, " ");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
        <span className="text-xs font-semibold capitalize text-ink-100">{displayLabel}</span>
      </div>
      <div className="relative flex h-5 items-center">
        <div className="h-1 w-full rounded-full bg-navy-700">
          <div className="h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-0">
          {levels.map((lvl, i) => (
            <button
              key={lvl}
              onClick={() => onChange(lvl)}
              aria-label={`${label}: ${labels?.[lvl] ?? lvl}`}
              className={`pointer-events-auto h-4 w-4 shrink-0 rounded-full border-2 transition-transform duration-150 ${
                i === index
                  ? "scale-125 border-white bg-accent-500 shadow-glow"
                  : "border-navy-600 bg-navy-800 hover:border-ink-500"
              }`}
              style={{ marginLeft: i === 0 ? 0 : "-2px" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
