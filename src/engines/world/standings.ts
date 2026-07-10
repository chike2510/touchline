// ============================================================================
// Computes a league table from completed fixtures. Pure function, no mutation
// — call it whenever you need a fresh table (Home dashboard, Club page) rather
// than persisting it, so it's always consistent with the fixture results.
// ============================================================================
import type { SaveGameWorld } from "@/domain/types";

export interface StandingsRow {
  clubId: string;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
  form: ("W" | "D" | "L")[]; // most recent first, capped at 5
}

export function computeStandings(world: SaveGameWorld, leagueId: string): StandingsRow[] {
  const league = world.leagues[leagueId];
  if (!league) return [];

  const rows = new Map<string, StandingsRow>();
  for (const clubId of league.clubIds) {
    rows.set(clubId, {
      clubId, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: [],
    });
  }

  const completed = Object.values(world.fixtures)
    .filter((f) => f.leagueId === leagueId && f.status === "completed" && f.result)
    .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1));

  for (const fixture of completed) {
    const result = fixture.result!;
    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);
    if (!home || !away) continue;

    home.played += 1; away.played += 1;
    home.goalsFor += result.homeGoals; home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals; away.goalsAgainst += result.homeGoals;

    if (result.homeGoals > result.awayGoals) {
      home.won += 1; home.points += 3; home.form.unshift("W");
      away.lost += 1; away.form.unshift("L");
    } else if (result.homeGoals < result.awayGoals) {
      away.won += 1; away.points += 3; away.form.unshift("W");
      home.lost += 1; home.form.unshift("L");
    } else {
      home.drawn += 1; home.points += 1; home.form.unshift("D");
      away.drawn += 1; away.points += 1; away.form.unshift("D");
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(0, 5);
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor
  );
}
