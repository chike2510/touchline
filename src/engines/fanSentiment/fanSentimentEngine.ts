// ============================================================================
// Fan sentiment engine — a slow-moving mood tracker distinct from board
// confidence (which is about the manager specifically). Driven by recent
// results, league position vs. expectation, and media/transfer events that
// call bumpFanSentiment() directly.
// ============================================================================
import type { SaveGameWorld, MatchResult, Fixture } from "@/domain/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function bumpFanSentiment(world: SaveGameWorld, clubId: string, delta: number, reason?: string): void {
  const club = world.clubs[clubId];
  if (!club) return;
  const prev = club.fanSentiment.overall;
  club.fanSentiment.overall = clamp(prev + delta);
  club.fanSentiment.recentTrend = club.fanSentiment.overall > prev ? "rising" : club.fanSentiment.overall < prev ? "falling" : "stable";
  club.fanSentiment.protestRisk = clamp(club.fanSentiment.protestRisk + (delta < -5 ? 5 : -1));
  void reason; // surfaced via media stories / inbox, not stored on the record itself
}

// Called once after a fixture result is committed to world.fixtures.
export function applyMatchResultToFanSentiment(world: SaveGameWorld, fixture: Fixture, result: MatchResult): void {
  for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
    const club = world.clubs[clubId];
    if (!club) continue;
    const isHome = clubId === fixture.homeClubId;
    const goalsFor = isHome ? result.homeGoals : result.awayGoals;
    const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
    const outcome = goalsFor > goalsAgainst ? "win" : goalsFor < goalsAgainst ? "loss" : "draw";
    const rivalry = world.rivalries[[fixture.homeClubId, fixture.awayClubId].sort().join("::")];
    const rivalryMultiplier = rivalry ? 1 + rivalry.intensity / 100 : 1;

    const base = outcome === "win" ? 2 : outcome === "draw" ? -0.5 : -2;
    bumpFanSentiment(world, clubId, base * rivalryMultiplier, `${outcome} vs ${isHome ? fixture.awayClubId : fixture.homeClubId}`);
  }
}

// Slow daily drift toward a neutral baseline, and ticket demand responding
// to sentiment + recent home attendance trend.
export function tickFanSentimentDay(world: SaveGameWorld): void {
  for (const club of Object.values(world.clubs)) {
    const towardNeutral = (50 - club.fanSentiment.overall) * 0.01;
    club.fanSentiment.overall = clamp(club.fanSentiment.overall + towardNeutral);
    club.fanSentiment.ticketDemand = clamp(
      club.fanSentiment.ticketDemand + (club.fanSentiment.overall - 50) * 0.02
    );
  }
}
