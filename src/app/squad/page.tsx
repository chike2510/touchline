"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { PlayerProfilePanel } from "@/components/squad/PlayerProfilePanel";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import { caToOverall } from "@/components/tactics/FormationPitch";
import type { Player } from "@/domain/types";

type SortKey = "name" | "position" | "age" | "overall" | "condition";

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function SquadPage() {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<"first-team" | "youth">("first-team");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const club = world?.clubs[world.userClubId];

  const players = useMemo(() => {
    if (!world || !club) return [];
    const ids = tab === "first-team" ? club.squadIds : club.youthSquadIds;
    const list = ids.map((id) => world.players[id]).filter((p): p is Player => !!p);
    const sorted = [...list].sort((a, b) => {
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
  }, [world, club, tab, sortKey, sortDesc]);

  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const league = world.leagues[club.leagueId];
  if (!league) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const selected = selectedId ? world.players[selectedId] : undefined;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  }

  return (
    <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:gap-4">
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink-100">Squad</h1>
          <div className="flex rounded-card border border-navy-600 bg-navy-900 p-1">
            <TabButton active={tab === "first-team"} onClick={() => setTab("first-team")}>First team</TabButton>
            <TabButton active={tab === "youth"} onClick={() => setTab("youth")}>Youth</TabButton>
          </div>
        </div>

        <div className="overflow-x-auto rounded-card border border-navy-600 bg-navy-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-left text-xs text-ink-500">
                <Th label="Pos" onClick={() => toggleSort("position")} />
                <Th label="Name" onClick={() => toggleSort("name")} />
                <Th label="Age" onClick={() => toggleSort("age")} align="right" />
                <th className="px-3 py-2">Nat</th>
                <Th label="OVR" onClick={() => toggleSort("overall")} align="right" />
                <Th label="Condition" onClick={() => toggleSort("condition")} align="right" />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
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
                      <PlayerPhoto
  firstName={p.firstName}
  lastName={p.lastName}
  leagueId={league.id}
  clubId={club.id}
  size={26}
/>
                      {p.firstName} {p.lastName}
                      {p.injuryStatus && <span className="ml-1.5 text-xs text-danger-500">INJ</span>}
                      {p.suspension && <span className="ml-1.5 text-xs text-warning-500">SUS</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-data text-ink-300">{ageFromDob(p.dateOfBirth)}</td>
                  <td className="px-3 py-2 text-ink-300">{p.nationality}</td>
                  <td className="px-3 py-2 text-right font-data font-semibold text-ink-100">{caToOverall(p.currentAbility)}</td>
                  <td className="px-3 py-2 text-right font-data text-ink-300">{100 - p.fatigue}%</td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-500">No players here yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="lg:w-96 lg:shrink-0">
          <PlayerProfilePanel player={selected} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function Th({ label, onClick, align = "left" }: { label: string; onClick: () => void; align?: "left" | "right" }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 hover:text-ink-100 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {label}
    </th>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-card px-3 py-1.5 text-sm transition-colors duration-150 ${
        active ? "bg-accent-500 text-white font-semibold" : "text-ink-500"
      }`}
    >
      {children}
    </button>
  );
}
