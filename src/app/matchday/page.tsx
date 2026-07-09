"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatBar } from "@/components/ui/Badge";
import { PitchViz } from "@/components/matchday/PitchViz";
import { EventFeed } from "@/components/matchday/EventFeed";
import { SubstitutionPanel } from "@/components/matchday/SubstitutionPanel";
import { useLiveMatch } from "@/hooks/useGameLoop";
import { buildClubTacticForMatch, pickAutoLineup, autoAssignSetPieceTakers } from "@/engines/tactics/aiTactics";
import { buildMatchResultFromState, applyMatchStateToPlayers } from "@/engines/match/matchResult";
import { applyMatchResultToFanSentiment } from "@/engines/fanSentiment/fanSentimentEngine";
import { generatePostMatchStory } from "@/engines/media/mediaEngine";
import { bumpRivalry } from "@/engines/world/worldEngine";
import type { MatchContext, TeamMatchSetup } from "@/engines/match/matchTypes";
import type { Fixture, PositionCode, TacticSetup } from "@/domain/types";

function findUserFixture(world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>): Fixture | null {
  const candidates = Object.values(world.fixtures)
    .filter((f) => f.homeClubId === world.userClubId || f.awayClubId === world.userClubId)
    .filter((f) => f.status === "scheduled" || f.status === "in-progress")
    .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1));
  return candidates[0] ?? null;
}

export default function MatchdayPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const advanceOnePhase = useGameStore((s) => s.advanceOnePhase);
  const [resultConfirmed, setResultConfirmed] = useState(false);

  const fixture = world ? findUserFixture(world) : null;
  const phase = world?.calendar[world.currentDate]?.phase;
  const isLive = phase === "matchday-live";

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

  if (!world) return <p className="px-4 py-6 text-sm text-chalk-300">No save loaded.</p>;

  if (!fixture) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-chalk-300">No fixture scheduled right now. Advance the calendar from the top bar.</p>
      </div>
    );
  }

  const homeClub = world.clubs[fixture.homeClubId];
  const awayClub = world.clubs[fixture.awayClubId];
  const userIsHome = fixture.homeClubId === world.userClubId;

  // ---- Build-up screen (before kickoff) --------------------------------------
  if (!isLive) {
    return (
      <div className="flex flex-col gap-3 px-4 py-2">
        <h1 className="font-display text-2xl text-chalk-100">Matchday build-up</h1>
        <Card>
          <CardHeader
            title={`${homeClub?.name ?? "TBC"} vs ${awayClub?.name ?? "TBC"}`}
            subtitle={`${fixture.kickoff.slice(0, 10)} • ${fixture.weather}`}
            right={<Badge tone="amber">{userIsHome ? "Home" : "Away"}</Badge>}
          />
          <p className="text-sm text-chalk-300">
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
    return <p className="px-4 py-6 text-sm text-chalk-300">Loading match engine…</p>;
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
    <div className="flex flex-col gap-3 px-4 py-2">
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
      />

      {!finished && (
        <div className="flex gap-2">
          <button
            onClick={() => playToMinute(state.minute + 15)}
            className="flex-1 rounded-card bg-pitch-700 px-3 py-2 text-sm font-medium text-chalk-100 active:scale-95"
          >
            Play 15 min
          </button>
          <button
            onClick={() => playToMinute(45)}
            className="flex-1 rounded-card bg-pitch-700 px-3 py-2 text-sm font-medium text-chalk-100 active:scale-95"
          >
            To half-time
          </button>
          <button
            onClick={() => playToMinute(90)}
            className="flex-1 rounded-card bg-floodlight-500 px-3 py-2 text-sm font-semibold text-ink-900 active:scale-95"
          >
            To full-time
          </button>
        </div>
      )}

      {finished && !resultConfirmed && (
        <button
          onClick={handleConfirmResult}
          className="rounded-card bg-floodlight-500 px-4 py-3 text-center font-semibold text-ink-900 active:scale-95"
        >
          Confirm full-time result &amp; continue
        </button>
      )}

      <SubstitutionPanel
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

      <EventFeed events={state.events} players={world.players} />

      <p className="text-xs text-chalk-300">
        Opponent: {oppSetup.clubId === fixture.homeClubId ? homeClub?.name : awayClub?.name} — {oppSetup.tactic.formation}, {oppSetup.tactic.mentality}
      </p>
    </div>
  );
}

function TacticQuickChange({ tactic, onChange }: { tactic: TacticSetup; onChange: (next: TacticSetup) => void }) {
  const mentalities: TacticSetup["mentality"][] = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"];
  return (
    <div className="rounded-card border border-pitch-700 bg-pitch-900 p-3">
      <p className="mb-2 text-sm font-medium text-chalk-100">Live mentality change</p>
      <div className="flex flex-wrap gap-1.5">
        {mentalities.map((m) => (
          <button
            key={m}
            onClick={() => onChange({ ...tactic, mentality: m, familiarity: Math.max(0, tactic.familiarity - 8) })}
            className={`rounded-card px-2.5 py-1 text-xs transition-colors duration-150 ${
              tactic.mentality === m ? "bg-floodlight-500 text-ink-900 font-semibold" : "bg-pitch-800 text-chalk-200"
            }`}
          >
            {m.replace("-", " ")}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-chalk-300">Changing mid-match costs some tactic familiarity.</p>
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
