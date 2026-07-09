// ============================================================================
// World engine — the "everything else in the world keeps moving" system:
// weekly briefing generation, season-end progression, rivalries, takeovers,
// long-term records and achievements. AI clubs' transfer/tactical decisions
// are orchestrated from here by delegating to the transfer/tactics engines
// per-club, so the user's own club isn't special-cased in the simulation.
// ============================================================================
import type { InboxItem, SaveGameWorld, RivalryRecord } from "@/domain/types";
import { nanoid } from "nanoid";

// Builds the Monday-morning inbox digest: form, injuries, upcoming fixture,
// board mood, and any pending decisions. This is intentionally a pure
// "read the world, write one inbox item" function — richer narrative
// generation (media-engine driven storylines) is layered in separately via
// engines/media/mediaEngine.ts so this stays readable.
export function runWeeklyBriefing(world: SaveGameWorld): void {
  const club = world.clubs[world.userClubId];
  if (!club) return;

  const upcoming = Object.values(world.fixtures)
    .filter(
      (f) =>
        f.status === "scheduled" &&
        (f.homeClubId === club.id || f.awayClubId === club.id) &&
        f.kickoff >= world.currentDate
    )
    .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1))[0];

  const injuredCount = club.squadIds.filter((id) => world.players[id]?.injuryStatus).length;
  const lowMoraleCount = club.squadIds.filter((id) => (world.players[id]?.morale ?? 100) < 40).length;

  const lines: string[] = [];
  lines.push(`Board confidence stands at ${club.boardConfidence}/100.`);
  lines.push(`Fan sentiment is ${club.fanSentiment.overall}/100 and ${club.fanSentiment.recentTrend}.`);
  if (upcoming) {
    const opponentId = upcoming.homeClubId === club.id ? upcoming.awayClubId : upcoming.homeClubId;
    const opponent = world.clubs[opponentId];
    lines.push(`Next up: ${opponent?.name ?? "TBC"} on ${upcoming.kickoff.slice(0, 10)}.`);
  }
  if (injuredCount > 0) lines.push(`${injuredCount} player(s) currently unavailable through injury.`);
  if (lowMoraleCount > 0) lines.push(`${lowMoraleCount} player(s) showing low morale — worth a squad chat.`);

  const item: InboxItem = {
    id: nanoid(10),
    category: "briefing",
    subject: `Weekly briefing — ${world.currentDate}`,
    body: lines.join(" "),
    date: world.currentDate,
    read: false,
    archived: false,
    priority: "normal",
    actions: [
      { id: "goto-squad", label: "Review squad", kind: "navigate", target: "/squad" },
      { id: "goto-tactics", label: "Set tactics", kind: "navigate", target: "/matchday" },
      { id: "ack", label: "Acknowledge", kind: "acknowledge" },
    ],
  };
  world.inboxItems[item.id] = item;
}

// Season rollover: standings finalisation, promotion/relegation, contract
// expiries, youth intake trigger, board expectation reset for next season.
// This is the single largest "TODO surface" in the scaffold — the shape is
// deliberately explicit so each step can be implemented independently.
export function progressSeasonEnd(world: SaveGameWorld): void {
  for (const league of Object.values(world.leagues)) {
    // 1. Compute final table from completed fixtures (see standings helper
    //    to be added in this file once fixture generation is implemented).
    // 2. Apply promotion/relegation per league.promotionSlots/relegationSlots.
    // 3. Emit inbox items + achievements for milestones (titles, promotions,
    //    relegations, individual records).
    void league;
  }
  for (const club of Object.values(world.clubs)) {
    // Contract expiries -> free agency; loan returns; renew-or-release
    // decisions surfaced to inbox for AI clubs (auto-resolved) and to the
    // user's club (requires a decision).
    void club;
  }
  // Youth intake for every club with youthFacilities above a threshold.
  // Board mood reset based on season target vs. actual finish.
}

// Rivalry intensity grows from derby fixtures, controversial incidents
// (media stories tagged with both clubs), and proximity. Call after each
// completed fixture between two clubs.
export function bumpRivalry(world: SaveGameWorld, clubAId: string, clubBId: string, delta: number, note?: string): void {
  const key = [clubAId, clubBId].sort().join("::");
  let rivalry = world.rivalries[key];
  if (!rivalry) {
    rivalry = {
      clubAId,
      clubBId,
      intensity: 0,
      historyNotes: [],
      headToHead: { clubAWins: 0, clubBWins: 0, draws: 0 },
    };
    world.rivalries[key] = rivalry;
  }
  rivalry.intensity = Math.max(0, Math.min(100, rivalry.intensity + delta));
  if (note) rivalry.historyNotes.push(note);
}

// Ownership change: resets finance ceilings/investment cap, nudges culture
// and fan sentiment (takeovers are rarely neutral news).
export function applyTakeover(world: SaveGameWorld, clubId: string, newInvestmentCap: number): void {
  const club = world.clubs[clubId];
  if (!club) return;
  club.finance.ownerInvestmentCap = newInvestmentCap;
  club.finance.lastTakeoverDate = world.currentDate;
  club.fanSentiment.recentTrend = newInvestmentCap > club.finance.transferBudget ? "rising" : "stable";

  const item: InboxItem = {
    id: nanoid(10),
    category: "world-news",
    subject: `${club.name} completes ownership change`,
    body: `New investment ceiling reported at roughly ${newInvestmentCap.toLocaleString()}.`,
    date: world.currentDate,
    read: false,
    archived: false,
    priority: club.id === world.userClubId ? "high" : "low",
    actions: [{ id: "ack", label: "Acknowledge", kind: "acknowledge" }],
  };
  world.inboxItems[item.id] = item;
}
