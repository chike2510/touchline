"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatBar } from "@/components/ui/Badge";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { Play, Pause } from "lucide-react";
import { PitchViz } from "@/components/matchday/PitchViz";
import { EventFeed } from "@/components/matchday/EventFeed";
import { DragSubBoard } from "@/components/matchday/DragSubBoard";
import { useLiveMatch } from "@/hooks/useGameLoop";
import { buildClubTacticForMatch, pickAutoLineup, autoAssignSetPieceTakers } from "@/engines/tactics/aiTactics";
import { buildMatchResultFromState, applyMatchStateToPlayers } from "@/engines/match/matchResult";
import { applyMatchResultToFanSentiment } from "@/engines/fanSentiment/fanSentimentEngine";
import { generatePostMatchStory } from "@/engines/media/mediaEngine";
import { bumpRivalry } from "@/engines/world/worldEngine";
import type { MatchContext, TeamMatchSetup } from "@/engines/match/matchTypes";
import type { Fixture, PositionCode, TacticSetup } from "@/domain/types";

// Strictly the fixture the calendar linked to *today* — set once, at the
// moment ensureCalendarDay first created this date's entry. Using this
// (rather than scanning for "any unresolved fixture") is what stops a stale
// unplayed match from ever being treated as live again on a later date.
function findTodayFixture(world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>): Fixture | null {
  const today = world.calendar[world.currentDate];
  if (!today?.fixtureId) return null;
  return world.fixtures[today.fixtureId] ?? null;
}

// Fallback for the build-up screen on a non-matchday: just show whichever
// fixture is coming up next, purely for preview — never used to drive the
// live match view.
function findNextUpcomingFixture(world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>): Fixture | null {
  const candidates = Object.values(world.fixtures)
    .filter((f) => f.homeClubId === world.userClubId || f.awayClubId === world.userClubId)
    .filter((f) => f.status === "scheduled")
    .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1));
  return candidates[0] ?? null;
}

export default function MatchdayPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const advanceOnePhase = useGameStore((s) => s.advanceOnePhase);
  const [resultConfirmed, setResultConfirmed] = useState(false);

  const todayFixture = world ? findTodayFixture(world) : null;
  const phase = world?.calendar[world.currentDate]?.phase;
  const isLive = phase === "matchday-live" && !!todayFixture;
  const fixture = todayFixture ?? (world ? findNextUpcomingFixture(world) : null);

  const matchSetups = useMemo(() => {
    if (!world || !fixture || !isLive) return null;
    const homeClub = world.clubs[fixture.homeClubId];
    const awayClub = world.clubs[fixture.awayClubId];
    if (!homeClub || !awayClub) return null;

    const homeTactic = buildClubTacticForMatch(world, homeClub);
    const awayTactic = buildClubTacticForMatch(world, awayClub);

    const home: TeamMatchSetup = {
      clubId: homeClub.id,
      tactic: homeTactic,
      startingXI: Object.keys(homeTactic.playerRoles),
      bench: homeClub.squadIds.filter((id) => !homeTactic.playerRoles[id]).slice(0, 9),
      substitutesUsed: 0,
      maxSubstitutions: 5,
    };
    const away: TeamMatchSetup = {
      clubId: awayClub.id,
      tactic: awayTactic,
      startingXI: Object.keys(awayTactic.playerRoles),
      bench: awayClub.squadIds.filter((id) => !awayTactic.playerRoles[id]).slice(0, 9),
      substitutesUsed: 0,
      maxSubstitutions: 5,
    };

    const referee = world.referees[fixture.refereeId];
    const context: MatchContext = {
      fixtureId: fixture.id,
      weather: fixture.weather,
      referee: referee ?? {
        id: "fallback", firstName: "Referee", lastName: "", nationality: "N/A",
        strictness: 50, advantagePlay: 50, homeBias: 0, consistency: 50,
      },
      isNeutralVenue: fixture.venueNeutral,
      homeAdvantageStrength: homeClub.stadium.atmosphere / 100,
    };

    return { home, away, context, seed: hashSeed(fixture.id) };
  }, [world, fixture, isLive]);

  const { state, playToMinute, substitute, changeTactic } = useLiveMatch(matchSetups);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2);
  const [pausedForHalfTime, setPausedForHalfTime] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track the latest state in a ref so the interval closure below always
  // reads the current minute without needing to be recreated every tick.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Real-time-feeling auto-play: advances one match-minute at a time on an
  // interval instead of jumping in fixed 15/45/90 chunks. Pauses itself at
  // half-time (needs a tap to kick off the second half) and at full-time.
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!isPlaying || !state || state.status === "finished") return;
    const msPerMinute = 900 / speed;
    tickRef.current = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      playToMinute(Math.min(90, current.minute + 1));
    }, msPerMinute);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, state?.status]);

  useEffect(() => {
    if (state && state.minute >= 45 && state.status !== "finished" && !pausedForHalfTime) {
      const isHalfTimeEvent = state.events.some((e) => e.type === "half-time");
      if (isHalfTimeEvent) {
        setIsPlaying(false);
        setPausedForHalfTime(true);
      }
    }
    if (state?.status === "finished") setIsPlaying(false);
  }, [state, pausedForHalfTime]);

  // Goal-flash banner trigger — counts goal events rather than checking
  // "is the last event a goal", since that naive check could stay stuck
  // true if play is paused right after a goal (e.g. into half-time).
  const goalEventCount = state?.events.filter((e) => e.type === "goal").length ?? 0;
  const lastGoalCountRef = useRef(0);
  const [isGoalMoment, setIsGoalMoment] = useState(false);
  useEffect(() => {
    if (goalEventCount > lastGoalCountRef.current) {
      lastGoalCountRef.current = goalEventCount;
      setIsGoalMoment(true);
      const t = setTimeout(() => setIsGoalMoment(false), 1800);
      return () => clearTimeout(t);
    }
  }, [goalEventCount]);

  if (!world) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  if (!fixture) {
    return (
      <div className="py-6">
        <p className="text-sm text-ink-500">No fixture scheduled right now. Advance the calendar from the top bar.</p>
      </div>
    );
  }

  const homeClub = world.clubs[fixture.homeClubId];
  const awayClub = world.clubs[fixture.awayClubId];
  const userIsHome = fixture.homeClubId === world.userClubId;

  // ---- Build-up screen (before kickoff) --------------------------------------
  if (!isLive) {
    return (
      <div className="flex flex-col gap-3 py-3">
        <h1 className="font-display text-2xl text-ink-100">Matchday build-up</h1>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ClubCrest clubId={homeClub?.id} abbreviation={homeClub?.abbreviation} color={homeClub?.colors.primary} size={22} />
                {homeClub?.name ?? "TBC"} vs {awayClub?.name ?? "TBC"}
                <ClubCrest clubId={awayClub?.id} abbreviation={awayClub?.abbreviation} color={awayClub?.colors.primary} size={22} />
              </span>
            }
            subtitle={`${fixture.kickoff.slice(0, 10)} • ${fixture.weather}`}
            right={<Badge tone="amber">{userIsHome ? "Home" : "Away"}</Badge>}
          />
          <p className="text-sm text-ink-500">
            Set your tactic from the active tactic below, then tap Continue in the top bar to kick off.
            The lineup is auto-selected from your best-fit available players.
          </p>
        </Card>

        <Card>
          <CardHeader title="Your active tactic" subtitle={`${world.activeTactic.formation} • ${world.activeTactic.mentality}`} />
          <div className="flex flex-col gap-1.5">
            <StatBar label="Tempo" value={world.activeTactic.inPossession.tempo} max={100} />
            <StatBar label="Width" value={world.activeTactic.inPossession.width} max={100} />
            <StatBar label="Pressing" value={world.activeTactic.outOfPossession.pressingIntensity} max={100} />
            <StatBar label="Defensive line" value={world.activeTactic.outOfPossession.defensiveLine} max={100} />
            <StatBar label="Familiarity" value={world.activeTactic.familiarity} max={100} />
          </div>
        </Card>
      </div>
    );
  }

  // ---- Live match --------------------------------------------------------------
  if (!state) {
    return <p className="px-4 py-6 text-sm text-ink-500">Loading match engine…</p>;
  }

  const userSetup = state.home.clubId === world.userClubId ? state.home : state.away;
  const oppSetup = state.home.clubId === world.userClubId ? state.away : state.home;
  const lastEvent = state.events[state.events.length - 1];
  const finished = state.status === "finished";

  function handleConfirmResult() {
    if (!state || !fixture) return;
    const homeClubRef = world!.clubs[fixture.homeClubId];
    const attendance = Math.round((homeClubRef?.stadium.avgAttendance ?? 20000) * (0.85 + Math.random() * 0.15));
    const result = buildMatchResultFromState(state, fixture, attendance);

    mutateWorld((w) => {
      const fx = w.fixtures[fixture.id];
      if (fx) {
        fx.status = "completed";
        fx.result = result;
      }
      applyMatchStateToPlayers(w, state);
      applyMatchResultToFanSentiment(w, fixture, result);
      generatePostMatchStory(w, fixture, result);
      if (result.homeGoals !== result.awayGoals) {
        const marginBig = Math.abs(result.homeGoals - result.awayGoals) >= 3;
        if (marginBig) bumpRivalry(w, fixture.homeClubId, fixture.awayClubId, 4, "Heavy defeat sparks bad blood");
      }
    });
    setResultConfirmed(true);
    advanceOnePhase(); // matchday-live -> post-match
  }

  return (
    <div className="relative flex flex-col gap-3 py-3">
      {isGoalMoment && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="animate-bounce rounded-card bg-gradient-to-r from-accent-500 to-pulse-500 px-8 py-4 text-2xl font-display font-bold text-navy-950 shadow-glow">
            GOAL!
          </div>
        </div>
      )}

      <PitchViz
        homeName={homeClub?.shortName ?? "Home"}
        awayName={awayClub?.shortName ?? "Away"}
        homeGoals={state.homeGoals}
        awayGoals={state.awayGoals}
        minute={state.minute}
        possessionHome={
          state.possessionHomeTicks + state.possessionAwayTicks > 0
            ? Math.round((state.possessionHomeTicks / (state.possessionHomeTicks + state.possessionAwayTicks)) * 100)
            : 50
        }
        lastEvent={lastEvent}
        homeSetup={state.home}
        awaySetup={state.away}
        players={world.players}
      />

      {!finished && (
        <div className="flex items-center gap-2">
          {pausedForHalfTime ? (
            <button
              onClick={() => { setPausedForHalfTime(false); setIsPlaying(true); }}
              className="flex-1 rounded-card bg-gradient-to-r from-accent-500 to-accent-600 px-3 py-2.5 text-sm font-semibold text-navy-950 shadow-glow active:scale-95"
            >
              Kick off second half
            </button>
          ) : (
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-card px-3 py-2.5 text-sm font-semibold active:scale-95 ${
                isPlaying ? "bg-navy-700 text-ink-100" : "bg-gradient-to-r from-accent-500 to-accent-600 text-navy-950 shadow-glow"
              }`}
            >
              {isPlaying ? <><Pause size={16} aria-hidden /> Pause</> : <><Play size={16} aria-hidden /> Play</>}
            </button>
          )}
          <div className="flex rounded-card border border-navy-600 bg-navy-800 p-1">
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-card px-2.5 py-1.5 text-xs font-data ${speed === s ? "bg-accent-500 text-navy-950" : "text-ink-500"}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}

      {finished && !resultConfirmed && (
        <button
          onClick={handleConfirmResult}
          className="rounded-card bg-gradient-to-r from-accent-500 to-accent-600 px-4 py-3 text-center font-semibold text-navy-950 shadow-glow active:scale-95"
        >
          Confirm full-time result &amp; continue
        </button>
      )}

      <DragSubBoard
        formation={userSetup.tactic.formation}
        onPitchIds={userSetup.startingXI}
        benchIds={userSetup.bench}
        players={world.players}
        substitutionsUsed={userSetup.substitutesUsed}
        maxSubstitutions={userSetup.maxSubstitutions}
        onSubstitute={(offId, onId, position: PositionCode) => substitute(userSetup.clubId, offId, onId, position)}
      />

      <TacticQuickChange
        tactic={userSetup.tactic}
        onChange={(next) => changeTactic(userSetup.clubId, next)}
      />

      <EventFeed events={state.events} players={world.players} homeClub={homeClub} awayClub={awayClub} homeClubId={fixture.homeClubId} />

      <p className="text-xs text-ink-500">
        Opponent: {oppSetup.clubId === fixture.homeClubId ? homeClub?.name : awayClub?.name} — {oppSetup.tactic.formation}, {oppSetup.tactic.mentality}
      </p>
    </div>
  );
}

function TacticQuickChange({ tactic, onChange }: { tactic: TacticSetup; onChange: (next: TacticSetup) => void }) {
  const mentalities: TacticSetup["mentality"][] = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"];
  return (
    <div className="rounded-card border border-navy-600 bg-navy-900 p-3">
      <p className="mb-2 text-sm font-medium text-ink-100">Live mentality change</p>
      <div className="flex flex-wrap gap-1.5">
        {mentalities.map((m) => (
          <button
            key={m}
            onClick={() => onChange({ ...tactic, mentality: m, familiarity: Math.max(0, tactic.familiarity - 8) })}
            className={`rounded-card px-2.5 py-1 text-xs transition-colors duration-150 ${
              tactic.mentality === m ? "bg-accent-500 text-white font-semibold" : "bg-navy-800 text-ink-300"
            }`}
          >
            {m.replace("-", " ")}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-500">Changing mid-match costs some tactic familiarity.</p>
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Kept as an internal helper (not exported — Next.js only allows specific
// named exports like `default`/`generateMetadata` from a page.tsx file) so
// this page can build a starting lineup for the user's own club too if
// `activeTactic.playerRoles` is ever empty (e.g. right after squad changes).
function autoFillUserLineupIfNeeded(
  world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>
): TacticSetup {
  const tactic = world.activeTactic;
  if (Object.keys(tactic.playerRoles).length >= 11) return tactic;
  const club = world.clubs[world.userClubId];
  if (!club) return tactic;
  const { startingXI } = pickAutoLineup(club.squadIds, world.players, tactic.formation);
  const playerRoles: TacticSetup["playerRoles"] = {};
  startingXI.forEach((id) => {
    const player = world.players[id];
    playerRoles[id] = { positionCode: player?.positions[0] ?? "CM", role: "Default", duty: "support" };
  });
  return autoAssignSetPieceTakers({ ...tactic, playerRoles }, startingXI, world.players);
}
