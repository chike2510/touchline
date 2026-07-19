"use client";
import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel flex flex-col gap-2 rounded-card p-4">
      <div>
        <p className="text-sm font-bold text-ink-100">{title}</p>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function DataHubPage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];
  const league = club ? world!.leagues[club.leagueId] : undefined;

  const leaguePlayers = useMemo(() => {
    if (!world || !league) return [];
    const clubIds = new Set(league.clubIds);
    return Object.values(world.players).filter((p) => p.clubId && clubIds.has(p.clubId));
  }, [world, league]);

  const topScorers = useMemo(() => [...leaguePlayers].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals).slice(0, 8), [leaguePlayers]);
  const topAssists = useMemo(() => [...leaguePlayers].sort((a, b) => b.seasonStats.assists - a.seasonStats.assists).slice(0, 8), [leaguePlayers]);
  const topRated = useMemo(
    () => [...leaguePlayers].filter((p) => p.seasonStats.appearances >= 3).sort((a, b) => b.seasonStats.averageRating - a.seasonStats.averageRating).slice(0, 8),
    [leaguePlayers]
  );

  if (!world || !club || !league) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Data Hub</h1>
      <p className="text-xs text-ink-500">Statistical leaders across {league.name}, {leaguePlayers.length} players tracked.</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <LeaderboardCard title="Top Scorers" players={topScorers} world={world} stat={(p) => p.seasonStats.goals} statLabel="Gls" />
        <LeaderboardCard title="Top Assists" players={topAssists} world={world} stat={(p) => p.seasonStats.assists} statLabel="Ast" />
        <LeaderboardCard title="Highest Rated" players={topRated} world={world} stat={(p) => p.seasonStats.averageRating.toFixed(2)} statLabel="Av Rat" />
      </div>

      <SectionCard title="More Analytics">
        <p className="text-sm text-ink-500">
          Deeper cross-league analytics (heat maps, pass networks, opposition scouting dashboards) aren&apos;t built yet — this hub currently covers season stat leaders only.
        </p>
      </SectionCard>
    </div>
  );
}

function LeaderboardCard({
  title, players, world, stat, statLabel,
}: {
  title: string;
  players: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["players"][string][];
  world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>;
  stat: (p: (typeof players)[number]) => string | number;
  statLabel: string;
}) {
  return (
    <SectionCard title={title}>
      <div className="flex flex-col gap-1.5">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-ink-200">
              <span className="w-4 text-xs text-ink-500">{i + 1}</span>
              <PlayerPhoto firstName={p.firstName} lastName={p.lastName} leagueId={world.clubs[p.clubId ?? ""]?.leagueId ?? ""} clubId={p.clubId ?? ""} size={22} />
              {p.lastName}
            </span>
            <span className="font-data font-semibold text-ink-100">{stat(p)} <span className="text-xs text-ink-500">{statLabel}</span></span>
          </div>
        ))}
        {players.length === 0 && <p className="text-xs text-ink-500">No data yet.</p>}
      </div>
    </SectionCard>
  );
}
