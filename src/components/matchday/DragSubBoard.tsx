"use client";
import { useRef, useState } from "react";
import type { ID, Player, PositionCode } from "@/domain/types";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { caToOverall } from "@/components/tactics/FormationPitch";
import { coordsForFormation } from "@/engines/tactics/positionCoords";
import { FORMATION_SLOTS } from "@/engines/tactics/aiTactics";

const DRAG_THRESHOLD_PX = 10;

export function DragSubBoard({
  formation, onPitchIds, benchIds, players, substitutionsUsed, maxSubstitutions, onSubstitute, leagueId, clubId,
}: {
  formation: string; onPitchIds: ID[]; benchIds: ID[]; players: Record<ID, Player>;
  substitutionsUsed: number; maxSubstitutions: number;
  onSubstitute: (offId: ID, onId: ID, position: PositionCode) => void;
  leagueId: string; clubId: string;
}) {
  const coords = coordsForFormation(formation);
  const remaining = maxSubstitutions - substitutionsUsed;

  const [selectedBenchId, setSelectedBenchId] = useState<ID | null>(null);
  const [dragId, setDragId] = useState<ID | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverSlot, setHoverSlot] = useState<ID | null>(null);

  // Tracks a pointer that's down but hasn't moved past the drag threshold
  // yet — until it does, this is a tap, not a drag. Without this, every
  // single tap briefly entered "drag mode" and rendered/discarded the ghost
  // chip in one frame, which is the stutter that made this feel rough.
  const pendingDrag = useRef<{ id: ID; startX: number; startY: number } | null>(null);
  // Set right after a real drag completes a swap, so the synthetic click
  // event that follows a pointerup doesn't also toggle bench-selection.
  const suppressClickRef = useRef(false);

  function performSwap(offId: ID, onId: ID) {
    if (remaining <= 0 || offId === onId) return;
    const incoming = players[onId];
    const outgoing = players[offId];
    onSubstitute(offId, onId, incoming?.positions[0] ?? outgoing?.positions[0] ?? "CM");
    setSelectedBenchId(null);
  }

  function handlePitchTap(pitchPlayerId: ID) {
    if (selectedBenchId) performSwap(pitchPlayerId, selectedBenchId);
  }

  function handleBenchClick(benchPlayerId: ID) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setSelectedBenchId((cur) => (cur === benchPlayerId ? null : benchPlayerId));
  }

  function findSlotUnderPoint(x: number, y: number): ID | null {
    const el = document.elementFromPoint(x, y);
    const target = el?.closest<HTMLElement>("[data-pitch-player-id]");
    return (target?.dataset.pitchPlayerId as ID) ?? null;
  }

  function handleBenchPointerDown(e: React.PointerEvent, benchPlayerId: ID) {
    if (remaining <= 0) return;
    pendingDrag.current = { id: benchPlayerId, startX: e.clientX, startY: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleBoardPointerMove(e: React.PointerEvent) {
    if (dragId) {
      // Already dragging — stop the page from scrolling under the finger
      // and keep the ghost glued to the pointer.
      e.preventDefault();
      setDragPos({ x: e.clientX, y: e.clientY });
      setHoverSlot(findSlotUnderPoint(e.clientX, e.clientY));
      return;
    }
    const pending = pendingDrag.current;
    if (!pending) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      setDragId(pending.id);
      setDragPos({ x: e.clientX, y: e.clientY });
    }
  }

  function handleBoardPointerUp(e: React.PointerEvent) {
    if (dragId) {
      const target = findSlotUnderPoint(e.clientX, e.clientY);
      if (target) {
        performSwap(target, dragId);
        suppressClickRef.current = true; // this pointer sequence was a drag, not a tap
      }
    }
    pendingDrag.current = null;
    setDragId(null);
    setDragPos(null);
    setHoverSlot(null);
  }

  const draggingPlayer = dragId ? players[dragId] : undefined;

  return (
    <div className="glass-panel flex flex-col gap-2 rounded-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-100">Substitutions</p>
        <span className="font-data text-xs text-ink-500">{remaining} remaining</span>
      </div>
      <p className="text-[11px] text-ink-500">
        {selectedBenchId ? "Now tap the player you're bringing off." : "Tap a bench player, then tap who comes off — or drag them onto the pitch."}
      </p>

      {/* ---- Pitch with on-pitch tokens as drop targets ------------------------ */}
      <div
        className="relative touch-none overflow-hidden rounded-card select-none"
        style={{ background: "linear-gradient(90deg, #0F2A1C 0%, #123420 100%)", minHeight: 220, touchAction: "none" }}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerCancel={handleBoardPointerUp}
      >
        {coords.map((c, i) => {
          const playerId = onPitchIds[i];
          const player = playerId ? players[playerId] : undefined;
          if (!player) return null;
          const left = (c.y / 100) * 96 + 2;
          const top = (c.x / 100) * 88 + 6;
          const isHovered = hoverSlot === player.id;
          return (
            <button
              key={i}
              type="button"
              data-pitch-player-id={player.id}
              onClick={() => handlePitchTap(player.id)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <PlayerPhoto
                firstName={player.firstName}
                lastName={player.lastName}
                leagueId={leagueId}
                clubId={clubId}
                size={32}
                className={`ring-2 transition-transform duration-100 ${isHovered ? "scale-125 ring-accent-400" : "ring-navy-950"}`}
              />
              <span className="rounded bg-navy-950/85 px-1 text-[9px] text-ink-100">{player.lastName}</span>
            </button>
          );
        })}
      </div>

      {/* ---- Bench strip: draggable / tappable chips --------------------------- */}
      <div className="flex touch-pan-x gap-2 overflow-x-auto pb-1 pt-1">
        {benchIds.map((id) => {
          const p = players[id];
          if (!p) return null;
          const isSelected = selectedBenchId === id;
          const isBeingDragged = dragId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleBenchClick(id)}
              onPointerDown={(e) => handleBenchPointerDown(e, id)}
              className={`flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-card border px-1 py-1.5 transition-colors duration-150 ${
                isSelected ? "border-accent-400 bg-accent-500/10" : "border-navy-600 bg-navy-800"
              } ${remaining <= 0 ? "opacity-40" : ""} ${isBeingDragged ? "opacity-30" : ""}`}
              style={{ touchAction: "none" }}
              disabled={remaining <= 0}
            >
              <PlayerPhoto firstName={p.firstName} lastName={p.lastName} leagueId={leagueId} clubId={clubId} size={30} />
              <span className="w-full truncate text-center text-[10px] text-ink-200">{p.lastName}</span>
              <span className="text-[9px] text-ink-500">{caToOverall(p.currentAbility)}</span>
            </button>
          );
        })}
        {benchIds.length === 0 && <p className="py-2 text-sm text-ink-500">No bench players available.</p>}
      </div>

      {/* ---- Drag ghost --------------------------------------------------------- */}
      {dragId && dragPos && draggingPlayer && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 opacity-90"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          <PlayerPhoto
            firstName={draggingPlayer.firstName}
            lastName={draggingPlayer.lastName}
            leagueId={leagueId}
            clubId={clubId}
            size={40}
            className="ring-2 ring-accent-400"
          />
          <span className="rounded bg-navy-950/90 px-1 text-[10px] text-ink-100">{draggingPlayer.lastName}</span>
        </div>
      )}
    </div>
  );
}
