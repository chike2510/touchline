"use client";
import { useState } from "react";
import type { MatchResult, MediaStory, Player } from "@/domain/types";
import type { MatchState } from "@/engines/match/matchTypes";
import { ClubCrest } from "@/components/ui/ClubCrest";

type Step = "report" | "ratings" | "stats" | "media" | "injuries" | "recovery";
const STEPS: { id: Step; label: string }[] = [
  { id: "report", label: "Match Report" },
  { id: "ratings", label: "Player Ratings" },
  { id: "stats", label: "Match Statistics" },
  { id: "media", label: "Media Reactions" },
  { id: "injuries", label: "Injury Updates" },
  { id: "recovery", label: "Recovery Summary" },
];

export function PostMatchSequence({
  state, result, mediaStory, players, homeClub, awayClub, onFinish,
}: {
  state: MatchState;
  result: MatchResult;
  mediaStory: MediaStory | null;
  players: Record<string, Player>;
  homeClub?: { id: string; name: string; abbreviation: string; colors: { primary: string } };
  awayClub?: { id: string; name: string; abbreviation: string; colors: { primary: string } };
  onFinish: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex]!.id;
  const isLast = stepIndex === STEPS.length - 1;

  function next() {
    if (isLast) onFinish();
    else setStepIndex((i) => i + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-950">
      <div className="flex items-center gap-1 px-4 pt-4">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-accent-500" : "bg-navy-700"}`} />
        ))}
      </div>
      <p className="px-4 pt-2 text-xs uppercase tracking-wide text-ink-500">{STEPS[stepIndex]!.label}</p>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {step === "report" && <MatchReportStep result={result} mediaStory={mediaStory} homeClub={homeClub} awayClub={awayClub} />}
        {step === "ratings" && <PlayerRatingsStep result={result} players={players} state={state} homeClub={homeClub} awayClub={awayClub} />}
        {step === "stats" && <MatchStatsStep result={result} homeClub={homeClub} awayClub={awayClub} />}
        {step === "media" && <MediaReactionsStep mediaStory={mediaStory} />}
        {step === "injuries" && <InjuryUpdatesStep state={state} players={players} />}
        {step === "recovery" && <RecoverySummaryStep state={state} players={players} homeClub={homeClub} awayClub={awayClub} />}
      </div>

      <div className="border-t border-navy-700 p-4">
        <button
          onClick={next}
          className="w-full rounded-card bg-gradient-to-r from-accent-500 to-accent-600 px-4 py-3 text-center font-semibold text-navy-950 shadow-glow active:scale-95"
        >
          {isLast ? "Continue to next day" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function MatchReportStep({
  result, mediaStory, homeClub, awayClub,
}: { result: MatchResult; mediaStory: MediaStory | null; homeClub?: { id: string; name: string; abbreviation: string; colors: { primary: string } }; awayClub?: { id: string; name: string; abbreviation: string; colors: { primary: string } } }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <ClubCrest clubId={homeClub?.id} abbreviation={homeClub?.abbreviation} color={homeClub?.colors.primary} size={40} />
          <span className="text-xs text-ink-300">{homeClub?.name ?? "Home"}</span>
        </div>
        <span className="font-display text-3xl text-ink-100">{result.homeGoals} – {result.awayGoals}</span>
        <div className="flex flex-col items-center gap-1">
          <ClubCrest clubId={awayClub?.id} abbreviation={awayClub?.abbreviation} color={awayClub?.colors.primary} size={40} />
          <span className="text-xs text-ink-300">{awayClub?.name ?? "Away"}</span>
        </div>
      </div>
      <div className="glass-panel rounded-card p-3">
        <p className="font-display text-lg text-ink-100">{mediaStory?.headline ?? "Full-time."}</p>
        <p className="mt-1 text-sm text-ink-300">{mediaStory?.body ?? `Final score ${result.homeGoals}-${result.awayGoals}, attendance ${result.attendance.toLocaleString()}.`}</p>
      </div>
    </div>
  );
}

function PlayerRatingsStep({
  result, players, state, homeClub, awayClub,
}: { result: MatchResult; players: Record<string, Player>; state: MatchState; homeClub?: { name: string }; awayClub?: { name: string } }) {
  const sides: ("home" | "away")[] = ["home", "away"];
  return (
    <div className="flex flex-col gap-4">
      {sides.map((side) => {
        const xi = side === "home" ? state.home.startingXI : state.away.startingXI;
        const rows = xi
          .map((id) => ({ id, player: players[id], rating: result.playerRatings[id] ?? 6.0 }))
          .filter((r) => r.player)
          .sort((a, b) => b.rating - a.rating);
        return (
          <div key={side} className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-ink-100">{side === "home" ? (homeClub?.name ?? "Home") : (awayClub?.name ?? "Away")}</p>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-card bg-navy-900 px-2.5 py-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-ink-200">
                  {r.id === result.motmPlayerId && <span className="text-[10px] font-bold text-pulse-400">MOTM</span>}
                  {r.player!.firstName} {r.player!.lastName}
                </span>
                <span className={`font-data font-bold ${r.rating >= 7.5 ? "text-accent-400" : r.rating < 5.5 ? "text-pulse-400" : "text-ink-100"}`}>
                  {r.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MatchStatsStep({
  result, homeClub, awayClub,
}: { result: MatchResult; homeClub?: { name: string }; awayClub?: { name: string } }) {
  const rows: [string, number, number][] = [
    ["Expected goals (xG)", result.homeXg, result.awayXg],
    ["Expected threat", result.stats.expectedThreatHome, result.stats.expectedThreatAway],
    ["Shots", result.stats.shotsHome, result.stats.shotsAway],
    ["Shots on target", result.stats.shotsOnTargetHome, result.stats.shotsOnTargetAway],
    ["Pass accuracy %", result.stats.passAccuracyHome, result.stats.passAccuracyAway],
    ["Corners", result.stats.cornersHome, result.stats.cornersAway],
    ["Fouls", result.stats.foulsHome, result.stats.foulsAway],
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{homeClub?.name ?? "Home"}</span>
        <span>Possession</span>
        <span>{awayClub?.name ?? "Away"}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-10 text-right font-data text-sm text-ink-100">{result.possessionHome}%</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-700">
          <div className="h-full bg-accent-500" style={{ width: `${result.possessionHome}%` }} />
        </div>
        <span className="w-10 font-data text-sm text-ink-100">{100 - result.possessionHome}%</span>
      </div>
      {rows.map(([label, h, a]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <span className="w-14 text-right font-data text-ink-100">{h}</span>
          <span className="flex-1 text-center text-xs text-ink-500">{label}</span>
          <span className="w-14 font-data text-ink-100">{a}</span>
        </div>
      ))}
    </div>
  );
}

function MediaReactionsStep({ mediaStory }: { mediaStory: MediaStory | null }) {
  if (!mediaStory) return <p className="text-sm text-ink-500">No media reaction generated for this match.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="glass-panel rounded-card p-3">
        <p className="font-display text-base text-ink-100">{mediaStory.headline}</p>
        <p className="mt-1 text-sm text-ink-300">{mediaStory.body}</p>
      </div>
      {mediaStory.requiresResponse && (
        <p className="text-xs text-ink-500">The press want your reaction — check your inbox to respond.</p>
      )}
    </div>
  );
}

function InjuryUpdatesStep({ state, players }: { state: MatchState; players: Record<string, Player> }) {
  const injuryEvents = state.events.filter((e) => e.type === "injury");
  if (injuryEvents.length === 0) return <p className="text-sm text-ink-500">No fresh injuries from this match.</p>;
  return (
    <div className="flex flex-col gap-2">
      {injuryEvents.map((e, i) => {
        const player = e.playerId ? players[e.playerId] : undefined;
        return (
          <div key={i} className="flex items-center justify-between rounded-card bg-navy-900 px-2.5 py-1.5 text-sm">
            <span className="text-ink-200">{player ? `${player.firstName} ${player.lastName}` : "Unknown player"}</span>
            <span className="text-xs text-ink-500">{e.minute}&apos; — {e.description}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecoverySummaryStep({
  state, players, homeClub, awayClub,
}: { state: MatchState; players: Record<string, Player>; homeClub?: { name: string }; awayClub?: { name: string } }) {
  const sides: ("home" | "away")[] = ["home", "away"];
  return (
    <div className="flex flex-col gap-4">
      {sides.map((side) => {
        const xi = side === "home" ? state.home.startingXI : state.away.startingXI;
        const rows = xi
          .map((id) => ({ id, player: players[id], ps: state.playerStates[id] }))
          .filter((r) => r.player && r.ps)
          .sort((a, b) => (b.ps!.fatigue - a.ps!.fatigue))
          .slice(0, 5);
        return (
          <div key={side} className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-ink-100">{side === "home" ? (homeClub?.name ?? "Home") : (awayClub?.name ?? "Away")} — most fatigued</p>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-card bg-navy-900 px-2.5 py-1.5 text-sm">
                <span className="text-ink-200">{r.player!.lastName}</span>
                <span className="font-data text-xs text-ink-500">{Math.round(100 - r.ps!.fatigue)}% fresh</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
