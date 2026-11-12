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
