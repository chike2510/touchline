"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { Play, Pause, Users, ClipboardList, BarChart3, X, RotateCcw } from "lucide-react";
import { PitchViz } from "@/components/matchday/PitchViz";
import { MatchTopBar } from "@/components/matchday/MatchTopBar";
import { MatchAnalyticsPanel } from "@/components/matchday/MatchAnalyticsPanel";
import { PostMatchSequence } from "@/components/matchday/PostMatchSequence";
import { EventFeed } from "@/components/matchday/EventFeed";
import { buildCommentaryFeed } from "@/engines/match/commentary";
import { DragSubBoard } from "@/components/matchday/DragSubBoard";
import { useLiveMatch } from "@/hooks/useGameLoop";
import { buildClubTacticForMatch, pickAutoLineup, autoAssignSetPieceTakers, reshapeTactic } from "@/engines/tactics/aiTactics";
import { activeXI } from "@/engines/stability/sentOff";
import { sanitizeLineup } from "@/engines/stability/lineupGuard";
import { applyMatchDiscipline } from "@/engines/stability/stabilityEngine";
import { buildMatchResultFromState, applyMatchStateToPlayers } from "@/engines/match/matchResult";
import { applyMatchResultToFanSentiment } from "@/engines/fanSentiment/fanSentimentEngine";
import { generatePostMatchStory } from "@/engines/media/mediaEngine";
import { bumpRivalry } from "@/engines/world/worldEngine";
import type { MatchContext, TeamMatchSetup } from "@/engines/match/matchTypes";
import type { Fixture, MatchResult, MediaStory, PositionCode, TacticSetup } from "@/domain/types";

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

// A tactic can end up with fewer than 11 assigned starters right after a
// squad change (injury, sale, etc.) — this tops it back up to a full XI
// using the same auto-lineup logic AI clubs get, rebuilding both phase
// shapes and role assignments, rather than kicking off a match short-handed.
function autoFillUserLineupIfNeeded(
  world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>
): TacticSetup {
  const tactic = world.activeTactic;
  if (Object.keys(tactic.playerRoles).length >= 11) return tactic;
  const club = world.clubs[world.userClubId];
  if (!club) return tactic;
  const { startingXI } = pickAutoLineup(club.squadIds, world.players, tactic.inPossession.formation);
  const reshaped = reshapeTactic(tactic, tactic.inPossession.formation, startingXI);
  return autoAssignSetPieceTakers(reshaped, startingXI, world.players);
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export default function MatchdayPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const advanceOnePhase = useGameStore((s) => s.advanceOnePhase);
  const [postMatch, setPostMatch] = useState<{ result: MatchResult; mediaStory: MediaStory | null } | null>(null);

  const todayFixture = world ? findTodayFixture(world) : null;
  const phase = world?.calendar[world.currentDate]?.phase;
  const isLive = phase === "matchday-live" && !!todayFixture;
  const fixture = todayFixture ?? (world ? findNextUpcomingFixture(world) : null);

  const matchSetups = useMemo(() => {
    if (!world || !fixture || !isLive) return null;
    const homeClub = world.clubs[fixture.homeClubId];
    const awayClub = world.clubs[fixture.awayClubId];
    if (!homeClub || !awayClub) return null;

    const userClubId = world.userClubId;
    const safeUserTactic = autoFillUserLineupIfNeeded(world);
    const homeTactic = homeClub.id === userClubId ? safeUserTactic : buildClubTacticForMatch(world, homeClub);
    const awayTactic = awayClub.id === userClubId ? safeUserTactic : buildClubTacticForMatch(world, awayClub);

    // Availability guard: swaps injured/suspended starters for the best available player.
    const homeSan = sanitizeLineup(world, homeClub.id, homeTactic, fixture.competitionId);
    const awaySan = sanitizeLineup(world, awayClub.id, awayTactic, fixture.competitionId);
    const home: TeamMatchSetup = {
      clubId: homeClub.id,
      tactic: homeSan.tactic,
      startingXI: homeSan.startingXI,
      bench: homeSan.bench,
      substitutesUsed: 0,
      maxSubstitutions: 5,
    };
    const away: TeamMatchSetup = {
      clubId: awayClub.id,
      tactic: awaySan.tactic,
      startingXI: awaySan.startingXI,
      bench: awaySan.bench,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, fixture, isLive]);

  const { state, playToMinute, substitute, changeTactic } = useLiveMatch(matchSetups);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2);
  const [pausedForHalfTime, setPausedForHalfTime] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoPausedForHalfTimeRef = useRef(false);

  const stateRef = useRef(state);
  stateRef.current = state;

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
    if (state && state.minute >= 45 && state.status !== "finished" && !hasAutoPausedForHalfTimeRef.current) {
      const isHalfTimeEvent = state.events.some((e) => e.type === "half-time");
      if (isHalfTimeEvent) {
        hasAutoPausedForHalfTimeRef.current = true;
        setIsPlaying(false);
        setPausedForHalfTime(true);
      }
    }
    if (state?.status === "finished") setIsPlaying(false);
  }, [state]);

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

  // Committed exactly once, the instant the match finishes — before the
  // post-match sequence is shown, so the Media Reactions / Recovery steps
  // have real generated content to display. `advanceOnePhase()` only fires
  // once the manager finishes clicking through the whole sequence. Hooks
  // can't be called conditionally, so this stays above every early return
  // below and guards its own preconditions internally instead.
  useEffect(() => {
    if (!world || !fixture || !state || state.status !== "finished" || postMatch) return;
    const homeClubRef = world.clubs[fixture.homeClubId];
    const attendance = Math.round((homeClubRef?.stadium.avgAttendance ?? 20000) * (0.85 + Math.random() * 0.15));
    const result = buildMatchResultFromState(state, fixture, attendance);
    let story: MediaStory | null = null;

    mutateWorld((w) => {
      const fx = w.fixtures[fixture.id];
      if (fx) { fx.status = "completed"; fx.result = result; }
      applyMatchStateToPlayers(w, state);
      applyMatchDiscipline(w, state, fixture.competitionId);
      applyMatchResultToFanSentiment(w, fixture, result);
      story = generatePostMatchStory(w, fixture, result);
      if (result.homeGoals !== result.awayGoals && Math.abs(result.homeGoals - result.awayGoals) >= 3) {
        bumpRivalry(w, fixture.homeClubId, fixture.awayClubId, 4, "Heavy defeat sparks bad blood");
      }
    });
    setPostMatch({ result, mediaStory: story });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, fixture, state?.status, postMatch]);

  // "Replay" — the engine simulates possession-tick outcomes rather than
  // tracking real player trajectories, so there's no frame buffer to scrub
  // back through. This re-plays the moment instead: it re-triggers the goal
  // flash/banner and re-surfaces the most recent notable event in the
  // commentary ticker, which is what "Replay" means in a stats-driven engine.
  const [replayPulse, setReplayPulse] = useState(0);
  function triggerReplay() {
    setIsGoalMoment(true);
    setReplayPulse((p) => p + 1);
    setTimeout(() => setIsGoalMoment(false), 1400);
  }

  const [activePanel, setActivePanel] = useState<"subs" | "tactics" | "stats" | null>(null);

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
  const competitionName = (fixture.leagueId && world.leagues[fixture.leagueId]?.name)
    ?? (fixture.competitionId && world.competitions[fixture.competitionId]?.name)
    ?? "Friendly";

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
          <CardHeader title="Your active tactic" subtitle={`${world.activeTactic.inPossession.formation} in possession → ${world.activeTactic.outOfPossession.formation} out of possession`} />
          <div className="flex flex-col gap-1.5 text-sm text-ink-300">
            <p>Mentality: <span className="capitalize text-ink-100">{world.activeTactic.mentality.replace(/-/g, " ")}</span></p>
           <p>
  Tempo:{" "}
  <span className="capitalize text-ink-100">
    {world.activeTactic.inPossession.instructions.tempo}
  </span>
  {" · "}
  Width:{" "}
  <span className="capitalize text-ink-100">
    {world.activeTactic.inPossession.instructions.width}
  </span>
</p>
            <p>Defensive line: <span className="capitalize text-ink-100">{world.activeTactic.outOfPossession.instructions.defensiveLine}</span> · Closing down: <span className="capitalize text-ink-100">{world.activeTactic.outOfPossession.instructions.closingDown.replace(/-/g, " ")}</span></p>
            <p>Familiarity: <span className="text-ink-100">{Math.round(world.activeTactic.familiarity)}/100</span></p>
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
  const finished = state.status === "finished";

  if (postMatch) {
    return (
      <PostMatchSequence
        state={state}
        result={postMatch.result}
        mediaStory={postMatch.mediaStory}
        players={world.players}
        homeClub={homeClub}
        awayClub={awayClub}
        onFinish={() => advanceOnePhase()}
      />
    );
  }

  const latestCommentary = buildCommentaryFeed(state.events, world.players, {
    home: homeClub, away: awayClub, homeClubId: fixture.homeClubId,
  })[0];
  void replayPulse;

  const totalPoss = state.possessionHomeTicks + state.possessionAwayTicks;
  const possessionHome = totalPoss > 0 ? Math.round((state.possessionHomeTicks / totalPoss) * 100) : 50;

  return (
    <div className="matchday-live-layout relative flex flex-col gap-2 py-2">
      {isGoalMoment && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="animate-bounce rounded-card bg-gradient-to-r from-accent-500 to-pulse-500 px-8 py-4 text-2xl font-display font-bold text-navy-950 shadow-glow">
            GOAL!
          </div>
        </div>
      )}

      <MatchTopBar
        competitionName={competitionName}
        homeName={homeClub?.shortName ?? "Home"}
        awayName={awayClub?.shortName ?? "Away"}
        homeCrestClubId={homeClub?.id}
        awayCrestClubId={awayClub?.id}
        homeColor={homeClub?.colors.primary}
        awayColor={awayClub?.colors.primary}
        homeGoals={state.homeGoals}
        awayGoals={state.awayGoals}
        minute={state.minute}
        status={state.status}
        stadiumName={homeClub?.stadium.name ?? "Stadium"}
        attendance={Math.round((homeClub?.stadium.avgAttendance ?? 20000) * 0.9)}
        weather={fixture.weather}
      />

      <section className="glass-panel rounded-card px-3 py-2.5" aria-label="Live match statistics">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          <span className="truncate">{homeClub?.shortName ?? "Home"}</span>
          <span className="shrink-0 text-accent-300">Possession</span>
          <span className="truncate text-right">{awayClub?.shortName ?? "Away"}</span>
        </div>
        <div className="mb-2 flex items-center justify-between font-data text-lg font-bold tabular-nums text-white">
          <span>{possessionHome}%</span>
          <span>{100 - possessionHome}%</span>
        </div>
        <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-navy-700">
          <div className="h-full bg-accent-400 transition-[width] duration-500" style={{ width: `${possessionHome}%` }} />
          <div className="h-full bg-pulse-500 transition-[width] duration-500" style={{ width: `${100 - possessionHome}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2 text-center">
          <div><p className="font-data text-sm font-semibold text-ink-100">{state.shotsHome} – {state.shotsAway}</p><p className="text-[10px] uppercase tracking-wide text-ink-500">Shots</p></div>
          <div><p className="font-data text-sm font-semibold text-ink-100">{state.shotsOnTargetHome} – {state.shotsOnTargetAway}</p><p className="text-[10px] uppercase tracking-wide text-ink-500">On target</p></div>
          <div><p className="font-data text-sm font-semibold text-ink-100">{state.homeXg.toFixed(2)} – {state.awayXg.toFixed(2)}</p><p className="text-[10px] uppercase tracking-wide text-ink-500">Expected goals</p></div>
        </div>
      </section>

      <PitchViz
        minute={state.minute}
        possessionHome={possessionHome}
        lastEvent={state.events[state.events.length - 1]}
        homeSetup={state.home}
        awaySetup={state.away}
        players={world.players}
      />

      <aside className="matchday-side-stats glass-panel min-w-0 overflow-y-auto rounded-card p-2">
        <MatchAnalyticsPanel state={state} players={world.players} homeClub={homeClub} awayClub={awayClub} />
        <div className="mt-2">
          <EventFeed events={state.events} players={world.players} homeClub={homeClub} awayClub={awayClub} homeClubId={fixture.homeClubId} />
        </div>
      </aside>

      {latestCommentary && (
        <div className="glass-panel flex items-center gap-2 rounded-card px-3 py-2 text-sm">
          <span className="font-data text-xs text-ink-500">{latestCommentary.minute}&apos;</span>
          <span className="truncate text-ink-200">{latestCommentary.text}</span>
        </div>
      )}

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
          <button
            onClick={triggerReplay}
            className="flex items-center gap-1 rounded-card border border-navy-600 bg-navy-800 px-2.5 py-2.5 text-xs text-ink-300"
            aria-label="Replay"
          >
            <RotateCcw size={14} /> Replay
          </button>
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

      {finished && (
        <p className="text-center text-sm text-ink-500">Building the full-time report…</p>
      )}

      {/* Floating corner icon toolbar — tap to open the corresponding panel
          as a bottom sheet, instead of three cards always stacked below the
          pitch. */}
      <div className="fixed bottom-20 right-4 z-30 flex flex-col gap-2 md:bottom-6">
        <ToolbarIcon
          icon={<Users size={18} />}
          label="Subs"
          badge={`${userSetup.maxSubstitutions - userSetup.substitutesUsed}`}
          active={activePanel === "subs"}
          onClick={() => setActivePanel((p) => (p === "subs" ? null : "subs"))}
        />
        <ToolbarIcon
          icon={<ClipboardList size={18} />}
          label="Tactics"
          active={activePanel === "tactics"}
          onClick={() => setActivePanel((p) => (p === "tactics" ? null : "tactics"))}
        />
        <ToolbarIcon
          icon={<BarChart3 size={18} />}
          label="Stats"
          active={activePanel === "stats"}
          onClick={() => setActivePanel((p) => (p === "stats" ? null : "stats"))}
        />
      </div>

      {activePanel && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
          onClick={() => setActivePanel(null)}
        >
          <div
            className="glass-panel max-h-[calc(100dvh-5rem)] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto rounded-t-card rounded-b-none p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-lg text-ink-100">
                {activePanel === "subs" ? "Substitutions" : activePanel === "tactics" ? "Tactics" : "Match stats"}
              </p>
              <button onClick={() => setActivePanel(null)} className="text-ink-500"><X size={18} /></button>
            </div>

            {activePanel === "subs" && (
              <DragSubBoard
                formation={userSetup.tactic.inPossession.formation}
                onPitchIds={activeXI(state, userSetup)}
                benchIds={userSetup.bench}
                players={world.players}
                substitutionsUsed={userSetup.substitutesUsed}
                maxSubstitutions={userSetup.maxSubstitutions}
                onSubstitute={(offId, onId, position: PositionCode) => substitute(userSetup.clubId, offId, onId, position)}
                leagueId={world.clubs[userSetup.clubId]?.leagueId ?? ""}
                clubId={userSetup.clubId}
              />
            )}

            {activePanel === "tactics" && (
              <>
                <TacticQuickChange tactic={userSetup.tactic} onChange={(next) => changeTactic(userSetup.clubId, next)} />
                <p className="mt-2 text-xs text-ink-500">
                  Opponent: {oppSetup.clubId === fixture.homeClubId ? homeClub?.name : awayClub?.name} — {oppSetup.tactic.inPossession.formation}, {oppSetup.tactic.mentality}
                </p>
              </>
            )}

            {activePanel === "stats" && (
              <div className="flex flex-col gap-4">
                <MatchAnalyticsPanel state={state} players={world.players} homeClub={homeClub} awayClub={awayClub} />
                <EventFeed events={state.events} players={world.players} homeClub={homeClub} awayClub={awayClub} homeClubId={fixture.homeClubId} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarIcon({
  icon, label, badge, active, onClick,
}: { icon: React.ReactNode; label: string; badge?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`glass-panel relative flex h-12 w-12 flex-col items-center justify-center gap-0 rounded-full transition-transform duration-150 active:scale-90 ${
        active ? "ring-2 ring-accent-400" : ""
      }`}
      aria-label={label}
    >
      <span className={active ? "text-accent-400" : "text-ink-200"}>{icon}</span>
      {badge && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-navy-950">
          {badge}
        </span>
      )}
    </button>
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
