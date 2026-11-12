// ============================================================================
// Core match engine — simulates a match in one-minute time slices. Designed
// to run inside workers/matchSim.worker.ts so the UI thread never blocks,
// but every function here is pure/synchronous so it's equally unit-testable
// on the main thread.
//
// Simulation approach (deliberately simple + tunable rather than a full
// physical positional model):
//   1. Each minute, decide who has the ball based on relative possession
//      skill (passing/vision/decisions + tactic tempo/width + chemistry +
//      fatigue-adjusted), with a home-advantage nudge.
//   2. The team in possession rolls for "chance created" based on attack
//      rating vs. opponent defense rating, tactic mentality, and traits.
//   3. Created chances resolve to a shot xG, contested by the keeper +
//      defense, and finally to goal/no-goal.
//   4. Discipline (cards) rolled from tackling/aggression vs. referee
//      strictness. Fatigue and injury risk accumulate every minute.
//   5. Set pieces (corners/free kicks/penalties) are diverted to
//      setPieces.ts instead of the generic open-play resolver.
// ============================================================================
import type { ID, Player, PositionCode } from "@/domain/types";
import type { MatchEvent, MatchState, PlayerMatchState, TeamMatchSetup } from "./matchTypes";
import { getWeatherModifiers } from "./weather";
import { resolveCorner, resolveFreeKick, resolvePenalty, refereeAwardsPenalty } from "./setPieces";
import { positionFitMultiplier } from "@/engines/tactics/tacticsEngine";

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---- Team strength aggregation ----------------------------------------------

export interface TeamStrengthProfile {
  attack: number; midfield: number; defense: number; possessionSkill: number;
  goalkeeping: number; setPieceThreat: number; discipline: number; // higher = fewer cards
}

export interface TacticalMatchEffects {
  possessionBonus: number;
  pressingStrength: number;
  chanceCreationMultiplier: number;
  shotVolumeMultiplier: number;
  shotQualityMultiplier: number;
  passingAccuracyMultiplier: number;
  fatigueMultiplier: number;
  foulRiskMultiplier: number;
}

/**
 * Translate the manager's match instructions into small, bounded simulation
 * effects. These are deliberately modifiers rather than hard-coded outcomes:
 * player quality, opponent quality, weather and randomness still matter.
 */
export function getTacticalMatchEffects(tactic: TeamMatchSetup["tactic"]): TacticalMatchEffects {
  const inPossession = tactic.inPossession.instructions;
  const outOfPossession = tactic.outOfPossession.instructions;
  const effects: TacticalMatchEffects = {
    possessionBonus: 0,
    pressingStrength: 0,
    chanceCreationMultiplier: 1,
    shotVolumeMultiplier: 1,
    shotQualityMultiplier: 1,
    passingAccuracyMultiplier: 1,
    fatigueMultiplier: 1,
    foulRiskMultiplier: 1,
  };

  if (inPossession.tempo === "slow") {
    effects.possessionBonus += 0.45;
    effects.chanceCreationMultiplier *= 0.91;
    effects.passingAccuracyMultiplier *= 1.04;
    effects.fatigueMultiplier *= 0.94;
  } else if (inPossession.tempo === "fast") {
    effects.possessionBonus -= 0.35;
    effects.chanceCreationMultiplier *= 1.12;
    effects.passingAccuracyMultiplier *= 0.95;
    effects.fatigueMultiplier *= 1.08;
  }

  if (inPossession.passingDirectness === "short") {
    effects.possessionBonus += 0.75;
    effects.passingAccuracyMultiplier *= 1.05;
    effects.chanceCreationMultiplier *= 0.96;
  } else if (inPossession.passingDirectness === "direct") {
    effects.possessionBonus -= 0.3;
    effects.passingAccuracyMultiplier *= 0.96;
    effects.chanceCreationMultiplier *= 1.07;
  } else if (inPossession.passingDirectness === "long") {
    effects.possessionBonus -= 0.75;
    effects.passingAccuracyMultiplier *= 0.9;
    effects.chanceCreationMultiplier *= 1.05;
  }

  if (inPossession.width === "narrow") {
    effects.possessionBonus += 0.25;
    effects.passingAccuracyMultiplier *= 1.015;
  } else if (inPossession.width === "wide") {
    effects.chanceCreationMultiplier *= 1.035;
  }

  if (inPossession.buildUpFromBack) {
    effects.possessionBonus += 0.25;
    effects.passingAccuracyMultiplier *= 1.015;
  }

  if (inPossession.creativeFreedom === "expressive") {
    effects.chanceCreationMultiplier *= 1.025;
    effects.passingAccuracyMultiplier *= 0.99;
  } else if (inPossession.creativeFreedom === "disciplined") {
    effects.possessionBonus += 0.15;
    effects.passingAccuracyMultiplier *= 1.01;
  }

  if (outOfPossession.closingDown === "all-over") {
    effects.pressingStrength += 1.9;
    effects.fatigueMultiplier *= 1.18;
    effects.foulRiskMultiplier *= 1.12;
  } else if (outOfPossession.closingDown === "own-half") {
    effects.pressingStrength += 0.9;
    effects.fatigueMultiplier *= 1.07;
  } else {
    effects.possessionBonus += 0.15;
  }

  if (outOfPossession.defensiveLine === "high") {
    effects.pressingStrength += 0.35;
    effects.fatigueMultiplier *= 1.04;
  } else if (outOfPossession.defensiveLine === "deep") {
    effects.possessionBonus += 0.15;
  }

  if (outOfPossession.tackling === "committed") {
    effects.foulRiskMultiplier *= 1.28;
    effects.fatigueMultiplier *= 1.07;
  } else if (outOfPossession.tackling === "cautious") {
    effects.foulRiskMultiplier *= 0.82;
  }

  if (tactic.transition.counterPressIntensity === "committed") {
    effects.pressingStrength += 0.45;
    effects.fatigueMultiplier *= 1.06;
  } else if (tactic.transition.counterPressIntensity === "normal") {
    effects.pressingStrength += 0.2;
  }

  if (tactic.transition.counterAttackSpeed === "fast-break") {
    effects.chanceCreationMultiplier *= 1.08;
  } else if (tactic.transition.counterAttackSpeed === "counter") {
    effects.chanceCreationMultiplier *= 1.04;
  }

  if (tactic.attack.finalThirdShooting === "shoot-on-sight") {
    effects.shotVolumeMultiplier *= 1.18;
    effects.shotQualityMultiplier *= 0.83;
  } else if (tactic.attack.finalThirdShooting === "work-into-box") {
    effects.shotVolumeMultiplier *= 0.9;
    effects.shotQualityMultiplier *= 1.15;
  }

  if (tactic.attack.finalThirdRunning === "through-balls") {
    effects.chanceCreationMultiplier *= 1.08;
    effects.shotQualityMultiplier *= 1.06;
  } else if (tactic.attack.finalThirdRunning === "run-at-defence") {
    effects.chanceCreationMultiplier *= 1.045;
    effects.foulRiskMultiplier *= 1.035;
  }

  effects.pressingStrength = clamp(effects.pressingStrength, 0, 3);
  effects.chanceCreationMultiplier = clamp(effects.chanceCreationMultiplier, 0.75, 1.35);
  effects.shotVolumeMultiplier = clamp(effects.shotVolumeMultiplier, 0.7, 1.3);
  effects.shotQualityMultiplier = clamp(effects.shotQualityMultiplier, 0.7, 1.3);
  effects.passingAccuracyMultiplier = clamp(effects.passingAccuracyMultiplier, 0.8, 1.12);
  effects.fatigueMultiplier = clamp(effects.fatigueMultiplier, 0.85, 1.4);
  effects.foulRiskMultiplier = clamp(effects.foulRiskMultiplier, 0.7, 1.6);
  return effects;
}

export function computeTeamStrength(
  setup: TeamMatchSetup,
  players: Record<ID, Player>,
  chemistry: number, // 0-100
  squadTacticFamiliarity: number, // 0-100
  playerStates?: Record<ID, PlayerMatchState>
): TeamStrengthProfile {
  const onPitch = setup.startingXI
    .filter((id) => playerStates?.[id]?.onPitch !== false)
    .map((id) => players[id])
    .filter((p): p is Player => !!p);
  if (onPitch.length === 0) {
    return { attack: 10, midfield: 10, defense: 10, possessionSkill: 10, goalkeeping: 10, setPieceThreat: 10, discipline: 10 };
  }

  // Attacking/possession numbers are computed off the in-possession shape
  // (where a player actually stands when this team has the ball); defense is
  // computed off the out-of-possession shape — this is what makes the dual
  // formation system actually matter, not just look different on the pitch.
  const inSlots = setup.tactic.inPossession.slotAssignments;
  const outSlots = setup.tactic.outOfPossession.slotAssignments;
  const weightedAvg = (selector: (p: Player) => number, positions: PositionCode[], slotMap: Record<string, PositionCode>) => {
    const relevant = onPitch.filter((p) => {
      const slot = slotMap[p.id];
      return slot ? positions.includes(slot) : positions.includes(p.positions[0]!);
    });
    const pool = relevant.length ? relevant : onPitch;
    const sum = pool.reduce((acc, p) => {
      const slot = slotMap[p.id];
      const fit = slot ? positionFitMultiplier(p, slot) : 1;
      const fatigueMultiplier = clamp(1 - p.fatigue / 160, 0.55, 1);
      const moraleMultiplier = clamp(0.75 + p.morale / 200, 0.75, 1.15);
      const formMultiplier = clamp(1 + p.form / 25, 0.8, 1.2);
      return acc + selector(p) * fit * fatigueMultiplier * moraleMultiplier * formMultiplier;
    }, 0);
    return sum / pool.length;
  };

  const attackPositions: PositionCode[] = ["LW", "RW", "CF", "ST", "CAM"];
  const midPositions: PositionCode[] = ["CDM", "CM", "CAM", "LM", "RM"];
  const defPositions: PositionCode[] = ["CB", "LB", "RB", "LWB", "RWB"];

  const attack = weightedAvg((p) => (p.attributes.technical.finishing + p.attributes.technical.dribbling + p.attributes.mental.anticipation) / 3, attackPositions, inSlots);
  const midfield = weightedAvg((p) => (p.attributes.technical.passing + p.attributes.mental.vision + p.attributes.mental.decisions) / 3, midPositions, inSlots);
  const defense = weightedAvg((p) => (p.attributes.technical.tackling + p.attributes.technical.marking + p.attributes.mental.positioning) / 3, defPositions, outSlots);
  const possessionSkill = weightedAvg((p) => (p.attributes.technical.passing + p.attributes.technical.firstTouch + p.attributes.mental.decisions) / 3, midPositions, inSlots);

  const gk = onPitch.find((p) => p.positions[0] === "GK");
  const goalkeeping = gk ? (gk.attributes.goalkeeping.shotStopping + gk.attributes.goalkeeping.reflexes + gk.attributes.goalkeeping.aerialCommand) / 3 : 8;

  const setPieceThreat = weightedAvg((p) => (p.attributes.technical.setPieceDelivery + p.attributes.technical.heading) / 2, [...attackPositions, ...defPositions], inSlots);
  const discipline = 20 - weightedAvg((p) => p.attributes.mental.aggression, defPositions, outSlots);

  const chemistryMultiplier = 0.85 + chemistry / 400; // 0.85-1.1
  const tacticMultiplier = 0.85 + squadTacticFamiliarity / 400;

  const scale = chemistryMultiplier * tacticMultiplier;
  return {
    attack: attack * scale, midfield: midfield * scale, defense: defense * scale,
    possessionSkill: possessionSkill * scale, goalkeeping, setPieceThreat, discipline,
  };
}

// ---- Match initialisation ----------------------------------------------------

export function initMatchState(
  home: TeamMatchSetup, away: TeamMatchSetup, context: MatchState["context"], seed: number,
  players: Record<ID, Player>
): MatchState {
  const playerStates: Record<ID, PlayerMatchState> = {};
  for (const setup of [home, away]) {
    for (const id of setup.startingXI) {
      const player = players[id];
      const slot = setup.tactic.inPossession.slotAssignments[id];
      playerStates[id] = {
        playerId: id, clubId: setup.clubId, onPitch: true, minutesPlayed: 0,
        fatigue: player?.fatigue ?? 0, rating: 6.0, goals: 0, assists: 0,
        yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0,
        positionCode: slot ?? player?.positions[0] ?? "CM",
      };
    }
  }
  return {
    context, home, away, minute: 0, homeGoals: 0, awayGoals: 0, homeXg: 0, awayXg: 0,
    homeXt: 0, awayXt: 0, momentum: 0,
    possessionHomeTicks: 0, possessionAwayTicks: 0,
    passesHome: 0, passesAway: 0, passesCompletedHome: 0, passesCompletedAway: 0,
    shotsHome: 0, shotsAway: 0, shotsOnTargetHome: 0, shotsOnTargetAway: 0,
    cornersHome: 0, cornersAway: 0, foulsHome: 0, foulsAway: 0,
    events: [{ minute: 0, type: "kickoff", description: "Kick-off!" }],
    playerStates, status: "not-started", rngSeed: seed,
  };
}

// ---- Tick simulation -----------------------------------------------------------

export function simulateOneMinute(
  state: MatchState, players: Record<ID, Player>, chemistryByClub: Record<ID, number>, tacticFamiliarityByClub: Record<ID, number>
): void {
  const rand = mulberry32(state.rngSeed + state.minute * 7919);
  state.rngSeed = Math.floor(rand() * 2 ** 31);

  if (state.minute === 0) state.status = "first-half";
  if (state.minute === 45) {
    state.status = "half-time";
    state.events.push({ minute: 45, type: "half-time", description: "Half-time." });
  }
  if (state.minute === 46 && state.status === "half-time") state.status = "second-half";
  if (state.minute >= 90) { state.status = "finished"; return; }

  state.minute += 1;
  const weatherMods = getWeatherModifiers(state.context.weather);

  const homeTactics = getTacticalMatchEffects(state.home.tactic);
  const awayTactics = getTacticalMatchEffects(state.away.tactic);
  const homeStrength = computeTeamStrength(
    state.home, players, chemistryByClub[state.home.clubId] ?? 60,
    tacticFamiliarityByClub[state.home.clubId] ?? 60, state.playerStates
  );
  const awayStrength = computeTeamStrength(
    state.away, players, chemistryByClub[state.away.clubId] ?? 60,
    tacticFamiliarityByClub[state.away.clubId] ?? 60, state.playerStates
  );

  // 1. Possession for this minute.
  const homeAdv = state.context.isNeutralVenue ? 0 : state.context.homeAdvantageStrength * 8;
  const possessionScoreHome = Math.max(1,
    homeStrength.possessionSkill + homeAdv + homeTactics.possessionBonus - awayTactics.pressingStrength
  );
  const possessionScoreAway = Math.max(1,
    awayStrength.possessionSkill + awayTactics.possessionBonus - homeTactics.pressingStrength
  );
  const homePossessionChance = possessionScoreHome / (possessionScoreHome + possessionScoreAway);
  const homeHasBall = rand() < homePossessionChance * weatherMods.passingAccuracy + (1 - weatherMods.passingAccuracy) * 0.5;

  if (homeHasBall) state.possessionHomeTicks += 1; else state.possessionAwayTicks += 1;

  // Passing volume/accuracy this minute — a rough proxy (not a real pass
  // map), scaled by the possessing team's passing skill and tempo.
  const possessingStrength = homeHasBall ? homeStrength : awayStrength;
  const passAttemptsThisMinute = 6 + Math.round(rand() * 4);
  const possessingTactics = homeHasBall ? homeTactics : awayTactics;
  const passSuccessRate = clamp(
    clamp(0.68 + (possessingStrength.possessionSkill - 12) / 60, 0.55, 0.95)
      * weatherMods.passingAccuracy * possessingTactics.passingAccuracyMultiplier,
    0.45, 0.98
  );
  let passesCompletedThisMinute = 0;
  for (let i = 0; i < passAttemptsThisMinute; i++) if (rand() < passSuccessRate) passesCompletedThisMinute += 1;
  if (homeHasBall) {
    state.passesHome += passAttemptsThisMinute; state.passesCompletedHome += passesCompletedThisMinute;
  } else {
    state.passesAway += passAttemptsThisMinute; state.passesCompletedAway += passesCompletedThisMinute;
  }

  const attackingSetup = homeHasBall ? state.home : state.away;
  const defendingSetup = homeHasBall ? state.away : state.home;
  const attackingStrength = homeHasBall ? homeStrength : awayStrength;
  const defendingStrength = homeHasBall ? awayStrength : homeStrength;
  const attackHomeAdv = homeHasBall ? homeAdv : 0;

  // 2. Chance creation probability this minute — mentality raises tempo of
  // chance creation at the cost of defensive solidity (handled below via
  // defense's own mentality symmetric effect when they're attacking).
  const mentalityAttackBoost: Record<string, number> = {
    "very-defensive": 0.6, defensive: 0.8, balanced: 1.0, attacking: 1.2, "very-attacking": 1.4,
  };
  const attackBoost = mentalityAttackBoost[attackingSetup.tactic.mentality] ?? 1;

  const attackingTactics = homeHasBall ? homeTactics : awayTactics;
  const chanceRate = 0.20 * attackBoost
    * (1 + (attackingStrength.attack - defendingStrength.defense) / 40)
    * (1 + attackHomeAdv / 100)
    * attackingTactics.chanceCreationMultiplier
    * attackingTactics.shotVolumeMultiplier;
  const chanceCreated = rand() < clamp(chanceRate, 0.005, 0.38);

  // Expected Threat — a smaller, continuous measure of buildup danger,
  // separate from xG (which only accrues on an actual shot). Ticks up every
  // minute the team is in possession in proportion to attack vs. defense.
  const xtTick = clamp(
    0.01 * (1 + (attackingStrength.attack - defendingStrength.defense) / 30)
      * attackingTactics.chanceCreationMultiplier,
    0.002, 0.05
  );
  if (homeHasBall) state.homeXt += xtTick; else state.awayXt += xtTick;

  if (chanceCreated) {
    resolveOpenPlayChance(
      state, rand, attackingSetup, defendingSetup, attackingStrength, defendingStrength,
      weatherMods, homeHasBall, players, attackingTactics
    );
  }

  // Momentum — decays toward 0 every minute, nudged by who's on top this
  // minute and spiked by chances/goals. Drives the live "momentum" meter.
  const momentumNudge = (homeHasBall ? 1 : -1) * (chanceCreated ? 6 : 1.5);
  state.momentum = clamp(state.momentum * 0.92 + momentumNudge, -100, 100);

  // 3. Discipline check (independent of chance creation) — tackles/duels
  // happen regardless of whether a shot results.
  rollForCards(
    state, rand, defendingSetup, defendingStrength,
    homeHasBall ? awayTactics : homeTactics
  );

  // 4. Fatigue + injury accumulation for everyone on the pitch.
  for (const setup of [state.home, state.away]) {
    for (const id of setup.startingXI) {
      const ps = state.playerStates[id];
      const player = players[id];
      if (!ps || !ps.onPitch || !player) continue;
      ps.minutesPlayed += 1;
      const staminaFactor = clamp((20 - player.attributes.physical.stamina) / 20, 0.2, 1.2);
      const teamTactics = setup.clubId === state.home.clubId ? homeTactics : awayTactics;
      ps.fatigue = clamp(
        ps.fatigue + 0.9 * staminaFactor * weatherMods.staminaDrainRate * teamTactics.fatigueMultiplier,
        0, 100
      );

      const injuryChance = 0.00025 * weatherMods.injuryRiskMultiplier * (1 + player.attributes.physical.injuryProneness / 20);
      if (rand() < injuryChance) {
        state.events.push({ minute: state.minute, type: "injury", clubId: setup.clubId, playerId: id, description: "Picks up a knock." });
      }
    }
  }
}

// Position-based attacking weight — a striker is far more likely to be the
// one on the end of a chance than a center-back, and a goalkeeper virtually
// never is. This replaced a uniform-random pick across the whole XI, which
// is why goalkeepers and center-backs were showing up as leading scorers.
const ATTACK_WEIGHT: Partial<Record<PositionCode, number>> = {
  ST: 10, CF: 9, LW: 7, RW: 7, CAM: 6, CM: 3, LM: 2.5, RM: 2.5,
  CDM: 1.5, LWB: 1.2, RWB: 1.2, LB: 1, RB: 1, CB: 0.5, GK: 0.03,
};
// Creative weight for who supplied the assist — playmakers and wide players
// far more than defenders, and a GK only ever via a rare long distribution.
const CREATIVE_WEIGHT: Partial<Record<PositionCode, number>> = {
  CAM: 9, CM: 6, LW: 6, RW: 6, RM: 5, LM: 5, CDM: 4, LWB: 4, RWB: 4,
  LB: 3, RB: 3, ST: 2.5, CF: 2.5, CB: 1, GK: 0.2,
};

function pickWeighted(
  pool: ID[], players: Record<ID, Player>, rand: () => number,
  weightTable: Partial<Record<PositionCode, number>>, attributeBoost: (p: Player) => number, exclude?: ID
): ID | null {
  const candidates = pool.filter((id) => id !== exclude && players[id]);
  if (candidates.length === 0) return null;
  const weights = candidates.map((id) => {
    const p = players[id]!;
    const base = weightTable[p.positions[0] ?? "CM"] ?? 1;
    return base * (1 + attributeBoost(p) / 20);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

function pickScorer(pool: ID[], players: Record<ID, Player>, rand: () => number): ID | null {
  return pickWeighted(pool, players, rand, ATTACK_WEIGHT, (p) => p.attributes.technical.finishing);
}

function pickAssister(pool: ID[], players: Record<ID, Player>, rand: () => number, scorerId: ID | null): ID | null {
  return pickWeighted(pool, players, rand, CREATIVE_WEIGHT, (p) => (p.attributes.mental.vision + p.attributes.technical.passing) / 2, scorerId ?? undefined);
}

function resolveOpenPlayChance(
  state: MatchState, rand: () => number,
  attacking: TeamMatchSetup, defending: TeamMatchSetup,
  attackingStrength: TeamStrengthProfile, defendingStrength: TeamStrengthProfile,
  weatherMods: ReturnType<typeof getWeatherModifiers>, isHomeAttacking: boolean,
  players: Record<ID, Player>, tacticalEffects: TacticalMatchEffects
): void {
  const setPieceRoll = rand();
  const routine = attacking.tactic.setPieces;
  const scorersPool = attacking.startingXI.filter((id) => state.playerStates[id]?.onPitch);
  const activePlayerId = (id: ID | null): ID | null => id && scorersPool.includes(id) ? id : null;
  const activeSetPieces = {
    cornersAttacking: {
      ...routine.cornersAttacking,
      designatedTakerId: activePlayerId(routine.cornersAttacking.designatedTakerId),
      targetPlayerIds: routine.cornersAttacking.targetPlayerIds.filter((id) => scorersPool.includes(id)),
    },
    freeKicksAttacking: {
      ...routine.freeKicksAttacking,
      designatedTakerId: activePlayerId(routine.freeKicksAttacking.designatedTakerId),
      targetPlayerIds: routine.freeKicksAttacking.targetPlayerIds.filter((id) => scorersPool.includes(id)),
    },
  };
  const fallbackScorer = pickScorer(scorersPool, players, rand);

  let xg: number;
  let scored: boolean;
  let scorer = fallbackScorer;
  let setPieceAssister: ID | null = null;
  let isOpenPlay = false;

  if (setPieceRoll < 0.10) {
    const outcome = resolveCorner(rand, activeSetPieces.cornersAttacking, players);
    xg = outcome.xg; scored = outcome.scored; scorer = outcome.scorerId ?? fallbackScorer;
    setPieceAssister = outcome.assisterId;
    state.events.push({ minute: state.minute, type: "corner", clubId: attacking.clubId, description: "Corner won." });
  } else if (setPieceRoll < 0.18) {
    const outcome = resolveFreeKick(rand, activeSetPieces.freeKicksAttacking, players, rand() < 0.4 ? "direct-shot" : "into-box");
    xg = outcome.xg; scored = outcome.scored; scorer = outcome.scorerId ?? fallbackScorer;
    setPieceAssister = outcome.assisterId;
    state.events.push({ minute: state.minute, type: "free-kick", clubId: attacking.clubId, description: "Free kick in a dangerous area." });
  } else {
    isOpenPlay = true;
    const baseXg = 0.22 * (1 + (attackingStrength.attack - defendingStrength.defense) / 30);
    xg = clamp(baseXg * tacticalEffects.shotQualityMultiplier, 0.03, 0.6) * weatherMods.shotAccuracy;
    const gkSave = 1 - clamp(defendingStrength.goalkeeping / 20, 0.3, 0.95) * 0.35;
    scored = rand() < xg * gkSave;
  }

  const homeGoal = isHomeAttacking ? scored : false;
  const awayGoal = !isHomeAttacking ? scored : false;
  if (isHomeAttacking) state.homeXg += xg; else state.awayXg += xg;

  // Every chance (open play, corner, or free kick) is one shot attempt.
  // "On target" is derived from xG quality when it isn't already a goal —
  // higher-quality chances are more likely to have at least forced a save
  // rather than sailing wide, without pretending to simulate shot placement.
  const onTarget = scored || rand() < clamp(xg * 2.5, 0.15, 0.85);
  if (isHomeAttacking) {
    state.shotsHome += 1;
    if (onTarget) state.shotsOnTargetHome += 1;
    if (setPieceRoll < 0.10) state.cornersHome += 1;
  } else {
    state.shotsAway += 1;
    if (onTarget) state.shotsOnTargetAway += 1;
    if (setPieceRoll < 0.10) state.cornersAway += 1;
  }
  if (scorer) {
    const shooterState = state.playerStates[scorer];
    if (shooterState) {
      shooterState.shots += 1;
      if (onTarget) shooterState.shotsOnTarget += 1;
    }
  }

  if (scored) {
    if (homeGoal) state.homeGoals += 1;
    if (awayGoal) state.awayGoals += 1;
    if (scorer) {
      const ps = state.playerStates[scorer];
      if (ps) { ps.goals += 1; ps.rating = clamp(ps.rating + 1.2, 1, 10); }
    }
    // Set pieces credit whoever took the corner/free-kick as the assist.
    // Open play: ~78% of goals get an assist (the rest are solo efforts —
    // dribbles, rebounds, individual moments), picked by creative weight.
    const assister = setPieceAssister ?? (isOpenPlay && rand() < 0.78 ? pickAssister(scorersPool, players, rand, scorer) : null);
    if (assister) {
      const aps = state.playerStates[assister];
      if (aps) { aps.assists += 1; aps.rating = clamp(aps.rating + 0.5, 1, 10); }
    }
    state.events.push({
      minute: state.minute, type: "goal", clubId: attacking.clubId, playerId: scorer ?? undefined,
      secondaryPlayerId: assister ?? undefined, description: "GOAL!", xgValue: xg,
    });
  } else {
    state.events.push({ minute: state.minute, type: "chance-created", clubId: attacking.clubId, description: "A chance goes begging.", xgValue: xg });
  }
  void defending;
}

function rollForCards(
  state: MatchState, rand: () => number, defendingSetup: TeamMatchSetup,
  defendingStrength: TeamStrengthProfile, tacticalEffects: TacticalMatchEffects
): void {
  const referee = state.context.referee;
  const isHomeDefending = defendingSetup.clubId === state.home.clubId;

  // Most fouls never produce a card — roll for the foul itself first (at a
  // noticeably higher rate), then decide whether it's bad enough to book.
  const foulBaseRate = 0.05 * (20 - defendingStrength.discipline) / 20 * tacticalEffects.foulRiskMultiplier;
  if (rand() < foulBaseRate) {
    if (isHomeDefending) state.foulsHome += 1; else state.foulsAway += 1;
  }

  const cardBaseRate = 0.006 * (referee.strictness / 50)
    * (20 - defendingStrength.discipline) / 20 * tacticalEffects.foulRiskMultiplier;
  if (rand() < cardBaseRate) {
    const candidates = defendingSetup.startingXI.filter((id) => {
      const playerState = state.playerStates[id];
      return playerState?.onPitch && playerState.redCards === 0;
    });
    if (candidates.length === 0) return;
    const playerId = candidates[Math.floor(rand() * candidates.length)]!;
    const ps = state.playerStates[playerId]!;
    if (isHomeDefending) state.foulsHome += 1; else state.foulsAway += 1;
    const isRed = rand() < 0.06 * (referee.strictness / 50);
    if (isRed) {
      ps.redCards += 1; ps.onPitch = false; ps.rating = clamp(ps.rating - 1.5, 1, 10);
      state.events.push({ minute: state.minute, type: "red-card", clubId: defendingSetup.clubId, playerId, description: "Red card!" });
    } else {
      ps.yellowCards += 1;
      const isSecond = ps.yellowCards >= 2;
      ps.rating = clamp(ps.rating - 0.3, 1, 10);
      if (isSecond) {
        ps.onPitch = false;
        state.events.push({ minute: state.minute, type: "second-yellow", clubId: defendingSetup.clubId, playerId, description: "Second yellow — off!" });
      } else {
        state.events.push({ minute: state.minute, type: "yellow-card", clubId: defendingSetup.clubId, playerId, description: "Booked." });
      }
    }
  }
}

// ---- Live management: substitutions & tactic changes --------------------------

export function applySubstitution(state: MatchState, clubId: ID, playerOffId: ID, playerOnId: ID, positionCode: PositionCode, playerOnBaseFatigue: number): boolean {
  const setup = state.home.clubId === clubId ? state.home : state.away;
  if (setup.substitutesUsed >= setup.maxSubstitutions) return false;
  if (!setup.startingXI.includes(playerOffId)) return false;
  if (!setup.bench.includes(playerOnId)) return false;

  setup.startingXI = setup.startingXI.map((id) => (id === playerOffId ? playerOnId : id));
  setup.bench = setup.bench.filter((id) => id !== playerOnId);
  setup.substitutesUsed += 1;

  const offState = state.playerStates[playerOffId];
  if (offState) offState.onPitch = false;
  state.playerStates[playerOnId] = {
    playerId: playerOnId, clubId, onPitch: true, minutesPlayed: 0, fatigue: playerOnBaseFatigue,
    rating: 6.0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0, positionCode,
  };
  state.events.push({
    minute: state.minute, type: "substitution", clubId, playerId: playerOnId, secondaryPlayerId: playerOffId,
    description: "Substitution.",
  });
  return true;
}

export function applyTacticChange(state: MatchState, clubId: ID, tactic: TeamMatchSetup["tactic"]): void {
  const setup = state.home.clubId === clubId ? state.home : state.away;
  setup.tactic = tactic;
  state.events.push({ minute: state.minute, type: "tactic-change", clubId, description: `Switched to ${tactic.inPossession.formation} (${tactic.mentality}).` });
}

export function simulateToMinute(
  state: MatchState, targetMinute: number, players: Record<ID, Player>,
  chemistryByClub: Record<ID, number>, tacticFamiliarityByClub: Record<ID, number>
): void {
  const cappedTarget = Math.min(targetMinute, 90);
  // Loop on minute <= target (not <), and run one extra tick once minute
  // reaches 90 so the "finished" flip inside simulateOneMinute actually
  // gets a chance to fire. The old `<` condition stopped the loop the
  // instant minute hit 90 — one tick before that flip ever happened — so
  // status stayed "second-half" forever and the match could never be
  // confirmed or advanced past.
  while (state.status !== "finished" && (state.minute < cappedTarget || state.minute >= 90)) {
    simulateOneMinute(state, players, chemistryByClub, tacticFamiliarityByClub);
  }
}

export function penaltyShootout(
  rand: () => number, players: Record<ID, Player>, homeTakers: ID[], awayTakers: ID[],
  homeGk: ID | null, awayGk: ID | null
): { homeScore: number; awayScore: number } {
  let homeScore = 0, awayScore = 0;
  for (let i = 0; i < 5; i++) {
    const homeTaker = homeTakers[i % homeTakers.length] ?? null;
    const awayTaker = awayTakers[i % awayTakers.length] ?? null;
    if (resolvePenalty(rand, homeTaker, players, awayGk).scored) homeScore += 1;
    if (resolvePenalty(rand, awayTaker, players, homeGk).scored) awayScore += 1;
  }
  while (homeScore === awayScore) {
    const homeTaker = homeTakers[Math.floor(rand() * homeTakers.length)] ?? null;
    const awayTaker = awayTakers[Math.floor(rand() * awayTakers.length)] ?? null;
    const homeScored = resolvePenalty(rand, homeTaker, players, awayGk).scored;
    const awayScored = resolvePenalty(rand, awayTaker, players, homeGk).scored;
    if (homeScored) homeScore += 1;
    if (awayScored) awayScore += 1;
    if (homeScored !== awayScored) break;
  }
  void refereeAwardsPenalty;
  return { homeScore, awayScore };
}
