"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { computeStandings } from "@/engines/world/standings";

export default function HomePage() {
  const world = useGameStore((s) => s.world);
  const meta = useGameStore((s) => s.meta);

  const club = world?.clubs[world.userClubId];
  const manager = world?.managers[world.userManagerId];
  const league = club ? world!.leagues[club.leagueId] : undefined;

  const standings = useMemo(() => (world && league ? computeStandings(world, league.id) : []), [world, league]);
  const userRow = standings.find((r) => r.clubId === world?.userClubId);
  const userRank = standings.findIndex((r) => r.clubId === world?.userClubId) + 1;

  const nextFixture = useMemo(() => {
    if (!world || !club) return undefined;
    return Object.values(world.fixtures)
      .filter((f) => (f.homeClubId === club.id || f.awayClubId === club.id) && f.status === "scheduled")
      .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1))[0];
  }, [world, club]);

  const clubStats = useMemo(() => {
    if (!world || !club) return null;
    const completed = Object.values(world.fixtures).filter(
      (f) => f.status === "completed" && f.result && (f.homeClubId === club.id || f.awayClubId === club.id)
    );
    let scored = 0, conceded = 0, possessionSum = 0;
    for (const f of completed) {
      const isHome = f.homeClubId === club.id;
      scored += isHome ? f.result!.homeGoals : f.result!.awayGoals;
      conceded += isHome ? f.result!.awayGoals : f.result!.homeGoals;
      possessionSum += isHome ? f.result!.possessionHome : 100 - f.result!.possessionHome;
    }
    return {
      played: completed.length,
      scored,
      conceded,
      avgPossession: completed.length ? Math.round(possessionSum / completed.length) : 50,
    };
  }, [world, club]);

  const topScorers = useMemo(() => {
    if (!world || !league) return [];
    return league.clubIds
      .flatMap((id) => world.clubs[id]?.squadIds ?? [])
      .map((id) => world.players[id])
      .filter((p) => p && p.seasonStats.goals > 0)
      .sort((a, b) => b!.seasonStats.goals - a!.seasonStats.goals)
      .slice(0, 5);
  }, [world, league]);

  const recentInbox = useMemo(() => {
    if (!world) return [];
    return Object.values(world.inboxItems)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);
  }, [world]);

  if (!world || !club) {
    return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 py-3 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <p className="mb-1 text-xs text-ink-500">Good morning, {manager?.firstName ?? meta?.managerName}</p>
        <h1 className="mb-1 font-display text-2xl text-ink-100">Home</h1>
        {userRow && userRow.form.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-500">Recent form</span>
            {userRow.form.map((r, i) => (
              <span
                key={i}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                  r === "W" ? "bg-positive-500" : r === "D" ? "bg-ink-500" : "bg-danger-500"
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="hidden lg:col-span-2 lg:block" />

      {/* Next match ------------------------------------------------------ */}
      <Card>
        <CardHeader title="Next match" subtitle={league?.name} />
        {nextFixture ? (
          <NextFixtureBlock world={world} fixture={nextFixture} userClubId={club.id} />
        ) : (
          <p className="text-sm text-ink-500">No fixture scheduled.</p>
        )}
      </Card>

      {/* League table ------------------------------------------------------ */}
      <Card className="lg:col-span-1">
        <CardHeader title={league?.name ?? "League"} subtitle={userRow ? `${userRank}${ordinal(userRank)} place` : undefined} />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-500">
              <th className="w-6 pb-1.5">Pos</th>
              <th className="pb-1.5">Team</th>
              <th className="w-8 pb-1.5 text-right">P</th>
              <th className="w-10 pb-1.5 text-right">GD</th>
              <th className="w-8 pb-1.5 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.slice(0, 6).map((row, i) => {
              const rowClub = world.clubs[row.clubId];
              const isUser = row.clubId === club.id;
              return (
                <tr key={row.clubId} className={isUser ? "bg-accent-500/10 text-ink-100" : "text-ink-300"}>
                  <td className="py-1 font-data">{i + 1}</td>
                  <td className="truncate py-1 font-medium">{rowClub?.shortName ?? "?"}</td>
                  <td className="py-1 text-right font-data">{row.played}</td>
                  <td className="py-1 text-right font-data">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td className="py-1 text-right font-data font-semibold">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Inbox preview ------------------------------------------------------ */}
      <Card>
        <CardHeader title="Inbox" subtitle={`${Object.values(world.inboxItems).filter((i) => !i.read).length} unread`} right={
          <Link href="/inbox" className="text-xs text-accent-400">View all</Link>
        } />
        <div className="flex flex-col gap-2">
          {recentInbox.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 border-b border-navy-600 pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-100">{item.subject}</p>
                <p className="truncate text-xs text-ink-500">{item.body}</p>
              </div>
              {!item.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />}
            </div>
          ))}
          {recentInbox.length === 0 && <p className="text-sm text-ink-500">Nothing new.</p>}
        </div>
      </Card>

      {/* Club stats ------------------------------------------------------ */}
      {clubStats && (
        <Card>
          <CardHeader title="Club stats" subtitle="This season" />
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <StatRow label="Played" value={clubStats.played} />
            <StatRow label="Goals scored" value={clubStats.scored} />
            <StatRow label="Goals conceded" value={clubStats.conceded} />
            <StatRow label="Avg. possession" value={`${clubStats.avgPossession}%`} />
          </div>
        </Card>
      )}

      {/* Top scorers ------------------------------------------------------ */}
      <Card>
        <CardHeader title="Top scorers" subtitle={league?.name} />
        <div className="flex flex-col gap-1.5">
          {topScorers.map((p, i) => (
            <div key={p!.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-ink-200">
                <span className="mr-2 font-data text-ink-500">{i + 1}</span>
                {p!.firstName} {p!.lastName}
              </span>
              <span className="font-data font-semibold text-ink-100">{p!.seasonStats.goals}</span>
            </div>
          ))}
          {topScorers.length === 0 && <p className="text-sm text-ink-500">No goals scored yet this season.</p>}
        </div>
      </Card>
    </div>
  );
}

function NextFixtureBlock({
  world, fixture, userClubId,
}: { world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>; fixture: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["fixtures"][string]; userClubId: string }) {
  const home = world.clubs[fixture.homeClubId];
  const away = world.clubs[fixture.awayClubId];
  const isHome = fixture.homeClubId === userClubId;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <TeamBadge name={home?.shortName ?? "TBC"} color={home?.colors.primary} />
        <span className="text-sm font-medium text-ink-500">VS</span>
        <TeamBadge name={away?.shortName ?? "TBC"} color={away?.colors.primary} />
      </div>
      <div className="text-center text-sm text-ink-300">
        {fixture.kickoff.slice(0, 10)} • {home?.stadium.name}
        <Badge tone={isHome ? "success" : "neutral"}>{isHome ? "Home" : "Away"}</Badge>
      </div>
      <Link href="/matchday" className="rounded-card bg-accent-500 px-3 py-2 text-center text-sm font-semibold text-white active:scale-95">
        Go to matchday
      </Link>
    </div>
  );
}

function TeamBadge({ name, color }: { name: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-card text-xs font-bold text-white" style={{ backgroundColor: color ?? "#3B82F6" }}>
        {name.slice(0, 3).toUpperCase()}
      </div>
      <span className="text-xs text-ink-300">{name}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-data font-semibold text-ink-100">{value}</span>
    </>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0]!;
}
