"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { listStarterClubs, createStarterWorld } from "@/engines/world/newSave";
import { createNewSave } from "@/engines/persistence/saveManager";
import { useGameStore } from "@/state/gameStore";

const STEPS = ["Manager", "League", "Club"] as const;
const NATIONALITIES = [
  "ENG", "SCO", "WAL", "NIR", "IRL", "FRA", "GER", "ESP", "ITA", "POR",
  "NED", "BEL", "BRA", "ARG", "USA", "JPN", "KOR", "NGA", "GHA", "SEN",
];

export default function NewGamePage() {
  const router = useRouter();
  const loadSave = useGameStore((s) => s.loadSave);
  const allClubs = useMemo(() => listStarterClubs(), []);
  const leagues = useMemo(() => {
    const names = Array.from(new Set(allClubs.map((c) => c.leagueName)));
    return names.map((name) => ({ name, count: allClubs.filter((c) => c.leagueName === name).length }));
  }, [allClubs]);

  const [step, setStep] = useState(0);
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerNationality, setManagerNationality] = useState("ENG");
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const clubsInLeague = selectedLeague ? allClubs.filter((c) => c.leagueName === selectedLeague) : [];

  const stepValid = [
    managerFirstName.trim().length > 0 && managerLastName.trim().length > 0,
    !!selectedLeague,
    !!selectedClubId,
  ];

  function goNext() {
    if (!stepValid[step]) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleStart() {
    if (!selectedClubId) return;
    setCreating(true);
    try {
      const world = createStarterWorld({
        managerFirstName, managerLastName, managerNationality,
        userClubId: selectedClubId, startDate: new Date().toISOString().slice(0, 10),
      });
      const clubName = world.clubs[selectedClubId]?.name ?? null;
      const meta = await createNewSave({
        name: `${managerFirstName} ${managerLastName} — ${clubName}`,
        managerName: `${managerFirstName} ${managerLastName}`,
        clubName, startDate: world.currentDate, world,
      });
      loadSave(meta, { ...world, saveId: meta.id });
      router.replace("/home");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4">
      <div>
        <h1 className="font-display text-2xl text-ink-100">New career</h1>
        <p className="text-sm text-ink-500">Set up your manager and pick a club to take charge of.</p>
      </div>

      {/* ---- Step indicator ------------------------------------------------ */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? "bg-positive-500 text-white" : i === step ? "bg-accent-500 text-white" : "bg-navy-700 text-ink-500"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-xs ${i === step ? "text-ink-100" : "text-ink-500"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-positive-500" : "bg-navy-700"}`} />}
          </div>
        ))}
      </div>

      {/* ---- Step 1: Manager details ---------------------------------------- */}
      {step === 0 && (
        <Card>
          <CardHeader title="Manager details" subtitle="Name and nationality" />
          <div className="flex flex-col gap-3">
            <label className="text-sm text-ink-500">
              First name
              <input
                value={managerFirstName}
                onChange={(e) => setManagerFirstName(e.target.value)}
                className="mt-1 w-full rounded-card border border-navy-600 bg-navy-800 px-3 py-2 text-ink-100 outline-none"
                placeholder="e.g. Alex"
                autoFocus
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
            <label className="text-sm text-ink-500">
              Nationality
              <select
                value={managerNationality}
                onChange={(e) => setManagerNationality(e.target.value)}
                className="mt-1 w-full rounded-card border border-navy-600 bg-navy-800 px-3 py-2 text-ink-100 outline-none"
              >
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </Card>
      )}

      {/* ---- Step 2: League -------------------------------------------------- */}
      {step === 1 && (
        <Card>
          <CardHeader title="Choose a league" subtitle="Which division do you want to manage in?" />
          <div className="flex flex-col gap-2">
            {leagues.map((l) => (
              <button
                key={l.name}
                onClick={() => { setSelectedLeague(l.name); setSelectedClubId(null); }}
                className={`rounded-card border px-4 py-3 text-left transition-colors duration-150 ${
                  selectedLeague === l.name
                    ? "border-accent-400 bg-accent-500/10"
                    : "border-navy-600 bg-navy-800"
                }`}
              >
                <p className="text-sm font-medium text-ink-100">{l.name}</p>
                <p className="text-xs text-ink-500">{l.count} clubs</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Step 3: Club ------------------------------------------------------ */}
      {step === 2 && (
        <Card>
          <CardHeader title="Choose your club" subtitle={selectedLeague ?? undefined} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {clubsInLeague.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClubId(c.id)}
                className={`flex flex-col items-center gap-1.5 rounded-card border px-2 py-3 text-center transition-colors duration-150 ${
                  selectedClubId === c.id
                    ? "border-accent-400 bg-accent-500/10 text-accent-400"
                    : "border-navy-600 bg-navy-800 text-ink-300"
                }`}
              >
                <ClubCrest clubId={c.id} abbreviation={c.abbreviation} color={c.color} size={40} />
                <span className="text-xs leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Navigation ------------------------------------------------------ */}
      <div className="flex gap-2">
        {step > 0 && (
          <button
            onClick={goBack}
            className="flex-1 rounded-card border border-navy-600 bg-navy-800 px-4 py-3 text-center text-sm font-medium text-ink-200 active:scale-95"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            disabled={!stepValid[step]}
            className="flex-1 rounded-card bg-accent-500 px-4 py-3 text-center font-semibold text-white transition-transform duration-150 active:scale-95 disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!stepValid[2] || creating}
            className="flex-1 rounded-card bg-accent-500 px-4 py-3 text-center font-semibold text-white transition-transform duration-150 active:scale-95 disabled:opacity-40"
          >
            {creating ? "Setting up your world…" : "Start career"}
          </button>
        )}
      </div>

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
