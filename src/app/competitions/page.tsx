"use client";
import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { computeStandings } from "@/engines/world/standings";

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

export default function CompetitionsPage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];
  const league = club ? world!.leagues[club.leagueId] : undefined;
  const standings = useMemo(() => (world && league ? computeStandings(world, league.id) : []), [world, league]);

  if (!world || !club || !league) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;
  const userRank = standings.findIndex((r) => r.clubId === club.id) + 1;

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Competitions</h1>

      <SectionCard title={league.name} subtitle={`Currently ${userRank}${ordinal(userRank)} of ${standings.length}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-600 text-left text-xs text-ink-500">
              <th className="py-1.5">#</th><th className="py-1.5">Club</th>
              <th className="py-1.5 text-right">P</th><th className="py-1.5 text-right">W</th>
              <th className="py-1.5 text-right">D</th><th className="py-1.5 text-right">L</th>
              <th className="py-1.5 text-right">GD</th><th className="py-1.5 text-right">Pts</th>
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
      </SectionCard>

      <SectionCard title="Cup Competitions">
        <p className="text-sm text-ink-500">
          Domestic cups, continental competitions, and friendlies aren&apos;t simulated yet — only the league table above is real right now.
        </p>
      </SectionCard>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}
