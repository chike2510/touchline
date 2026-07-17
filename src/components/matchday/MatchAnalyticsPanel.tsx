"use client";
import type { MatchState } from "@/engines/match/matchTypes";
import type { Player } from "@/domain/types";

function StatRow({ label, home, away, format }: { label: string; home: number; away: number; format?: (n: number) => string }) {
  const fmt = format ?? ((n: number) => String(n));
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="w-12 text-right font-data text-ink-100">{fmt(home)}</span>
      <span className="flex-1 text-center text-xs text-ink-500">{label}</span>
      <span className="w-12 font-data text-ink-100">{fmt(away)}</span>
    </div>
  );
}

function SplitBar({ label, homePct }: { label: string; homePct: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{Math.round(homePct)}%</span>
        <span>{label}</span>
        <span>{Math.round(100 - homePct)}%</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-navy-700">
        <div className="h-full bg-accent-500" style={{ width: `${homePct}%` }} />
        <div className="h-full bg-pulse-500" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

export function MatchAnalyticsPanel({
  state, players, homeClub, awayClub,
}: {
  state: MatchState;
  players: Record<string, Player>;
  homeClub?: { shortName: string }; awayClub?: { shortName: string };
}) {
  const totalPoss = state.possessionHomeTicks + state.possessionAwayTicks;
  const possHome = totalPoss > 0 ? Math.round((state.possessionHomeTicks / totalPoss) * 100) : 50;
  const passAccHome = state.passesHome > 0 ? (state.passesCompletedHome / state.passesHome) * 100 : 0;
  const passAccAway = state.passesAway > 0 ? (state.passesCompletedAway / state.passesAway) * 100 : 0;
  const momentumHomePct = 50 + state.momentum / 2;

  const staminaFor = (setup: "home" | "away") => {
    const xi = setup === "home" ? state.home.startingXI : state.away.startingXI;
    const onPitch = xi.map((id) => state.playerStates[id]).filter((p) => p?.onPitch);
    if (onPitch.length === 0) return 100;
    return onPitch.reduce((acc, p) => acc + (100 - (p?.fatigue ?? 0)), 0) / onPitch.length;
  };

  const topRatings = (setup: "home" | "away") => {
    const xi = setup === "home" ? state.home.startingXI : state.away.startingXI;
    return xi
      .map((id) => ({ id, ps: state.playerStates[id], player: players[id] }))
      .filter((r) => r.ps && r.player)
      .sort((a, b) => (b.ps!.rating - a.ps!.rating))
      .slice(0, 3);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{homeClub?.shortName ?? "Home"}</span>
        <span>Live analytics</span>
        <span>{awayClub?.shortName ?? "Away"}</span>
      </div>

      <SplitBar label="Possession" homePct={possHome} />
      <SplitBar label="Momentum" homePct={Math.max(0, Math.min(100, momentumHomePct))} />

      <div className="flex flex-col gap-1.5 rounded-card border border-navy-700 p-2.5">
        <StatRow label="xG" home={Math.round(state.homeXg * 100) / 100} away={Math.round(state.awayXg * 100) / 100} />
        <StatRow label="Expected Threat" home={Math.round(state.homeXt * 100) / 100} away={Math.round(state.awayXt * 100) / 100} />
        <StatRow label="Shots" home={state.shotsHome} away={state.shotsAway} />
        <StatRow label="Shots on target" home={state.shotsOnTargetHome} away={state.shotsOnTargetAway} />
        <StatRow label="Pass accuracy" home={Math.round(passAccHome)} away={Math.round(passAccAway)} format={(n) => `${n}%`} />
        <StatRow label="Corners" home={state.cornersHome} away={state.cornersAway} />
        <StatRow label="Fouls" home={state.foulsHome} away={state.foulsAway} />
        <StatRow label="Squad stamina" home={Math.round(staminaFor("home"))} away={Math.round(staminaFor("away"))} format={(n) => `${n}%`} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["home", "away"] as const).map((side) => (
          <div key={side} className="flex flex-col gap-1 rounded-card border border-navy-700 p-2">
            <p className="text-[11px] text-ink-500">{side === "home" ? (homeClub?.shortName ?? "Home") : (awayClub?.shortName ?? "Away")} — top ratings</p>
            {topRatings(side).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-ink-200">{r.player!.lastName}</span>
                <span className="font-data text-ink-100">{r.ps!.rating.toFixed(1)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
