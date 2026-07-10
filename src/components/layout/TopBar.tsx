"use client";
import { useGameStore } from "@/state/gameStore";

const PHASE_LABELS: Record<string, string> = {
  "weekly-briefing": "Briefing",
  "tactics-training": "Training",
  "off-pitch": "Off the pitch",
  "matchday-build-up": "Matchday build-up",
  "matchday-live": "Live",
  "post-match": "Post-match",
  "calendar-advance": "Advancing…",
};

export function TopBar() {
  const meta = useGameStore((s) => s.meta);
  const world = useGameStore((s) => s.world);
  const advanceOnePhase = useGameStore((s) => s.advanceOnePhase);

  const today = world ? world.calendar[world.currentDate] : undefined;
  const phaseLabel = today ? PHASE_LABELS[today.phase] ?? today.phase : "—";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-navy-600 bg-navy-950/95 px-4 py-3 backdrop-blur">
      <div>
        <p className="font-display text-lg leading-none text-ink-100">
          {meta?.clubName ?? "Touchline"}
        </p>
        <p className="font-data text-xs text-ink-500">
          {world?.currentDate ?? "No save loaded"} {today?.hasFixture ? "• Matchday" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-card bg-navy-800 px-2.5 py-1 text-xs font-medium text-accent-400">
          {phaseLabel}
        </span>
        <button
          onClick={() => advanceOnePhase()}
          disabled={!world}
          className="rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-95 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </header>
  );
}
