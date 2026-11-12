// ============================================================================
// Instant fixture simulation — this is what was completely missing before:
// there was no mechanism anywhere to resolve a fixture that didn't involve
// the user's club, so every other team in the league sat at 0 games played
// forever while the user's own record kept climbing in a vacuum (which is
// also why the table only ever showed one real competitor).
//
// Reuses the exact same match engine as the user's live matches (same xG
// math, same weighted scorer/assist picks) rather than a separate simplified
// model, so results stay internally consistent — just run synchronously to
// full time in one call instead of interactively in a worker, since there's
// no one watching an AI-vs-AI match live.
// ============================================================================
import type { Club, Fixture, MatchResult, SaveGameWorld } from "@/domain/types";
import { buildClubTacticForMatch } from "@/engines/tactics/aiTactics";
import { computeSquadChemistry } from "@/engines/personality/personalityEngine";
import { initMatchState, simulateToMinute } from "@/engines/match/matchEngine";
import { buildMatchResultFromState, applyMatchStateToPlayers } from "@/engines/match/matchResult";
import { sanitizeLineup } from "@/engines/stability/lineupGuard";
import { applyMatchDiscipline } from "@/engines/stability/stabilityEngine";
import type { TeamMatchSetup } from "@/engines/match/matchTypes";

function buildTeamSetup(world: SaveGameWorld, club: Club, competitionId: string | null = null): TeamMatchSetup {
  const san = sanitizeLineup(world, club.id, buildClubTacticForMatch(world, club), competitionId);
  return {
    clubId: club.id, tactic: san.tactic, startingXI: san.startingXI,
    bench: san.bench,
    substitutesUsed: 0, maxSubstitutions: 5,
  };
}

export function simulateFixtureInstantly(world: SaveGameWorld, fixture: Fixture): MatchResult | null {
  const homeClub = world.clubs[fixture.homeClubId];
  const awayClub = world.clubs[fixture.awayClubId];
  if (!homeClub || !awayClub) return null;

  const home = buildTeamSetup(world, homeClub, fixture.competitionId);
  const away = buildTeamSetup(world, awayClub, fixture.competitionId);
  const referee = world.referees[fixture.refereeId] ?? Object.values(world.referees)[0];
  if (!referee) return null;

  const context = {
    fixtureId: fixture.id, weather: fixture.weather, referee,
    isNeutralVenue: fixture.venueNeutral, homeAdvantageStrength: homeClub.stadium.atmosphere / 100,
  };
  const chemistry = {
    [home.clubId]: computeSquadChemistry(world, home.clubId),
    [away.clubId]: computeSquadChemistry(world, away.clubId),
  };
  const familiarity = {
    [home.clubId]: home.tactic.familiarity,
    [away.clubId]: away.tactic.familiarity,
  };

  // Deterministic per-fixture seed so re-simulating the same save is stable.
  let seed = 0;
  for (let i = 0; i < fixture.id.length; i++) seed = (Math.imul(31, seed) + fixture.id.charCodeAt(i)) | 0;

  const state = initMatchState(home, away, context, seed >>> 0, world.players);
  simulateToMinute(state, 90, world.players, chemistry, familiarity);

  const attendance = Math.round(homeClub.stadium.avgAttendance * (0.75 + Math.random() * 0.2));
  const result = buildMatchResultFromState(state, fixture, attendance);
  applyMatchStateToPlayers(world, state);
  applyMatchDiscipline(world, state, fixture.competitionId);
  return result;
}

// Resolves every fixture kicking off on `date` that does NOT involve the
// user's club — the user's own matches still go through the interactive
// matchday screen. Safe to call once per calendar day; anything already
// completed or not yet at its kickoff date is skipped automatically.
export function simulateOtherFixturesForDate(world: SaveGameWorld, date: string): void {
  const todaysFixtures = Object.values(world.fixtures).filter(
    (f) =>
      f.status === "scheduled" &&
      f.kickoff.slice(0, 10) === date &&
      f.homeClubId !== world.userClubId &&
      f.awayClubId !== world.userClubId
  );

  for (const fixture of todaysFixtures) {
    const result = simulateFixtureInstantly(world, fixture);
    if (!result) continue;
    fixture.status = "completed";
    fixture.result = result;
  }
}
