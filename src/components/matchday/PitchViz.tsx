"use client";
import { useMemo } from "react";
import type { MatchEvent } from "@/engines/match/matchTypes";
import type { TeamMatchSetup } from "@/engines/match/matchTypes";
import type { ID, Player } from "@/domain/types";
import { coordsForFormation } from "@/engines/tactics/positionCoords";

function seededFraction(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Landscape pitch (100 wide x 64 tall). Home team occupies the left half
// attacking rightward; away team is mirrored into the right half attacking
// leftward. This is a visual approximation (not literal player tracking) —
// each player sits at their formation slot with a small deterministic
// per-minute jitter so the pitch still feels alive.
function teamDots(setup: TeamMatchSetup, players: Record<ID, Player>, minute: number, side: "home" | "away") {
  const coords = coordsForFormation(setup.tactic.formation);
  return setup.startingXI.map((playerId, i) => {
    const c = coords[i] ?? { x: 50, y: 50 };
    const jitterX = (seededFraction(minute * 3.1 + i * 7) - 0.5) * 4;
    const jitterY = (seededFraction(minute * 5.3 + i * 11) - 0.5) * 4;
    const advancement = c.y + jitterY; // 0 (own goal) .. 100 (opp goal)
    const spread = c.x + jitterX; // 0 (left touchline) .. 100 (right touchline)
    const x = side === "home" ? 1 + (advancement / 100) * 48 : 99 - (advancement / 100) * 48;
    const y = (spread / 100) * 63 + 0.5;
    return { playerId, x, y, player: players[playerId] };
  });
}

export function PitchViz({
  homeName, awayName, homeGoals, awayGoals, minute, possessionHome, lastEvent, homeSetup, awaySetup, players,
}: {
  homeName: string; awayName: string; homeGoals: number; awayGoals: number;
  minute: number; possessionHome: number; lastEvent: MatchEvent | undefined;
  homeSetup: TeamMatchSetup; awaySetup: TeamMatchSetup; players: Record<ID, Player>;
}) {
  const ballX = useMemo(() => {
    const bias = 50 + (possessionHome - 50) * 0.5;
    const wobble = (seededFraction(minute) - 0.5) * 30;
    return Math.max(6, Math.min(94, bias + wobble));
  }, [possessionHome, minute]);
  const ballY = useMemo(() => 4 + seededFraction(minute * 1.7) * 56, [minute]);

  const homeDots = useMemo(() => teamDots(homeSetup, players, minute, "home"), [homeSetup, players, minute]);
  const awayDots = useMemo(() => teamDots(awaySetup, players, minute, "away"), [awaySetup, players, minute]);

  const isGoalFlash = lastEvent?.type === "goal" && lastEvent.minute === minute;

  return (
    <div className="rounded-card border border-navy-600 bg-navy-900 p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between text-sm text-ink-300">
        <span className="truncate">{homeName}</span>
        <span className="font-data text-xl text-ink-100">{homeGoals} – {awayGoals}</span>
        <span className="truncate text-right">{awayName}</span>
      </div>

      <svg viewBox="0 0 100 64" className="w-full rounded-sm" style={{ background: "linear-gradient(180deg,#0F2A1C,#123420)" }} role="img" aria-label="Match pitch visualization">
        <rect x="1" y="0.5" width="98" height="63" fill="none" stroke="#2E6B4A" strokeWidth="0.4" />
        <line x1="50" y1="0.5" x2="50" y2="63.5" stroke="#2E6B4A" strokeWidth="0.3" />
        <circle cx="50" cy="32" r="8" fill="none" stroke="#2E6B4A" strokeWidth="0.3" />
        <rect x="1" y="18" width="14" height="28" fill="none" stroke="#2E6B4A" strokeWidth="0.3" />
        <rect x="85" y="18" width="14" height="28" fill="none" stroke="#2E6B4A" strokeWidth="0.3" />

        {homeDots.map((d) => (
          <circle key={`h-${d.playerId}`} cx={d.x} cy={d.y} r={d.player?.positions[0] === "GK" ? 1.7 : 1.3} fill="#3B82F6" />
        ))}
        {awayDots.map((d) => (
          <circle key={`a-${d.playerId}`} cx={d.x} cy={d.y} r={d.player?.positions[0] === "GK" ? 1.7 : 1.3} fill="#EF4444" />
        ))}

        <circle cx={ballX} cy={ballY} r={isGoalFlash ? 2.6 : 1.1} fill={isGoalFlash ? "#EAB308" : "#F4F6FB"} className="transition-all duration-300" />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
        <span className="font-data">{minute}&apos;</span>
        <span>{possessionHome}% – {100 - possessionHome}% possession</span>
      </div>
    </div>
  );
}
