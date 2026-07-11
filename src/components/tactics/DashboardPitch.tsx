"use client";
import Link from "next/link";
import type { Player, TacticSetup } from "@/domain/types";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { caToOverall } from "@/components/tactics/FormationPitch";
import { coordsForFormation } from "@/engines/tactics/positionCoords";
import { FORMATION_SLOTS } from "@/engines/tactics/aiTactics";

export function DashboardPitch({ tactic, players }: { tactic: TacticSetup; players: Record<string, Player> }) {
  const slots = FORMATION_SLOTS[tactic.formation] ?? FORMATION_SLOTS["4-3-3"]!;
  const coords = coordsForFormation(tactic.formation);

  // Ordered slot -> playerId, same matching approach as the Tactics page.
  const remaining = new Map(Object.entries(tactic.playerRoles));
  const assignments = slots.map((slotPos) => {
    const match = [...remaining.entries()].find(([, role]) => role.positionCode === slotPos);
    if (match) { remaining.delete(match[0]); return match[0]; }
    return null;
  });

  return (
    <div className="flex h-full flex-col rounded-card border border-navy-600 bg-navy-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-100">{tactic.formation} • {tactic.mentality.replace(/-/g, " ")}</p>
        <Link href="/tactics" className="text-xs text-accent-400">Edit tactics</Link>
      </div>
      <div
        className="relative flex-1 overflow-hidden rounded-card"
        style={{ background: "linear-gradient(90deg, #0F2A1C 0%, #123420 100%)", minHeight: 320 }}
      >
        <svg viewBox="0 0 100 64" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <rect x="1" y="1" width="98" height="62" fill="none" stroke="#2E6B4A" strokeWidth="0.4" />
          <line x1="50" y1="1" x2="50" y2="63" stroke="#2E6B4A" strokeWidth="0.3" />
          <circle cx="50" cy="32" r="9" fill="none" stroke="#2E6B4A" strokeWidth="0.3" />
          <rect x="1" y="18" width="13" height="28" fill="none" stroke="#2E6B4A" strokeWidth="0.3" />
          <rect x="86" y="18" width="13" height="28" fill="none" stroke="#2E6B4A" strokeWidth="0.3" />
        </svg>

        {coords.map((c, i) => {
          const playerId = assignments[i];
          const player = playerId ? players[playerId] : undefined;
          // Landscape: pitch "advancement" (c.y in the portrait template) maps
          // to horizontal position; "spread" (c.x) maps to vertical position.
          const left = (c.y / 100) * 96 + 2;
          const top = (c.x / 100) * 88 + 6;
          return (
            <div
              key={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <PlayerPhoto playerId={player?.id} size={34} className="ring-2 ring-navy-950" />
              <span className="rounded bg-navy-950/85 px-1 text-[10px] text-ink-100">
                {player ? player.lastName : slots[i]}
              </span>
              {player && (
                <span className="rounded bg-accent-500 px-1 text-[9px] font-bold text-white">
                  {caToOverall(player.currentAbility)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
