"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/state/gameStore";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { estimateMarketValue, transferWindowInfo } from "@/engines/transfers/transferEngine";
import { formatMoney, formatMoneyPerWeek } from "@/lib/format";
import type { ID, Player } from "@/domain/types";

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel flex flex-col gap-2 rounded-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink-100">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function TransfersPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const router = useRouter();
  const [query, setQuery] = useState("");

  const club = world?.clubs[world.userClubId];

  const shortlist = useMemo(() => {
    if (!world || !club) return [];
    return (world.shortlistedPlayerIds ?? [])
      .map((id) => world.players[id])
      .filter((p): p is Player => !!p);
  }, [world, club]);

  const searchResults = useMemo(() => {
    if (!world || !club || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return Object.values(world.players)
      .filter((p) => p.clubId !== club.id)
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [world, club, query]);

  const activity = useMemo(() => {
    if (!world || !club) return { playersIn: 0, playersOut: 0, bidsMade: 0, bidsReceived: 0 };
    const offers = Object.values(world.transferOffers);
    return {
      playersIn: offers.filter((o) => o.toClubId === club.id && o.status === "completed").length,
      playersOut: offers.filter((o) => o.fromClubId === club.id && o.status === "completed").length,
      bidsMade: offers.filter((o) => o.fromClubId === club.id && o.status === "pending").length,
      bidsReceived: offers.filter((o) => {
        const player = world.players[o.playerId];
        return player?.clubId === club.id && o.fromClubId !== club.id && o.status === "pending";
      }).length,
    };
  }, [world, club]);

  const loanAvailable = useMemo(() => {
    if (!world || !club) return 0;
    return Object.values(world.transferListings).filter((l) => l.clubId === club.id && l.loanAvailable).length;
  }, [world, club]);

  const scoutReports = useMemo(() => {
    if (!world || !club) return [];
    return Object.values(world.scoutingReports).filter((r) => r.clubId === club.id).sort((a, b) => (a.createdDate < b.createdDate ? 1 : -1));
  }, [world, club]);

  const scoutStaff = useMemo(() => {
    if (!world || !club) return [];
    return Object.values(world.staff).filter((s) => s.clubId === club.id && s.role === "chief-scout");
  }, [world, club]);

  const news = useMemo(() => {
    if (!world) return [];
    return Object.values(world.mediaStories)
      .filter((n) => n.category === "transfer-rumour")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);
  }, [world]);

  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;
  const windowInfo = transferWindowInfo(world.currentDate);
  const scoutingBudget = Math.round(club.finance.transferBudget * 0.15);

  function toggleShortlist(id: ID) {
    mutateWorld((w) => {
      const current = w.shortlistedPlayerIds ?? [];
      w.shortlistedPlayerIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Transfers</h1>

      {!windowInfo.open && (
        <div className="rounded-card border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-sm text-warning-500">
          The transfer window is currently closed. Opens in {windowInfo.daysRemaining} days — contract renewals, scouting, and loan recalls are still available.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SectionCard title="Transfer Budget"><p className="font-data text-xl font-bold text-positive-500">{formatMoney(club.finance.transferBudget)}</p></SectionCard>
        <SectionCard title="Wage Budget"><p className="font-data text-xl font-bold text-positive-500">{formatMoneyPerWeek(club.finance.wageBudgetWeekly)}</p></SectionCard>
        <SectionCard title="Scouting Budget"><p className="font-data text-xl font-bold text-positive-500">{formatMoney(scoutingBudget)}</p></SectionCard>
      </div>

      <SectionCard title="Transfer Activity">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Players In" value={activity.playersIn} />
          <Stat label="Players Out" value={activity.playersOut} />
          <Stat label="Bids Made" value={activity.bidsMade} />
          <Stat label="Bids Received" value={activity.bidsReceived} />
        </div>
      </SectionCard>

      <SectionCard title="Search Players">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any club's players…"
          className="rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-ink-100 outline-none"
        />
        {searchResults.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {searchResults.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-card bg-navy-800 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-ink-200">
                  <PlayerPhoto firstName={p.firstName} lastName={p.lastName} leagueId={world.clubs[p.clubId ?? ""]?.leagueId ?? ""} clubId={p.clubId ?? ""} size={26} />
                  {p.firstName} {p.lastName} <span className="text-ink-500">· {world.clubs[p.clubId ?? ""]?.shortName ?? "Free agent"}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleShortlist(p.id)} className="text-xs text-accent-400">
                    {(world.shortlistedPlayerIds ?? []).includes(p.id) ? "Shortlisted" : "Shortlist"}
                  </button>
                  <button onClick={() => router.push(`/transfers/offer/${p.id}`)} className="rounded-card bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white">
                    Offer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Transfer Targets (${shortlist.length})`}>
        {shortlist.length === 0 && <p className="text-sm text-ink-500">Search for players above and shortlist them to track as targets.</p>}
        {shortlist.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500">
                <th className="pb-1.5">Player</th><th className="pb-1.5">Club</th>
                <th className="pb-1.5 text-right">Value</th><th className="pb-1.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shortlist.map((p) => {
                const value = estimateMarketValue(p, world.currentDate);
                const playerClub = p.clubId ? world.clubs[p.clubId] : undefined;
                return (
                  <tr key={p.id} className="border-t border-navy-700">
                    <td className="py-1.5 text-ink-100">{p.firstName} {p.lastName}</td>
                    <td className="py-1.5 text-ink-400">{playerClub?.shortName ?? "Free agent"}</td>
                    <td className="py-1.5 text-right font-data text-positive-500">{formatMoney(value)}</td>
                    <td className="py-1.5 text-right">
                      <Link href={`/transfers/offer/${p.id}`} className="text-xs text-accent-400">Make Offer</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SectionCard title="Scout Reports">
          <p className="font-data text-2xl font-bold text-ink-100">{scoutReports.length}</p>
          <p className="text-xs text-ink-500">reports on file</p>
        </SectionCard>
        <SectionCard title="Loan Availability">
          <p className="font-data text-2xl font-bold text-ink-100">{loanAvailable}</p>
          <p className="text-xs text-ink-500">of your players listed for loan</p>
        </SectionCard>
        <SectionCard title="Transfer Window">
          <p className={`font-data text-lg font-bold ${windowInfo.open ? "text-positive-500" : "text-warning-500"}`}>{windowInfo.label}</p>
          <p className="text-xs text-ink-500">{windowInfo.open ? `Closes in ${windowInfo.daysRemaining} days` : `Opens in ${windowInfo.daysRemaining} days`}</p>
        </SectionCard>
      </div>

      <SectionCard title="Recent News">
        {news.length === 0 && <p className="text-sm text-ink-500">No transfer news yet.</p>}
        {news.map((n) => (
          <div key={n.id} className="border-b border-navy-700 pb-1.5 last:border-0">
            <p className="text-sm text-ink-200">{n.headline}</p>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Scouting Network">
        <p className="text-sm text-ink-300">{scoutStaff.length} chief scout{scoutStaff.length === 1 ? "" : "s"} on staff.</p>
        {scoutStaff.length === 0 && <p className="mt-1 text-xs text-ink-500">Hire a chief scout from Staff to start generating scouting reports.</p>}
      </SectionCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-data text-xl font-bold text-ink-100">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}
