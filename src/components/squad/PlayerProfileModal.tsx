"use client";
import { useGameStore } from "@/state/gameStore";
import { PlayerProfilePanel } from "@/components/squad/PlayerProfilePanel";

export function PlayerProfileModal() {
  const world = useGameStore((s) => s.world);
  const viewingPlayerId = useGameStore((s) => s.viewingPlayerId);
  const closePlayerProfile = useGameStore((s) => s.closePlayerProfile);

  if (!viewingPlayerId || !world) return null;
  const player = world.players[viewingPlayerId];
  if (!player) return null;
  const playerLeagueId = player.clubId ? world.clubs[player.clubId]?.leagueId ?? "" : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={closePlayerProfile}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <PlayerProfilePanel player={player} leagueId={playerLeagueId} onClose={closePlayerProfile} />
      </div>
    </div>
  );
}
