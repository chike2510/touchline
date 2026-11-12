// Milestone 2 foundation: deterministic AI manager "club brain" profiles.
// Derived only from world.seed + manager id (+ reputation), so the same save always yields the same
// profile, and saves written before this existed get one on load. Does not touch match calculations;
// consumers (transfer AI, rotation, board) can read manager.aiProfile later.
import type { Manager, SaveGameWorld } from "@/domain/types";

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h >>> 0; }
function unit(seed: string, salt: string): number {
  let t = (hash(seed + "::" + salt) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function buildAiProfile(worldSeed: string, manager: Pick<Manager, "id" | "reputation" | "tacticalTendencies">): NonNullable<Manager["aiProfile"]> {
  const s = `${worldSeed}::${manager.id}`;
  const t = manager.tacticalTendencies;
  return {
    version: 1,
    ambition: clamp(30 + unit(s, "amb") * 50 + (manager.reputation - 100) * 0.1),
    patience: clamp(20 + unit(s, "pat") * 70),
    riskTolerance: clamp(20 + unit(s, "risk") * 60 + ((t?.transferAggression ?? 50) - 50) * 0.2),
    rotationPolicy: clamp(25 + unit(s, "rot") * 60),
    youthTrust: clamp(((t?.favoursYouth ?? 50) * 0.6) + unit(s, "youth") * 40),
    squadSizeTarget: 22 + Math.floor(unit(s, "squad") * 6),
  };
}

// Idempotent. Returns number of profiles added. Never overwrites an existing profile.
export function ensureManagerProfiles(world: SaveGameWorld): number {
  let n = 0;
  for (const m of Object.values(world.managers ?? {})) {
    if (m.isUserControlled || m.aiProfile) continue;
    m.aiProfile = buildAiProfile(world.seed, m);
    n++;
  }
  return n;
}

// Squad rotation driven by the AI profile. Deterministic: no randomness, same world gives same answer.
// Tired players (fatigue is 0-100, 100 = exhausted) are left out of selection when the manager's
// rotationPolicy says so, but never so many that the club cannot field a full XI plus bench,
// and never the last available goalkeeper. Returns the squad ids to pick from (original order kept).
export function rotationThreshold(rotationPolicy: number): number { return Math.round(80 - rotationPolicy * 0.4); }

export function rotationSquad(world: SaveGameWorld, clubId: string, availableIds: string[]): string[] {
  const club = world.clubs[clubId];
  if (!club || clubId === world.userClubId) return availableIds;
  const profile = club.managerId ? world.managers[club.managerId]?.aiProfile : undefined;
  if (!profile) return availableIds;
  const limit = rotationThreshold(profile.rotationPolicy);
  const tired = availableIds
    .filter((id) => (world.players[id]?.fatigue ?? 0) > limit)
    .sort((a, b) => (world.players[b]!.fatigue - world.players[a]!.fatigue) || (a < b ? -1 : 1));
  const keep = new Set(availableIds);
  const isGk = (id: string) => world.players[id]?.positions[0] === "GK";
  for (const id of tired) {
    if (keep.size <= 16) break; // XI + a usable bench
    if (isGk(id) && [...keep].filter(isGk).length <= 1) continue;
    keep.delete(id);
  }
  return availableIds.filter((id) => keep.has(id));
}

// Mentality shifts one step with the manager's appetite: ambitious, risk-tolerant bosses push forward,
// cautious, patient ones sit deeper. Pure, deterministic; only picks the starting mentality of the tactic.
const MENT = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"] as const;
export function profileMentality(base: (typeof MENT)[number], profile?: Manager["aiProfile"]): (typeof MENT)[number] {
  if (!profile) return base;
  const push = (profile.ambition + profile.riskTolerance) / 2;
  const shift = push >= 70 ? 1 : push <= 35 ? -1 : 0;
  return MENT[Math.max(0, Math.min(4, MENT.indexOf(base) + shift))]!;
}

// Selling-club price multiplier: patient managers hold out, high-risk ambitious ones cash in faster.
export function sellerPriceFactor(profile?: Manager["aiProfile"]): number {
  if (!profile) return 1;
  return Math.max(0.9, Math.min(1.15, 1 + (profile.patience - 50) / 500 - (profile.riskTolerance - 50) / 800));
}

// Buying side: how much of the transfer budget an AI club is willing to commit to one signing.
export function buyerSpendCap(world: SaveGameWorld, clubId: string): number {
  const club = world.clubs[clubId]; if (!club) return 0;
  const prof = club.managerId ? world.managers[club.managerId]?.aiProfile : undefined;
  const share = 0.3 + ((prof?.riskTolerance ?? 50) / 100) * 0.4;
  return Math.floor(club.finance.transferBudget * share);
}

// Squad-size behaviour: does this AI club want to sign or sell right now?
export function squadNeed(world: SaveGameWorld, clubId: string): "buy" | "sell" | "hold" {
  const club = world.clubs[clubId]; if (!club) return "hold";
  const target = (club.managerId ? world.managers[club.managerId]?.aiProfile?.squadSizeTarget : undefined) ?? 24;
  return club.squadIds.length < target - 2 ? "buy" : club.squadIds.length > target + 4 ? "sell" : "hold";
}

// Managerial behaviour: an AI board sacks on sustained low confidence, scaled by the manager's patience
// (patient bosses survive lower confidence). Returns true when the manager should be dismissed.
export function shouldSackManager(world: SaveGameWorld, clubId: string): boolean {
  const club = world.clubs[clubId]; if (!club || clubId === world.userClubId || !club.managerId) return false;
  const m = world.managers[club.managerId]; if (!m || m.isUserControlled) return false;
  return club.boardConfidence < 25 - (m.aiProfile?.patience ?? 50) * 0.1;
}

// Season-end managerial behaviour: sack and replace. The replacement is a deterministic new manager
// (id derived from club + season) so the same world always yields the same result. Returns sacked club ids.
export function runAiManagerChanges(world: SaveGameWorld, season: number): string[] {
  const out: string[] = [];
  for (const club of Object.values(world.clubs)) {
    if (!shouldSackManager(world, club.id)) continue;
    const old = world.managers[club.managerId!]!;
    old.clubId = null;
    old.history = [...(old.history ?? []), { clubId: club.id, clubName: club.name, from: world.currentDate, to: world.currentDate, trophies: [] }];
    const id = `mgr-${club.id}-s${season + 1}`;
    if (!world.managers[id]) {
      const t = { ...old.tacticalTendencies };
      const jit = (k: string) => Math.round(unit(world.seed + id, k) * 30 - 15);
      t.pressingIntensity = clamp(t.pressingIntensity + jit("p"));
      t.buildUpSpeed = clamp(t.buildUpSpeed + jit("b"));
      t.width = clamp(t.width + jit("w"));
      t.defensiveLine = clamp(t.defensiveLine + jit("d"));
      const firstNames = ["Adrian", "Marco", "Daniel", "Rafael", "Thomas", "Victor", "Julian", "Samuel"];
      const lastNames = ["Moretti", "Silva", "Bennett", "Kovacs", "Mensah", "Petrov", "Costa", "Okafor"];
      const pick = (items: string[], salt: string) => items[Math.floor(unit(world.seed + id, salt) * items.length)]!;
      const reputation = Math.max(35, Math.min(160, Math.round(club.reputation * 0.72 + unit(world.seed + id, "rep") * 35)));
      const replacement: Manager = {
        id, firstName: pick(firstNames, "first"), lastName: pick(lastNames, "last"),
        nationality: old.nationality, clubId: club.id, isUserControlled: false, reputation,
        tacticalTendencies: t,
        contract: { wageWeekly: Math.max(1500, Math.round(reputation * 90)), expiryDate: new Date(Date.parse(world.currentDate) + 2 * 365 * 86400000).toISOString().slice(0, 10) },
        history: [],
      };
      replacement.aiProfile = buildAiProfile(world.seed, replacement);
      world.managers[id] = replacement;
    }
    club.managerId = id;
    club.boardConfidence = 50;
    out.push(club.id);
  }
  return out;
}
