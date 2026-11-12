import { describe, expect, it } from "vitest";
import { progressSeasonEnd } from "@/engines/world/worldEngine";
import type { SaveGameWorld } from "@/domain/types";

function finishedSeasonWorld(): SaveGameWorld {
  const manager = {
    id: "ai-manager", firstName: "Old", lastName: "Boss", nationality: "ENG", clubId: "ai",
    isUserControlled: false, reputation: 80,
    tacticalTendencies: {
      preferredFormation: "4-3-3", mentality: "balanced", pressingIntensity: 50,
      buildUpSpeed: 50, defensiveLine: 50, width: 50, favoursYouth: 40,
      transferAggression: 50, adaptability: 50,
    },
    contract: { wageWeekly: 5000, expiryDate: "2028-06-01" }, history: [],
    aiProfile: { version: 1, ambition: 50, patience: 0, riskTolerance: 50, rotationPolicy: 50, youthTrust: 50, squadSizeTarget: 24 },
  };
  return {
    seed: "season-test", currentDate: "2026-06-01", seasonNumber: 1, lastRolloverSeason: 1,
    userClubId: "u", userManagerId: "user-manager", managers: { "ai-manager": manager },
    clubs: {
      u: { id: "u", name: "User FC", shortName: "User", reputation: 80, leagueId: "l", squadIds: [], isUserControlled: true, managerId: "user-manager", boardConfidence: 60 },
      ai: { id: "ai", name: "AI FC", shortName: "AI", reputation: 80, leagueId: "l", squadIds: [], isUserControlled: false, managerId: "ai-manager", boardConfidence: 10 },
    },
    leagues: { l: { id: "l", name: "Test League", countryCode: "ENG", tier: 1, clubIds: ["u", "ai"], format: { type: "round-robin-double", matchdaysTotal: 2 }, reputation: 80, promotionSlots: 0, relegationSlots: 0, continentalQualification: [] } },
    fixtures: {
      f1: {
        id: "f1", leagueId: "l", competitionId: null, homeClubId: "u", awayClubId: "ai",
        kickoff: "2026-05-20T15:00:00.000Z", round: "Round 1", venueNeutral: false, weather: "clear",
        refereeId: "fallback", status: "completed", season: 1,
        result: { homeGoals: 2, awayGoals: 0, homeXg: 1.2, awayXg: 0.3, scorers: [], cards: [], motmPlayerId: null, playerRatings: {}, possessionHome: 55, attendance: 1000, stats: { shotsHome: 5, shotsAway: 2, shotsOnTargetHome: 3, shotsOnTargetAway: 1, cornersHome: 2, cornersAway: 1, foulsHome: 4, foulsAway: 5, expectedThreatHome: 0.4, expectedThreatAway: 0.1, passAccuracyHome: 85, passAccuracyAway: 78 } },
      },
    },
    referees: {}, players: {}, staff: {}, competitions: {}, rivalries: {}, achievements: {},
    transferListings: {}, transferOffers: {}, scoutingReports: {}, inboxItems: {}, mediaStories: {},
    calendar: {}, activeTactic: {} as never, savedTactics: [],
    seasonArchive: [],
  } as unknown as SaveGameWorld;
}

describe("season-end manager succession", () => {
  it("archives the completed season, generates the next campaign, and replaces an under-pressure AI manager once", () => {
    const world = finishedSeasonWorld();
    progressSeasonEnd(world);
    expect(world.seasonNumber).toBe(2);
    expect(world.seasonArchive).toHaveLength(1);
    expect(Object.values(world.fixtures).some((fixture) => fixture.season === 2 && fixture.status === "scheduled")).toBe(true);
    expect(world.clubs.ai?.managerId).not.toBe("ai-manager");
    expect(world.managers["ai-manager"]?.clubId).toBeNull();
    expect(world.managers[world.clubs.ai!.managerId!]?.clubId).toBe("ai");

    const replacementId = world.clubs.ai!.managerId;
    progressSeasonEnd(world);
    expect(world.clubs.ai?.managerId).toBe(replacementId);
    expect(world.seasonArchive).toHaveLength(1);
  });
});
