"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, RefreshCcw } from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { computeStandings } from "@/engines/world/standings";
import { computeSquadChemistry } from "@/engines/personality/personalityEngine";
import { formatMoney } from "@/lib/format";
import type { Player } from "@/domain/types";

function bucketLabel(score: number): { label: string; tone: "positive" | "neutral" | "warning" | "danger" } {
  if (score >= 80) return { label: "Excellent", tone: "positive" };
  if (score >= 60) return { label: "Very Good", tone: "positive" };
  if (score >= 45) return { label: "Good", tone: "positive" };
  if (score >= 30) return { label: "Okay", tone: "warning" };
  return { label: "Poor", tone: "danger" };
}

const TONE_TEXT: Record<string, string> = {
  positive: "text-positive-500", neutral: "text-ink-300", warning: "text-warning-500", danger: "text-accent-400",
};

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel flex flex-col gap-2.5 rounded-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-accent-400">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-1 flex items-center gap-0.5 text-xs text-ink-500 hover:text-accent-400">
      {label} <ChevronRight size={13} aria-hidden />
    </Link>
  );
}

export default function HomePage() {
  const world = useGameStore((s) => s.world);
  const openPlayerProfile = useGameStore((s) => s.openPlayerProfile);
  const [showFullTable, setShowFullTable] = useState(false);

  const club = world?.clubs[world.userClubId];
  const league = club ? world!.leagues[club.leagueId] : undefined;

  const standings = useMemo(() => (world && league ? computeStandings(world, league.id) : []), [world, league]);
  const userRank = standings.findIndex((r) => r.clubId === world?.userClubId) + 1;

  const nextFixture = useMemo(() => {
    if (!world || !club) return undefined;
    return Object.values(world.fixtures)
      .filter((f) => (f.homeClubId === club.id || f.awayClubId === club.id) && f.status === "scheduled")
      .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1))[0];
  }, [world, club]);

  const upcomingFixtures = useMemo(() => {
    if (!world || !club) return [];
    return Object.values(world.fixtures)
      .filter((f) => (f.homeClubId === club.id || f.awayClubId === club.id) && f.status === "scheduled")
      .sort((a, b) => (a.kickoff < b.kickoff ? -1 : 1))
      .slice(1, 5);
  }, [world, club]);

  const squad = useMemo(() => {
    if (!world || !club) return [];
    return club.squadIds.map((id) => world.players[id]).filter((p): p is Player => !!p);
  }, [world, club]);

  const teamStatus = useMemo(() => {
    if (!world || !club || squad.length === 0) return null;
    const avgMorale = squad.reduce((a, p) => a + p.morale, 0) / squad.length;
    const avgCondition = squad.reduce((a, p) => a + (100 - p.fatigue), 0) / squad.length;
    const chemistry = computeSquadChemistry(world, club.id);
    return {
      morale: bucketLabel(avgMorale),
      condition: bucketLabel(avgCondition),
      chemistry: bucketLabel(chemistry),
      injuries: squad.filter((p) => p.injuryStatus).length,
      suspensions: squad.filter((p) => p.suspension).length,
    };
  }, [world, club, squad]);

  const squadCondition = useMemo(() => {
    const ranked = [...squad].sort((a, b) => b.fatigue - a.fatigue).slice(0, 5);
    return ranked.map((p) => ({ p, condition: Math.round(100 - p.fatigue) }));
  }, [squad]);

  const playerOfTheWeek = useMemo(() => {
    const played = squad.filter((p) => p.seasonStats.appearances > 0);
    if (played.length === 0) return undefined;
    return [...played].sort((a, b) => b.seasonStats.averageRating - a.seasonStats.averageRating)[0];
  }, [squad]);

  const squadOverview = useMemo(() => {
    if (!world || !club) return null;
    const withAge = squad.map((p) => ({
      p, age: Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)),
    }));
    const u21 = withAge.filter((x) => x.age <= 21).length;
    const u18 = withAge.filter((x) => x.age <= 18).length;
    const avgAge = withAge.length ? withAge.reduce((a, x) => a + x.age, 0) / withAge.length : 0;
    const depth = squad.length ? Math.round(squad.reduce((a, p) => a + p.currentAbility, 0) / squad.length) : 0;
    return { players: squad.length, firstTeam: Math.min(squad.length, 22), u21, u18, avgAge, depth };
  }, [world, club, squad]);

  const recentNews = useMemo(() => {
    if (!world) return [];
    return Object.values(world.mediaStories).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  }, [world]);

  const seasonProfit = club
    ? club.finance.broadcastIncomeSeasonal + club.finance.matchdayIncomeSeasonal - club.finance.wageBudgetUsedWeekly * 52
    : 0;

  const unreadInbox = world ? Object.values(world.inboxItems).filter((i) => !i.read && !i.archived) : [];

  if (!world || !club) return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;

  const homeForm = standings.find((r) => r.clubId === club.id)?.form ?? [];
  const opponentId = nextFixture ? (nextFixture.homeClubId === club.id ? nextFixture.awayClubId : nextFixture.homeClubId) : undefined;
  const opponentForm = standings.find((r) => r.clubId === opponentId)?.form ?? [];
  const opponent = opponentId ? world.clubs[opponentId] : undefined;
  const opponentRank = standings.findIndex((r) => r.clubId === opponentId) + 1;

  return (
    <div className="home-dashboard-layout flex flex-col gap-4 py-3 pb-16">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Column 1 */}
        <div className="flex flex-col gap-4">
          <SectionCard title="Upcoming Fixture" right={<ChevronRight size={15} className="text-ink-500" />}>
            {nextFixture ? (
              <>
                <p className="text-xs text-ink-500">{league?.name ?? "Fixture"}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <ClubCrest clubId={club.id} abbreviation={club.abbreviation} color={club.colors.primary} size={44} />
                    <span className="text-xs text-ink-200">{club.shortName}</span>
                    <span className="text-[10px] text-ink-500">{userRank > 0 ? `${userRank}${ordinal(userRank)}` : ""}</span>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-ink-300">VS</div>
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <ClubCrest clubId={opponent?.id} abbreviation={opponent?.abbreviation} color={opponent?.colors.primary} size={44} />
                    <span className="text-xs text-ink-200">{opponent?.shortName ?? "TBC"}</span>
                    <span className="text-[10px] text-ink-500">{opponentRank > 0 ? `${opponentRank}${ordinal(opponentRank)}` : ""}</span>
                  </div>
                </div>
                <p className="text-center text-xs text-ink-300">{nextFixture.kickoff.slice(0, 10)}</p>
                <div className="flex items-center justify-between text-[11px]">
                  <FormStrip label={`${club.shortName.toUpperCase()} FORM`} form={homeForm} />
                  <FormStrip label={`${(opponent?.shortName ?? "OPP").toUpperCase()} FORM`} form={opponentForm} align="right" />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-500">No fixture scheduled.</p>
            )}
          </SectionCard>

          <SectionCard title="News Feed">
            <div className="flex flex-col gap-2.5">
              {recentNews.map((n) => (
                <div key={n.id} className="border-b border-navy-700 pb-2 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-ink-100">{n.headline}</p>
                  <p className="truncate text-xs text-ink-500">{n.body}</p>
                </div>
              ))}
              {recentNews.length === 0 && <p className="text-sm text-ink-500">No news yet.</p>}
            </div>
            <FooterLink href="/inbox" label="View All News" />
          </SectionCard>

          <SectionCard title="Upcoming Fixtures">
            <div className="flex flex-col gap-1.5 text-xs">
              {upcomingFixtures.map((f) => {
                const oppId = f.homeClubId === club.id ? f.awayClubId : f.homeClubId;
                const venue = f.homeClubId === club.id ? "H" : "A";
                return (
                  <div key={f.id} className="flex items-center justify-between border-b border-navy-700 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-ink-300">{f.kickoff.slice(0, 10)}</span>
                    <span className="flex-1 truncate px-2 text-ink-100">{world.clubs[oppId]?.shortName ?? "TBC"}</span>
                    <span className="font-data text-ink-500">{venue}</span>
                  </div>
                );
              })}
              {upcomingFixtures.length === 0 && <p className="text-sm text-ink-500">No further fixtures.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Training Overview">
            <p className="text-xs text-ink-500">
              Full training scheduling isn&apos;t simulated yet — this is a placeholder until the Training engine lands.
            </p>
            <FooterLink href="/training" label="View Training" />
          </SectionCard>
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-4">
          <SectionCard title="League Table" right={<button onClick={() => setShowFullTable(true)}><ChevronRight size={15} className="text-ink-500" /></button>}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="pb-1 font-normal">Pos</th>
                  <th className="pb-1 font-normal">Team</th>
                  <th className="pb-1 text-right font-normal">P</th>
                  <th className="pb-1 text-right font-normal">GD</th>
                  <th className="pb-1 text-right font-normal">Pts</th>
                  <th className="pb-1 pl-2 text-right font-normal">Form</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, 5).map((row, i) => {
                  const rowClub = world.clubs[row.clubId];
                  const isUser = row.clubId === club.id;
                  return (
                    <tr key={row.clubId} className={isUser ? "font-semibold text-accent-400" : "text-ink-300"}>
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1">
                        <span className="flex items-center gap-1.5">
                          <ClubCrest clubId={rowClub?.id} abbreviation={rowClub?.abbreviation} color={rowClub?.colors.primary} size={16} />
                          {rowClub?.shortName ?? "?"}
                        </span>
                      </td>
                      <td className="py-1 text-right font-data">{row.played}</td>
                      <td className="py-1 text-right font-data">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="py-1 text-right font-data">{row.points}</td>
                      <td className="py-1 pl-2"><span className="flex justify-end gap-0.5">{row.form.slice(0, 5).map((r, k) => (<span key={k} className={`h-2 w-2 rounded-full ${r === "W" ? "bg-positive-500" : r === "D" ? "bg-ink-500" : "bg-accent-500"}`} />))}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button onClick={() => setShowFullTable(true)} className="mt-1 w-full rounded-card border border-navy-600 py-1.5 text-xs text-ink-300 hover:bg-navy-800">
              View Full Table
            </button>
          </SectionCard>

          <SectionCard title="Squad Condition" right={<FooterLink href="/squad" label="" />}>
            <div className="flex flex-col gap-2">
              {squadCondition.map(({ p, condition }) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="w-28 truncate text-ink-300">{p.firstName[0]}. {p.lastName}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-700">
                    <div className={`h-full rounded-full ${condition >= 70 ? "bg-positive-500" : condition >= 45 ? "bg-warning-500" : "bg-accent-500"}`} style={{ width: `${condition}%` }} />
                  </div>
                  <span className="w-8 text-right font-data text-ink-100">{condition}%</span>
                </div>
              ))}
              {squadCondition.length === 0 && <p className="text-sm text-ink-500">No squad data.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Player of the Week">
            {playerOfTheWeek ? (
              <button onClick={() => openPlayerProfile(playerOfTheWeek.id)} className="flex items-center gap-3 text-left">
                <PlayerPhoto firstName={playerOfTheWeek.firstName} lastName={playerOfTheWeek.lastName} leagueId={league?.id ?? ""} clubId={club.id} size={56} />
                <div>
                  <p className="text-sm font-semibold text-ink-100">{playerOfTheWeek.firstName} {playerOfTheWeek.lastName}</p>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-ink-500">Apps <b className="text-ink-100">{playerOfTheWeek.seasonStats.appearances}</b></span>
                    <span className="text-ink-500">Goals <b className="text-ink-100">{playerOfTheWeek.seasonStats.goals}</b></span>
                    <span className="text-ink-500">Assists <b className="text-ink-100">{playerOfTheWeek.seasonStats.assists}</b></span>
                    <span className="text-ink-500">Rating <b className="text-positive-500">{playerOfTheWeek.seasonStats.averageRating.toFixed(1)}</b></span>
                  </div>
                </div>
              </button>
            ) : <p className="text-sm text-ink-500">No standout player yet.</p>}
          </SectionCard>

          <SectionCard title="Squad Overview" right={<FooterLink href="/squad" label="View Squad" />}>
            {squadOverview && (
              <div className="flex items-center gap-4">
                <CircularGauge value={squadOverview.depth} />
                <div className="grid flex-1 grid-cols-2 gap-y-1 text-xs">
                  <span className="text-ink-500">Players</span><span className="text-right font-data text-ink-100">{squadOverview.players}</span>
                  <span className="text-ink-500">First Team</span><span className="text-right font-data text-ink-100">{squadOverview.firstTeam}</span>
                  <span className="text-ink-500">U21</span><span className="text-right font-data text-ink-100">{squadOverview.u21}</span>
                  <span className="text-ink-500">U18</span><span className="text-right font-data text-ink-100">{squadOverview.u18}</span>
                  <span className="text-ink-500">Avg Age</span><span className="text-right font-data text-ink-100">{squadOverview.avgAge.toFixed(1)}</span>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Column 3 */}
        <div className="flex flex-col gap-4">
          <SectionCard title="Team Status" right={<RefreshCcw size={13} className="text-ink-500" />}>
            {teamStatus && (
              <div className="flex flex-col gap-1.5 text-sm">
                <Row label="Morale" value={teamStatus.morale.label} tone={teamStatus.morale.tone} />
                <Row label="Team Condition" value={teamStatus.condition.label} tone={teamStatus.condition.tone} />
                <Row label="Injuries" value={String(teamStatus.injuries)} tone={teamStatus.injuries > 0 ? "warning" : "positive"} />
                <Row label="Suspensions" value={String(teamStatus.suspensions)} tone={teamStatus.suspensions > 0 ? "warning" : "positive"} />
                <Row label="Team Chemistry" value={teamStatus.chemistry.label} tone={teamStatus.chemistry.tone} />
              </div>
            )}
            <FooterLink href="/squad" label="View Team" />
          </SectionCard>

          <SectionCard title="Finances Overview" right={<FooterLink href="/finances" label="" />}>
            <div className="flex flex-col gap-1.5 text-sm">
              <Row label="Balance" value={formatMoney(club.finance.balance)} tone="positive" />
              <Row label="Season Profit/(Loss)" value={formatMoney(seasonProfit)} tone={seasonProfit >= 0 ? "positive" : "danger"} />
              <Row label="Wage Budget" value={`${formatMoney(club.finance.wageBudgetWeekly)} p/w`} tone="neutral" />
              <Row label="Wage Spending" value={`${formatMoney(club.finance.wageBudgetUsedWeekly)} p/w`} tone="neutral" />
              <Row label="Transfer Budget" value={formatMoney(club.finance.transferBudget)} tone="positive" />
            </div>
            <FooterLink href="/finances" label="View Finances" />
          </SectionCard>

          <SectionCard title="Competitions" right={<FooterLink href="/competitions" label="" />}>
            <div className="flex flex-col gap-1.5 text-sm">
              <Row label={league?.name ?? "League"} value={userRank > 0 ? `${userRank}${ordinal(userRank)}` : "—"} tone="neutral" />
            </div>
            <p className="mt-1 text-[11px] text-ink-500">Cup competitions aren&apos;t simulated yet.</p>
            <FooterLink href="/competitions" label="View Competitions" />
          </SectionCard>
        </div>
      </div>

      {/* Bottom inbox strip */}
      <div className="glass-panel fixed bottom-0 left-16 right-0 z-10 flex items-center gap-3 rounded-none border-x-0 border-b-0 px-4 py-2 md:left-60">
        <span className="rounded-card bg-accent-500 px-2.5 py-1 text-xs font-bold text-white">Inbox</span>
        <p className="flex-1 truncate text-xs text-ink-300">
          {unreadInbox[0]?.subject ?? "No new messages"}
        </p>
        <Link href="/inbox" className="flex items-center gap-1 text-xs text-accent-400">
          {unreadInbox.length} Unread <ChevronRight size={13} />
        </Link>
      </div>

      {showFullTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowFullTable(false)}>
          <div className="glass-panel max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink-100">{league?.name} — Full table</h2>
              <button onClick={() => setShowFullTable(false)} className="text-sm text-ink-500">Close</button>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "positive" | "neutral" | "warning" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className={`font-data font-semibold ${TONE_TEXT[tone]}`}>{value}</span>
    </div>
  );
}

function FormStrip({ label, form, align = "left" }: { label: string; form: ("W" | "D" | "L")[]; align?: "left" | "right" }) {
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <span className="text-ink-500">{label}</span>
      <div className="flex gap-0.5">
        {form.map((r, i) => (
          <span
            key={i}
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
              r === "W" ? "bg-positive-500" : r === "D" ? "bg-ink-500" : "bg-accent-500"
            }`}
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

function CircularGauge({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const tone = bucketLabel(value);
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#1A2030" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={tone.tone === "positive" ? "#2FE38A" : tone.tone === "warning" ? "#F5C445" : "#E51E2B"}
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-data text-lg font-bold text-ink-100">{value}</span>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}
