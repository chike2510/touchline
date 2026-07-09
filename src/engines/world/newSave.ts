// ============================================================================
// New-save bootstrap — turns the editable league JSON (src/data/leagues) into
// a fully-populated SaveGameWorld: clubs get full squads (procedurally
// generated unless the JSON specifies real players — see data/README.md),
// a referee pool, a double round-robin fixture list, and an initialised
// calendar starting from the chosen start date.
// ============================================================================
import { nanoid } from "nanoid";
import type {
  Club, Fixture, League, Manager, Player, Referee, SaveGameWorld, TacticSetup, WeatherCondition,
} from "@/domain/types";
import { generateProceduralPlayer } from "@/engines/youth/generator";
import premierLeague from "@/data/leagues/premier-league.json";
import eflChampionship from "@/data/leagues/efl-championship.json";

// Partial mirrors of the full engine types — every field is optional except
// the handful needed to make a coherent player/manager, since data/README.md
// promises "anything you omit gets a sensible generated default".
interface LeagueJsonPlayer {
  firstName: string; lastName: string; commonName?: string; nationality: string;
  dateOfBirth?: string; height_cm?: number; weight_kg?: number;
  foot?: "left" | "right" | "both";
  positions: Player["positions"];
  currentAbility: number; potentialAbility?: number;
  attributes?: Player["attributes"];
  personality?: Player["personality"];
  traits?: Player["traits"];
}
interface LeagueJsonManager {
  firstName: string; lastName: string; nationality: string;
  reputation?: number;
  tacticalTendencies: {
    preferredFormation: string; mentality: string;
    pressingIntensity?: number; buildUpSpeed?: number; defensiveLine?: number;
    width?: number; favoursYouth?: number; transferAggression?: number; adaptability?: number;
  };
}
interface LeagueJsonClub {
  id: string; name: string; shortName: string; abbreviation: string; founded: number;
  colors: { primary: string; secondary: string };
  stadium: { name: string; capacity: number };
  manager: LeagueJsonManager;
  players?: LeagueJsonPlayer[];
}
interface LeagueJson {
  id: string; name: string; countryCode: string; tier: number; clubs: LeagueJsonClub[];
}

// All editable "real world" leagues that feed a new save — see data/README.md.
// Add more entries here (and drop a matching file in src/data/leagues/) to
// bring in further divisions; every league gets its own round-robin fixture
// list, and the new-game club picker (listStarterClubs) spans all of them.
const LEAGUE_FILES: LeagueJson[] = [premierLeague as LeagueJson, eflChampionship as LeagueJson];

const WEATHER_POOL: WeatherCondition[] = ["clear", "overcast", "rain", "windy", "cold"];
const SQUAD_POSITIONS = ["GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST", "ST", "CB", "CM", "GK"] as const;

function defaultTactic(formation: string, mentality: string): TacticSetup {
  return {
    id: nanoid(8), name: "Starting XI", formation,
    mentality: (mentality as TacticSetup["mentality"]) ?? "balanced",
    inPossession: { tempo: 55, passingDirectness: 50, width: 55, playThroughBias: "balanced", buildUpFromBack: true },
    outOfPossession: { pressingIntensity: 55, defensiveLine: 50, marking: "zonal", tacklingAggression: 50, offsideTrap: false },
    transitions: { counterPressIntensity: 55, counterAttackSpeed: 55 },
    setPieces: {
      cornersAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "far-post" },
      freeKicksAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "edge-of-box" },
      throwInsAttacking: { designatedTakerId: null, targetPlayerIds: [], routine: "short-corner" },
      cornersDefending: "zonal",
    },
    playerRoles: {},
    familiarity: 30,
  };
}

// Fills every engine-managed field a JSON seed player doesn't (and can't)
// specify — form/morale/fatigue/contract/etc. start at neutral career-start
// values, same as a freshly generated regen. Attributes/personality/traits
// are only defaulted (borrowing the procedural generator's tables) when the
// JSON omits them, per data/README.md's "sensible generated default" promise.
function playerFromJson(json: LeagueJsonPlayer, seed: string, asOfDate: string): Player {
  const fallback = generateProceduralPlayer({
    seed, nationality: json.nationality, minAge: 18, maxAge: 33,
    targetCurrentAbility: json.currentAbility, potentialCeilingBias: 0.3,
    asOfDate, isYouthProduct: false,
  });
  const dob = json.dateOfBirth ?? fallback.dateOfBirth;
  const positionFamiliarity: Player["positionFamiliarity"] = {};
  json.positions.forEach((p, i) => { positionFamiliarity[p] = i === 0 ? 20 : 14; });

  return {
    ...fallback,
    firstName: json.firstName, lastName: json.lastName, commonName: json.commonName,
    nationality: json.nationality, dateOfBirth: dob,
    height_cm: json.height_cm ?? fallback.height_cm, weight_kg: json.weight_kg ?? fallback.weight_kg,
    foot: json.foot ?? fallback.foot,
    positions: json.positions, positionFamiliarity,
    attributes: json.attributes ?? fallback.attributes,
    personality: json.personality ?? fallback.personality,
    traits: json.traits ?? fallback.traits,
    currentAbility: json.currentAbility,
    potentialAbility: json.potentialAbility ?? Math.max(json.currentAbility, fallback.potentialAbility),
    isRegen: false,
    faceSeed: seed,
  };
}

function buildSquad(seedPrefix: string, nationality: string, asOfDate: string, clubStrength: number, jsonPlayers?: LeagueJsonPlayer[]): Player[] {
  const real = (jsonPlayers ?? []).map((p, i) => playerFromJson(p, `${seedPrefix}::real::${i}`, asOfDate));
  // Fill the rest of the squad procedurally around whatever real players were
  // supplied (e.g. just a captain) so every club still fields a full 18-man
  // squad even when the seed JSON only names a handful of real personnel.
  // Drop as many template slots as we already have real players for.
  const remainingSlots = SQUAD_POSITIONS.slice(Math.min(real.length, SQUAD_POSITIONS.length));

  const generated = remainingSlots.map((pos, i) => {
    const player = generateProceduralPlayer({
      seed: `${seedPrefix}::${i}`,
      nationality,
      minAge: 18, maxAge: 33,
      targetCurrentAbility: clubStrength + (Math.random() * 20 - 10),
      potentialCeilingBias: 0.3,
      asOfDate,
      isYouthProduct: false,
    });
    player.positions = [pos as Player["positions"][number]];
    player.positionFamiliarity = { [pos]: 20 } as Player["positionFamiliarity"];
    return player;
  });

  return [...real, ...generated];
}

function generateRoundRobinFixtures(clubIds: string[], startDate: string): { homeClubId: string; awayClubId: string; kickoff: string; round: string }[] {
  const ids = [...clubIds];
  if (ids.length % 2 !== 0) ids.push("BYE");
  const rounds = ids.length - 1;
  const half = ids.length / 2;
  const fixtures: { homeClubId: string; awayClubId: string; kickoff: string; round: string }[] = [];
  let current = [...ids];
  const start = new Date(startDate + "T15:00:00Z");

  for (let leg = 0; leg < 2; leg++) {
    let roundStart = new Date(start);
    roundStart.setUTCDate(roundStart.getUTCDate() + leg * rounds * 7);
    let working = [...ids];
    for (let r = 0; r < rounds; r++) {
      const kickoff = new Date(roundStart);
      kickoff.setUTCDate(kickoff.getUTCDate() + r * 7);
      for (let i = 0; i < half; i++) {
        const a = working[i]!;
        const b = working[working.length - 1 - i]!;
        if (a === "BYE" || b === "BYE") continue;
        const [home, away] = leg === 0 ? [a, b] : [b, a];
        fixtures.push({ homeClubId: home, awayClubId: away, kickoff: kickoff.toISOString(), round: `Round ${leg * rounds + r + 1}` });
      }
      // rotate all but the first element
      working = [working[0]!, working[working.length - 1]!, ...working.slice(1, working.length - 1)];
    }
  }
  void current;
  return fixtures;
}

export interface NewSaveParams {
  managerFirstName: string;
  managerLastName: string;
  managerNationality: string;
  userClubId: string; // must match a club id in the league JSON
  startDate: string; // ISO date, e.g. "2026-08-08"
}

export function createStarterWorld(params: NewSaveParams): SaveGameWorld {
  const seed = nanoid(16);

  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};
  const managers: Record<string, Manager> = {};
  const referees: Record<string, Referee> = {};
  const leagues: Record<string, League> = {};
  const fixtures: Record<string, Fixture> = {};

  const refNations = ["ENG", "ESP", "ITA", "FRA"];
  for (let i = 0; i < 4; i++) {
    const id = nanoid(8);
    referees[id] = {
      id, firstName: `Referee`, lastName: `${i + 1}`, nationality: refNations[i % refNations.length]!,
      strictness: 40 + Math.random() * 40, advantagePlay: 40 + Math.random() * 40,
      homeBias: Math.random() * 6 - 3, consistency: 50 + Math.random() * 40,
    };
  }
  const refereeIds = Object.keys(referees);

  for (const leagueData of LEAGUE_FILES) {
    for (const clubJson of leagueData.clubs) {
      const clubStrength = clubJson.manager.reputation ?? 70 + Math.random() * 60; // club-quality anchor
      const squad = buildSquad(`${seed}::${clubJson.id}`, leagueData.countryCode, params.startDate, clubStrength, clubJson.players);
      for (const p of squad) {
        p.clubId = clubJson.id;
        p.contract = {
          playerId: p.id, clubId: clubJson.id, wageWeekly: Math.round(500 + clubStrength * 40),
          startDate: params.startDate, expiryDate: addYears(params.startDate, 2 + Math.floor(Math.random() * 3)),
        };
        players[p.id] = p;
      }

      const managerId = nanoid(10);
      managers[managerId] = {
        id: managerId,
        firstName: clubJson.manager.firstName, lastName: clubJson.manager.lastName,
        nationality: clubJson.manager.nationality,
        clubId: clubJson.id === params.userClubId ? null : clubJson.id,
        isUserControlled: false,
        reputation: clubJson.manager.reputation ?? 60 + Math.random() * 40,
        tacticalTendencies: {
          preferredFormation: clubJson.manager.tacticalTendencies.preferredFormation,
          mentality: (clubJson.manager.tacticalTendencies.mentality as Manager["tacticalTendencies"]["mentality"]) ?? "balanced",
          pressingIntensity: clubJson.manager.tacticalTendencies.pressingIntensity ?? 40 + Math.random() * 40,
          buildUpSpeed: clubJson.manager.tacticalTendencies.buildUpSpeed ?? 40 + Math.random() * 40,
          defensiveLine: clubJson.manager.tacticalTendencies.defensiveLine ?? 40 + Math.random() * 40,
          width: clubJson.manager.tacticalTendencies.width ?? 40 + Math.random() * 40,
          favoursYouth: clubJson.manager.tacticalTendencies.favoursYouth ?? Math.random() * 60,
          transferAggression: clubJson.manager.tacticalTendencies.transferAggression ?? Math.random() * 60,
          adaptability: clubJson.manager.tacticalTendencies.adaptability ?? 30 + Math.random() * 50,
        },
        contract: { wageWeekly: 8000, expiryDate: addYears(params.startDate, 3) },
        history: [],
      };

      clubs[clubJson.id] = {
        id: clubJson.id, name: clubJson.name, shortName: clubJson.shortName, abbreviation: clubJson.abbreviation,
        countryCode: leagueData.countryCode, leagueId: leagueData.id, founded: clubJson.founded,
        colors: clubJson.colors,
        stadium: { name: clubJson.stadium.name, capacity: clubJson.stadium.capacity, avgAttendance: Math.round(clubJson.stadium.capacity * 0.75), pitchQuality: 70, atmosphere: 60 },
        facilities: { trainingFacilities: 10, youthFacilities: 8, medicalFacilities: 9, dataAnalysis: 7, youthRecruitment: 8, stadiumFacilities: 10 },
        finance: {
          balance: 5_000_000, transferBudget: 3_000_000, wageBudgetWeekly: 250_000, wageBudgetUsedWeekly: 0,
          sponsorships: [{ name: "Local sponsor", type: "shirt", incomeWeekly: 40_000, expiryDate: addYears(params.startDate, 3) }],
          broadcastIncomeSeasonal: 8_000_000, matchdayIncomeSeasonal: 4_000_000, debt: 0, ownerInvestmentCap: null, lastTakeoverDate: null,
        },
        squadIds: squad.map((p) => p.id),
        youthSquadIds: [],
        staffIds: [],
        managerId: clubJson.id === params.userClubId ? null : managerId,
        boardConfidence: 65,
        fanSentiment: { overall: 60, boardTrust: 60, ticketDemand: 60, recentTrend: "stable", protestRisk: 10 },
        culture: { playingPhilosophy: "balanced", youthEmphasis: 40, transferPolicy: "sustainable", identityTags: [] },
        reputation: Math.round(clubStrength),
        rivalIds: [],
        trophyCabinet: [],
        isUserControlled: clubJson.id === params.userClubId,
      };
    }

    const clubIds = leagueData.clubs.map((c) => c.id);
    const rawFixtures = generateRoundRobinFixtures(clubIds, nextSaturday(params.startDate));
    rawFixtures.forEach((f, i) => {
      const id = nanoid(10);
      fixtures[id] = {
        id, leagueId: leagueData.id, competitionId: null,
        homeClubId: f.homeClubId, awayClubId: f.awayClubId, kickoff: f.kickoff, round: f.round,
        venueNeutral: false, weather: WEATHER_POOL[i % WEATHER_POOL.length]!,
        refereeId: refereeIds[i % refereeIds.length]!, status: "scheduled", result: null,
      };
    });

    leagues[leagueData.id] = {
      id: leagueData.id, name: leagueData.name, countryCode: leagueData.countryCode, tier: leagueData.tier,
      clubIds, format: { type: "round-robin-double", matchdaysTotal: (clubIds.length - 1) * 2 },
      reputation: leagueData.tier === 1 ? 90 : 60,
      promotionSlots: leagueData.tier === 1 ? 0 : 3,
      relegationSlots: 3,
      continentalQualification: [],
    };
  }

  const userManagerId = nanoid(10);
  managers[userManagerId] = {
    id: userManagerId, firstName: params.managerFirstName, lastName: params.managerLastName,
    nationality: params.managerNationality, clubId: params.userClubId, isUserControlled: true,
    reputation: 40,
    tacticalTendencies: {
      preferredFormation: "4-3-3", mentality: "balanced", pressingIntensity: 50, buildUpSpeed: 50,
      defensiveLine: 50, width: 50, favoursYouth: 50, transferAggression: 50, adaptability: 50,
    },
    contract: { wageWeekly: 6000, expiryDate: addYears(params.startDate, 2) },
    history: [],
  };
  clubs[params.userClubId]!.managerId = userManagerId;

  const defaultUserTactic = defaultTactic("4-3-3", "balanced");
  const userSquad = clubs[params.userClubId]!.squadIds;
  userSquad.slice(0, 11).forEach((id, i) => {
    const p = players[id]!;
    defaultUserTactic.playerRoles[id] = { positionCode: p.positions[0]!, role: "Default", duty: "support" };
    void i;
  });

  const world: SaveGameWorld = {
    saveId: "", // filled in by saveManager.createNewSave
    currentDate: params.startDate,
    seed,
    managers, clubs, players, staff: {},
    leagues,
    competitions: {},
    referees, fixtures,
    rivalries: {}, achievements: {}, transferListings: {}, transferOffers: {}, scoutingReports: {},
    inboxItems: {}, mediaStories: {},
    userClubId: params.userClubId, userManagerId,
    calendar: {},
    activeTactic: defaultUserTactic,
    savedTactics: [defaultUserTactic],
  };
  return world;
}

function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function nextSaturday(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay();
  const delta = (6 - day + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function listStarterClubs(): { id: string; name: string; leagueName: string }[] {
  return LEAGUE_FILES.flatMap((leagueData) =>
    leagueData.clubs.map((c) => ({ id: c.id, name: c.name, leagueName: leagueData.name })),
  );
}
