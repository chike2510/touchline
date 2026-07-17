// ============================================================================
// Bridges transient match-worker state (matchTypes.ts) back into persisted
// save data (domain/types.ts) once a match reaches "finished". Kept as its
// own module so matchEngine.ts stays focused on the tick simulation itself.
// ============================================================================
import type { Fixture, MatchResult, SaveGameWorld } from "@/domain/types";
import type { MatchState } from "./matchTypes";

export function buildMatchResultFromState(state: MatchState, fixture: Fixture, attendance: number): MatchResult {
  const scorers = state.events
    .filter((e) => e.type === "goal" && e.playerId)
    .map((e) => ({
      playerId: e.playerId!,
      clubId: e.clubId!,
      minute: e.minute,
      // The engine doesn't yet tag *which* open-play/set-piece path produced
      // each goal event distinctly enough to classify reliably here, so this
      // defaults to "open-play". Wiring a `source` field onto MatchEvent in
      // matchTypes.ts is the cleanest way to make this exact.
      type: "open-play" as const,
    }));

  const cards = state.events
    .filter((e) => (e.type === "yellow-card" || e.type === "red-card" || e.type === "second-yellow") && e.playerId)
    .map((e) => ({
      playerId: e.playerId!,
      clubId: e.clubId!,
      minute: e.minute,
      type: (e.type === "yellow-card" ? "yellow" : e.type === "red-card" ? "red" : "second-yellow") as
        | "yellow"
        | "red"
        | "second-yellow",
    }));

  const playerRatings: Record<string, number> = {};
  let motmPlayerId: string | null = null;
  let bestRating = -Infinity;
  for (const ps of Object.values(state.playerStates)) {
    playerRatings[ps.playerId] = Math.round(ps.rating * 10) / 10;
    if (ps.rating > bestRating) {
      bestRating = ps.rating;
      motmPlayerId = ps.playerId;
    }
  }

  const totalTicks = state.possessionHomeTicks + state.possessionAwayTicks;
  const possessionHome = totalTicks > 0 ? Math.round((state.possessionHomeTicks / totalTicks) * 100) : 50;

  return {
    homeGoals: state.homeGoals,
    awayGoals: state.awayGoals,
    homeXg: Math.round(state.homeXg * 100) / 100,
    awayXg: Math.round(state.awayXg * 100) / 100,
    scorers,
    cards,
    motmPlayerId,
    playerRatings,
    possessionHome,
    attendance,
    stats: {
      shotsHome: state.shotsHome, shotsAway: state.shotsAway,
      shotsOnTargetHome: state.shotsOnTargetHome, shotsOnTargetAway: state.shotsOnTargetAway,
      cornersHome: state.cornersHome, cornersAway: state.cornersAway,
      foulsHome: state.foulsHome, foulsAway: state.foulsAway,
      expectedThreatHome: Math.round(state.homeXt * 100) / 100,
      expectedThreatAway: Math.round(state.awayXt * 100) / 100,
      passAccuracyHome: state.passesHome > 0 ? Math.round((state.passesCompletedHome / state.passesHome) * 100) : 0,
      passAccuracyAway: state.passesAway > 0 ? Math.round((state.passesCompletedAway / state.passesAway) * 100) : 0,
    },
  };
}

// Writes the match's effect on every involved player back into the
// persisted world: fatigue carries over, form nudges toward the match
// rating, and season-long counting stats increment. Call once, right after
// buildMatchResultFromState, before advancing the calendar phase.
export function applyMatchStateToPlayers(world: SaveGameWorld, state: MatchState): void {
  for (const ps of Object.values(state.playerStates)) {
    const player = world.players[ps.playerId];
    if (!player) continue;

    player.fatigue = Math.max(0, Math.min(100, ps.fatigue));
    player.seasonStats.appearances += 1;
    if (ps.minutesPlayed >= 60) player.seasonStats.starts += 1;
    player.seasonStats.minutesPlayed += ps.minutesPlayed;
    player.seasonStats.goals += ps.goals;
    player.seasonStats.assists += ps.assists;
    player.seasonStats.yellowCards += ps.yellowCards;
    player.seasonStats.redCards += ps.redCards;
    player.seasonStats.shots += ps.shots;
    player.seasonStats.shotsOnTarget += ps.shotsOnTarget;

    const priorApps = player.seasonStats.appearances;
    player.seasonStats.averageRating =
      (player.seasonStats.averageRating * (priorApps - 1) + ps.rating) / priorApps;

    // Form drifts toward how they played tonight, clamped to the -5..+5 range.
    const ratingDelta = ps.rating - 6.5; // 6.5 treated as a "solid average" baseline
    player.form = Math.max(-5, Math.min(5, player.form + ratingDelta * 0.4));
  }
}
