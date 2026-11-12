import { describe, it, expect } from "vitest";
import { createStarterWorld } from "@/engines/world/newSave";
import { progressSeasonEnd } from "@/engines/world/worldEngine";
import { computeStandings } from "@/engines/world/standings";
import { migrateSaveWorld } from "@/engines/persistence/migrateSaveWorld";
import { renewPlayerContract, releasePlayer, applyContractDecision, suggestedRenewal, releaseUnresolvedExpiries } from "@/engines/contracts/contractEngine";
import { ensureManagerProfiles, rotationSquad } from "@/engines/ai/managerProfiles";
import { buildClubTacticForMatch } from "@/engines/tactics/aiTactics";
import { activeXI, sentOffIds, canSubstituteOff } from "./sentOff";
import { initMatchState, computeTeamStrength } from "@/engines/match/matchEngine";
import type { SaveGameWorld } from "@/domain/types";

const mk = () => createStarterWorld({ managerFirstName: "A", managerLastName: "B", managerNationality: "ENG", userClubId: "club-birmingham", startDate: "2026-08-08" } as never);
const finishSeason = (w: SaveGameWorld) => { for (const f of Object.values(w.fixtures)) if (f.status === "scheduled") { f.status = "completed"; f.result = { homeGoals: 1, awayGoals: 0 } as never; } };

describe("promotion and relegation", () => {
  it("moves clubs between tiers, keeps sizes, archives the old membership", () => {
    const w = mk(); w.currentDate = "2027-06-01";
    const pl = w.leagues["premier-league"]!; const ch = w.leagues["efl-championship"]!;
    const plSize = pl.clubIds.length, chSize = ch.clubIds.length;
    const fmtPl = JSON.stringify(pl.format.type), fmtCh = JSON.stringify(ch.format.type);
    finishSeason(w);
    const tables = { pl: computeStandings(w, pl.id), ch: computeStandings(w, ch.id) };
    const down = tables.pl.slice(-3).map((r) => r.clubId); const up = tables.ch.slice(0, 3).map((r) => r.clubId);
    progressSeasonEnd(w);
    expect(w.leagues["premier-league"]!.clubIds).toHaveLength(plSize);
    expect(w.leagues["efl-championship"]!.clubIds).toHaveLength(chSize);
    for (const id of down) { expect(w.leagues["efl-championship"]!.clubIds).toContain(id); expect(w.clubs[id]!.leagueId).toBe("efl-championship"); }
    for (const id of up) { expect(w.leagues["premier-league"]!.clubIds).toContain(id); expect(w.clubs[id]!.leagueId).toBe("premier-league"); }
    expect(new Set([...w.leagues["premier-league"]!.clubIds, ...w.leagues["efl-championship"]!.clubIds]).size).toBe(plSize + chSize);
    expect(w.leagues["premier-league"]!.format.matchdaysTotal).toBe((plSize - 1) * 2);
    expect(JSON.stringify(w.leagues["premier-league"]!.format.type)).toBe(fmtPl);
    expect(JSON.stringify(w.leagues["efl-championship"]!.format.type)).toBe(fmtCh);
    const arch = w.seasonArchive!.find((a) => a.leagueId === "premier-league" && a.season === 1)!;
    expect(arch.table.map((r) => r.clubId).sort()).toEqual(tables.pl.map((r) => r.clubId).sort()); // old membership preserved
    expect(arch.appliedRelegatedClubIds).toEqual(down);
    // next season fixtures use NEW membership
    const s2 = Object.values(w.fixtures).filter((f) => f.leagueId === "premier-league" && f.season === 2);
    expect(s2.length).toBeGreaterThan(0);
    for (const f of s2) { expect(w.leagues["premier-league"]!.clubIds).toContain(f.homeClubId); expect(w.leagues["premier-league"]!.clubIds).toContain(f.awayClubId); }
    // idempotent
    const snap = JSON.stringify(w.leagues); progressSeasonEnd(w); expect(JSON.stringify(w.leagues)).toBe(snap);
  });
  it("does not roll over while another league is unfinished", () => {
    const w = mk(); const pl = w.leagues["premier-league"]!;
    for (const f of Object.values(w.fixtures)) if (f.leagueId === pl.id) { f.status = "completed"; f.result = { homeGoals: 1, awayGoals: 0 } as never; }
    progressSeasonEnd(w); expect(w.seasonNumber ?? 1).toBe(1); expect(w.seasonArchive ?? []).toHaveLength(0);
  });
  it("old saves without applied* fields still load", () => {
    const w = mk(); const m = migrateSaveWorld(JSON.parse(JSON.stringify(w))); expect(m.leagues["premier-league"]).toBeTruthy();
  });
});

describe("user contract flow", () => {
  const setup = () => { const w = mk(); w.currentDate = "2027-06-01"; const id = w.clubs[w.userClubId]!.squadIds[0]!; w.players[id]!.contract!.expiryDate = "2027-05-01"; return { w, id }; };
  it("renews with a new expiry and rejects lowball offers", () => {
    const { w, id } = setup(); const ask = suggestedRenewal(w, id)!;
    expect(renewPlayerContract(w, id, { years: 3, wageWeekly: Math.round(ask.wageWeekly * 0.5) })).toEqual({ ok: false, reason: "player-rejected" });
    expect(renewPlayerContract(w, id, { years: 3, wageWeekly: ask.wageWeekly }).ok).toBe(true);
    expect(w.players[id]!.contract!.expiryDate > "2030-05-01").toBe(true);
  });
  it("refuses renewals that blow the wage budget", () => {
    const { w, id } = setup(); w.clubs[w.userClubId]!.finance.wageBudgetWeekly = 1;
    expect(renewPlayerContract(w, id, { years: 2, wageWeekly: w.players[id]!.contract!.wageWeekly * 3 })).toEqual({ ok: false, reason: "wage-budget-exceeded" });
  });
  it("release removes the player from the squad as a free agent", () => {
    const { w, id } = setup();
    expect(applyContractDecision(w, { contractAction: "release", playerId: id })!.ok).toBe(true);
    expect(w.clubs[w.userClubId]!.squadIds).not.toContain(id);
    expect(w.players[id]!.clubId).toBeNull(); expect(w.players[id]!.contract).toBeNull();
    expect(releasePlayer(w, id).ok).toBe(false);
  });
  it("auto-releases unresolved expiries after 30 days", () => {
    const { w, id } = setup(); w.currentDate = "2027-05-10"; expect(releaseUnresolvedExpiries(w)).toEqual([]);
    w.currentDate = "2027-06-05"; w.players[id]!.contract!.expiryDate = "2027-04-01"; expect(releaseUnresolvedExpiries(w)).toEqual([id]);
  });
});

describe("AI profile rotation", () => {
  it("rests tired players deterministically, only selection changes, never below a full squad", () => {
    const w = mk(); ensureManagerProfiles(w);
    const club = Object.values(w.clubs).find((c) => c.id !== w.userClubId)!;
    const base = buildClubTacticForMatch(w, club); const xi = Object.keys(base.playerRoles);
    const m = w.managers[club.managerId!]!; m.aiProfile!.rotationPolicy = 100;
    for (const id of xi.slice(1)) w.players[id]!.fatigue = 95;
    const sel = rotationSquad(w, club.id, club.squadIds);
    expect(sel.length).toBeGreaterThanOrEqual(16);
    const rested = buildClubTacticForMatch(w, club); expect(Object.keys(rested.playerRoles)).not.toEqual(xi);
    expect(Object.keys(buildClubTacticForMatch(w, club).playerRoles)).toEqual(Object.keys(rested.playerRoles));
    m.aiProfile!.rotationPolicy = 0; for (const id of xi) w.players[id]!.fatigue = 70;
    expect(rotationSquad(w, club.id, club.squadIds)).toEqual(club.squadIds); // low policy keeps the best XI
  });
  it("never rotates the user's club", () => { const w = mk(); const c = w.clubs[w.userClubId]!; for (const id of c.squadIds) w.players[id]!.fatigue = 99; expect(rotationSquad(w, c.id, c.squadIds)).toEqual(c.squadIds); });
});

describe("sent-off players", () => {
  it("are excluded from the active XI, from subs-off and from team strength", () => {
    const w = mk(); const ids = Object.values(w.clubs).slice(0, 2);
    const mkSetup = (c: typeof ids[number]) => { const t = buildClubTacticForMatch(w, c); return { clubId: c.id, tactic: t, startingXI: Object.keys(t.playerRoles), bench: c.squadIds.filter((i) => !(i in t.playerRoles)).slice(0, 9), substitutesUsed: 0, maxSubstitutions: 5 }; };
    const home = mkSetup(ids[0]!), away = mkSetup(ids[1]!);
    const state = initMatchState(home, away, {} as never, 7, w.players);
    const off = home.startingXI[4]!; state.playerStates[off]!.onPitch = false; state.playerStates[off]!.redCards = 1;
    expect(sentOffIds(state, home.clubId)).toEqual([off]);
    expect(activeXI(state, home)).toHaveLength(10); expect(activeXI(state, home)).not.toContain(off);
    expect(canSubstituteOff(state, home, off)).toBe(false);
    expect(activeXI(state, away)).toHaveLength(11);
    const full = computeTeamStrength(home, w.players, 60, 60); const ten = computeTeamStrength(home, w.players, 60, 60, state.playerStates);
    expect(JSON.stringify(ten)).not.toBe(JSON.stringify(full));
  });
});
