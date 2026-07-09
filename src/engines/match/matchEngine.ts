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

export function computeTeamStrength(
  setup: TeamMatchSetup,
  players: Record<ID, Player>,
  chemistry: number, // 0-100
  squadTacticFamiliarity: number // 0-100
): TeamStrengthProfile {
  const onPitch = setup.startingXI.map((id) => players[id]).filter((p): p is Player => !!p);
  if (onPitch.length === 0) {
    return { attack: 10, midfield: 10, defense: 10, possessionSkill: 10, goalkeeping: 10, setPieceThreat: 10, discipline: 10 };
  }

  const roleByPlayer = setup.tactic.playerRoles;
  const weightedAvg = (selector: (p: Player) => number, positions: PositionCode[]) => {
    const relevant = onPitch.filter((p) => {
      const role = roleByPlayer[p.id];
      return role ? positions.includes(role.positionCode) : positions.includes(p.positions[0]!);
    });
    const pool = relevant.length ? relevant : onPitch;
    const sum = pool.reduce((acc, p) => {
      const role = roleByPlayer[p.id];
      const fit = role ? positionFitMultiplier(p, role.positionCode) : 1;
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

  const attack = weightedAvg((p) => (p.attributes.technical.finishing + p.attributes.technical.dribbling + p.attributes.mental.anticipation) / 3, attackPositions);
  const midfield = weightedAvg((p) => (p.attributes.technical.passing + p.attributes.mental.vision + p.attributes.mental.decisions) / 3, midPositions);
  const defense = weightedAvg((p) => (p.attributes.technical.tackling + p.attributes.technical.marking + p.attributes.mental.positioning) / 3, defPositions);
  const possessionSkill = weightedAvg((p) => (p.attributes.technical.passing + p.attributes.technical.firstTouch + p.attributes.mental.decisions) / 3, midPositions);

  const gk = onPitch.find((p) => p.positions[0] === "GK");
  const goalkeeping = gk ? (gk.attributes.goalkeeping.shotStopping + gk.attributes.goalkeeping.reflexes + gk.attributes.goalkeeping.aerialCommand) / 3 : 8;

  const setPieceThreat = weightedAvg((p) => (p.attributes.technical.setPieceDelivery + p.attributes.technical.heading) / 2, [...attackPositions, ...defPositions]);
  const discipline = 20 - weightedAvg((p) => p.attributes.mental.aggression, defPositions);

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
      const role = setup.tactic.playerRoles[id];
      playerStates[id] = {
        playerId: id, clubId: setup.clubId, onPitch: true, minutesPlayed: 0,
        fatigue: player?.fatigue ?? 0, rating: 6.0, goals: 0, assists: 0,
        yellowCards: 0, redCards: 0, positionCode: role?.positionCode ?? player?.positions[0] ?? "CM",
      };
    }
  }
  return {
    context, home, away, minute: 0, homeGoals: 0, awayGoals: 0, homeXg: 0, awayXg: 0,
    possessionHomeTicks: 0, possessionAwayTicks: 0,
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

  const homeStrength = computeTeamStrength(state.home, players, chemistryByClub[state.home.clubId] ?? 60, tacticFamiliarityByClub[state.home.clubId] ?? 60);
  const awayStrength = computeTeamStrength(state.away, players, chemistryByClub[state.away.clubId] ?? 60, tacticFamiliarityByClub[state.away.clubId] ?? 60);

  // 1. Possession for this minute.
  const homeAdv = state.context.isNeutralVenue ? 0 : state.context.homeAdvantageStrength * 8;
  const possessionScoreHome = homeStrength.possessionSkill + homeAdv;
  const possessionScoreAway = awayStrength.possessionSkill;
  const homePossessionChance = possessionScoreHome / (possessionScoreHome + possessionScoreAway);
  const homeHasBall = rand() < homePossessionChance * weatherMods.passingAccuracy + (1 - weatherMods.passingAccuracy) * 0.5;

  if (homeHasBall) state.possessionHomeTicks += 1; else state.possessionAwayTicks += 1;

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

  const chanceRate = 0.055 * attackBoost * (1 + (attackingStrength.attack - defendingStrength.defense) / 40) * (1 + attackHomeAdv / 100);
  const chanceCreated = rand() < clamp(chanceRate, 0.005, 0.35);

  if (chanceCreated) {
    resolveOpenPlayChance(state, rand, attackingSetup, defendingSetup, attackingStrength, defendingStrength, weatherMods, homeHasBall, players);
  }

  // 3. Discipline check (independent of chance creation) — tackles/duels
  // happen regardless of whether a shot results.
  rollForCards(state, rand, defendingSetup, defendingStrength);

  // 4. Fatigue + injury accumulation for everyone on the pitch.
  for (const setup of [state.home, state.away]) {
    for (const id of setup.startingXI) {
      const ps = state.playerStates[id];
      const player = players[id];
      if (!ps || !ps.onPitch || !player) continue;
      ps.minutesPlayed += 1;
      const staminaFactor = clamp((20 - player.attributes.physical.stamina) / 20, 0.2, 1.2);
      ps.fatigue = clamp(ps.fatigue + 0.9 * staminaFactor * weatherMods.staminaDrainRate, 0, 100);

      const injuryChance = 0.00025 * weatherMods.injuryRiskMultiplier * (1 + player.attributes.physical.injuryProneness / 20);
      if (rand() < injuryChance) {
        state.events.push({ minute: state.minute, type: "injury", clubId: setup.clubId, playerId: id, description: "Picks up a knock." });
      }
    }
  }
}

function resolveOpenPlayChance(
  state: MatchState, rand: () => number,
  attacking: TeamMatchSetup, defending: TeamMatchSetup,
  attackingStrength: TeamStrengthProfile, defendingStrength: TeamStrengthProfile,
  weatherMods: ReturnType<typeof getWeatherModifiers>, isHomeAttacking: boolean, players: Record<ID, Player>
): void {
  const setPieceRoll = rand();
  const routine = attacking.tactic.setPieces;
  const scorersPool = attacking.startingXI;
  const fallbackScorer = scorersPool[Math.floor(rand() * scorersPool.length)] ?? null;

  let xg: number;
  let scored: boolean;
  let scorer = fallbackScorer;

  if (setPieceRoll < 0.10) {
    const outcome = resolveCorner(rand, routine.cornersAttacking, players);
    xg = outcome.xg; scored = outcome.scored; scorer = outcome.scorerId ?? fallbackScorer;
    state.events.push({ minute: state.minute, type: "corner", clubId: attacking.clubId, description: "Corner won." });
  } else if (setPieceRoll < 0.18) {
    const outcome = resolveFreeKick(rand, routine.freeKicksAttacking, players, rand() < 0.4 ? "direct-shot" : "into-box");
    xg = outcome.xg; scored = outcome.scored; scorer = outcome.scorerId ?? fallbackScorer;
    state.events.push({ minute: state.minute, type: "free-kick", clubId: attacking.clubId, description: "Free kick in a dangerous area." });
  } else {
    const baseXg = 0.09 * (1 + (attackingStrength.attack - defendingStrength.defense) / 30);
    xg = clamp(baseXg, 0.02, 0.6) * weatherMods.shotAccuracy;
    const gkSave = 1 - clamp(defendingStrength.goalkeeping / 20, 0.3, 0.95) * 0.5;
    scored = rand() < xg * gkSave;
  }

  const homeGoal = isHomeAttacking ? scored : false;
  const awayGoal = !isHomeAttacking ? scored : false;
  if (isHomeAttacking) state.homeXg += xg; else state.awayXg += xg;

  if (scored) {
    if (homeGoal) state.homeGoals += 1;
    if (awayGoal) state.awayGoals += 1;
    if (scorer) {
      const ps = state.playerStates[scorer];
      if (ps) { ps.goals += 1; ps.rating = clamp(ps.rating + 1.2, 1, 10); }
    }
    state.events.push({
      minute: state.minute, type: "goal", clubId: attacking.clubId, playerId: scorer ?? undefined,
      description: "GOAL!", xgValue: xg,
    });
  } else {
    state.events.push({ minute: state.minute, type: "chance-created", clubId: attacking.clubId, description: "A chance goes begging.", xgValue: xg });
  }
  void defending;
}

function rollForCards(state: MatchState, rand: () => number, defendingSetup: TeamMatchSetup, defendingStrength: TeamStrengthProfile): void {
  const referee = state.context.referee;
  const cardBaseRate = 0.006 * (referee.strictness / 50) * (20 - defendingStrength.discipline) / 20;
  if (rand() < cardBaseRate) {
    const candidates = defendingSetup.startingXI.filter((id) => (state.playerStates[id]?.redCards ?? 0) === 0);
    if (candidates.length === 0) return;
    const playerId = candidates[Math.floor(rand() * candidates.length)]!;
    const ps = state.playerStates[playerId]!;
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
    rating: 6.0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, positionCode,
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
  state.events.push({ minute: state.minute, type: "tactic-change", clubId, description: `Switched to ${tactic.formation} (${tactic.mentality}).` });
}

export function simulateToMinute(
  state: MatchState, targetMinute: number, players: Record<ID, Player>,
  chemistryByClub: Record<ID, number>, tacticFamiliarityByClub: Record<ID, number>
): void {
  while (state.minute < Math.min(targetMinute, 90) && state.status !== "finished") {
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
