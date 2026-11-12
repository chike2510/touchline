// ============================================================================
// DOMAIN TYPES
// Single source of truth for every shape used by engines, persistence, and UI.
// Keep this file free of logic — pure data contracts only.
// ============================================================================

export type ID = string;

export type Foot = "left" | "right" | "both";

export type PositionCode =
  | "GK"
  | "CB" | "LB" | "RB" | "LWB" | "RWB"
  | "CDM" | "CM" | "CAM" | "LM" | "RM"
  | "LW" | "RW" | "CF" | "ST";

// ---- Attributes -----------------------------------------------------------
// FM-style 1-20 attribute scale. Grouped by category for UI progressive
// disclosure (Overview tab shows key attrs; Attributes tab shows all).

export interface TechnicalAttributes {
  passing: number; dribbling: number; firstTouch: number; finishing: number;
  crossing: number; heading: number; marking: number; tackling: number;
  longShots: number; freeKicks: number; penalties: number; setPieceDelivery: number;
}

export interface MentalAttributes {
  vision: number; composure: number; decisions: number; anticipation: number;
  positioning: number; concentration: number; workRate: number; teamwork: number;
  leadership: number; aggression: number; bravery: number; determination: number;
}

export interface PhysicalAttributes {
  pace: number; acceleration: number; stamina: number; strength: number;
  agility: number; balance: number; jumping: number; naturalFitness: number;
  injuryProneness: number; // higher = more prone
}

export interface GoalkeepingAttributes {
  handling: number; reflexes: number; shotStopping: number; aerialCommand: number;
  distribution: number; oneOnOnes: number; sweeping: number;
}

export interface PlayerAttributes {
  technical: TechnicalAttributes;
  mental: MentalAttributes;
  physical: PhysicalAttributes;
  goalkeeping: GoalkeepingAttributes;
}

// ---- Personality ------------------------------------------------------------

export type PersonalityTrait =
  | "professional" | "ambitious" | "loyal" | "temperamental" | "influential"
  | "media-friendly" | "media-shy" | "model-professional" | "unsettled"
  | "big-game-player" | "streaky" | "injury-prone-mentality" | "resilient"
  | "leader" | "solo-runner" | "team-player";

export interface PlayerPersonality {
  traits: PersonalityTrait[];
  professionalism: number; // 1-20, drives training growth/decay
  ambition: number;
  loyalty: number;
  pressureResistance: number; // performance delta under high stakes
  sociability: number; // affects dressing-room chemistry contribution
  controversyTendency: number; // affects media incident frequency
}

// ---- Traits / Playing style -------------------------------------------------
// "Traits" here = FM-style player instincts (set via PIs or born with them),
// each implemented as a small modifier consumed by the match engine.

export type PlayerTrait =
  | "comes-deep-to-collect-ball" | "plays-no-through-balls" | "runs-with-ball-often"
  | "tries-first-time-shots" | "arrives-late-in-box" | "cuts-inside"
  | "stays-back-at-all-times" | "gets-forward-whenever-possible"
  | "tries-killer-balls-often" | "dictates-tempo" | "wins-tackles"
  | "long-throw" | "penalty-taker" | "corner-taker" | "free-kick-taker"
  | "target-man" | "false-nine" | "sweeper-keeper" | "shot-stopper";

export interface Player {
  id: ID;
  firstName: string;
  lastName: string;
  commonName?: string;
  nationality: string;
  secondNationality?: string;
  dateOfBirth: string; // ISO date
  height_cm: number;
  weight_kg: number;
  foot: Foot;
  positions: PositionCode[]; // ordered, primary first
  positionFamiliarity: Partial<Record<PositionCode, number>>; // 0-20 per position
  attributes: PlayerAttributes;
  personality: PlayerPersonality;
  traits: PlayerTrait[];
  currentAbility: number; // 1-200 hidden composite, drives match engine baseline
  potentialAbility: number; // 1-200 ceiling, drives youth development
  form: number; // -5..+5 rolling recent-performance modifier
  morale: number; // 0-100
  fatigue: number; // 0-100 (100 = exhausted)
  sharpness: number; // 0-100 match fitness (distinct from fatigue)
  injuryStatus: InjuryStatus | null;
  suspension: SuspensionStatus | null;
  clubId: ID | null;
  nationalTeamId: ID | null;
  contract: Contract | null;
  careerHistory: CareerStint[];
  seasonStats: SeasonStats;
  isYouthProduct: boolean;
  isRegen: boolean; // procedurally generated vs. seeded real-world player
  faceSeed: string; // deterministic seed for avatar rendering
}

export interface InjuryStatus {
  description: string;
  daysRemaining: number;
  severity: "minor" | "moderate" | "severe";
  recurring: boolean;
  // Added by stabilisation pass (optional: older saves lack them)
  injuredOn?: string; // ISO date
  initialDays?: number; // estimated recovery at time of injury
  injuryType?: string;
}

export interface SuspensionStatus {
  reason: "yellow-accumulation" | "red-card" | "disciplinary";
  matchesRemaining: number;
  competitionId?: string | null; // null/undefined = applies to all competitions
  issuedOn?: string;
}

export interface SeasonStats {
  appearances: number; starts: number; goals: number; assists: number;
  minutesPlayed: number; yellowCards: number; redCards: number;
  averageRating: number; cleanSheets: number; motmAwards: number;
  shots: number; shotsOnTarget: number;
}

export interface CareerStint {
  clubId: ID; clubName: string; from: string; to: string | null;
  appearances: number; goals: number;
}

// ---- Contracts & Finance ----------------------------------------------------

export interface Contract {
  playerId: ID; clubId: ID;
  wageWeekly: number;
  signingBonus?: number;
  startDate: string; expiryDate: string;
  releaseClause?: number;
  loyaltyBonus?: number;
  appearanceBonus?: number;
  goalBonus?: number;
  promotionBonus?: number;
  agentId?: ID;
  squadStatusPromise?: "star" | "important" | "regular" | "rotation" | "backup" | "youth-prospect";
}

export interface Manager {
  id: ID;
  firstName: string; lastName: string; nationality: string;
  clubId: ID | null;
  isUserControlled: boolean;
  reputation: number; // 1-200
  tacticalTendencies: ManagerTacticalProfile;
  contract: { wageWeekly: number; expiryDate: string } | null;
  history: { clubId: ID; clubName: string; from: string; to: string | null; trophies: string[] }[];
}

// Editable, per-manager AI behaviour profile — drives both how the AI manager
// sets up its own team and, for the user's own manager record, is just a log
// of past tendencies shown in the profile screen.
export interface ManagerTacticalProfile {
  preferredFormation: string; // e.g. "4-3-3"
  mentality: "very-defensive" | "defensive" | "balanced" | "attacking" | "very-attacking";
  pressingIntensity: number; // 0-100
  buildUpSpeed: number; // 0-100 (slow -> direct)
  defensiveLine: number; // 0-100 (deep -> high)
  width: number; // 0-100 (narrow -> wide)
  favoursYouth: number; // 0-100
  transferAggression: number; // 0-100, spending willingness relative to budget
  adaptability: number; // 0-100, how often they change plan mid-season/match
}

// ---- Club -------------------------------------------------------------------

export interface Club {
  id: ID;
  name: string;
  shortName: string;
  abbreviation: string;
  countryCode: string;
  leagueId: ID;
  founded: number;
  colors: { primary: string; secondary: string };
  stadium: Stadium;
  facilities: ClubFacilities;
  finance: ClubFinance;
  squadIds: ID[];
  youthSquadIds: ID[];
  staffIds: ID[];
  managerId: ID | null;
  boardConfidence: number; // 0-100
  fanSentiment: FanSentiment;
  culture: ClubCulture;
  reputation: number; // 1-200
  rivalIds: ID[];
  trophyCabinet: TrophyRecord[];
  isUserControlled: boolean;
  captainId: ID | null;
}

export interface Stadium {
  name: string; capacity: number; avgAttendance: number;
  pitchQuality: number; // 0-100, affects injury risk/ball behaviour marginally
  atmosphere: number; // 0-100, feeds into home advantage
}

export interface ClubFacilities {
  trainingFacilities: number; // 1-20 FM-style scale
  youthFacilities: number;
  medicalFacilities: number; // affects injury recovery speed
  dataAnalysis: number; // affects scouting accuracy / opposition reports
  youthRecruitment: number; // affects youth intake quality
  stadiumFacilities: number; // affects matchday revenue & atmosphere ceiling
}

export interface ClubFinance {
  balance: number;
  transferBudget: number;
  wageBudgetWeekly: number;
  wageBudgetUsedWeekly: number;
  sponsorships: SponsorshipDeal[];
  broadcastIncomeSeasonal: number;
  matchdayIncomeSeasonal: number;
  debt: number;
  ownerInvestmentCap: number | null;
  lastTakeoverDate: string | null;
}

export interface SponsorshipDeal {
  name: string; type: "shirt" | "stadium" | "training-kit" | "regional";
  incomeWeekly: number; expiryDate: string;
  performanceBonusClauses?: { condition: string; amount: number }[];
}

export interface FanSentiment {
  overall: number; // 0-100
  boardTrust: number; // 0-100, distinct from board confidence in manager
  ticketDemand: number; // 0-100
  recentTrend: "rising" | "stable" | "falling";
  protestRisk: number; // 0-100
}

export interface ClubCulture {
  playingPhilosophy: "possession" | "direct" | "counter" | "high-press" | "balanced";
  youthEmphasis: number; // 0-100
  transferPolicy: "boom-bust" | "sustainable" | "star-driven" | "moneyball";
  identityTags: string[]; // free-form evolving descriptors, e.g. "cup specialists"
}

export interface TrophyRecord {
  competitionName: string; season: string; result: "winner" | "runner-up" | "semi-final";
}

// ---- Staff ------------------------------------------------------------------

export type StaffRole =
  | "assistant-manager" | "head-of-youth-development" | "chief-scout"
  | "head-physio" | "fitness-coach" | "goalkeeping-coach"
  | "first-team-coach" | "data-analyst" | "loan-manager";

export interface Staff {
  id: ID; firstName: string; lastName: string; nationality: string;
  role: StaffRole; clubId: ID | null;
  attributes: StaffAttributes;
  contract: { wageWeekly: number; expiryDate: string } | null;
}

export interface StaffAttributes {
  coaching: number; manManagement: number; discipline: number;
  judgingPotential: number; judgingAbility: number; // scouting accuracy stats
  physiotherapy: number; workingWithYoungsters: number; adaptability: number;
}

// ---- League / World -----------------------------------------------------------

export interface League {
  id: ID; name: string; countryCode: string; tier: number;
  clubIds: ID[]; format: LeagueFormat; reputation: number;
  promotionSlots: number; relegationSlots: number;
  continentalQualification: { competitionId: ID; slots: number }[];
}

export interface LeagueFormat {
  type: "round-robin-double" | "round-robin-single" | "split-conference";
  matchdaysTotal: number;
}

export interface Fixture {
  id: ID; leagueId: ID | null; competitionId: ID | null;
  homeClubId: ID; awayClubId: ID; kickoff: string; // ISO datetime
  round: string;
  venueNeutral: boolean;
  weather: WeatherCondition;
  refereeId: ID;
  status: "scheduled" | "in-progress" | "completed" | "postponed";
  season?: number; // absent on older fixtures = season 1
  result: MatchResult | null;
}

export interface MatchResult {
  homeGoals: number; awayGoals: number;
  homeXg: number; awayXg: number;
  scorers: { playerId: ID; clubId: ID; minute: number; type: "open-play" | "penalty" | "free-kick" | "own-goal" | "header" }[];
  cards: { playerId: ID; clubId: ID; minute: number; type: "yellow" | "red" | "second-yellow" }[];
  motmPlayerId: ID | null;
  playerRatings: Record<ID, number>;
  possessionHome: number; // %
  attendance: number;
  stats: MatchTeamStats;
}

export interface MatchTeamStats {
  shotsHome: number; shotsAway: number;
  shotsOnTargetHome: number; shotsOnTargetAway: number;
  cornersHome: number; cornersAway: number;
  foulsHome: number; foulsAway: number;
  expectedThreatHome: number; expectedThreatAway: number;
  passAccuracyHome: number; passAccuracyAway: number; // %
}

export type WeatherCondition = "clear" | "overcast" | "rain" | "heavy-rain" | "snow" | "windy" | "hot" | "cold";

export interface Referee {
  id: ID; firstName: string; lastName: string; nationality: string;
  strictness: number; // 0-100, card frequency
  advantagePlay: number; // 0-100, lets play flow
  homeBias: number; // -20..+20, subtle bias applied to 50/50 calls
  consistency: number; // 0-100
}

// ---- Competitions -------------------------------------------------------------

export interface Competition {
  id: ID; name: string; type: "league" | "domestic-cup" | "continental-cup" | "super-cup";
  format: "knockout" | "group-knockout" | "league-table";
  participatingClubIds: ID[];
  currentRound: string;
}

// ---- Achievements / Rivalries -------------------------------------------------

export interface RivalryRecord {
  clubAId: ID; clubBId: ID;
  intensity: number; // 0-100, grows with meetings/incidents/proximity
  historyNotes: string[];
  headToHead: { clubAWins: number; clubBWins: number; draws: number };
}

export interface Achievement {
  id: ID; label: string; description: string;
  category: "manager-career" | "club-record" | "player-milestone" | "world-event";
  achievedOn: string | null; // null until unlocked
}

// ---- Transfers ------------------------------------------------------------------

export interface TransferListing {
  playerId: ID; clubId: ID; askingPrice: number | null;
  listedDate: string; loanAvailable: boolean; reason: "surplus" | "financial" | "unsettled" | "board-decision";
}

export interface TransferOffer {
  id: ID; playerId: ID; fromClubId: ID; toClubId: ID;
  type: "permanent" | "loan" | "loan-with-obligation";
  fee: number; addOns: { condition: string; amount: number }[];
  wageOffer: number; contractLengthYears: number;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "player-considering" | "medical" | "completed";
  submittedDate: string;
}

export interface ScoutingReport {
  id: ID; playerId: ID; scoutId: ID; clubId: ID;
  confidence: number; // 0-100, accuracy of the estimate below
  estimatedAttributes: Partial<PlayerAttributes>;
  estimatedCurrentAbility: number; estimatedPotentialAbility: number;
  recommendation: "sign-now" | "monitor" | "not-needed" | "too-expensive";
  notes: string; createdDate: string;
}

// ---- Media ------------------------------------------------------------------

export interface MediaStory {
  id: ID; headline: string; body: string; date: string;
  category: "transfer-rumour" | "match-reaction" | "press-conference" | "dressing-room" | "board-statement" | "personal";
  relatedClubIds: ID[]; relatedPlayerIds: ID[];
  requiresResponse: boolean;
  responseOptions?: MediaResponseOption[];
}

export interface MediaResponseOption {
  id: string; label: string; tone: "diplomatic" | "confident" | "aggressive" | "humble" | "deflect";
  effects: { moraleDelta?: number; fanSentimentDelta?: number; boardConfidenceDelta?: number; rivalryDelta?: number };
}

// ---- Inbox ------------------------------------------------------------------

export type InboxCategory =
  | "briefing" | "match-report" | "transfer" | "contract" | "media"
  | "board" | "medical" | "youth" | "staff" | "finance" | "world-news";

export interface InboxItem {
  id: ID; category: InboxCategory; subject: string; body: string;
  date: string; read: boolean; archived: boolean;
  priority: "low" | "normal" | "high" | "urgent";
  actions: InboxAction[];
  linkedEntityId?: ID;
}

export interface InboxAction {
  id: string; label: string;
  kind: "navigate" | "decision" | "acknowledge";
  target?: string; // route or decision handler key
  payload?: Record<string, unknown>;
}

// ---- Calendar / Game Loop -----------------------------------------------------

export type GamePhase =
  | "weekly-briefing" | "tactics-training" | "off-pitch" | "matchday-build-up"
  | "matchday-live" | "post-match" | "calendar-advance";

export interface CalendarDay {
  date: string; // ISO date
  phase: GamePhase;
  hasFixture: boolean;
  fixtureId: ID | null;
  scheduledEvents: ScheduledEvent[];
}

export interface ScheduledEvent {
  id: ID; type: "training-session" | "press-conference" | "board-meeting"
    | "transfer-deadline" | "youth-intake" | "contract-expiry-check" | "awards-ceremony";
  date: string; description: string; resolved: boolean;
}

// ---- Save Game ------------------------------------------------------------------

export interface SaveGameMeta {
  id: ID; name: string; createdAt: string; lastPlayedAt: string;
  currentDate: string; managerName: string; clubName: string | null;
  saveType: "autosave" | "manual" | "snapshot";
  appVersion: string;
}

// The full save payload persisted to IndexedDB. Split from SaveGameMeta so the
// save-list screen can render quickly from meta alone without deserialising
// the (potentially large) world blob.
export interface SeasonArchiveEntry {
  season: number;
  leagueId: ID;
  table: { clubId: ID; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }[];
  championClubId: ID | null;
}

export interface SaveGameWorld {
  saveId: ID;
  currentDate: string;
  seed: string; // RNG seed for deterministic procedural generation
  managers: Record<ID, Manager>;
  clubs: Record<ID, Club>;
  players: Record<ID, Player>;
  staff: Record<ID, Staff>;
  leagues: Record<ID, League>;
  competitions: Record<ID, Competition>;
  referees: Record<ID, Referee>;
  fixtures: Record<ID, Fixture>;
  rivalries: Record<ID, RivalryRecord>;
  achievements: Record<ID, Achievement>;
  transferListings: Record<ID, TransferListing>;
  transferOffers: Record<ID, TransferOffer>;
  scoutingReports: Record<ID, ScoutingReport>;
  inboxItems: Record<ID, InboxItem>;
  mediaStories: Record<ID, MediaStory>;
  userClubId: ID;
  userManagerId: ID;
  calendar: Record<string, CalendarDay>; // keyed by ISO date
  activeTactic: TacticSetup;
  savedTactics: TacticSetup[];
  seasonNumber?: number; // 1-based; absent on older saves = 1
  seasonArchive?: SeasonArchiveEntry[];
  lastDailyProcessed?: string; // ISO date; guards exactly-once daily processing
  shortlistedPlayerIds?: ID[]; // optional: absent on older saves, always read with `?? []`
}

// ---- Tactics ------------------------------------------------------------------
//
// A tactic stores TWO independent formations — one for when the team has the
// ball, one for when it doesn't (see PhaseShape). The match engine and pitch
// visualization morph between them live. Every behavioural setting is an
// authentic, discrete football decision (a small set of named options) —
// never a raw 0-100 slider.

export type MentalityLevel = "very-defensive" | "defensive" | "balanced" | "attacking" | "very-attacking";

export type RoleDuty = "defend" | "support" | "attack" | "automatic";

// The player's authentic role identity — shared across both phase shapes
// (a player assigned "Inverted Wing-Back" plays that job in possession and
// simply reverts to covering their patch of the pitch out of possession).
export type RoleCode =
  | "GK" | "SK"
  | "CB" | "NCB" | "BPD"
  | "FB" | "WB" | "IWB" | "CWB"
  | "HB" | "DM" | "DLP" | "RPM"
  | "CM" | "BWM" | "MEZ" | "CAR"
  | "AP" | "AM" | "SS"
  | "IF" | "IW" | "W"
  | "AF" | "DLF" | "PF" | "TM" | "CF";

export interface PlayerRoleAssignment {
  roleCode: RoleCode;
  duty: RoleDuty;
}

// A formation "shape" — a named formation plus which broad slot each of the
// 11 starters occupies while the team is in that phase of play.
export interface PhaseShape {
  formation: string; // "3-2-5", "4-4-2", etc.
  slotAssignments: Record<ID, PositionCode>; // playerId -> slot in this phase
}

export type TempoLevel = "slow" | "normal" | "fast";
export type WidthLevel = "narrow" | "balanced" | "wide";
export type PassingDirectness = "short" | "mixed" | "direct" | "long";
export type PlayThroughBias = "left" | "centre" | "right" | "balanced";
export type CreativeFreedomLevel = "disciplined" | "balanced" | "expressive";

export interface InPossessionInstructions {
  tempo: TempoLevel;
  passingDirectness: PassingDirectness;
  width: WidthLevel;
  playThroughBias: PlayThroughBias;
  buildUpFromBack: boolean;
  creativeFreedom: CreativeFreedomLevel;
}

export type DefensiveLineLevel = "deep" | "balanced" | "high";
export type ClosingDownLevel = "sit-back" | "own-half" | "all-over";
export type TacklingLevel = "cautious" | "normal" | "committed";

export interface DefensiveInstructions {
  defensiveLine: DefensiveLineLevel;
  defensiveWidth: WidthLevel;
  closingDown: ClosingDownLevel;
  tackling: TacklingLevel;
  marking: "zonal" | "man";
  offsideTrap: boolean;
  timeWasting: boolean;
}

export type PassingFocus = "left" | "centre" | "right" | "both-flanks" | "mixed";
export type GkDistribution = "short" | "mixed" | "long";

export interface AttackInstructions {
  finalThirdCrossing: "early-crosses" | "look-for-overlap";
  finalThirdShooting: "shoot-on-sight" | "work-into-box";
  finalThirdRunning: "run-at-defence" | "through-balls";
  passingFocus: PassingFocus;
  goalkeeperDistribution: GkDistribution;
}

export type CounterAttackSpeed = "hold-shape" | "counter" | "fast-break";

export interface TransitionInstructions {
  counterPressIntensity: TacklingLevel;
  counterAttackSpeed: CounterAttackSpeed;
  transitionDirectness: PassingDirectness;
}

// A named tactical style (Tiki-Taka, Gegenpress, Park the Bus, etc.) is a
// starting template the assistant recommends — picking one pre-fills
// mentality + every instruction bundle below, which the manager can then
// hand-tune tab by tab. "Clean Slate" applies no defaults.
export type TacticalStyleId =
  | "tiki-taka" | "vertical-tiki-taka" | "control-possession" | "gegenpress"
  | "wing-play" | "clean-slate" | "route-one" | "fluid-counter-attack"
  | "direct-counter-attack" | "catenaccio" | "park-the-bus";

export interface TacticSetup {
  id: ID; name: string;
  tacticalStyleId: TacticalStyleId;
  mentality: MentalityLevel;
  inPossession: PhaseShape & { instructions: InPossessionInstructions };
  outOfPossession: PhaseShape & { instructions: DefensiveInstructions };
  attack: AttackInstructions;
  transition: TransitionInstructions;
  setPieces: SetPieceRoutines;
  playerRoles: Record<ID, PlayerRoleAssignment>; // playerId -> role identity in this tactic
  familiarity: number; // 0-100, grows with use, decays with disuse/injury changes
}

export interface SetPieceRoutines {
  cornersAttacking: SetPieceRoutine;
  freeKicksAttacking: SetPieceRoutine;
  throwInsAttacking: SetPieceRoutine;
  cornersDefending: "zonal" | "man-marking" | "mixed";
}

export interface SetPieceRoutine {
  designatedTakerId: ID | null;
  targetPlayerIds: ID[]; // aerial targets in the box
  routine: "near-post" | "far-post" | "short-corner" | "edge-of-box" | "direct-shot";
}
