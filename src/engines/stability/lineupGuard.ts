// Lineup availability guard. Pure: never mutates the world or the tactic passed in.
// Used before kickoff so injured / suspended players can never be fielded, whether the XI
// came from auto-selection or from a lineup the user picked by hand.
import type { Player, PositionCode, SaveGameWorld, TacticSetup } from "@/domain/types";
import { isAvailable } from "./stabilityEngine";

export interface LineupIssue { playerId: string; reason: "injured" | "suspended" | "not-in-squad"; }
export interface LineupReplacement { out: string; in: string; }
export interface SanitizedLineup {
  tactic: TacticSetup;
  startingXI: string[];
  bench: string[];
  replaced: LineupReplacement[];
  unresolved: string[]; // unavailable starters we had nobody to replace (squad too thin)
}

export function lineupIssues(world: SaveGameWorld, clubId: string, startingXI: string[], competitionId: string | null = null): LineupIssue[] {
  const club = world.clubs[clubId];
  const out: LineupIssue[] = [];
  for (const id of startingXI) {
    const p = world.players[id];
    if (!p || !club || !club.squadIds.includes(id)) { out.push({ playerId: id, reason: "not-in-squad" }); continue; }
    if (isAvailable(p, competitionId)) continue;
    out.push({ playerId: id, reason: p.injuryStatus && p.injuryStatus.daysRemaining > 0 ? "injured" : "suspended" });
  }
  return out;
}

function fitScore(p: Player, slot: PositionCode | undefined): number {
  if (!slot) return 0;
  return p.positions[0] === slot ? 100 : p.positions.includes(slot) ? 80 : (p.positionFamiliarity[slot] ?? 0) * 2;
}

function mapIds<T>(ids: T[], map: Record<string, string>): T[] { return ids.map((i) => ((map[i as unknown as string] ?? i) as unknown as T)); }

export function sanitizeLineup(world: SaveGameWorld, clubId: string, tactic: TacticSetup, competitionId: string | null = null, benchSize = 9): SanitizedLineup {
  const club = world.clubs[clubId];
  const xi = Object.keys(tactic.playerRoles);
  if (!club) return { tactic, startingXI: xi, bench: [], replaced: [], unresolved: [] };

  const bad = new Set(lineupIssues(world, clubId, xi, competitionId).map((i) => i.playerId));
  const inXI = new Set(xi.filter((id) => !bad.has(id)));
  const map: Record<string, string> = {};
  const replaced: LineupReplacement[] = [];
  const unresolved: string[] = [];

  for (const outId of xi) {
    if (!bad.has(outId)) continue;
    const slot = tactic.inPossession.slotAssignments[outId];
    const pool = club.squadIds
      .map((id) => world.players[id])
      .filter((p): p is Player => !!p && !inXI.has(p.id) && isAvailable(p, competitionId))
      .sort((a, b) => fitScore(b, slot) - fitScore(a, slot) || b.currentAbility - a.currentAbility || (a.id < b.id ? -1 : 1));
    const pick = pool[0];
    if (!pick) { unresolved.push(outId); inXI.add(outId); continue; }
    map[outId] = pick.id; inXI.add(pick.id); replaced.push({ out: outId, in: pick.id });
  }

  const remap = <V,>(rec: Record<string, V>): Record<string, V> => {
    const o: Record<string, V> = {};
    for (const k of Object.keys(rec)) o[map[k] ?? k] = rec[k]!;
    return o;
  };
  let next = tactic;
  if (replaced.length > 0) {
    const sp = tactic.setPieces;
    next = {
      ...tactic,
      playerRoles: remap(tactic.playerRoles),
      inPossession: { ...tactic.inPossession, slotAssignments: remap(tactic.inPossession.slotAssignments) },
      outOfPossession: { ...tactic.outOfPossession, slotAssignments: remap(tactic.outOfPossession.slotAssignments) },
      setPieces: {
        ...sp,
        cornersAttacking: { ...sp.cornersAttacking, designatedTakerId: sp.cornersAttacking.designatedTakerId ? (map[sp.cornersAttacking.designatedTakerId] ?? sp.cornersAttacking.designatedTakerId) : null, targetPlayerIds: mapIds(sp.cornersAttacking.targetPlayerIds, map) },
        freeKicksAttacking: { ...sp.freeKicksAttacking, designatedTakerId: sp.freeKicksAttacking.designatedTakerId ? (map[sp.freeKicksAttacking.designatedTakerId] ?? sp.freeKicksAttacking.designatedTakerId) : null, targetPlayerIds: mapIds(sp.freeKicksAttacking.targetPlayerIds, map) },
        throwInsAttacking: { ...sp.throwInsAttacking, designatedTakerId: sp.throwInsAttacking.designatedTakerId ? (map[sp.throwInsAttacking.designatedTakerId] ?? sp.throwInsAttacking.designatedTakerId) : null, targetPlayerIds: mapIds(sp.throwInsAttacking.targetPlayerIds, map) },
      },
    };
  }
  const startingXI = Object.keys(next.playerRoles);
  const used = new Set(startingXI);
  const bench = club.squadIds
    .filter((id) => !used.has(id) && world.players[id] && isAvailable(world.players[id]!, competitionId))
    .slice(0, benchSize);
  return { tactic: next, startingXI, bench, replaced, unresolved };
}
