import { describe, expect, it } from "vitest";
import { runAiTransferMarket } from "@/engines/transfers/transferEngine";
import type { SaveGameWorld } from "@/domain/types";

function marketWorld(): SaveGameWorld {
  const finance = (balance: number, transferBudget: number, wageBudgetWeekly: number) => ({
    balance, transferBudget, wageBudgetWeekly, wageBudgetUsedWeekly: 0,
    sponsorships: [], broadcastIncomeSeasonal: 0, matchdayIncomeSeasonal: 0,
    debt: 0, ownerInvestmentCap: null, lastTakeoverDate: null,
  });
  const manager = (id: string, clubId: string) => ({
    id, firstName: "AI", lastName: id, nationality: "ENG", clubId,
    isUserControlled: false, reputation: 80,
    tacticalTendencies: { preferredFormation: "4-3-3", mentality: "balanced", pressingIntensity: 50, buildUpSpeed: 50, defensiveLine: 50, width: 50, favoursYouth: 50, transferAggression: 50, adaptability: 50 },
    contract: null, history: [],
    aiProfile: { version: 1, ambition: 75, patience: 50, riskTolerance: 50, rotationPolicy: 50, youthTrust: 50, squadSizeTarget: 24 },
  });
  const player = {
    id: "target", firstName: "Alex", lastName: "Player", nationality: "ENG", dateOfBirth: "2001-01-01",
    currentAbility: 70, potentialAbility: 80, form: 0, morale: 70, fatigue: 10, sharpness: 80,
    injuryStatus: null, suspension: null, clubId: "seller", nationalTeamId: null,
    contract: { playerId: "target", clubId: "seller", wageWeekly: 1000, startDate: "2024-01-01", expiryDate: "2028-01-01" },
    careerHistory: [], seasonStats: { appearances: 10, starts: 8, goals: 2, assists: 1, minutesPlayed: 700, yellowCards: 0, redCards: 0, averageRating: 6.8, cleanSheets: 0, motmAwards: 0, shots: 8, shotsOnTarget: 3 },
  };
  const sellerIds = ["target", ...Array.from({ length: 17 }, (_, i) => "seller-player-" + i)];
  const buyerIds = Array.from({ length: 15 }, (_, i) => "buyer-player-" + i);
  return {
    seed: "market-seed", currentDate: "2026-06-15", userClubId: "user", userManagerId: "user-manager",
    managers: { "buyer-manager": manager("buyer-manager", "buyer"), "seller-manager": manager("seller-manager", "seller") },
    clubs: {
      user: { id: "user", name: "User", isUserControlled: true, squadIds: [], finance: finance(1e6, 1e6, 100000), managerId: null },
      buyer: { id: "buyer", name: "Buyer FC", isUserControlled: false, squadIds: buyerIds, finance: finance(30e6, 20e6, 1e6), managerId: "buyer-manager", reputation: 110 },
      seller: { id: "seller", name: "Seller FC", isUserControlled: false, squadIds: sellerIds, finance: finance(5e6, 5e6, 500000), managerId: "seller-manager", reputation: 70 },
    },
    players: { target: player }, transferListings: {}, transferOffers: {},
  } as unknown as SaveGameWorld;
}

describe("autonomous AI transfer market", () => {
  it("completes a deterministic AI-to-AI signing without involving the user's club", () => {
    const world = marketWorld();
    const completed = runAiTransferMarket(world, 1);
    expect(completed).toEqual(["target"]);
    expect(world.players.target?.clubId).toBe("buyer");
    expect(world.clubs.seller?.squadIds).not.toContain("target");
    expect(world.clubs.buyer?.squadIds).toContain("target");
    expect(world.clubs.buyer?.finance.transferBudget).toBeLessThan(20e6);
    expect(Object.values(world.transferOffers).some((offer) => offer.playerId === "target" && offer.status === "completed")).toBe(true);
    expect(world.clubs.user?.squadIds).not.toContain("target");
  });

  it("does nothing outside transfer windows", () => {
    const world = marketWorld();
    world.currentDate = "2026-03-15";
    expect(runAiTransferMarket(world)).toEqual([]);
    expect(world.players.target?.clubId).toBe("seller");
  });
});
