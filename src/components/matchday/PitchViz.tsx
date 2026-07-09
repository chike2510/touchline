"use client";
import { useMemo } from "react";
import type { MatchEvent } from "@/engines/match/matchTypes";

// Deterministic pseudo-random from minute+seed so the ball marker doesn't
// jitter randomly on every re-render, only when the minute actually advances.
function seededFraction(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function PitchViz({
  homeName, awayName, homeGoals, awayGoals, minute, possessionHome, lastEvent,
}: {
  homeName: string; awayName: string; homeGoals: number; awayGoals: number;
  minute: number; possessionHome: number; lastEvent: MatchEvent | undefined;
}) {
  // x: 0 = home goal line, 100 = away goal line. Ball drifts toward whichever
  // side has more possession, with a small deterministic wobble per minute.
  const ballX = useMemo(() => {
    const bias = 50 + (possessionHome - 50) * 0.5;
    const wobble = (seededFraction(minute) - 0.5) * 30;
    return Math.max(6, Math.min(94, bias + wobble));
  }, [possessionHome, minute]);

  const ballY = useMemo(() => 20 + seededFraction(minute * 1.7) * 60, [minute]);

  const isGoalFlash = lastEvent?.type === "goal" && lastEvent.minute === minute;

  return (
    <div className="rounded-card border border-pitch-700 bg-pitch-900 p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between text-sm text-chalk-200">
        <span className="truncate">{homeName}</span>
        <span className="font-data text-xl text-chalk-100">
          {homeGoals} – {awayGoals}
        </span>
        <span className="truncate text-right">{awayName}</span>
      </div>

      <svg viewBox="0 0 100 65" className="w-full rounded-sm bg-pitch-800" role="img" aria-label="Match pitch visualization">
        {/* Pitch markings — static, minimal */}
        <rect x="1" y="1" width="98" height="63" fill="none" stroke="#2C7057" strokeWidth="0.6" />
        <line x1="50" y1="1" x2="50" y2="64" stroke="#2C7057" strokeWidth="0.5" />
        <circle cx="50" cy="32.5" r="8" fill="none" stroke="#2C7057" strokeWidth="0.5" />
        <rect x="1" y="18" width="12" height="29" fill="none" stroke="#2C7057" strokeWidth="0.5" />
        <rect x="87" y="18" width="12" height="29" fill="none" stroke="#2C7057" strokeWidth="0.5" />

        {/* Possession-weighted ball marker */}
        <circle
          cx={ballX}
          cy={ballY}
          r={isGoalFlash ? 3.2 : 1.8}
          fill={isGoalFlash ? "#E8A33D" : "#F5F3EC"}
          className="transition-all duration-300"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-chalk-300">
        <span className="font-data">{minute}&apos;</span>
        <span>{possessionHome}% – {100 - possessionHome}% possession</span>
      </div>
    </div>
  );
}
