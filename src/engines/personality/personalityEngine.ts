// ============================================================================
// Personality engine — turns PlayerPersonality + PersonalityTrait data into
// two things the rest of the game consumes: (1) a dressing-room chemistry
// score per club, and (2) morale deltas from events (team talks, squad
// status changes, contract disputes, media incidents).
// ============================================================================
import type { SaveGameWorld, Player } from "@/domain/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

// Chemistry is a 0-100 club-wide score: high-sociability, high-professionalism
// squads with few "unsettled"/"temperamental" players cohere faster. This
// feeds the match engine as a small global performance multiplier alongside
// tactic familiarity.
export function computeSquadChemistry(world: SaveGameWorld, clubId: string): number {
  const club = world.clubs[clubId];
  if (!club || club.squadIds.length === 0) return 50;
  const players = club.squadIds.map((id) => world.players[id]).filter((p): p is Player => !!p);
  if (players.length === 0) return 50;

  const avgSociability = players.reduce((s, p) => s + p.personality.sociability, 0) / players.length;
  const avgLeadership = players.reduce((s, p) => s + p.personality.leadership, 0) / players.length;
  const unsettledPenalty = players.filter((p) => p.personality.traits.includes("unsettled")).length * 2;
  const temperamentalPenalty = players.filter((p) => p.personality.traits.includes("temperamental")).length * 1.5;
  const leadersBonus = players.filter((p) => p.personality.traits.includes("leader")).length * 3;

  const raw = 40 + avgSociability * 1.5 + avgLeadership * 0.8 + leadersBonus - unsettledPenalty - temperamentalPenalty;
  return clamp(raw);
}

export type TeamTalkTone = "calm" | "encouraging" | "demanding" | "furious";

// Applied at half-time or pre-match; pressureResistance and professionalism
// dampen the swing so the same talk doesn't affect every player identically.
export function applyTeamTalk(world: SaveGameWorld, clubId: string, tone: TeamTalkTone): void {
  const club = world.clubs[clubId];
  if (!club) return;
  const baseDelta: Record<TeamTalkTone, number> = { calm: 1, encouraging: 4, demanding: 2, furious: -3 };
  for (const playerId of club.squadIds) {
    const player = world.players[playerId];
    if (!player) continue;
    const dampener = 0.5 + player.personality.pressureResistance / 40; // 0.5-1.0
    const misjudgeRisk = tone === "furious" && player.personality.professionalism < 8 ? -3 : 0;
    player.morale = clamp(player.morale + baseDelta[tone] * dampener + misjudgeRisk);
  }
}

// Squad-status mismatch (promised "star" but benched repeatedly, etc.) is a
// recurring morale drain — call from the weekly briefing / after each match
// selection is finalised.
export function applySquadStatusMoraleCheck(world: SaveGameWorld, playerId: string, actualRoleThisWeek: "started" | "benched" | "not-in-squad"): void {
  const player = world.players[playerId];
  if (!player?.contract?.squadStatusPromise) return;
  const promise = player.contract.squadStatusPromise;
  const expectedToStart = promise === "star" || promise === "important";
  if (expectedToStart && actualRoleThisWeek !== "started") {
    const ambitionFactor = player.personality.ambition / 20;
    player.morale = clamp(player.morale - 3 * ambitionFactor);
  }
}
