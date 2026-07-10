"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { generateScoutingReport } from "@/engines/transfers/scouting";
import { caToOverall } from "@/components/tactics/FormationPitch";

export default function ScoutingPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [query, setQuery] = useState("");
  const club = world?.clubs[world.userClubId];

  const scout = useMemo(() => {
    if (!world || !club) return undefined;
    return club.staffIds.map((id) => world.staff[id]).find((s) => s?.role === "chief-scout");
  }, [world, club]);

  const reports = useMemo(() => {
    if (!world || !club) return [];
    return Object.values(world.scoutingReports)
      .filter((r) => r.clubId === club.id)
      .sort((a, b) => (a.createdDate < b.createdDate ? 1 : -1));
  }, [world, club]);

  const searchResults = useMemo(() => {
    if (!world || !club || query.trim().length < 2) return [];
    return Object.values(world.players)
      .filter((p) => p.clubId && p.clubId !== club.id && p.lastName.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8);
  }, [world, club, query]);

  if (!world || !club) return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;

  function handleScout(playerId: string) {
    if (!scout) return;
    const player = world!.players[playerId];
    if (!player) return;
    const report = generateScoutingReport(world!, scout, player, club!.id);
    mutateWorld((w) => {
      w.scoutingReports[report.id] = report;
    });
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-4 py-3">
      <h1 className="font-display text-2xl text-ink-100">Scouting</h1>

      {!scout && (
        <Card>
          <p className="text-sm text-ink-300">
            You don&apos;t have a chief scout on staff yet, so new reports can&apos;t be generated — existing reports
            below still show what&apos;s been assessed so far.
          </p>
        </Card>
      )}

      {scout && (
        <Card>
          <CardHeader title="Scout a player" subtitle={`Using ${scout.firstName} ${scout.lastName} (chief scout)`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by last name…"
            className="w-full rounded-card border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleScout(p.id)}
                  className="flex items-center justify-between rounded-card px-2 py-1.5 text-left text-sm text-ink-200 hover:bg-navy-800"
                >
                  <span>{p.firstName} {p.lastName} <span className="text-ink-500">({world.clubs[p.clubId!]?.shortName})</span></span>
                  <span className="text-xs text-accent-400">Scout</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Scouting reports" subtitle={`${reports.length} on file`} />
        <div className="flex flex-col gap-2">
          {reports.map((r) => {
            const player = world.players[r.playerId];
            if (!player) return null;
            return (
              <div key={r.id} className="flex items-center justify-between border-b border-navy-600 pb-2 text-sm last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-ink-100">{player.firstName} {player.lastName}</p>
                  <p className="text-xs text-ink-500">{r.recommendation.replace(/-/g, " ")} • confidence {r.confidence}%</p>
                </div>
                <div className="text-right font-data text-sm">
                  <p className="text-ink-100">{caToOverall(r.estimatedCurrentAbility)} CA</p>
                  <p className="text-accent-400">{caToOverall(r.estimatedPotentialAbility)} PA</p>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && <p className="text-sm text-ink-500">No scouting reports yet.</p>}
        </div>
      </Card>
    </div>
  );
}
