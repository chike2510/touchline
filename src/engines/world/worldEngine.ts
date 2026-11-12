// ============================================================================
// World engine — the "everything else in the world keeps moving" system:
// weekly briefing generation, season-end progression, rivalries, takeovers,
// long-term records and achievements. AI clubs' transfer/tactical decisions
// are orchestrated from here by delegating to the transfer/tactics engines
// per-club, so the user's own club isn't special-cased in the simulation.
// ============================================================================
import type { InboxItem, SaveGameWorld, RivalryRecord, Fixture } from "@/domain/types";
import { nanoid } from "nanoid";
import { computeStandings } from "@/engines/world/standings";
import { generateRoundRobinFixtures, nextSaturday, WEATHER_POOL } from "@/engines/world/newSave";

// Builds the Monday-morning inbox digest: form, injuries, upcoming fixture,
// board mood, and any pending decisions. This is intentionally a pure
// "read the world, write one inbox item" function — richer narrative
// generation (media-engine driven storylines) is layered in separately via
// engines/media/mediaEngine.ts so this stays readable.
export function runWeeklyBriefing(world: SaveGameWorld): void {
  const club = world.clubs[world.userClubId];
  if (!club) return;

  const upcoming = Object.values(world.fixtures)
    .filter(
      (f) =>
        f.status === "scheduled" &&
        (f.homeClubId === club.id || f.awayClubId === club.id) &&
        f.kickoff >= world.currentDate
    )
    .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1))[0];

  const injuredCount = club.squadIds.filter((id) => world.players[id]?.injuryStatus).length;
  const lowMoraleCount = club.squadIds.filter((id) => (world.players[id]?.morale ?? 100) < 40).length;

  const lines: string[] = [];
  lines.push(`Board confidence stands at ${club.boardConfidence}/100.`);
  lines.push(`Fan sentiment is ${club.fanSentiment.overall}/100 and ${club.fanSentiment.recentTrend}.`);
  if (upcoming) {
    const opponentId = upcoming.homeClubId === club.id ? upcoming.awayClubId : upcoming.homeClubId;
    const opponent = world.clubs[opponentId];
    lines.push(`Next up: ${opponent?.name ?? "TBC"} on ${upcoming.kickoff.slice(0, 10)}.`);
  }
  if (injuredCount > 0) lines.push(`${injuredCount} player(s) currently unavailable through injury.`);
  if (lowMoraleCount > 0) lines.push(`${lowMoraleCount} player(s) showing low morale — worth a squad chat.`);

  const item: InboxItem = {
    id: nanoid(10),
    category: "briefing",
    subject: `Weekly briefing — ${world.currentDate}`,
    body: lines.join(" "),
    date: world.currentDate,
    read: false,
    archived: false,
    priority: "normal",
    actions: [
      { id: "goto-squad", label: "Review squad", kind: "navigate", target: "/squad" },
      { id: "goto-tactics", label: "Set tactics", kind: "navigate", target: "/matchday" },
      { id: "ack", label: "Acknowledge", kind: "acknowledge" },
    ],
  };
  world.inboxItems[item.id] = item;
}

// Season rollover: finalises the table, reports it to the user, resets
// season-long counting stats, and — critically — generates a fresh fixture
// list for the next season. Without this last step the calendar has nothing
// left to advance toward once a season's fixtures are exhausted, which is
// why matches previously stopped appearing after the first season.
//
// Triggering condition: a league has fixtures on record but none left with
// status "scheduled". That's self-guarding — once this function generates
// a new batch of "scheduled" fixtures, the condition is false again until
// *that* season is also fully played out, so it's safe to call this every
// time the calendar advances a day.
//
// Promotion/relegation between divisions and contract-expiry handling are
// still open — see the README's "documented stub" list — but the core loop
// (finish season -> see final table -> play a new season) now works.
export function progressSeasonEnd(world: SaveGameWorld): void {
  let advanced = false;
  for (const league of Object.values(world.leagues)) {
    const season = world.seasonNumber ?? 1;
    const leagueFixtures = Object.values(world.fixtures).filter((f) => f.leagueId === league.id && (f.season ?? 1) === season);
    if (leagueFixtures.length === 0) continue; // league has no fixtures at all yet — nothing to roll over
    const stillToPlay = leagueFixtures.some((f) => f.status === "scheduled");
    if (stillToPlay) continue; // season still in progress

    const standings = computeStandings(world, league.id);
    (world.seasonArchive ??= []).push({ season, leagueId: league.id, championClubId: standings[0]?.clubId ?? null,
      table: standings.map((r) => ({ clubId: r.clubId, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points })) });
    reportSeasonEnd(world, league.id, standings);
    resetSeasonStats(world, league.clubIds);
    generateNextSeasonFixtures(world, league.id, league.clubIds, leagueFixtures, season + 1);
    advanced = true;
  }
  if (advanced) world.seasonNumber = (world.seasonNumber ?? 1) + 1;

  for (const club of Object.values(world.clubs)) {
    // Contract expiries -> free agency; loan returns; renew-or-release
    // decisions surfaced to inbox for AI clubs (auto-resolved) and to the
    // user's club (requires a decision).
    void club;
  }
  // Youth intake for every club with youthFacilities above a threshold.
  // Board mood reset based on season target vs. actual finish.
}

function reportSeasonEnd(world: SaveGameWorld, leagueId: string, standings: ReturnType<typeof computeStandings>): void {
  const league = world.leagues[leagueId];
  if (!league) return;
  const userRank = standings.findIndex((r) => r.clubId === world.userClubId) + 1;
  const isUserLeague = userRank > 0;
  const champion = world.clubs[standings[0]?.clubId ?? ""];

  const lines: string[] = [];
  lines.push(`${champion?.name ?? "The champions"} are crowned ${league.name} winners.`);
  if (isUserLeague) {
    const row = standings[userRank - 1]!;
    lines.push(`You finished ${userRank}${ordinal(userRank)} with ${row.points} points (${row.won}W ${row.drawn}D ${row.lost}L).`);
  }
  lines.push(`A new season's fixtures have been published.`);

  const item: InboxItem = {
    id: nanoid(10),
    category: "world-news",
    subject: `${league.name} season review`,
    body: lines.join(" "),
    date: world.currentDate,
    read: false,
    archived: false,
    priority: isUserLeague ? "high" : "low",
    actions: [{ id: "ack", label: "Acknowledge", kind: "acknowledge" }],
  };
  world.inboxItems[item.id] = item;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}

function resetSeasonStats(world: SaveGameWorld, clubIds: string[]): void {
  for (const clubId of clubIds) {
    const club = world.clubs[clubId];
    if (!club) continue;
    for (const playerId of club.squadIds) {
      const player = world.players[playerId];
      if (!player) continue;
      player.seasonStats = {
        appearances: 0, starts: 0, goals: 0, assists: 0, minutesPlayed: 0,
        yellowCards: 0, redCards: 0, averageRating: 0, cleanSheets: 0, motmAwards: 0, shots: 0, shotsOnTarget: 0,
      };
      player.suspension = null; // card counts don't carry across seasons
    }
  }
}

function generateNextSeasonFixtures(
  world: SaveGameWorld, leagueId: string, clubIds: string[], previousFixtures: Fixture[], season: number
): void {
  const lastKickoff = previousFixtures.reduce((max, f) => (f.kickoff > max ? f.kickoff : max), previousFixtures[0]!.kickoff);
  // ~10 week close season (end of one campaign to the following August-ish
  // kickoff), then snap to the next Saturday for a realistic opening day.
  const closeSeasonEnd = addDays(lastKickoff.slice(0, 10), 70);
  const newSeasonStart = nextSaturday(closeSeasonEnd);

  const refereeIds = Object.keys(world.referees);
  const rawFixtures = generateRoundRobinFixtures(clubIds, newSeasonStart);
  rawFixtures.forEach((f, i) => {
    const id = nanoid(10);
    world.fixtures[id] = {
      id, leagueId, competitionId: null,
      homeClubId: f.homeClubId, awayClubId: f.awayClubId, kickoff: f.kickoff, round: f.round,
      venueNeutral: false, weather: WEATHER_POOL[i % WEATHER_POOL.length]!,
      refereeId: refereeIds.length > 0 ? refereeIds[i % refereeIds.length]! : "fallback",
      status: "scheduled", result: null, season,
    };
  });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Rivalry intensity grows from derby fixtures, controversial incidents
// (media stories tagged with both clubs), and proximity. Call after each
// completed fixture between two clubs.
export function bumpRivalry(world: SaveGameWorld, clubAId: string, clubBId: string, delta: number, note?: string): void {
  const key = [clubAId, clubBId].sort().join("::");
  let rivalry = world.rivalries[key];
  if (!rivalry) {
    rivalry = {
      clubAId,
      clubBId,
      intensity: 0,
      historyNotes: [],
      headToHead: { clubAWins: 0, clubBWins: 0, draws: 0 },
    };
    world.rivalries[key] = rivalry;
  }
  rivalry.intensity = Math.max(0, Math.min(100, rivalry.intensity + delta));
  if (note) rivalry.historyNotes.push(note);
}

// Ownership change: resets finance ceilings/investment cap, nudges culture
// and fan sentiment (takeovers are rarely neutral news).
export function applyTakeover(world: SaveGameWorld, clubId: string, newInvestmentCap: number): void {
  const club = world.clubs[clubId];
  if (!club) return;
  club.finance.ownerInvestmentCap = newInvestmentCap;
  club.finance.lastTakeoverDate = world.currentDate;
  club.fanSentiment.recentTrend = newInvestmentCap > club.finance.transferBudget ? "rising" : "stable";

  const item: InboxItem = {
    id: nanoid(10),
    category: "world-news",
    subject: `${club.name} completes ownership change`,
    body: `New investment ceiling reported at roughly ${newInvestmentCap.toLocaleString()}.`,
    date: world.currentDate,
    read: false,
    archived: false,
    priority: club.id === world.userClubId ? "high" : "low",
    actions: [{ id: "ack", label: "Acknowledge", kind: "acknowledge" }],
  };
  world.inboxItems[item.id] = item;
}
