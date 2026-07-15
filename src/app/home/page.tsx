"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { AttributeRadar } from "@/components/squad/AttributeRadar";
import { caToOverall } from "@/components/tactics/FormationPitch";
import { DashboardPitch } from "@/components/tactics/DashboardPitch";
import { computeStandings } from "@/engines/world/standings";
import type { Fixture, Player, SaveGameWorld } from "@/domain/types";

export default function HomePage() {
  const world = useGameStore((s) => s.world);
  const meta = useGameStore((s) => s.meta);
  const openPlayerProfile = useGameStore((s) => s.openPlayerProfile);

  const [showFullTable, setShowFullTable] = useState(false);
  const [showFullFixtures, setShowFullFixtures] = useState(false);
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

  // Grouped by competition so cup competitions/friendlies (once modeled)
  // slot in automatically — right now every fixture is league play, so
  // there's a single group, but the structure doesn't need to change later.
  const fixturesByCompetition = useMemo(() => {
    if (!world || !club) return [];
    const all = Object.values(world.fixtures)
      .filter((f) => f.homeClubId === club.id || f.awayClubId === club.id)
      .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1));
    const groups = new Map<string, Fixture[]>();
    for (const f of all) {
      const name = (f.leagueId ? world.leagues[f.leagueId]?.name : undefined)
        ?? (f.competitionId ? world.competitions[f.competitionId]?.name : undefined)
        ?? "Other";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(f);
    }
    return [...groups.entries()];
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
      played: completed.length, scored, conceded,
      avgPossession: completed.length ? Math.round(possessionSum / completed.length) : 50,
    };
  }, [world, club]);

  const topScorers = useMemo(() => {
    if (!world || !league) return [];
    return league.clubIds
      .flatMap((id) => world.clubs[id]?.squadIds ?? [])
      .map((id) => world.players[id])
      .filter((p): p is Player => !!p && p.seasonStats.goals > 0)
      .sort((a, b) => b.seasonStats.goals - a.seasonStats.goals)
      .slice(0, 5);
  }, [world, league]);

  const recentInbox = useMemo(() => {
    if (!world) return [];
    return Object.values(world.inboxItems).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  }, [world]);

  const squadList = useMemo(() => {
    if (!world || !club) return [];
    return club.squadIds.map((id) => world.players[id]).filter((p): p is Player => !!p).slice(0, 12);
  }, [world, club]);

  const starMan = useMemo(() => {
    if (squadList.length === 0) return undefined;
    return [...squadList].sort((a, b) => b.currentAbility - a.currentAbility)[0];
  }, [squadList]);

  if (!world || !club) {
    return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;
  }

  return (
    <div className="flex flex-col gap-4 py-3">
      <div>
        <p className="text-xs text-ink-500">Good morning, {manager?.firstName ?? meta?.managerName}</p>
        <div className="flex items-center gap-3">
          <ClubCrest clubId={club.id} abbreviation={club.abbreviation} color={club.colors.primary} size={32} />
          <h1 className="font-display text-2xl text-ink-100">{club.name}</h1>
          {userRow && userRow.form.length > 0 && (
            <div className="ml-2 flex items-center gap-1">
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ---- Left column: stat cards, inbox, squad --------------------- */}
        <div className="flex flex-col gap-4 xl:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="cursor-pointer" onClick={() => setShowFullFixtures(true)}>
              <Card>
                <CardHeader title="Next Fixture" subtitle={league ? `${league.name} • tap for full list` : undefined} />
                {nextFixture ? (
                  <NextFixtureBlock world={world} fixture={nextFixture} userClubId={club.id} />
                ) : (
                  <p className="text-sm text-ink-500">No fixture scheduled.</p>
                )}
              </Card>
            </div>

            <div className="cursor-pointer" onClick={() => setShowFullTable(true)}>
              <Card>
                <CardHeader title="League Standings" subtitle={userRow ? `${userRank}${ordinal(userRank)} place • tap for full table` : league?.name} />
              <table className="w-full text-sm">
                <tbody>
                  {standings.slice(0, 5).map((row, i) => {
                    const rowClub = world.clubs[row.clubId];
                    const isUser = row.clubId === club.id;
                    return (
                      <tr key={row.clubId} className={isUser ? "text-ink-100" : "text-ink-300"}>
                        <td className="w-5 py-0.5 font-data text-xs text-ink-500">{i + 1}</td>
                        <td className="py-0.5">
                          <div className="flex items-center gap-1.5">
                            <ClubCrest clubId={rowClub?.id} abbreviation={rowClub?.abbreviation} color={rowClub?.colors.primary} size={16} />
                            <span className="truncate text-xs">{rowClub?.shortName ?? "?"}</span>
                          </div>
                        </td>
                        <td className="py-0.5 text-right font-data text-xs font-semibold">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            </div>

            <Card>
              <CardHeader title="Club Statistics" subtitle="This season" />
              {clubStats && (
                <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <StatRow label="Played" value={clubStats.played} />
                  <StatRow label="Scored" value={clubStats.scored} />
                  <StatRow label="Conceded" value={clubStats.conceded} />
                  <StatRow label="Poss." value={`${clubStats.avgPossession}%`} />
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Top Scorer" subtitle={league?.name} />
              {topScorers[0] ? (
                <button onClick={() => openPlayerProfile(topScorers[0]!.id)} className="flex w-full items-center gap-2 text-left">
                  <PlayerPhoto firstName={topScorers[0].firstName} lastName={topScorers[0].lastName} leagueId={league?.id ?? ""} clubId={topScorers[0].clubId ?? club.id} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-100">{topScorers[0].firstName} {topScorers[0].lastName}</p>
                    <p className="font-data text-xs text-ink-500">{topScorers[0].seasonStats.goals} goals</p>
                  </div>
                </button>
              ) : (
                <p className="text-sm text-ink-500">No goals yet this season.</p>
              )}
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader title="Top Scorers" subtitle={league?.name} right={<Link href="/squad" className="text-xs text-accent-400">View squad</Link>} />
              <div className="flex flex-col gap-1">
                {topScorers.map((p, i) => (
                  <button key={p.id} onClick={() => openPlayerProfile(p.id)} className="flex items-center justify-between text-left text-sm">
                    <span className="flex items-center gap-2 truncate text-ink-200">
                      <span className="font-data text-xs text-ink-500">{i + 1}</span>
                      <PlayerPhoto firstName={p.firstName} lastName={p.lastName} leagueId={league?.id ?? ""} clubId={p.clubId ?? club.id} size={22} />
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="font-data font-semibold text-ink-100">{p.seasonStats.goals}</span>
                  </button>
                ))}
                {topScorers.length === 0 && <p className="text-sm text-ink-500">No goals scored yet this season.</p>}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Inbox"
              subtitle={`${Object.values(world.inboxItems).filter((i) => !i.read).length} unread`}
              right={<Link href="/inbox" className="text-xs text-accent-400">View all</Link>}
            />
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

          <Card>
            <CardHeader title="Squad" subtitle={`${club.squadIds.length} players`} right={<Link href="/squad" className="text-xs text-accent-400">Full squad</Link>} />
            <div className="flex gap-3 overflow-x-auto pb-1">
              {squadList.map((p, i) => (
                <button key={p.id} onClick={() => openPlayerProfile(p.id)} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
                  <div className="relative">
                    <PlayerPhoto firstName={p.firstName} lastName={p.lastName} leagueId={league?.id ?? ""} clubId={club.id} size={44} />
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                      {caToOverall(p.currentAbility)}
                    </span>
                  </div>
                  <span className="w-full truncate text-[11px] text-ink-300">{p.lastName}</span>
                  <span className="text-[10px] text-ink-500">#{i + 1}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ---- Right column: tactics board + radar + matchday preview --- */}
        <div className="flex flex-col gap-4 xl:col-span-4">
          <DashboardPitch tactic={world.activeTactic} players={world.players} leagueId={league?.id ?? ""} clubId={club.id} />

          <Card>
            <CardHeader title="Player Analysis" subtitle={starMan ? `${starMan.firstName} ${starMan.lastName}` : undefined} />
            {starMan ? <AttributeRadar player={starMan} /> : <p className="text-sm text-ink-500">No squad data.</p>}
          </Card>

          <Card>
            <CardHeader title="Matchday" subtitle={nextFixture ? nextFixture.kickoff.slice(0, 10) : "No fixture"} />
            <p className="mb-2 text-sm text-ink-300">
              {nextFixture ? "Everything's set for the next fixture." : "Nothing scheduled right now."}
            </p>
            <Link href="/matchday" className="block rounded-card bg-accent-500 px-3 py-2 text-center text-sm font-semibold text-white active:scale-95">
              Go to matchday
            </Link>
          </Card>
        </div>
      </div>

      {showFullTable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowFullTable(false)}
        >
          <div
            className="glass-panel max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink-100">{league?.name} — Full table</h2>
              <button onClick={() => setShowFullTable(false)} className="text-sm text-ink-500">Close</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-left text-xs text-ink-500">
                  <th className="py-1.5">#</th>
                  <th className="py-1.5">Club</th>
                  <th className="py-1.5 text-right">P</th>
                  <th className="py-1.5 text-right">W</th>
                  <th className="py-1.5 text-right">D</th>
                  <th className="py-1.5 text-right">L</th>
                  <th className="py-1.5 text-right">GD</th>
                  <th className="py-1.5 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const rowClub = world.clubs[row.clubId];
                  const isUser = row.clubId === club.id;
                  return (
                    <tr key={row.clubId} className={`border-b border-navy-700 last:border-0 ${isUser ? "bg-accent-500/10 text-ink-100" : "text-ink-300"}`}>
                      <td className="py-1 font-data text-xs">{i + 1}</td>
                      <td className="py-1">
                        <div className="flex items-center gap-1.5">
                          <ClubCrest clubId={rowClub?.id} abbreviation={rowClub?.abbreviation} color={rowClub?.colors.primary} size={16} />
                          <span className="truncate text-xs">{rowClub?.name ?? "?"}</span>
                        </div>
                      </td>
                      <td className="py-1 text-right font-data text-xs">{row.played}</td>
                      <td className="py-1 text-right font-data text-xs">{row.won}</td>
                      <td className="py-1 text-right font-data text-xs">{row.drawn}</td>
                      <td className="py-1 text-right font-data text-xs">{row.lost}</td>
                      <td className="py-1 text-right font-data text-xs">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="py-1 text-right font-data text-xs font-semibold">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showFullFixtures && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowFullFixtures(false)}
        >
          <div
            className="glass-panel max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink-100">{club.name} — Fixtures</h2>
              <button onClick={() => setShowFullFixtures(false)} className="text-sm text-ink-500">Close</button>
            </div>
            {fixturesByCompetition.map(([competitionName, fixtures]) => (
              <div key={competitionName} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{competitionName}</p>
                <div className="flex flex-col gap-1">
                  {fixtures.map((f) => {
                    const isHome = f.homeClubId === club.id;
                    const oppId = isHome ? f.awayClubId : f.homeClubId;
                    const opp = world.clubs[oppId];
                    const isPast = f.status === "completed";
                    const scoreLine = isPast && f.result
                      ? `${isHome ? f.result.homeGoals : f.result.awayGoals}-${isHome ? f.result.awayGoals : f.result.homeGoals}`
                      : null;
                    return (
                      <div key={f.id} className="flex items-center justify-between rounded-card px-2 py-1.5 text-sm hover:bg-navy-800">
                        <div className="flex items-center gap-2">
                          <ClubCrest clubId={opp?.id} abbreviation={opp?.abbreviation} color={opp?.colors.primary} size={18} />
                          <span className="text-ink-200">{opp?.name ?? "TBC"}</span>
                          <Badge tone={isHome ? "success" : "neutral"}>{isHome ? "H" : "A"}</Badge>
                        </div>
                        <div className="text-right">
                          {scoreLine ? (
                            <span className="font-data font-semibold text-ink-100">{scoreLine}</span>
                          ) : (
                            <span className="font-data text-xs text-ink-500">{f.kickoff.slice(0, 10)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {fixturesByCompetition.length === 0 && <p className="text-sm text-ink-500">No fixtures found.</p>}
            <p className="mt-2 text-xs text-ink-500">
              Cup competitions and friendlies aren&apos;t modeled yet — this shows league fixtures only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NextFixtureBlock({ world, fixture, userClubId }: { world: SaveGameWorld; fixture: Fixture; userClubId: string }) {
  const home = world.clubs[fixture.homeClubId];
  const away = world.clubs[fixture.awayClubId];
  const isHome = fixture.homeClubId === userClubId;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <TeamBadge clubId={home?.id} name={home?.shortName ?? "TBC"} abbreviation={home?.abbreviation} color={home?.colors.primary} />
        <span className="text-sm font-medium text-ink-500">VS</span>
        <TeamBadge clubId={away?.id} name={away?.shortName ?? "TBC"} abbreviation={away?.abbreviation} color={away?.colors.primary} />
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-ink-300">
        {fixture.kickoff.slice(0, 10)}
        <Badge tone={isHome ? "success" : "neutral"}>{isHome ? "Home" : "Away"}</Badge>
      </div>
    </div>
  );
}

function TeamBadge({ clubId, name, abbreviation, color }: { clubId?: string; name: string; abbreviation?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <ClubCrest clubId={clubId} abbreviation={abbreviation} color={color} size={36} />
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
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}
