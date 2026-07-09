// ============================================================================
// Set pieces — resolved as discrete events rather than folded into the
// general open-play chance model, since they depend on specific designated
// takers/targets rather than average team attack rating.
// ============================================================================
import type { Player, SetPieceRoutine, Referee } from "@/domain/types";

export interface SetPieceOutcome {
  scored: boolean;
  shotOnTarget: boolean;
  xg: number;
  scorerId: string | null;
  assisterId: string | null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function resolveCorner(
  rand: () => number,
  routine: SetPieceRoutine,
  players: Record<string, Player>
): SetPieceOutcome {
  const taker = routine.designatedTakerId ? players[routine.designatedTakerId] : undefined;
  const deliveryQuality = taker ? taker.attributes.technical.setPieceDelivery / 20 : 0.4;

  const targets = routine.targetPlayerIds.map((id) => players[id]).filter((p): p is Player => !!p);
  const bestTarget = targets.sort((a, b) => b.attributes.technical.heading - a.attributes.technical.heading)[0];
  const headingQuality = bestTarget ? bestTarget.attributes.technical.heading / 20 : 0.3;
  const jumpingReach = bestTarget ? bestTarget.attributes.physical.jumping / 20 : 0.3;

  const baseXg = 0.09; // league-average corner xG
  const xg = baseXg * (0.5 + deliveryQuality) * (0.5 + headingQuality) * (0.5 + jumpingReach);

  const scored = rand() < xg;
  return {
    scored,
    shotOnTarget: scored || rand() < xg * 2.2,
    xg,
    scorerId: scored ? bestTarget?.id ?? null : null,
    assisterId: scored ? taker?.id ?? null : null,
  };
}

export function resolveFreeKick(
  rand: () => number,
  routine: SetPieceRoutine,
  players: Record<string, Player>,
  distanceCategory: "direct-shot" | "into-box"
): SetPieceOutcome {
  const taker = routine.designatedTakerId ? players[routine.designatedTakerId] : undefined;

  if (distanceCategory === "direct-shot") {
    const freeKickSkill = taker ? taker.attributes.technical.freeKicks / 20 : 0.25;
    const xg = 0.06 * (0.4 + freeKickSkill * 1.6);
    const scored = rand() < xg;
    return { scored, shotOnTarget: scored || rand() < xg * 3, xg, scorerId: scored ? taker?.id ?? null : null, assisterId: null };
  }

  // Delivered into the box behaves like a corner but with slightly lower
  // baseline xG (defenders better set at free kicks than open corners).
  return resolveCorner(rand, routine, players);
}

export function resolvePenalty(
  rand: () => number,
  takerId: string | null,
  players: Record<string, Player>,
  goalkeeperId: string | null
): SetPieceOutcome {
  const taker = takerId ? players[takerId] : undefined;
  const gk = goalkeeperId ? players[goalkeeperId] : undefined;
  const takerSkill = taker ? (taker.attributes.technical.penalties / 20) * 0.7 + (taker.personality.pressureResistance / 20) * 0.3 : 0.5;
  const gkSkill = gk ? gk.attributes.goalkeeping.oneOnOnes / 20 : 0.3;

  const baseScoreChance = 0.76;
  const scoreChance = clamp01(baseScoreChance + (takerSkill - 0.5) * 0.3 - (gkSkill - 0.3) * 0.25);
  const scored = rand() < scoreChance;
  return { scored, shotOnTarget: true, xg: 0.76, scorerId: scored ? taker?.id ?? null : null, assisterId: null };
}

// Referee strictness affects how often marginal contact in the box is given
// as a penalty at all (separate from whether it's converted).
export function refereeAwardsPenalty(rand: () => number, referee: Referee, marginalCallSeverity: number): boolean {
  const threshold = 0.5 - referee.strictness / 200 + referee.advantagePlay / 400;
  return marginalCallSeverity > threshold + (rand() - 0.5) * 0.2;
}
