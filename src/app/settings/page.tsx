"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { useSaveList } from "@/hooks/useSaveGame";
import { takeSnapshot, setActiveSave } from "@/engines/persistence/saveManager";
import { exportSaveAsJson, importSaveFromJson, listSnapshots, restoreSnapshot, deleteSave } from "@/engines/persistence/db";
import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { usePreferences, type Preferences } from "@/hooks/usePreferences";
import { Badge } from "@/components/ui/Badge";

const TABS = ["Overview", "Gameplay", "Match", "Interface", "Audio", "Notifications", "Save & Load", "About"] as const;
type Tab = (typeof TABS)[number];

const TIPS = [
  "Use the Scouting Centre to assign scouts to focus on players that fit your tactical system. The more specific your instructions, the better your reports will be.",
  "A tactic's Familiarity drops whenever you change formation or roles — give it a few matches to settle before judging it.",
  "Out-of-possession shape doesn't have to match your in-possession formation — a compact block can protect an attacking system.",
  "Take a backup snapshot before a transfer window closes or a cup final — it's the fastest way back if a big decision goes wrong.",
  "Board Confidence responds to results relative to expectations, not just results in isolation.",
  "Squad happiness affects performance even for players who aren't starting — check Happiness in the Squad page periodically.",
  "Exporting your save as a JSON file is the safest way to move a career between devices.",
];

function SettingsCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel flex flex-col gap-2.5 rounded-card p-4">
      <div>
        <p className="text-sm font-bold text-ink-100">{title}</p>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink-300">{label}</span>
      {children}
    </div>
  );
}

function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="rounded-card border border-navy-600 bg-navy-800 px-2 py-1 text-xs text-ink-100">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${value ? "bg-positive-500" : "bg-navy-600"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function GameplaySection({ prefs, update }: { prefs: Preferences; update: <K extends keyof Preferences>(k: K, v: Preferences[K]) => void }) {
  return (
    <SettingsCard title="Gameplay" subtitle="Customize the way you play.">
      <Row label="Game Mode"><Select value={prefs.gameMode} onChange={(v) => update("gameMode", v)} options={[{ value: "manager", label: "Manager" }, { value: "director-of-football", label: "Director of Football" }]} /></Row>
      <Row label="Difficulty"><Select value={prefs.difficulty} onChange={(v) => update("difficulty", v)} options={[{ value: "easy", label: "Easy" }, { value: "normal", label: "Normal" }, { value: "hard", label: "Hard" }, { value: "professional", label: "Professional" }]} /></Row>
      <Row label="In-Game Editor"><Toggle value={prefs.inGameEditor} onChange={(v) => update("inGameEditor", v)} /></Row>
      <Row label="Use Real Player Faces"><Toggle value={prefs.useRealPlayerFaces} onChange={(v) => update("useRealPlayerFaces", v)} /></Row>
      <Row label="Auto Save"><Select value={prefs.autoSave} onChange={(v) => update("autoSave", v)} options={[{ value: "off", label: "Off" }, { value: "every-day", label: "Every Day" }, { value: "every-week", label: "Every Week" }]} /></Row>
    </SettingsCard>
  );
}

function MatchSection({ prefs, update }: { prefs: Preferences; update: <K extends keyof Preferences>(k: K, v: Preferences[K]) => void }) {
  return (
    <SettingsCard title="Match" subtitle="Configure match experience.">
      <Row label="Default Match Speed"><Select value={String(prefs.matchSpeedDefault) as "1" | "2" | "4"} onChange={(v) => update("matchSpeedDefault", Number(v) as 1 | 2 | 4)} options={[{ value: "1", label: "1x" }, { value: "2", label: "2x" }, { value: "4", label: "4x" }]} /></Row>
      <Row label="Highlights"><Select value={prefs.highlights} onChange={(v) => update("highlights", v)} options={[{ value: "key-highlights", label: "Key Highlights" }, { value: "extended", label: "Extended" }, { value: "full-match", label: "Full Match" }]} /></Row>
      <Row label="3D Pitch View"><Toggle value={prefs.show3dMatch} onChange={(v) => update("show3dMatch", v)} /></Row>
      <Row label="Show Player Names"><Toggle value={prefs.showPlayerNames} onChange={(v) => update("showPlayerNames", v)} /></Row>
      <Row label="Show Stadium"><Toggle value={prefs.showStadium} onChange={(v) => update("showStadium", v)} /></Row>
      <Row label="Show Crowd"><Toggle value={prefs.showCrowd} onChange={(v) => update("showCrowd", v)} /></Row>
    </SettingsCard>
  );
}

function InterfaceSection() {
  return (
    <SettingsCard title="Interface" subtitle="Adjust how the game looks.">
      <Row label="Theme"><Select value="dark" onChange={() => {}} options={[{ value: "dark", label: "Dark" }]} /></Row>
      <Row label="Accent Colour"><span className="flex items-center gap-1.5 text-xs text-ink-400"><span className="h-3 w-3 rounded-full bg-accent-500" /> Red</span></Row>
      <p className="text-xs text-ink-500">Light theme and custom accent colours aren&apos;t built yet — Dark/Red is the only option right now.</p>
    </SettingsCard>
  );
}

function AudioSection() {
  return (
    <SettingsCard title="Audio" subtitle="Configure all audio settings.">
      <p className="text-xs text-ink-500">Touchline doesn&apos;t have an audio system yet (no music, commentary voice, or sound effects) — volume controls will appear here once that&apos;s built.</p>
    </SettingsCard>
  );
}

function NotificationsSection({ prefs, update }: { prefs: Preferences; update: <K extends keyof Preferences>(k: K, v: Preferences[K]) => void }) {
  return (
    <SettingsCard title="Notifications" subtitle="Choose what you want to be notified about.">
      <Row label="Inbox Messages"><Toggle value={prefs.notifyInbox} onChange={(v) => update("notifyInbox", v)} /></Row>
      <Row label="Transfers"><Toggle value={prefs.notifyTransfers} onChange={(v) => update("notifyTransfers", v)} /></Row>
      <Row label="Injuries"><Toggle value={prefs.notifyInjuries} onChange={(v) => update("notifyInjuries", v)} /></Row>
      <Row label="Match Events"><Toggle value={prefs.notifyMatchEvents} onChange={(v) => update("notifyMatchEvents", v)} /></Row>
      <Row label="Board Meetings"><Toggle value={prefs.notifyBoardMeetings} onChange={(v) => update("notifyBoardMeetings", v)} /></Row>
      <Row label="Competitions"><Toggle value={prefs.notifyCompetitions} onChange={(v) => update("notifyCompetitions", v)} /></Row>
      <p className="text-xs text-ink-500">These control whether an inbox item is generated for each category — there&apos;s no separate push-notification system.</p>
    </SettingsCard>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const meta = useGameStore((s) => s.meta);
  const world = useGameStore((s) => s.world);
  const manualSave = useGameStore((s) => s.manualSave);
  const { saves, loading, refresh, openSave } = useSaveList();
  const { prefs, update, reset: resetPrefs } = usePreferences();
  const [tab, setTab] = useState<Tab>("Overview");
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof listSnapshots>>>([]);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!meta) return;
    listSnapshots(meta.id).then(setSnapshots);
  }, [meta, busyMessage]);

  async function handleRestoreSnapshot(snapshotKey: string, createdAt: string) {
    if (!confirm(`Restore the snapshot from ${new Date(createdAt).toLocaleString()}? This overwrites the current save state.`)) return;
    setBusyMessage("Restoring snapshot…");
    await restoreSnapshot(snapshotKey);
    await refresh();
    setBusyMessage("Snapshot restored — load the save below to continue from it.");
    setTimeout(() => setBusyMessage(null), 2500);
  }

  async function handleManualSave() {
    setBusyMessage("Saving…");
    await manualSave();
    await refresh();
    setBusyMessage("Saved.");
    setTimeout(() => setBusyMessage(null), 1500);
  }

  async function handleSnapshot() {
    if (!meta || !world) return;
    setBusyMessage("Creating backup snapshot…");
    await takeSnapshot(meta, world);
    setBusyMessage("Snapshot created.");
    setTimeout(() => setBusyMessage(null), 1500);
  }

  async function handleExport() {
    if (!meta) return;
    const json = await exportSaveAsJson(meta.id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${meta.name.replace(/\s+/g, "-")}-backup.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBusyMessage("Importing…");
    const saveId = await importSaveFromJson(text);
    await setActiveSave(saveId);
    await refresh();
    setBusyMessage("Imported. Select it below to load.");
    setTimeout(() => setBusyMessage(null), 2000);
  }

  async function handleOpenSave(saveId: string) {
    await setActiveSave(saveId);
    await openSave(saveId);
    router.push("/inbox");
  }

  async function handleDelete(saveId: string) {
    if (!confirm("Delete this save permanently? This cannot be undone.")) return;
    await deleteSave(saveId);
    await refresh();
  }

  function handleResetGame() {
    if (!confirm("Reset ALL app data — every save, snapshot, and preference? This cannot be undone.")) return;
    if (!confirm("Really sure? This deletes everything permanently.")) return;
    resetPrefs();
    Promise.all(saves.map((s) => deleteSave(s.id))).then(() => {
      refresh();
      router.push("/new-game");
    });
  }

  const saveLoadSection = (
    <SettingsCard title="Save & Load" subtitle="Manage your saves.">
      <Row label="Current Save"><span className="text-xs text-positive-500">{meta?.name ?? "None"}</span></Row>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={handleManualSave} disabled={!meta} className="rounded-card bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40">Save Now</button>
        <button onClick={handleSnapshot} disabled={!meta} className="rounded-card border border-navy-500 bg-navy-800 px-2.5 py-1 text-xs text-ink-100 disabled:opacity-40">Backup ({snapshots.length})</button>
        <button onClick={handleExport} disabled={!meta} className="rounded-card border border-navy-500 bg-navy-800 px-2.5 py-1 text-xs text-ink-100 disabled:opacity-40">Export</button>
        <label className="cursor-pointer rounded-card border border-navy-500 bg-navy-800 px-2.5 py-1 text-xs text-ink-100">
          Import
          <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </label>
      </div>
    </SettingsCard>
  );

  const aboutSection = (
    <SettingsCard title="About">
      <p className="text-sm font-semibold text-ink-100">Touchline</p>
      <p className="text-xs text-ink-500">Version 0.1.0 — offline football manager, made with passion for the beautiful game.</p>
    </SettingsCard>
  );

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink-100">Settings</h1>
        <button onClick={resetPrefs} className="flex items-center gap-1.5 rounded-card border border-navy-600 px-3 py-1.5 text-xs text-ink-300 hover:bg-navy-800">
          <RotateCw size={13} /> Reset To Defaults
        </button>
      </div>

      {busyMessage && <p className="text-sm text-accent-400">{busyMessage}</p>}

      <div className="flex gap-1 overflow-x-auto border-b border-navy-700">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 px-3 py-2 text-sm ${tab === t ? "border-b-2 border-accent-500 font-medium text-ink-100" : "text-ink-500"}`}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <GameplaySection prefs={prefs} update={update} />
          <MatchSection prefs={prefs} update={update} />
          <InterfaceSection />
          <AudioSection />
          <NotificationsSection prefs={prefs} update={update} />
          {saveLoadSection}
        </div>
      )}
      {tab === "Gameplay" && <GameplaySection prefs={prefs} update={update} />}
      {tab === "Match" && <MatchSection prefs={prefs} update={update} />}
      {tab === "Interface" && <InterfaceSection />}
      {tab === "Audio" && <AudioSection />}
      {tab === "Notifications" && <NotificationsSection prefs={prefs} update={update} />}

      {tab === "Save & Load" && (
        <div className="flex flex-col gap-3">
          {saveLoadSection}
          <SettingsCard title="Backup snapshots" subtitle={`${snapshots.length} kept for this save (newest 5)`}>
            <div className="flex flex-col gap-2">
              {snapshots.map((s) => (
                <div key={s.snapshotKey} className="flex items-center justify-between gap-2 rounded-card border border-navy-600 bg-navy-800 px-3 py-2">
                  <p className="text-sm text-ink-300">{new Date(s.createdAt).toLocaleString()}</p>
                  <button onClick={() => handleRestoreSnapshot(s.snapshotKey, s.createdAt)} className="rounded-card border border-navy-500 px-2.5 py-1 text-xs text-ink-100">Restore</button>
                </div>
              ))}
              {snapshots.length === 0 && <p className="text-sm text-ink-500">No snapshots yet.</p>}
            </div>
          </SettingsCard>
          <SettingsCard title="Your saves" subtitle={loading ? "Loading…" : `${saves.length} save(s)`}>
            <div className="flex flex-col gap-2">
              {saves.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-card border border-navy-600 bg-navy-800 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-100">{s.name}</p>
                    <p className="text-xs text-ink-500">{s.currentDate} • <Badge tone={s.saveType === "manual" ? "success" : "neutral"}>{s.saveType}</Badge></p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => handleOpenSave(s.id)} className="rounded-card bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white">Load</button>
                    <button onClick={() => handleDelete(s.id)} className="rounded-card border border-danger-500 px-2.5 py-1 text-xs text-danger-500">Delete</button>
                  </div>
                </div>
              ))}
              {saves.length === 0 && !loading && <p className="text-sm text-ink-500">No saves yet.</p>}
            </div>
          </SettingsCard>
          <SettingsCard title="New career">
            <p className="text-sm text-ink-500">Start a fresh save. Your current save stays on disk untouched.</p>
            <button onClick={() => router.push("/new-game")} className="w-fit rounded-card border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100">Start new career</button>
          </SettingsCard>
        </div>
      )}

      {tab === "About" && (
        <div className="flex flex-col gap-3">
          {aboutSection}
          <SettingsCard title="Install app" subtitle="Best experience on mobile">
            <p className="text-sm text-ink-500">Installing to your home screen launches Touchline full-screen with no browser bar.</p>
            <InstallPrompt />
          </SettingsCard>
          <SettingsCard title="Credits">
            <p className="text-sm text-ink-500">Built solo, patch by patch.</p>
          </SettingsCard>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {tab === "Overview" && (
          <>
            <div className="md:col-span-2">{aboutSection}</div>
          </>
        )}
      </div>

      <div className="glass-panel flex items-center justify-between gap-3 rounded-card p-3">
        <p className="flex-1 text-sm text-ink-300">💡 <span className="text-ink-500">Tip:</span> {TIPS[tipIndex]}</p>
        <div className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
          <button onClick={() => setTipIndex((i) => (i - 1 + TIPS.length) % TIPS.length)}>‹</button>
          {tipIndex + 1} / {TIPS.length}
          <button onClick={() => setTipIndex((i) => (i + 1) % TIPS.length)}>›</button>
        </div>
      </div>

      <SettingsCard title="Reset Game">
        <p className="text-sm text-danger-500">Reset your game data. This action cannot be undone.</p>
        <button onClick={handleResetGame} className="w-fit rounded-card border border-danger-500 px-3 py-1.5 text-sm text-danger-500">Reset All Data</button>
      </SettingsCard>
    </div>
  );
}
