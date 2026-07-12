// ============================================================================
// Calendar engine — owns the daily gameplay loop:
//   weekly-briefing -> tactics-training -> off-pitch -> matchday-build-up
//   -> matchday-live -> post-match -> calendar-advance -> (repeat)
//
// This module is pure logic (no IO). It mutates a SaveGameWorld copy and
// returns it, so it can run identically on the main thread or be unit tested.
// ============================================================================
import type { CalendarDay, GamePhase, SaveGameWorld, ScheduledEvent } from "@/domain/types";
import { runWeeklyBriefing, progressSeasonEnd } from "@/engines/world/worldEngine";
import { simulateOtherFixturesForDate } from "@/engines/world/simulateFixture";
import { applyTrainingDay } from "@/engines/staff/staffEngine";
import { tickFinanceDay } from "@/engines/finance/financeEngine";
import { tickFanSentimentDay } from "@/engines/fanSentiment/fanSentimentEngine";
import { tickFacilitiesDay } from "@/engines/facilities/facilitiesEngine";

const PHASE_ORDER: GamePhase[] = [
  "weekly-briefing",
  "tactics-training",
  "off-pitch",
  "matchday-build-up",
  "matchday-live",
  "post-match",
  "calendar-advance",
];

// hasFixture matters here: on a day with no match, the matchday-build-up /
// matchday-live / post-match phases must never be entered at all — walking
// through them anyway was the root cause of matches "looping" (the live
// view kept grabbing whatever fixture was still unresolved, on days that
// had nothing to do with that fixture, every time the cycle came back
// around to matchday-live).
export function nextPhase(current: GamePhase, hasFixture: boolean): GamePhase {
  if (current === "off-pitch" && !hasFixture) return "calendar-advance";
  const idx = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]!;
}

export function isMatchday(world: SaveGameWorld, date: string): boolean {
  return Object.values(world.fixtures).some(
    (f) => f.homeClubId === world.userClubId || f.awayClubId === world.userClubId
      ? f.kickoff.slice(0, 10) === date
      : false
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Ensures a CalendarDay entry exists for a date, creating a sensible default
// (skips straight to matchday phases automatically if a fixture exists).
export function ensureCalendarDay(world: SaveGameWorld, date: string): CalendarDay {
  const existing = world.calendar[date];
  if (existing) return existing;
  const hasFixture = isMatchday(world, date);
  const day: CalendarDay = {
    date,
    phase: hasFixture ? "matchday-build-up" : "weekly-briefing",
    hasFixture,
    fixtureId: hasFixture
      ? Object.values(world.fixtures).find(
          (f) => f.kickoff.slice(0, 10) === date &&
            (f.homeClubId === world.userClubId || f.awayClubId === world.userClubId)
        )?.id ?? null
      : null,
    scheduledEvents: [],
  };
  world.calendar[date] = day;
  return day;
}

// Advances one phase within the current day, or rolls over to the next
// calendar day once "calendar-advance" completes. Each phase applies its
// own side effects via the relevant engine (training wear, finance ticks,
// fan sentiment drift, etc.) so the calendar engine stays a thin conductor.
export function advancePhase(world: SaveGameWorld): SaveGameWorld {
  const today = ensureCalendarDay(world, world.currentDate);

  switch (today.phase) {
    case "weekly-briefing":
      runWeeklyBriefing(world);
      break;
    case "tactics-training":
      applyTrainingDay(world);
      break;
    case "off-pitch":
      tickFinanceDay(world);
      tickFacilitiesDay(world);
      break;
    case "matchday-build-up":
      // Build-up UI (team news, opposition report) reads world state directly;
      // no mutation needed here beyond marking the phase.
      break;
    case "matchday-live":
      // Actual simulation is dispatched to the match worker by the caller
      // (see hooks/useGameLoop.ts) because it's async and CPU-heavy. This
      // engine only advances the phase pointer; the worker result is merged
      // back into `world.fixtures`/`world.players` before this phase ends.
      break;
    case "post-match":
      tickFanSentimentDay(world);
      break;
    case "calendar-advance":
      world.currentDate = addDays(world.currentDate, 1);
      simulateOtherFixturesForDate(world, world.currentDate); // the rest of the league plays its fixtures too
      progressSeasonEnd(world); // no-op unless a league just ran out of fixtures
      ensureCalendarDay(world, world.currentDate);
      // Loop back to the start of the cycle for the new day.
      world.calendar[world.currentDate]!.phase = isMatchday(world, world.currentDate)
        ? "matchday-build-up"
        : "weekly-briefing";
      return world;
  }

  today.phase = nextPhase(today.phase, today.hasFixture);
  return world;
}

// Convenience for skipping non-matchday days quickly (e.g. a "sim to next
// match" button) — repeatedly advances phases until a matchday-live phase
// is reached or a fixed safety cap of days is hit.
export function advanceUntilNextMatchOrDecisionNeeded(
  world: SaveGameWorld,
  maxDays = 120
): { world: SaveGameWorld; stoppedReason: "matchday" | "decision-pending" | "max-days-reached" } {
  let daysAdvanced = 0;
  let lastDate = world.currentDate;
  while (daysAdvanced < maxDays) {
    const today = world.calendar[world.currentDate];
    if (today?.phase === "matchday-live") {
      return { world, stoppedReason: "matchday" };
    }
    const hasUrgentInbox = Object.values(world.inboxItems).some(
      (i) => !i.archived && i.priority === "urgent"
    );
    if (hasUrgentInbox) {
      return { world, stoppedReason: "decision-pending" };
    }
    advancePhase(world);
    if (world.currentDate !== lastDate) {
      daysAdvanced += 1;
      lastDate = world.currentDate;
    }
  }
  return { world, stoppedReason: "max-days-reached" };
}

export function addScheduledEvent(world: SaveGameWorld, event: ScheduledEvent): void {
  const day = ensureCalendarDay(world, event.date);
  day.scheduledEvents.push(event);
}
