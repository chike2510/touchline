"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/state/gameStore";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { caToOverall } from "@/components/tactics/FormationPitch";
import { generateScoutingReport } from "@/engines/transfers/scouting";
import { estimateMarketValue } from "@/engines/transfers/transferEngine";
import { formatMoney, formatMoneyPerWeek } from "@/lib/format";
import type { ID, Player, ScoutingReport } from "@/domain/types";

const SUB_TABS = ["Overview", "Attributes", "Report", "Comparison"] as const;
type SubTab = (typeof SUB_TABS)[number];

function gradeFor(report: ScoutingReport | undefined): { label: string; tone: string } {
  if (!report) return { label: "—", tone: "text-ink-500" };
  const pa = caToOverall(report.estimatedPotentialAbility);
  if (pa >= 85) return { label: "A", tone: "text-positive-500" };
  if (pa >= 75) return { label: "B+", tone: "text-positive-500" };
  if (pa >= 65) return { label: "B", tone: "text-warning-500" };
  if (pa >= 55) return { label: "C+", tone: "text-warning-500" };
  return { label: "C", tone: "text-ink-400" };
}

export default function ScoutingPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("Overview");

  const club = world?.clubs[world.userClubId];

  const scout = useMemo(() => {
    if (!world || !club) return undefined;
    return club.staffIds.map((id) => world.staff[id]).find((s) => s?.role === "chief-scout");
  }, [world, club]);

  const reportByPlayer = useMemo(() => {
    if (!world || !club) return new Map<ID, ScoutingReport>();
    const map = new Map<ID, ScoutingReport>();
    for (const r of Object.values(world.scoutingReports)) {
      if (r.clubId !== club.id) continue;
      const existing = map.get(r.playerId);
      if (!existing || existing.createdDate < r.createdDate) map.set(r.playerId, r);
    }
    return map;
  }, [world, club]);

  const candidates = useMemo(() => {
    if (!world || !club) return [];
    const q = query.trim().toLowerCase();
    return Object.values(world.players)
      .filter((p) => p.clubId !== club.id)
      .filter((p) => (q ? `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const ra = reportByPlayer.get(a.id), rb = reportByPlayer.get(b.id);
        if (ra && !rb) return -1;
        if (!ra && rb) return 1;
        return b.currentAbility - a.currentAbility;
      })
      .slice(0, 40);
  }, [world, club, query, reportByPlayer]);

  const shortlist = useMemo(() => {
    if (!world) return [];
    return (world.shortlistedPlayerIds ?? []).map((id) => world.players[id]).filter((p): p is Player => !!p);
  }, [world]);

  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const selected = selectedId ? world.players[selectedId] : candidates[0];
  const selectedReport = selected ? reportByPlayer.get(selected.id) : undefined;
  const selectedClub = selected?.clubId ? world.clubs[selected.clubId] : undefined;
  const isShortlisted = selected ? (world.shortlistedPlayerIds ?? []).includes(selected.id) : false;

  function handleScout(playerId: string) {
    if (!scout) return;
    const player = world!.players[playerId];
    if (!player) return;
    const report = generateScoutingReport(world!, scout, player, club!.id);
    mutateWorld((w) => { w.scoutingReports[report.id] = report; });
  }

  function toggleShortlist(id: ID) {
    mutateWorld((w) => {
      const current = w.shortlistedPlayerIds ?? [];
      w.shortlistedPlayerIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 py-3 lg:grid-cols-[280px_1fr_260px]">
      {/* Left: search + list */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-ink-100">Scouting</h1>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…"
          className="rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-ink-100 outline-none"
        />
        <p className="text-xs text-ink-500">{candidates.length} players found</p>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {candidates.map((p) => {
            const grade = gradeFor(reportByPlayer.get(p.id));
            return (
              <button
                key={p.id} onClick={() => { setSelectedId(p.id); setSubTab("Overview"); }}
                className={`flex items-center justify-between rounded-card px-2.5 py-2 text-left text-sm ${selectedId === p.id || (!selectedId && p.id === candidates[0]?.id) ? "bg-accent-500/15 text-accent-300" : "text-ink-200 hover:bg-navy-800"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{p.firstName} {p.lastName}</span>
                  <span className="block truncate text-xs text-ink-500">{p.positions.join(", ")} · {world.clubs[p.clubId ?? ""]?.shortName ?? "Free agent"}</span>
                </span>
                <span className={`shrink-0 font-data text-sm font-bold ${grade.tone}`}>{grade.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: detail panel */}
      {selected && (
        <div className="flex flex-col gap-3">
          <div className="glass-panel flex items-center gap-3 rounded-card p-3">
            <PlayerPhoto firstName={selected.firstName} lastName={selected.lastName} leagueId={selectedClub?.leagueId ?? ""} clubId={selectedClub?.id ?? ""} size={56} />
            <div className="flex-1">
              <p className="font-display text-lg text-ink-100">{selected.firstName} {selected.lastName}</p>
              <p className="text-xs text-ink-500">{selected.positions.join(", ")} · {selectedClub?.name ?? "Free agent"}</p>
            </div>
            <span className={`font-data text-2xl font-bold ${gradeFor(selectedReport).tone}`}>{gradeFor(selectedReport).label}</span>
          </div>

          {selectedReport ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <MiniStat label="Est. Cost" value={formatMoney(estimateMarketValue(selected, world.currentDate))} />
              <MiniStat label="Est. CA" value={String(caToOverall(selectedReport.estimatedCurrentAbility))} />
              <MiniStat label="Est. PA" value={String(caToOverall(selectedReport.estimatedPotentialAbility))} />
            </div>
          ) : (
            <div className="glass-panel rounded-card p-4 text-center">
              <p className="mb-2 text-sm text-ink-500">Not yet scouted.</p>
              <button
                onClick={() => handleScout(selected.id)} disabled={!scout}
                className="rounded-card bg-accent-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {scout ? "Generate Scouting Report" : "Hire a chief scout first"}
              </button>
            </div>
          )}

          <div className="flex gap-1 border-b border-navy-700">
            {SUB_TABS.map((t) => (
              <button key={t} onClick={() => setSubTab(t)} className={`px-3 py-2 text-sm ${subTab === t ? "border-b-2 border-accent-500 font-medium text-ink-100" : "text-ink-500"}`}>{t}</button>
            ))}
          </div>

          {subTab === "Overview" && (
            <div className="glass-panel grid grid-cols-2 gap-3 rounded-card p-4 text-sm sm:grid-cols-3">
              <Row label="Nationality" value={selected.nationality} />
              <Row label="Age" value={String(Math.floor((Date.now() - new Date(selected.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)))} />
              <Row label="Foot" value={selected.foot} />
              <Row label="Contract" value={selected.contract?.expiryDate.slice(0, 10) ?? "Free agent"} />
              <Row label="Wage" value={selected.contract ? formatMoneyPerWeek(selected.contract.wageWeekly) : "—"} />
              <Row label="Value" value={formatMoney(estimateMarketValue(selected, world.currentDate))} />
            </div>
          )}

          {subTab === "Attributes" && (
            <div className="glass-panel grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-card p-4 text-sm sm:grid-cols-3">
              {Object.entries(selected.attributes.technical).map(([k, v]) => <Row key={k} label={k} value={String(v)} />)}
            </div>
          )}

          {subTab === "Report" && (
            <div className="glass-panel rounded-card p-4">
              {selectedReport ? (
                <>
                  <p className="text-sm text-ink-200">{selectedReport.notes}</p>
                  <p className="mt-1 text-xs text-ink-500">Recommendation: {selectedReport.recommendation.replace(/-/g, " ")} · Confidence {selectedReport.confidence}%</p>
                </>
              ) : <p className="text-sm text-ink-500">No report yet — generate one from the Overview tab.</p>}
            </div>
          )}

          {subTab === "Comparison" && (
            <div className="glass-panel rounded-card p-4">
              <p className="text-sm text-ink-500">A side-by-side comparison tool isn&apos;t built yet.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => toggleShortlist(selected.id)} className="flex-1 rounded-card border border-navy-600 py-2 text-sm text-ink-300">
              {isShortlisted ? "Remove From Shortlist" : "Add to Shortlist"}
            </button>
            <button onClick={() => router.push(`/transfers/offer/${selected.id}`)} className="flex-1 rounded-card bg-accent-500 py-2 text-sm font-semibold text-white">
              Make Offer
            </button>
          </div>
        </div>
      )}

      {/* Right: assignments / shortlist / focus */}
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-card p-3">
          <p className="mb-2 text-sm font-bold text-ink-100">Scout Assignments</p>
          {scout ? (
            <p className="text-sm text-ink-300">{scout.firstName} {scout.lastName} · Judging Ability {scout.attributes.judgingAbility}</p>
          ) : (
            <p className="text-sm text-ink-500">No chief scout hired — reports can&apos;t be generated.</p>
          )}
          <p className="mt-1.5 text-xs text-ink-500">Regional scout coverage isn&apos;t simulated yet — one chief scout currently covers all reports.</p>
        </div>

        <div className="glass-panel rounded-card p-3">
          <p className="mb-2 text-sm font-bold text-ink-100">Shortlist ({shortlist.length})</p>
          <div className="flex flex-col gap-1">
            {shortlist.slice(0, 6).map((p) => (
              <button key={p.id} onClick={() => { setSelectedId(p.id); setSubTab("Overview"); }} className="flex items-center justify-between rounded-card px-2 py-1.5 text-left text-sm text-ink-200 hover:bg-navy-800">
                <span className="truncate">{p.firstName} {p.lastName}</span>
                <span className={`font-data text-xs font-bold ${gradeFor(reportByPlayer.get(p.id)).tone}`}>{gradeFor(reportByPlayer.get(p.id)).label}</span>
              </button>
            ))}
            {shortlist.length === 0 && <p className="text-xs text-ink-500">Nobody shortlisted yet.</p>}
          </div>
        </div>

        <div className="glass-panel rounded-card p-3">
          <p className="mb-1 text-sm font-bold text-ink-100">Scouting Focus</p>
          <p className="text-xs text-ink-500">Positional scouting priorities aren&apos;t simulated yet — search and scout any player directly.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="capitalize text-ink-500">{label}</span>
      <span className="font-data font-semibold text-ink-100">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-card p-3">
      <p className="font-data text-lg font-bold text-ink-100">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}
