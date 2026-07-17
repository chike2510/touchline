// ============================================================================
// Tactics engine — computes how well a player fits an assigned role/position
// (consumed by the match engine as a performance multiplier) and grows/decays
// tactic familiarity over time. The actual on-pitch behaviour lives in
// engines/match/matchEngine.ts; this module is the "preparation" side.
// ============================================================================
import type { Player, PositionCode, TacticSetup, SaveGameWorld } from "@/domain/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

// 0-1 multiplier: 1.0 = perfectly natural position/role, drops off for
// unfamiliar positions. Cheap heuristic — real depth would score per-role
// (e.g. "Inverted Wing-Back" needs different attributes than "Wing-Back")
// rather than per-position-code; that mapping is the natural next layer.
export function positionFitMultiplier(player: Player, position: PositionCode): number {
  if (player.positions[0] === position) return 1.0;
  if (player.positions.includes(position)) return 0.9;
  const familiarity = player.positionFamiliarity[position] ?? 0;
  return clamp(0.55 + familiarity / 40, 0.4, 0.95);
}

// Familiarity grows fastest early (novelty of a new system) and plateaus;
// call once per match/training week the tactic is actively used.
export function growTacticFamiliarity(tactic: TacticSetup, matchesPlayedWithIt: number): number {
  const growthRate = 8;
  const target = 100;
  const grown = tactic.familiarity + (target - tactic.familiarity) * (growthRate / 100);
  void matchesPlayedWithIt;
  return clamp(grown, 0, 100);
}

// Decay applied when a tactic hasn't been used recently (e.g. player picks a
// new system) — called from the calendar's off-pitch tick if the active
// tactic id changed since last check.
export function decayUnusedTacticFamiliarity(tactic: TacticSetup): number {
  return clamp(tactic.familiarity - 2, 0, 100);
}

// Overall squad familiarity with the active tactic — averaged across the
// starting XI implied by playerRoles, used by the match engine as a global
// cohesion modifier distinct from per-player chemistry.
export function squadTacticFamiliarity(world: SaveGameWorld, tactic: TacticSetup): number {
  const ids = Object.keys(tactic.playerRoles);
  if (ids.length === 0) return tactic.familiarity;
  const perPlayer = ids.map((id) => {
    const player = world.players[id];
    if (!player) return tactic.familiarity;
    const slot = tactic.inPossession.slotAssignments[id];
    const fit = slot ? positionFitMultiplier(player, slot) : 1;
    return tactic.familiarity * fit;
  });
  return perPlayer.reduce((a, b) => a + b, 0) / perPlayer.length;
}
