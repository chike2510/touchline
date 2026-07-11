// ============================================================================
// AI tactics & lineup selection — AI clubs don't store a persisted TacticSetup
// the way the user's club does (only `SaveGameWorld.activeTactic` is tracked
// explicitly); instead one is derived on demand from the club's manager
// tendencies and current squad. This keeps the save file smaller and means
// changing an AI manager's `ManagerTacticalProfile` immediately reflects in
// how their team sets up, without a separate sync step.
// ============================================================================
import type { Club, ManagerTacticalProfile, Player, PositionCode, SaveGameWorld, TacticSetup } from "@/domain/types";
import { nanoid } from "nanoid";

// Slot templates: ordered position lists for common formations. Extend this
// table to support more formations — the lineup picker below is generic.
const FORMATION_SLOTS: Record<string, PositionCode[]> = {
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "CDM", "CM", "LW", "ST", "RW"],
  "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "CAM", "LW", "RW", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CM", "CM", "RWB", "ST", "ST"],
  "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "CM", "RM", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
  "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
  "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "CF", "ST"],
  "4-3-2-1": ["GK", "LB", "CB", "CB", "RB", "CM", "CDM", "CM", "CAM", "CAM", "ST"],
};

function mentalityToTactic(mentality: ManagerTacticalProfile["mentality"]): TacticSetup["mentality"] {
  return mentality;
}

// Greedy best-fit: for each formation slot (in order), pick the remaining
// available player with the best positionFamiliarity/primary-position match,
// tie-broken by currentAbility. Simple and fast; a real implementation might
// solve this as an assignment problem for a globally optimal XI.
export function pickAutoLineup(squadIds: string[], players: Record<string, Player>, formation: string): { startingXI: string[]; bench: string[] } {
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"]!;
  const pool = squadIds
    .map((id) => players[id])
    .filter((p): p is Player => !!p && !p.injuryStatus && !p.suspension)
    .sort((a, b) => b.currentAbility - a.currentAbility);

  const used = new Set<string>();
  const startingXI: string[] = [];

  for (const slot of slots) {
    const candidates = pool.filter((p) => !used.has(p.id));
    const scored = candidates
      .map((p) => ({
        p,
        score:
          p.positions[0] === slot ? 100 : p.positions.includes(slot) ? 80 : (p.positionFamiliarity[slot] ?? 0) * 2,
      }))
      .sort((a, b) => b.score - a.score || b.p.currentAbility - a.p.currentAbility);
    const best = scored[0]?.p ?? candidates[0];
    if (best) {
      used.add(best.id);
      startingXI.push(best.id);
    }
  }

  const bench = squadIds.filter((id) => !used.has(id)).slice(0, 9);
  return { startingXI, bench };
}

export function buildTacticFromProfile(profile: ManagerTacticalProfile, playerRoles: TacticSetup["playerRoles"] = {}): TacticSetup {
  return {
    id: nanoid(8),
    name: `${profile.preferredFormation} (AI)`,
    formation: profile.preferredFormation,
    mentality: mentalityToTactic(profile.mentality),
    inPossession: {
      tempo: profile.buildUpSpeed,
      passingDirectness: 100 - profile.buildUpSpeed,
      width: profile.width,
      playThroughBias: "balanced",
      buildUpFromBack: profile.buildUpSpeed < 50,
    },
    outOfPossession: {
      pressingIntensity: profile.pressingIntensity,
      defensiveLine: profile.defensiveLine,
      marking: "zonal",
      tacklingAggression: 50,
      offsideTrap: profile.defensiveLine > 65,
    },
    transitions: { counterPressIntensity: profile.pressingIntensity, counterAttackSpeed: 60 },
    setPieces: {
      cornersAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "far-post" },
      freeKicksAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "edge-of-box" },
      throwInsAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "short-corner" },
      cornersDefending: "zonal",
    },
    playerRoles,
    familiarity: 70, // AI clubs are assumed drilled in their own default system
  };
}

// Assigns designated set-piece takers/targets automatically based on
// attributes — called once when building a matchday lineup so AI (and the
// user, as a convenience default) always has a taker rather than nulls.
export function autoAssignSetPieceTakers(tactic: TacticSetup, startingXI: string[], players: Record<string, Player>): TacticSetup {
  const onPitch = startingXI.map((id) => players[id]).filter((p): p is Player => !!p);
  const bestBy = (selector: (p: Player) => number) =>
    [...onPitch].sort((a, b) => selector(b) - selector(a))[0]?.id ?? null;

  const deliveryTaker = bestBy((p) => p.attributes.technical.setPieceDelivery);
  const freeKickTaker = bestBy((p) => p.attributes.technical.freeKicks);
  const aerialTargets = [...onPitch]
    .sort((a, b) => (b.attributes.technical.heading + b.attributes.physical.jumping) - (a.attributes.technical.heading + a.attributes.physical.jumping))
    .slice(0, 3)
    .map((p) => p.id);

  return {
    ...tactic,
    setPieces: {
      ...tactic.setPieces,
      cornersAttacking: { ...tactic.setPieces.cornersAttacking, designatedTakerId: deliveryTaker, targetPlayerIds: aerialTargets },
      freeKicksAttacking: { ...tactic.setPieces.freeKicksAttacking, designatedTakerId: freeKickTaker, targetPlayerIds: aerialTargets },
    },
  };
}

export function buildClubTacticForMatch(world: SaveGameWorld, club: Club): TacticSetup {
  if (club.id === world.userClubId) {
    return world.activeTactic;
  }
  const manager = club.managerId ? world.managers[club.managerId] : undefined;
  const profile = manager?.tacticalTendencies ?? {
    preferredFormation: "4-3-3", mentality: "balanced", pressingIntensity: 50, buildUpSpeed: 50,
    defensiveLine: 50, width: 50, favoursYouth: 50, transferAggression: 50, adaptability: 50,
  };
  const { startingXI } = pickAutoLineup(club.squadIds, world.players, profile.preferredFormation);
  const slots = FORMATION_SLOTS[profile.preferredFormation] ?? FORMATION_SLOTS["4-3-3"]!;
  const playerRoles: TacticSetup["playerRoles"] = {};
  startingXI.forEach((id, i) => {
    playerRoles[id] = { positionCode: slots[i] ?? "CM", role: "Default", duty: "support" };
  });
  const tactic = buildTacticFromProfile(profile, playerRoles);
  return autoAssignSetPieceTakers(tactic, startingXI, world.players);
}

export { FORMATION_SLOTS };
