"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { PlayerProfilePanel } from "@/components/squad/PlayerProfilePanel";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { caToOverall } from "@/components/tactics/FormationPitch";
import type { Player, PositionCode } from "@/domain/types";

const POSITION_TABS: { label: string; codes: PositionCode[] }[] = [
  { label: "GK", codes: ["GK"] },
  { label: "DR", codes: ["RB"] },
  { label: "DCR", codes: ["CB"] },
  { label: "DCL", codes: ["CB"] },
  { label: "DL", codes: ["LB"] },
  { label: "DM", codes: ["CDM"] },
  { label: "MCR", codes: ["CM"] },
  { label: "MCL", codes: ["CM"] },
  { label: "AMR", codes: ["RW", "RM"] },
  { label: "AML", codes: ["LW", "LM"] },
  { label: "STC", codes: ["ST", "CF"] },
];

const SUB_TABS = ["Overview", "Squad Depth", "Statistics", "Happiness"] as const;
type SubTab = (typeof SUB_TABS)[number];
type SortKey = "name" | "position" | "age" | "overall" | "condition";

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function moraleMeta(morale: number): { label: string; emoji: string } {
  if (morale >= 80) return { label: "Excellent", emoji: "😄" };
  if (morale >= 60) return { label: "Good", emoji: "🙂" };
  if (morale >= 40) return { label: "Okay", emoji: "😐" };
  if (morale >= 20) return { label: "Poor", emoji: "🙁" };
  return { label: "Very Poor", emoji: "😞" };
}

export default function SquadPage() {
  const world = useGameStore((s) => s.world);
  const [subTab, setSubTab] = useState<SubTab>("Overview");
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const club = world?.clubs[world.userClubId];

  const players = useMemo(() => {
    if (!world || !club) return [];
    const list = club.squadIds.map((id) => world.players[id]).filter((p): p is Player => !!p);
    const filtered = posFilter
      ? list.filter((p) => POSITION_TABS.find((t) => t.label === posFilter)?.codes.some((c) => p.positions.includes(c)))
      : list;
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name": return a.lastName.localeCompare(b.lastName);
        case "position": return a.positions[0]!.localeCompare(b.positions[0]!);
        case "age": return ageFromDob(a.dateOfBirth) - ageFromDob(b.dateOfBirth);
        case "condition": return (100 - a.fatigue) - (100 - b.fatigue);
        case "overall":
        default: return a.currentAbility - b.currentAbility;
      }
    });
    return sortDesc ? sorted.reverse() : sorted;
  }, [world, club, posFilter, sortKey, sortDesc]);

  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;
  const league = world.leagues[club.leagueId];
  if (!league) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const selected = selectedId ? world.players[selectedId] : undefined;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  }

  return (
    <div className="squad-page-layout flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink-100">Squad</h1>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {POSITION_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setPosFilter(posFilter === t.label ? null : t.label)}
              className={`rounded-card px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                posFilter === t.label ? "bg-accent-500 text-white" : "bg-navy-800 text-ink-300 hover:bg-navy-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex gap-1 border-b border-navy-700">
          {SUB_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 text-sm transition-colors duration-150 ${
                subTab === t ? "border-b-2 border-accent-500 font-medium text-ink-100" : "text-ink-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {subTab === "Overview" && (
          <div className="overflow-x-auto rounded-card border border-navy-600 bg-navy-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-left text-xs text-ink-500">
                  <Th label="Pos" onClick={() => toggleSort("position")} />
                  <Th label="Name" onClick={() => toggleSort("name")} />
                  <Th label="Age" onClick={() => toggleSort("age")} align="right" />
                  <th className="px-3 py-2">Nat</th>
                  <Th label="Con" onClick={() => toggleSort("condition")} align="right" />
                  <th className="px-3 py-2 text-right">Sharp.</th>
                  <th className="px-3 py-2">Morale</th>
                  <Th label="OVR" onClick={() => toggleSort("overall")} align="right" />
                  <th className="px-3 py-2 text-right">Apps</th>
                  <th className="px-3 py-2 text-right">Gls</th>
                  <th className="px-3 py-2 text-right">Ast</th>
                  <th className="px-3 py-2 text-right">Av Rat</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const morale = moraleMeta(p.morale);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`cursor-pointer border-b border-navy-600 last:border-0 hover:bg-navy-800 ${
                        selectedId === p.id ? "bg-accent-500/10" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-data text-ink-500">{p.positions[0]}</td>
                      <td className="px-3 py-2 font-medium text-ink-100">
                        <div className="flex items-center gap-2">
                          <PlayerPhoto firstName={p.firstName} lastName={p.lastName} leagueId={league.id} clubId={club.id} size={26} />
                          {p.firstName} {p.lastName}
                          {club.captainId === p.id && <span className="ml-1 text-xs text-accent-400">(C)</span>}
                          {p.injuryStatus && <span className="ml-1.5 text-xs text-danger-500">INJ</span>}
                          {p.suspension && <span className="ml-1.5 text-xs text-warning-500">SUS</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-data text-ink-300">{ageFromDob(p.dateOfBirth)}</td>
                      <td className="px-3 py-2 text-ink-300">{p.nationality}</td>
                      <td className="px-3 py-2 text-right font-data text-positive-500">{100 - p.fatigue}%</td>
                      <td className="px-3 py-2 text-right font-data text-accent-400">{p.sharpness}%</td>
                      <td className="px-3 py-2">
                        <span title={morale.label}>{morale.emoji}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-data font-semibold text-ink-100">{caToOverall(p.currentAbility)}</td>
                      <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.appearances}</td>
                      <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.goals}</td>
                      <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.assists}</td>
                      <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.averageRating.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {players.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-6 text-center text-ink-500">No players here yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {subTab === "Squad Depth" && <SquadDepthView players={players} onSelect={setSelectedId} />}
        {subTab === "Statistics" && <StatisticsView players={players} onSelect={setSelectedId} />}
        {subTab === "Happiness" && <HappinessView players={players} onSelect={setSelectedId} />}
      </div>

      {selected && (
        <div className="lg:w-96 lg:shrink-0">
          <PlayerProfilePanel player={selected} leagueId={league.id} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function SquadDepthView({ players, onSelect }: { players: Player[]; onSelect: (id: string) => void }) {
  const groups = new Map<string, Player[]>();
  for (const p of players) {
    const key = p.positions[0]!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...groups.entries()].map(([pos, list]) => (
        <div key={pos} className="rounded-card border border-navy-600 bg-navy-900 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{pos} ({list.length})</p>
          <div className="flex flex-wrap gap-2">
            {[...list].sort((a, b) => b.currentAbility - a.currentAbility).map((p) => (
              <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center gap-1.5 rounded-card bg-navy-800 px-2 py-1 text-xs text-ink-200 hover:bg-navy-700">
                {p.lastName} <span className="font-data text-ink-500">{caToOverall(p.currentAbility)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatisticsView({ players, onSelect }: { players: Player[]; onSelect: (id: string) => void }) {
  const sorted = [...players].sort((a, b) => b.seasonStats.averageRating - a.seasonStats.averageRating);
  return (
    <div className="overflow-x-auto rounded-card border border-navy-600 bg-navy-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-600 text-left text-xs text-ink-500">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Apps</th>
            <th className="px-3 py-2 text-right">Goals</th>
            <th className="px-3 py-2 text-right">Assists</th>
            <th className="px-3 py-2 text-right">Yel</th>
            <th className="px-3 py-2 text-right">Red</th>
            <th className="px-3 py-2 text-right">Av Rat</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} onClick={() => onSelect(p.id)} className="cursor-pointer border-b border-navy-600 last:border-0 hover:bg-navy-800">
              <td className="px-3 py-2 font-medium text-ink-100">{p.firstName} {p.lastName}</td>
              <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.appearances}</td>
              <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.goals}</td>
              <td className="px-3 py-2 text-right font-data text-ink-300">{p.seasonStats.assists}</td>
              <td className="px-3 py-2 text-right font-data text-warning-500">{p.seasonStats.yellowCards}</td>
              <td className="px-3 py-2 text-right font-data text-danger-500">{p.seasonStats.redCards}</td>
              <td className="px-3 py-2 text-right font-data font-semibold text-ink-100">{p.seasonStats.averageRating.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HappinessView({ players, onSelect }: { players: Player[]; onSelect: (id: string) => void }) {
  const sorted = [...players].sort((a, b) => a.morale - b.morale);
  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((p) => {
        const morale = moraleMeta(p.morale);
        return (
          <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center justify-between rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-left text-sm hover:bg-navy-800">
            <span className="text-ink-200">{p.firstName} {p.lastName}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-ink-500">{morale.label}</span>
              <span>{morale.emoji}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Th({ label, onClick, align = "left" }: { label: string; onClick: () => void; align?: "left" | "right" }) {
  return (
    <th onClick={onClick} className={`cursor-pointer select-none px-3 py-2 hover:text-ink-100 ${align === "right" ? "text-right" : "text-left"}`}>
      {label}
    </th>
  );
}
