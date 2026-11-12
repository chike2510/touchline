import { describe, it, expect } from "vitest";
import { createStarterWorld } from "@/engines/world/newSave";
import { processDailyRecovery, isAvailable, createInjury } from "./stabilityEngine";
import { computeStandings } from "@/engines/world/standings";
import { progressSeasonEnd } from "@/engines/world/worldEngine";

function mk() {
  const leagueFile = null; void leagueFile;
  const w = createStarterWorld({ managerFirstName: "A", managerLastName: "B", managerNationality: "ENG", userClubId: "club-birmingham", startDate: "2026-08-08" } as never);
  return w;
}
describe("stability", () => {
  it("recovers fatigue once per day only", () => {
    const w = mk(); const p = Object.values(w.players).find((x) => x.clubId)!; p.fatigue = 80;
    expect(processDailyRecovery(w, "2026-08-09")).toBe(true);
    const after = p.fatigue; expect(after).toBeLessThan(80);
    expect(processDailyRecovery(w, "2026-08-09")).toBe(false);
    expect(p.fatigue).toBe(after);
  });
  it("injuries persist, block availability and heal", () => {
    const w = mk(); const p = Object.values(w.players).find((x) => x.clubId)!;
    p.injuryStatus = createInjury(p, "2026-08-08", "s"); expect(p.injuryStatus.injuredOn).toBe("2026-08-08");
    expect(isAvailable(p)).toBe(false);
    for (let d = 1; d <= 200; d++) processDailyRecovery(w, `2027-01-${String(d).padStart(3, "0")}`);
    expect(p.injuryStatus).toBeNull();
  });
  it("suspension is competition specific", () => {
    const w = mk(); const p = Object.values(w.players)[0]!;
    p.suspension = { reason: "red-card", matchesRemaining: 2, competitionId: "cup" };
    expect(isAvailable(p, "cup")).toBe(false); expect(isAvailable(p, "league")).toBe(true);
  });
  it("season rollover archives and isolates standings", () => {
    const w = mk(); const lg = Object.values(w.leagues)[0]!;
    for (const f of Object.values(w.fixtures)) if (f.leagueId === lg.id) { f.status = "completed"; f.result = { homeGoals: 1, awayGoals: 0 } as never; }
    progressSeasonEnd(w);
    expect(w.seasonNumber).toBe(2); expect(w.seasonArchive!.length).toBeGreaterThan(0);
    expect(computeStandings(w, lg.id).every((r) => r.played === 0)).toBe(true);
  });
});
import { applyTrainingDay } from "@/engines/staff/staffEngine";
import { pickAutoLineup } from "@/engines/tactics/aiTactics";
describe("part 2", () => {
  it("lineup excludes injured and suspended", () => {
    const w = mk(); const club = w.clubs["club-birmingham"]!;
    const a = w.players[club.squadIds[0]!]!, b = w.players[club.squadIds[1]!]!;
    a.injuryStatus = createInjury(a, "2026-08-08", "x");
    b.suspension = { reason: "red-card", matchesRemaining: 1 };
    const { startingXI } = pickAutoLineup(club.squadIds, w.players, "4-3-3");
    expect(startingXI).not.toContain(a.id); expect(startingXI).not.toContain(b.id);
  });
  it("training changes real attributes and training day runs once", () => {
    const w = mk(); const club = w.clubs["club-birmingham"]!;
    const p = w.players[club.squadIds[0]!]!; p.potentialAbility = 190; p.currentAbility = 60; p.fatigue = 0;
    p.dateOfBirth = "2008-01-01"; p.injuryStatus = null;
    const sum = () => Object.values(p.attributes.technical).reduce((x, y) => x + y, 0) + Object.values(p.attributes.mental).reduce((x, y) => x + y, 0);
    const before = sum();
    for (let i = 0; i < 400; i++) { applyTrainingDay(w); p.fatigue = 0; }
    expect(sum()).toBeGreaterThan(before);
    expect(p.currentAbility).toBeGreaterThan(60);
  });
});
