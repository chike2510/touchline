"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { listStarterClubs, createStarterWorld } from "@/engines/world/newSave";
import { createNewSave } from "@/engines/persistence/saveManager";
import { useGameStore } from "@/state/gameStore";

export default function NewGamePage() {
  const router = useRouter();
  const loadSave = useGameStore((s) => s.loadSave);
  const clubs = listStarterClubs();

  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id ?? "");
  const [creating, setCreating] = useState(false);

  const canStart = managerFirstName.trim().length > 0 && managerLastName.trim().length > 0 && selectedClubId;

  async function handleStart() {
    if (!canStart) return;
    setCreating(true);
    try {
      const world = createStarterWorld({
        managerFirstName, managerLastName, managerNationality: "ENG",
        userClubId: selectedClubId, startDate: new Date().toISOString().slice(0, 10),
      });
      const clubName = world.clubs[selectedClubId]?.name ?? null;
      const meta = await createNewSave({
        name: `${managerFirstName} ${managerLastName} — ${clubName}`,
        managerName: `${managerFirstName} ${managerLastName}`,
        clubName, startDate: world.currentDate, world,
      });
      loadSave(meta, { ...world, saveId: meta.id });
      router.replace("/inbox");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <h1 className="font-display text-2xl text-ink-100">New career</h1>
        <p className="text-sm text-ink-500">Set up your manager and pick a club to take charge of.</p>
      </div>

      <Card>
        <CardHeader title="Manager details" />
        <div className="flex flex-col gap-3">
          <label className="text-sm text-ink-500">
            First name
            <input
              value={managerFirstName}
              onChange={(e) => setManagerFirstName(e.target.value)}
              className="mt-1 w-full rounded-card border border-navy-600 bg-navy-800 px-3 py-2 text-ink-100 outline-none"
              placeholder="e.g. Alex"
            />
          </label>
          <label className="text-sm text-ink-500">
            Last name
            <input
              value={managerLastName}
              onChange={(e) => setManagerLastName(e.target.value)}
              className="mt-1 w-full rounded-card border border-navy-600 bg-navy-800 px-3 py-2 text-ink-100 outline-none"
              placeholder="e.g. Morgan"
            />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Choose your club" subtitle="Sample Premier Division" />
        <div className="grid grid-cols-2 gap-2">
          {clubs.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClubId(c.id)}
              className={`rounded-card border px-3 py-2 text-left text-sm transition-colors duration-150 ${
                selectedClubId === c.id
                  ? "border-accent-400 bg-accent-500/10 text-accent-400"
                  : "border-navy-600 bg-navy-800 text-ink-300"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Card>

      <button
        onClick={handleStart}
        disabled={!canStart || creating}
        className="rounded-card bg-accent-500 px-4 py-3 text-center font-semibold text-white transition-transform duration-150 active:scale-95 disabled:opacity-40"
      >
        {creating ? "Setting up your world…" : "Start career"}
      </button>

      <p className="text-center text-xs text-ink-500">
        This generates squads for every club in the league. Edit
        <code className="mx-1 rounded bg-navy-800 px-1 py-0.5 font-data">src/data/leagues/premier-league.json</code>
        or
        <code className="mx-1 rounded bg-navy-800 px-1 py-0.5 font-data">efl-championship.json</code>
        to tweak clubs, managers, or add more real player data — see the schema notes in
        <code className="mx-1 rounded bg-navy-800 px-1 py-0.5 font-data">src/data/README.md</code>.
      </p>
    </div>
  );
}
