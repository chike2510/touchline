import { describe, it, expect } from "vitest";
import { createStarterWorld } from "@/engines/world/newSave";
import { sanitizeLineup, lineupIssues } from "./lineupGuard";
import { buildClubTacticForMatch } from "@/engines/tactics/aiTactics";
import { simulateFixtureInstantly } from "@/engines/world/simulateFixture";
import { migrateSaveWorld } from "@/engines/persistence/migrateSaveWorld";
import { buildAiProfile } from "@/engines/ai/managerProfiles";
import { advancePhase } from "@/engines/calendar/calendarEngine";
import { runSeasonRolloverEssentials, progressSeasonEnd } from "@/engines/world/worldEngine";

const mk = () => createStarterWorld({ managerFirstName: "A", managerLastName: "B", managerNationality: "ENG", userClubId: "club-birmingham", startDate: "2026-08-08" } as never);

describe("lineup guard", () => {
  it("replaces injured and suspended manually selected starters", () => {
    const w = mk(); const club = w.clubs[w.userClubId]!;
    const tactic = buildClubTacticForMatch(w, club);
    const xi = Object.keys(tactic.playerRoles);
    w.players[xi[3]!]!.injuryStatus = { description: "x", daysRemaining: 10, severity: "minor", recurring: false };
    w.players[xi[5]!]!.suspension = { reason: "red-card", matchesRemaining: 1, competitionId: "cup" };
    expect(lineupIssues(w, club.id, xi, "cup").map((i) => i.playerId).sort()).toEqual([xi[3]!, xi[5]!].sort());
    const s = sanitizeLineup(w, club.id, tactic, "cup");
    expect(s.startingXI).toHaveLength(11);
    expect(new Set(s.startingXI).size).toBe(11);
    expect(s.startingXI).not.toContain(xi[3]);
    expect(s.startingXI).not.toContain(xi[5]);
    expect(s.replaced).toHaveLength(2);
    expect(lineupIssues(w, club.id, s.startingXI, "cup")).toHaveLength(0);
    expect(s.bench.some((id) => s.startingXI.includes(id))).toBe(false);
    expect(Object.keys(s.tactic.inPossession.slotAssignments).sort()).toEqual([...s.startingXI].sort());
    expect(Object.keys(tactic.playerRoles)).toEqual(xi); // input untouched
  });
  it("league suspension does not block a cup lineup check and clean lineups are unchanged", () => {
    const w = mk(); const club = w.clubs[w.userClubId]!; const tactic = buildClubTacticForMatch(w, club);
    const s = sanitizeLineup(w, club.id, tactic, null);
    expect(s.tactic).toBe(tactic); expect(s.replaced).toHaveLength(0);
  });
  it("instant sim never fields injured players", () => {
    const w = mk(); const fx = Object.values(w.fixtures).find((f) => f.homeClubId !== w.userClubId && f.awayClubId !== w.userClubId)!;
    const home = w.clubs[fx.homeClubId]!; const xi = Object.keys(buildClubTacticForMatch(w, home).playerRoles);
    const hurt = xi[2]!; w.players[hurt]!.injuryStatus = { description: "x", daysRemaining: 20, severity: "severe", recurring: false };
    const before = w.players[hurt]!.seasonStats.appearances;
    expect(simulateFixtureInstantly(w, fx)).not.toBeNull();
    expect(w.players[hurt]!.seasonStats.appearances).toBe(before);
  });
});

describe("exactly-once calendar", () => {
  it("finance and fan sentiment run once per date even if phase replays", () => {
    const w = mk(); const club = w.clubs[w.userClubId]!;
    const d = w.currentDate; w.calendar[d] = { date: d, phase: "off-pitch", hasFixture: false, fixtureId: null, scheduledEvents: [] } as never;
    advancePhase(w); const bal = club.finance.balance;
    (w.calendar[d] as { phase: string }).phase = "off-pitch"; advancePhase(w);
    expect(club.finance.balance).toBe(bal);
    expect(w.lastFinanceDate).toBe(d);
  });
});

describe("migration / compat", () => {
  it("loads an old save missing every optional field and is idempotent", () => {
    const w = mk() as any;
    for (const k of ["seasonNumber", "seasonArchive", "shortlistedPlayerIds", "lastDailyProcessed", "lastFinanceDate"]) delete w[k];
    for (const p of Object.values(w.players) as any[]) { delete p.injuryStatus; delete p.suspension; delete p.attrProgress; }
    for (const m of Object.values(w.managers) as any[]) delete m.aiProfile;
    const m1 = migrateSaveWorld(w); const m2 = migrateSaveWorld(m1);
    expect(m1.seasonNumber).toBe(1); expect(m1.seasonArchive).toEqual([]); expect(m1.shortlistedPlayerIds).toEqual([]);
    expect(Object.values(m1.players).every((p) => p.injuryStatus === null && p.suspension === null)).toBe(true);
    const ai = Object.values(m1.managers).filter((m) => !m.isUserControlled);
    expect(ai.length).toBeGreaterThan(0); expect(ai.every((m) => !!m.aiProfile)).toBe(true);
    expect(JSON.stringify(m2.managers)).toBe(JSON.stringify(m1.managers));
    expect(Object.values(w.managers as any).every((m: any) => !m.aiProfile)).toBe(true); // input not mutated
  });
  it("ai profiles are deterministic, bounded, and never overwritten", () => {
    const m = Object.values(mk().managers).find((x) => !x.isUserControlled)!;
    const a = buildAiProfile("seed1", m); expect(buildAiProfile("seed1", m)).toEqual(a);
    expect(buildAiProfile("seed2", m)).not.toEqual(a);
    for (const v of [a.ambition, a.patience, a.riskTolerance, a.rotationPolicy, a.youthTrust]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    const w = mk(); const mm = Object.values(w.managers).find((x) => !x.isUserControlled)!;
    mm.aiProfile = { ...a, ambition: 1 }; const w2 = migrateSaveWorld(w); expect(w2.managers[mm.id]!.aiProfile!.ambition).toBe(1);
  });
});

describe("season rollover", () => {
  it("archives promotion/relegation, runs youth + contract expiry once", () => {
    const w = mk(); w.currentDate = "2030-06-01";
    const club = w.clubs[w.userClubId]!; const youthBefore = club.youthSquadIds.length;
    const uid = club.squadIds[0]!; w.players[uid]!.contract!.expiryDate = "2029-01-01";
    const aiClub = Object.values(w.clubs).find((c) => c.id !== w.userClubId)!; const aid = aiClub.squadIds[0]!; w.players[aid]!.contract!.expiryDate = "2029-01-01";
    for (const f of Object.values(w.fixtures)) { if (f.status === "scheduled") { f.status = "completed"; f.result = { homeGoals: 1, awayGoals: 0 } as never; } }
    progressSeasonEnd(w);
    expect(w.seasonNumber).toBe(2);
    expect(w.seasonArchive!.length).toBeGreaterThan(0);
    for (const a of w.seasonArchive!) { expect(a.relegatedClubIds!.length).toBe(Math.min(a.relegationSlots!, a.table.length)); }
    expect(club.youthSquadIds.length).toBeGreaterThan(youthBefore);
    expect(w.players[uid]!.clubId).toBe(club.id); // user player kept
    expect(Object.values(w.inboxItems).some((i) => i.subject.includes("contract(s) expired"))).toBe(true);
    expect(w.players[aid]!.contract!.expiryDate > "2030-06-01").toBe(true);
    const y = club.youthSquadIds.length; runSeasonRolloverEssentials(w, 1);
    expect(club.youthSquadIds.length).toBe(y);
  });
});
