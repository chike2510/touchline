// ============================================================================
// AI tactics & lineup selection — AI clubs don't store a persisted TacticSetup
// the way the user's club does (only `SaveGameWorld.activeTactic` is tracked
// explicitly); instead one is derived on demand from the club's manager
// tendencies and current squad. This keeps the save file smaller and means
// changing an AI manager's `ManagerTacticalProfile` immediately reflects in
// how their team sets up, without a separate sync step.
//
// Every tactic built here stores TWO independent shapes (see PhaseShape in
// domain/types.ts): the manager's preferred in-possession formation, and an
// automatically-derived, more compact out-of-possession block. The match
// engine and pitch visualization morph between the two live.
// ============================================================================
import type {
  Club, ManagerTacticalProfile, Player, PositionCode, SaveGameWorld, TacticSetup, TacticalStyleId,
} from "@/domain/types";
import { nanoid } from "nanoid";
import { defaultDutyForRole, defaultRoleForSlot, ROLE_CATALOG } from "./roles";
import { TACTICAL_STYLES } from "./styles";

// Slot templates: ordered position lists for common formations. Extend this
// table to support more formations — the lineup picker below is generic.
// Ordering matters: GK, then defenders, then midfield, then attack, so index
// alignment between an in-possession formation and its out-of-possession
// counterpart below keeps the same player in roughly the same "band".
export const FORMATION_SLOTS: Record<string, PositionCode[]> = {
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "CDM", "CM", "LW", "ST", "RW"],
  "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "CAM", "LW", "RW", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CM", "CM", "RWB", "ST", "ST"],
  "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "CM", "RM", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
  "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
  "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "CF", "ST"],
  "4-3-2-1": ["GK", "LB", "CB", "CB", "RB", "CM", "CDM", "CM", "CAM", "CAM", "ST"],
  "3-2-5": ["GK", "CB", "CB", "CB", "CM", "CM", "LW", "CAM", "ST", "CAM", "RW"],
  "5-4-1": ["GK", "LWB", "CB", "CB", "CB", "RWB", "LM", "CM", "CM", "RM", "ST"],
};

export const FORMATION_CATEGORY: Record<string, "3-at-back" | "4-at-back" | "5-at-back"> = {
  "3-5-2": "3-at-back", "3-4-3": "3-at-back", "3-2-5": "3-at-back",
  "4-3-3": "4-at-back", "4-4-2": "4-at-back", "4-2-3-1": "4-at-back",
  "4-1-4-1": "4-at-back", "4-4-1-1": "4-at-back", "4-3-2-1": "4-at-back",
  "5-3-2": "5-at-back", "5-4-1": "5-at-back",
};

// Sensible, automatically-derived defensive block for a given attacking
// shape — this is what the team morphs into out of possession by default.
// The manager can always override it by hand from the Out of Possession tab.
export const DEFAULT_OUT_OF_POSSESSION_SHAPE: Record<string, string> = {
  "3-2-5": "4-4-2",
  "4-3-3": "4-1-4-1",
  "4-4-2": "4-4-2",
  "4-2-3-1": "4-4-1-1",
  "3-5-2": "5-3-2",
  "4-1-4-1": "4-1-4-1",
  "3-4-3": "5-4-1",
  "5-3-2": "5-3-2",
  "4-4-1-1": "4-4-1-1",
  "4-3-2-1": "4-1-4-1",
  "5-4-1": "5-4-1",
};

export function defaultOutOfPossessionFormation(inPossessionFormation: string): string {
  return DEFAULT_OUT_OF_POSSESSION_SHAPE[inPossessionFormation] ?? inPossessionFormation;
}

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

function defaultSetPieces(): TacticSetup["setPieces"] {
  return {
    cornersAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "far-post" },
    freeKicksAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "edge-of-box" },
    throwInsAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "short-corner" },
    cornersDefending: "zonal",
  };
}

// Builds both phase shapes (slot assignments for the same 11 players across
// the in-possession and out-of-possession formations) — the same starter
// occupies index-aligned slots in each shape, since the formation lists are
// deliberately ordered GK -> defence -> midfield -> attack.
function buildDualShapes(startingXI: string[], inFormation: string, outFormation: string) {
  const inSlots = FORMATION_SLOTS[inFormation] ?? FORMATION_SLOTS["4-3-3"]!;
  const outSlots = FORMATION_SLOTS[outFormation] ?? inSlots;

  const inPossessionSlots: Record<string, PositionCode> = {};
  const outOfPossessionSlots: Record<string, PositionCode> = {};

  startingXI.forEach((id, i) => {
    const inSlot = inSlots[i] ?? "CM";
    const outSlot = outSlots[i] ?? inSlot;
    inPossessionSlots[id] = inSlot;
    outOfPossessionSlots[id] = outSlot;
  });

  return { inPossessionSlots, outOfPossessionSlots };
}

function buildDefaultRoles(startingXI: string[], inFormation: string): TacticSetup["playerRoles"] {
  const slots = FORMATION_SLOTS[inFormation] ?? FORMATION_SLOTS["4-3-3"]!;
  const playerRoles: TacticSetup["playerRoles"] = {};
  startingXI.forEach((id, i) => {
    const slot = slots[i] ?? "CM";
    const roleCode = defaultRoleForSlot(slot);
    playerRoles[id] = { roleCode, duty: defaultDutyForRole(roleCode) };
  });
  return playerRoles;
}

// Picks a flavour-matched style template purely so AI teams feel like they
// have an identity rather than all defaulting to "Clean Slate" — the actual
// discrete instructions still come from the chosen style's defaults.
function pickStyleForProfile(profile: ManagerTacticalProfile): TacticalStyleId {
  if (profile.pressingIntensity > 70 && profile.defensiveLine > 65) return "gegenpress";
  if (profile.buildUpSpeed < 35 && profile.defensiveLine < 40) return "park-the-bus";
  if (profile.buildUpSpeed < 40 && profile.pressingIntensity < 40) return "catenaccio";
  if (profile.width > 65) return "wing-play";
  if (profile.buildUpSpeed < 35) return "route-one";
  if (profile.buildUpSpeed > 65 && profile.width < 40) return "vertical-tiki-taka";
  if (profile.pressingIntensity > 55 && profile.adaptability > 55) return "fluid-counter-attack";
  if (profile.buildUpSpeed > 60) return "tiki-taka";
  return "control-possession";
}

export function buildTacticFromProfile(profile: ManagerTacticalProfile, startingXI: string[]): TacticSetup {
  const inFormation = FORMATION_SLOTS[profile.preferredFormation] ? profile.preferredFormation : "4-3-3";
  const outFormation = defaultOutOfPossessionFormation(inFormation);
  const { inPossessionSlots, outOfPossessionSlots } = buildDualShapes(startingXI, inFormation, outFormation);
  const playerRoles = buildDefaultRoles(startingXI, inFormation);

  const styleId = pickStyleForProfile(profile);
  const style = TACTICAL_STYLES[styleId];

  return {
    id: nanoid(8),
    name: `${inFormation} (AI)`,
    tacticalStyleId: styleId,
    mentality: mentalityToTactic(profile.mentality),
    inPossession: { formation: inFormation, slotAssignments: inPossessionSlots, instructions: style.defaults.inPossession },
    outOfPossession: { formation: outFormation, slotAssignments: outOfPossessionSlots, instructions: style.defaults.outOfPossession },
    attack: style.defaults.attack,
    transition: style.defaults.transition,
    setPieces: defaultSetPieces(),
    playerRoles,
    familiarity: 70, // AI clubs are assumed drilled in their own default system
  };
}

// Builds a fresh tactic for the user's own club from a chosen style template
// and formation — this is what the "Create Tactic" flow in the Tactics page
// calls. Distinct from buildTacticFromProfile, which derives from an AI
// manager's numeric tendencies rather than an explicit style pick.
export function buildTacticFromStyle(styleId: TacticalStyleId, inFormation: string, startingXI: string[], name?: string): TacticSetup {
  const outFormation = defaultOutOfPossessionFormation(inFormation);
  const { inPossessionSlots, outOfPossessionSlots } = buildDualShapes(startingXI, inFormation, outFormation);
  const playerRoles = buildDefaultRoles(startingXI, inFormation);
  const style = TACTICAL_STYLES[styleId];

  return {
    id: nanoid(8),
    name: name ?? `${inFormation} — ${style.label}`,
    tacticalStyleId: styleId,
    mentality: style.defaults.mentality,
    inPossession: { formation: inFormation, slotAssignments: inPossessionSlots, instructions: style.defaults.inPossession },
    outOfPossession: { formation: outFormation, slotAssignments: outOfPossessionSlots, instructions: style.defaults.outOfPossession },
    attack: style.defaults.attack,
    transition: style.defaults.transition,
    setPieces: defaultSetPieces(),
    playerRoles,
    familiarity: 40, // fresh tactic, not yet drilled
  };
}

export function remapOutOfPossessionFormation(startingXI: string[], inFormation: string, newOutFormation: string): Record<string, PositionCode> {
  const { outOfPossessionSlots } = buildDualShapes(startingXI, inFormation, newOutFormation);
  return outOfPossessionSlots;
}

// Re-applies role defaults + both phase shapes to a tactic after the
// formation or starting XI changes, preserving instructions/style/mentality.
export function reshapeTactic(tactic: TacticSetup, inFormation: string, startingXI: string[]): TacticSetup {
  const outFormation = defaultOutOfPossessionFormation(inFormation);
  const { inPossessionSlots, outOfPossessionSlots } = buildDualShapes(startingXI, inFormation, outFormation);
  const playerRoles = buildDefaultRoles(startingXI, inFormation);
  return {
    ...tactic,
    inPossession: { ...tactic.inPossession, formation: inFormation, slotAssignments: inPossessionSlots },
    outOfPossession: { ...tactic.outOfPossession, formation: outFormation, slotAssignments: outOfPossessionSlots },
    playerRoles,
    familiarity: Math.max(0, tactic.familiarity - 30),
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
  const tactic = buildTacticFromProfile(profile, startingXI);
  return autoAssignSetPieceTakers(tactic, startingXI, world.players);
}

export { ROLE_CATALOG };
