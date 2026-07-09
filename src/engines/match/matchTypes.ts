// ============================================================================
// Match engine types. Kept separate from domain/types.ts because these are
// transient simulation-run state (recreated each match) rather than
// persisted save data — only the final MatchResult (domain/types.ts) is
// written back into the save.
// ============================================================================
import type { ID, PositionCode, TacticSetup, WeatherCondition, Referee } from "@/domain/types";

export interface TeamMatchSetup {
  clubId: ID;
  tactic: TacticSetup;
  startingXI: ID[]; // player ids, 11 entries
  bench: ID[]; // up to 9 substitutes
  substitutesUsed: number;
  maxSubstitutions: number; // typically 5
}

export interface MatchContext {
  fixtureId: ID;
  weather: WeatherCondition;
  referee: Referee;
  isNeutralVenue: boolean;
  homeAdvantageStrength: number; // 0-1, derived from stadium atmosphere + crowd size
}

export interface PlayerMatchState {
  playerId: ID;
  clubId: ID;
  onPitch: boolean;
  minutesPlayed: number;
  fatigue: number; // 0-100, starts at pre-match player.fatigue and climbs
  rating: number; // live FM-style 1-10 rating, starts at 6.0
  goals: number; assists: number; yellowCards: number; redCards: number;
  positionCode: PositionCode;
}

export type MatchEventType =
  | "kickoff" | "goal" | "own-goal" | "yellow-card" | "red-card" | "second-yellow"
  | "substitution" | "injury" | "chance-created" | "chance-missed" | "half-time" | "full-time"
  | "tactic-change" | "corner" | "free-kick" | "penalty-awarded" | "penalty-scored" | "penalty-missed";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  clubId?: ID;
  playerId?: ID;
  secondaryPlayerId?: ID; // assister, sub-off player, etc.
  description: string;
  xgValue?: number;
}

export interface MatchState {
  context: MatchContext;
  home: TeamMatchSetup;
  away: TeamMatchSetup;
  minute: number;
  homeGoals: number; awayGoals: number;
  homeXg: number; awayXg: number;
  possessionHomeTicks: number; possessionAwayTicks: number;
  events: MatchEvent[];
  playerStates: Record<ID, PlayerMatchState>;
  status: "not-started" | "first-half" | "half-time" | "second-half" | "extra-time" | "finished";
  rngSeed: number;
}

// Messages exchanged with the Web Worker (see workers/matchSim.worker.ts).
export type MatchSimRequest =
  | { kind: "init"; home: TeamMatchSetup; away: TeamMatchSetup; context: MatchContext; seed: number }
  | { kind: "simulate-to-minute"; targetMinute: number }
  | { kind: "apply-substitution"; clubId: ID; playerOffId: ID; playerOnId: ID; positionCode: PositionCode }
  | { kind: "apply-tactic-change"; clubId: ID; tactic: TacticSetup }
  | { kind: "get-state" };

export type MatchSimResponse =
  | { kind: "state-update"; state: MatchState }
  | { kind: "error"; message: string };
