import { describe, it, expect } from "vitest";
import { profileMentality, sellerPriceFactor, squadNeed, shouldSackManager, buildAiProfile, runAiManagerChanges } from "./managerProfiles";
import { renewPlayerContract, releasePlayer, applyContractDecision } from "@/engines/contracts/contractEngine";
import type { SaveGameWorld } from "@/domain/types";

const prof = (o: Partial<NonNullable<SaveGameWorld["managers"][string]["aiProfile"]>>) => ({ ...buildAiProfile("s", { id: "m", reputation: 100, tacticalTendencies: undefined as never }), ...o });

function mk(): SaveGameWorld {
  const player = (id: string, wage: number, expiry: string) => ({ id, firstName: "A", lastName: id, dateOfBirth: "2000-01-01", currentAbility: 100, clubId: "u", contract: { playerId: id, clubId: "u", wageWeekly: wage, startDate: "2025-01-01", expiryDate: expiry } });
  return {
    seed: "s", currentDate: "2026-06-01", userClubId: "u", inboxItems: {}, shortlistedPlayerIds: [],
    players: { p1: player("p1", 1000, "2026-05-01"), p2: player("p2", 1000, "2027-06-01") },
    staff: {}, managers: { m1: { id: "m1", isUserControlled: false, clubId: "c", aiProfile: prof({ patience: 0 }), tacticalTendencies: {} } },
    clubs: { u: { id: "u", squadIds: ["p1", "p2"], staffIds: [], finance: { balance: 1e6, transferBudget: 1e6, wageBudgetWeekly: 100000 }, boardConfidence: 50 },
      c: { id: "c", managerId: "m1", squadIds: Array.from({ length: 30 }, (_, i) => "x" + i), staffIds: [], boardConfidence: 10, finance: { transferBudget: 100 } } },
  } as unknown as SaveGameWorld;
}

describe("AI profile decisions", () => {
  it("mentality shifts with ambition/risk", () => {
    expect(profileMentality("balanced", prof({ ambition: 90, riskTolerance: 90 }))).toBe("attacking");
    expect(profileMentality("balanced", prof({ ambition: 10, riskTolerance: 10 }))).toBe("defensive");
    expect(profileMentality("very-attacking", prof({ ambition: 90, riskTolerance: 90 }))).toBe("very-attacking");
  });
  it("patient sellers ask more", () => {
    expect(sellerPriceFactor(prof({ patience: 100, riskTolerance: 50 }))).toBeGreaterThan(sellerPriceFactor(prof({ patience: 0, riskTolerance: 50 })));
  });
  it("squad need and sacking", () => {
    const w = mk();
    expect(squadNeed(w, "c")).toBe("sell");
    expect(shouldSackManager(w, "c")).toBe(true);
    expect(shouldSackManager(w, "u")).toBe(false);
    w.clubs.c!.boardConfidence = 60; expect(shouldSackManager(w, "c")).toBe(false);
  });
  it("sacks and replaces an AI manager once at season end with a valid career record", () => {
    const w = mk();
    w.clubs.c!.name = "Club C";
    w.clubs.c!.reputation = 90;
    w.managers.m1!.reputation = 80;
    w.managers.m1!.tacticalTendencies = {
      preferredFormation: "4-3-3", mentality: "balanced", pressingIntensity: 50,
      buildUpSpeed: 50, defensiveLine: 50, width: 50, favoursYouth: 40,
      transferAggression: 45, adaptability: 50,
    };
    const oldManagerId = w.clubs.c!.managerId;
    expect(runAiManagerChanges(w, 1)).toEqual(["c"]);
    const replacementId = w.clubs.c!.managerId!;
    expect(replacementId).not.toBe(oldManagerId);
    expect(w.managers[replacementId]!.clubId).toBe("c");
    expect(w.managers[replacementId]!.firstName).not.toBe("Interim");
    expect(w.managers[replacementId]!.aiProfile).toBeDefined();
    expect(w.managers[oldManagerId!]!.clubId).toBeNull();
    expect(w.managers[oldManagerId!]!.history?.[0]).toMatchObject({ clubId: "c", clubName: "Club C", to: "2026-06-01" });
    expect(runAiManagerChanges(w, 1)).toEqual([]);
  });
});

describe("contracts", () => {
  it("rejects low offer with reason, accepts fair one, saves roundtrip", () => {
    const w = mk();
    expect(renewPlayerContract(w, "p1", { years: 2, wageWeekly: 10 })).toEqual({ ok: false, reason: "player-rejected" });
    expect(renewPlayerContract(w, "p1", { years: 2, wageWeekly: 1500 }).ok).toBe(true);
    const copy = JSON.parse(JSON.stringify(w)) as SaveGameWorld;
    expect(copy.players.p1!.contract!.expiryDate > "2026-06-01").toBe(true);
  });
  it("release charges compensation only for unexpired deals", () => {
    const w = mk();
    expect(releasePlayer(w, "p1")).toEqual({ ok: true, compensation: 0 });
    const r = applyContractDecision(w, { contractAction: "release", playerId: "p2" });
    expect(r && r.ok && r.compensation).toBeGreaterThan(0);
    expect(w.clubs.u!.squadIds).toEqual([]);
    expect(w.clubs.u!.finance.balance).toBeLessThan(1e6);
  });
});
