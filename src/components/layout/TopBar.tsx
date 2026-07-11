"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FastForward } from "lucide-react";
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
  const router = useRouter();
  const meta = useGameStore((s) => s.meta);
  const world = useGameStore((s) => s.world);
  const advanceOnePhase = useGameStore((s) => s.advanceOnePhase);
  const simToNextMatch = useGameStore((s) => s.simToNextMatch);
  const simStatus = useGameStore((s) => s.simStatus);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const today = world ? world.calendar[world.currentDate] : undefined;
  const phaseLabel = today ? PHASE_LABELS[today.phase] ?? today.phase : "—";
  const isLive = today?.phase === "matchday-live";

  async function handleSim() {
    setSimMessage(null);
    const reason = await simToNextMatch();
    if (reason === "matchday") {
      router.push("/matchday");
    } else if (reason === "decision-pending") {
      setSimMessage("Something needs your attention — check your inbox.");
      router.push("/inbox");
    } else if (reason === "max-days-reached") {
      setSimMessage("Stopped after a long gap with no fixture — try again to keep going.");
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-navy-600 bg-navy-950/95 px-4 py-3 backdrop-blur">
      <div>
        <p className="font-display text-lg leading-none text-ink-100">
          {meta?.clubName ?? "Touchline"}
        </p>
        <p className="font-data text-xs text-ink-500">
          {world?.currentDate ?? "No save loaded"} {today?.hasFixture ? "• Matchday" : ""}
          {simMessage && <span className="ml-2 text-accent-400">{simMessage}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-card bg-navy-800 px-2.5 py-1 text-xs font-medium text-accent-400">
          {phaseLabel}
        </span>
        {!isLive && (
          <button
            onClick={handleSim}
            disabled={!world || simStatus === "simming"}
            title="Sim to next match"
            className="flex items-center gap-1 rounded-card border border-navy-600 bg-navy-800 px-2.5 py-1.5 text-sm text-ink-200 transition-transform duration-150 active:scale-95 disabled:opacity-40"
          >
            <FastForward size={14} aria-hidden />
            {simStatus === "simming" ? "Simming…" : "Next match"}
          </button>
        )}
        <button
          onClick={() => (isLive ? router.push("/matchday") : advanceOnePhase())}
          disabled={!world || simStatus === "simming"}
          className="rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-95 disabled:opacity-40"
        >
          {isLive ? "Go to match" : "Continue"}
        </button>
      </div>
    </header>
  );
}
