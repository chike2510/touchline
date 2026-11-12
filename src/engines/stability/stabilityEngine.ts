// Stabilisation: injuries, suspensions, daily recovery. Pure, deterministic, idempotent per day.
import type { InjuryStatus, Player, SaveGameWorld } from "@/domain/types";
import type { MatchState } from "@/engines/match/matchTypes";

export const YELLOW_LIMIT = 5;

export function currentSeason(world: SaveGameWorld): number { return world.seasonNumber ?? 1; }

export function isAvailable(p: Player, competitionId: string | null = null): boolean {
  if (p.injuryStatus && p.injuryStatus.daysRemaining > 0) return false;
  const s = p.suspension;
  if (s && s.matchesRemaining > 0 && (!s.competitionId || s.competitionId === competitionId)) return false;
  return true;
}

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h >>> 0; }

export function createInjury(p: Player, date: string, seed: string): InjuryStatus {
  const r = (hash(seed + p.id) % 1000) / 1000;
  const prone = p.attributes.physical.injuryProneness / 20;
  const x = Math.min(1, r * 0.8 + prone * 0.2);
  const severity: InjuryStatus["severity"] = x < 0.6 ? "minor" : x < 0.9 ? "moderate" : "severe";
  const days = severity === "minor" ? 3 + Math.floor(r * 12) : severity === "moderate" ? 18 + Math.floor(r * 30) : 60 + Math.floor(r * 120);
  const injuryType = severity === "minor" ? "Knock" : severity === "moderate" ? "Muscle strain" : "Ligament damage";
  return { description: injuryType, injuryType, daysRemaining: days, initialDays: days, severity, recurring: false, injuredOn: date };
}

// Persist match consequences: injuries, suspensions, serving bans. Call once per played fixture.
export function applyMatchDiscipline(world: SaveGameWorld, state: MatchState, competitionId: string | null = null): void {
  const played = new Set(Object.values(state.playerStates).filter((s) => s.minutesPlayed > 0 || s.onPitch).map((s) => s.playerId));
  // 1. serve existing bans: club's banned players who sat this match out
  for (const clubId of [state.home.clubId, state.away.clubId]) {
    const club = world.clubs[clubId]; if (!club) continue;
    for (const id of club.squadIds) {
      const p = world.players[id];
      const s = p?.suspension;
      if (!p || !s || s.matchesRemaining <= 0) continue;
      if (s.competitionId && s.competitionId !== competitionId) continue;
      if (played.has(id)) continue;
      s.matchesRemaining -= 1;
      if (s.matchesRemaining <= 0) p.suspension = null;
    }
  }
  // 2. new events
  for (const e of state.events) {
    const p = e.playerId ? world.players[e.playerId] : undefined;
    if (!p) continue;
    if (e.type === "injury" && !p.injuryStatus) {
      p.injuryStatus = createInjury(p, world.currentDate, `${state.rngSeed}:${e.minute}`);
    } else if (e.type === "red-card" || e.type === "second-yellow") {
      const ban = e.type === "red-card" ? 3 : 1;
      p.suspension = { reason: "red-card", matchesRemaining: (p.suspension?.matchesRemaining ?? 0) + ban, competitionId, issuedOn: world.currentDate };
    }
  }
  // 3. yellow accumulation (season-long count already incremented by caller before this runs is NOT assumed)
  for (const ps of Object.values(state.playerStates)) {
    const p = world.players[ps.playerId];
    if (!p || p.suspension) continue;
    if (ps.yellowCards > 0 && p.seasonStats.yellowCards > 0 && p.seasonStats.yellowCards % YELLOW_LIMIT === 0) {
      p.suspension = { reason: "yellow-accumulation", matchesRemaining: 1, competitionId, issuedOn: world.currentDate };
    }
  }
}

// Once per calendar day. Idempotent via world.lastDailyProcessed.
export function processDailyRecovery(world: SaveGameWorld, date: string, playedToday: Set<string> = new Set()): boolean {
  if (world.lastDailyProcessed && world.lastDailyProcessed >= date) return false;
  world.lastDailyProcessed = date;
  for (const p of Object.values(world.players)) {
    if (!p.clubId) continue;
    const nf = p.attributes.physical.naturalFitness / 20;
    const club = world.clubs[p.clubId];
    const medical = club ? Math.min(1, club.facilities.medicalFacilities / 20) : 0.3;
    if (!playedToday.has(p.id)) {
      const rec = 4 + nf * 4 + medical * 2; // 4..10 per rest day
      p.fatigue = Math.max(0, p.fatigue - rec);
      p.sharpness = Math.max(0, Math.min(100, p.sharpness - 0.3));
    }
    const inj = p.injuryStatus;
    if (inj) {
      inj.daysRemaining -= medical > 0.6 ? 2 : 1 + (nf > 0.7 ? 0.25 : 0) ;
      if (inj.daysRemaining <= 0) p.injuryStatus = null;
    }
  }
  return true;
}
