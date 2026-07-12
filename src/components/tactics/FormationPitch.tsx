"use client";
import type { Player, PositionCode } from "@/domain/types";
import type { PitchCoord } from "@/engines/tactics/positionCoords";

export function caToOverall(ca: number): number {
  return Math.max(1, Math.min(99, Math.round(ca / 1.9)));
}

export function FormationPitch({
  coords, slotPositions, assignments, players, onSlotClick, selectedSlot,
}: {
  coords: PitchCoord[];
  slotPositions: PositionCode[];
  assignments: (string | null)[];
  players: Record<string, Player>;
  onSlotClick: (slotIndex: number) => void;
  selectedSlot: number | null;
}) {
  return (
    <div className="glass-panel relative w-full overflow-hidden rounded-card" style={{ aspectRatio: "3 / 4", background: "linear-gradient(180deg, #0A2117 0%, #0F2E1E 100%)" }}>
      {/* Pitch markings */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="96" fill="none" stroke="#245C3E" strokeWidth="0.4" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="#245C3E" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="9" fill="none" stroke="#245C3E" strokeWidth="0.3" />
        <rect x="22" y="2" width="56" height="14" fill="none" stroke="#245C3E" strokeWidth="0.3" />
        <rect x="22" y="84" width="56" height="14" fill="none" stroke="#245C3E" strokeWidth="0.3" />
      </svg>

      {coords.map((c, i) => {
        const playerId = assignments[i];
        const player = playerId ? players[playerId] : undefined;
        const isSelected = selectedSlot === i;
        return (
          <button
            key={i}
            onClick={() => onSlotClick(i)}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${c.x}%`, top: `${100 - c.y}%` }}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-navy-950 shadow-glow transition-transform duration-150 group-active:scale-95 ${
                isSelected ? "ring-2 ring-pulse-400" : ""
              } ${player ? "bg-gradient-to-br from-accent-400 to-accent-600" : "border-2 border-dashed border-ink-500 bg-navy-800 text-ink-500"}`}
            >
              {player ? caToOverall(player.currentAbility) : slotPositions[i]}
            </div>
            <span className="max-w-[64px] truncate rounded bg-navy-950/80 px-1 text-[10px] text-ink-100">
              {player ? player.lastName : slotPositions[i]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
