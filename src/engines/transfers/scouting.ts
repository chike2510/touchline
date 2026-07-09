// ============================================================================
// Scouting — separate from transfers.ts because it models *information
// quality* rather than dealmaking. A scout's judgingAbility/judgingPotential
// attributes control how far the estimated ability figures drift from the
// hidden true values, simulating imperfect information.
// ============================================================================
import type { SaveGameWorld, Player, Staff, ScoutingReport } from "@/domain/types";
import { nanoid } from "nanoid";

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function generateScoutingReport(
  world: SaveGameWorld,
  scout: Staff,
  player: Player,
  requestingClubId: string
): ScoutingReport {
  const rand = mulberry32(hashStringToInt(scout.id + player.id + world.currentDate));
  const accuracy = (scout.attributes.judgingAbility + scout.attributes.judgingPotential) / 40; // 0-1
  const noiseRange = (1 - accuracy) * 40; // up to +/-40 ability points of error at zero accuracy

  const estimatedCurrentAbility = clampAbility(player.currentAbility + (rand() * 2 - 1) * noiseRange);
  const estimatedPotentialAbility = clampAbility(player.potentialAbility + (rand() * 2 - 1) * noiseRange * 1.3);

  const recommendation: ScoutingReport["recommendation"] =
    estimatedPotentialAbility > 140 && estimatedCurrentAbility > 100
      ? "sign-now"
      : estimatedPotentialAbility > 110
      ? "monitor"
      : "not-needed";

  const report: ScoutingReport = {
    id: nanoid(10),
    playerId: player.id,
    scoutId: scout.id,
    clubId: requestingClubId,
    confidence: Math.round(accuracy * 100),
    estimatedAttributes: {}, // per-attribute estimation is a straightforward
    // extension: apply the same noise function per attribute category and
    // populate technical/mental/physical/goalkeeping partials here.
    estimatedCurrentAbility: Math.round(estimatedCurrentAbility),
    estimatedPotentialAbility: Math.round(estimatedPotentialAbility),
    recommendation,
    notes: `${scout.firstName} ${scout.lastName}'s assessment, confidence ${Math.round(accuracy * 100)}%.`,
    createdDate: world.currentDate,
  };
  world.scoutingReports[report.id] = report;
  return report;
}

function clampAbility(n: number): number {
  return Math.max(1, Math.min(200, n));
}
