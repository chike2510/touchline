"use client";
import { useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { PlayerCard } from "@/components/squad/PlayerCard";

export default function SquadPage() {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<"first-team" | "youth">("first-team");

  if (!world) return <p className="px-4 py-6 text-sm text-chalk-300">No save loaded.</p>;

  const club = world.clubs[world.userClubId];
  if (!club) return null;

  const ids = tab === "first-team" ? club.squadIds : club.youthSquadIds;
  const players = ids.map((id) => world.players[id]).filter(Boolean);

  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-chalk-100">Squad</h1>
        <div className="flex rounded-card border border-pitch-700 bg-pitch-900 p-1">
          <TabButton active={tab === "first-team"} onClick={() => setTab("first-team")}>First team</TabButton>
          <TabButton active={tab === "youth"} onClick={() => setTab("youth")}>Youth</TabButton>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {players.length === 0 && <p className="text-sm text-chalk-300">No players here yet.</p>}
        {players.map((p) => p && <PlayerCard key={p.id} player={p} />)}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-card px-3 py-1.5 text-sm transition-colors duration-150 ${
        active ? "bg-floodlight-500 text-ink-900 font-semibold" : "text-chalk-300"
      }`}
    >
      {children}
    </button>
  );
}
