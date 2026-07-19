"use client";
import { useMemo } from "react";
import type { MatchEvent, TeamMatchSetup } from "@/engines/match/matchTypes";
import type { ID, Player } from "@/domain/types";
import { coordsForFormation } from "@/engines/tactics/positionCoords";

function seededFraction(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// No persisted squad number exists on Player yet, so this derives a stable
// 1-99 "shirt number" per player id purely for the pitch marker — consistent
// match to match, just not tied to a real kit-number assignment system.
function shirtNumberFor(playerId: ID): number {
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (Math.imul(31, h) + playerId.charCodeAt(i)) | 0;
  return (Math.abs(h) % 99) + 1;
}

// Landscape pitch (100 wide x 64 tall). Home team occupies the left half
// attacking rightward; away team is mirrored into the right half attacking
// leftward. This is a visual approximation (not literal player tracking) —
// each player sits at their formation slot (which one depends on whether
// their team currently has the ball — see `hasBallNow` below) with a small
// deterministic per-minute jitter so the pitch still feels alive.
function teamDots(setup: TeamMatchSetup, players: Record<ID, Player>, minute: number, side: "home" | "away", hasBallNow: boolean) {
  const shape = hasBallNow ? setup.tactic.inPossession : setup.tactic.outOfPossession;
  const coords = coordsForFormation(shape.formation);
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

// NOTE on "3D": this renders the pitch inside a CSS perspective stage
// (`.pitch-3d-stage` / `.pitch-3d-tilt` from globals.css) so it reads as a
// tilted broadcast-camera shot with drop shadows under each player dot —
// it is still 2D SVG content underneath, just presented in 3D space. A
// real 3D match engine (actual player models/geometry, free camera) is a
// separate, much larger project — see the note left in the project README.
export function PitchViz({
  minute, possessionHome, lastEvent, homeSetup, awaySetup, players,
}: {
  minute: number; possessionHome: number; lastEvent: MatchEvent | undefined;
  homeSetup: TeamMatchSetup; awaySetup: TeamMatchSetup; players: Record<ID, Player>;
}) {
  const ballX = useMemo(() => {
    const bias = 50 + (possessionHome - 50) * 0.5;
    const wobble = (seededFraction(minute) - 0.5) * 30;
    return Math.max(6, Math.min(94, bias + wobble));
  }, [possessionHome, minute]);
  const ballY = useMemo(() => 4 + seededFraction(minute * 1.7) * 56, [minute]);

  // Deterministic per-minute "who has the ball right now" flip, weighted by
  // the running possession share — this is what actually drives each team's
  // pitch dots to morph between their in-possession and out-of-possession
  // shape live, rather than sitting on one static formation all match.
  const homeHasBallNow = useMemo(() => seededFraction(minute * 2.7) < possessionHome / 100, [minute, possessionHome]);

  const homeDots = useMemo(() => teamDots(homeSetup, players, minute, "home", homeHasBallNow), [homeSetup, players, minute, homeHasBallNow]);
  const awayDots = useMemo(() => teamDots(awaySetup, players, minute, "away", !homeHasBallNow), [awaySetup, players, minute, homeHasBallNow]);

  const isGoalFlash = lastEvent?.type === "goal" && lastEvent.minute === minute;

  return (
    <div className="pitch-3d-stage overflow-hidden rounded-card" style={{ padding: "6% 2% 2%" }}>
      <svg
        viewBox="0 0 100 64"
        className="pitch-3d-tilt w-full rounded-sm"
        style={{ background: "linear-gradient(180deg,#0A2117,#0F2E1E)", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.7)" }}
        role="img"
        aria-label="Match pitch visualization"
      >
        <rect x="1" y="0.5" width="98" height="63" fill="none" stroke="#245C3E" strokeWidth="0.4" />
        <line x1="50" y1="0.5" x2="50" y2="63.5" stroke="#245C3E" strokeWidth="0.3" />
        <circle cx="50" cy="32" r="8" fill="none" stroke="#245C3E" strokeWidth="0.3" />
        <rect x="1" y="18" width="14" height="28" fill="none" stroke="#245C3E" strokeWidth="0.3" />
        <rect x="85" y="18" width="14" height="28" fill="none" stroke="#245C3E" strokeWidth="0.3" />

        {/* Drop shadows first, so they sit under the tokens */}
        {[...homeDots, ...awayDots].map((d) => (
          <ellipse
            key={`shadow-${d.playerId}`} cx={d.x} cy={d.y + 0.9} rx={1.9} ry={0.6} fill="rgba(0,0,0,0.35)"
            style={{ transition: "cx 0.6s ease-out, cy 0.6s ease-out" }}
          />
        ))}

        {homeDots.map((d) => (
          <g key={`h-${d.playerId}`} style={{ transition: "transform 0.6s ease-out" }} transform={`translate(${d.x} ${d.y})`}>
            <circle r={d.player?.positions[0] === "GK" ? 2.1 : 1.7} fill="#F5C445" stroke="#0A2117" strokeWidth="0.2" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="1.5" fontWeight="700" fill="#04212b">
              {shirtNumberFor(d.playerId)}
            </text>
          </g>
        ))}
        {awayDots.map((d) => (
          <g key={`a-${d.playerId}`} style={{ transition: "transform 0.6s ease-out" }} transform={`translate(${d.x} ${d.y})`}>
            <circle r={d.player?.positions[0] === "GK" ? 2.1 : 1.7} fill="#FF5A6E" stroke="#0A2117" strokeWidth="0.2" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="1.5" fontWeight="700" fill="#3a0a0f">
              {shirtNumberFor(d.playerId)}
            </text>
          </g>
        ))}

        <circle
          cx={ballX} cy={ballY} r={isGoalFlash ? 2.6 : 1.1}
          fill={isGoalFlash ? "#F5C445" : "#EAF2FF"}
          style={{ transition: "cx 0.5s ease-out, cy 0.5s ease-out, r 0.3s, fill 0.3s" }}
        />
      </svg>
    </div>
  );
}
