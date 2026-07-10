"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useGameStore } from "@/state/gameStore";
import { useSaveList } from "@/hooks/useSaveGame";
import { takeSnapshot, setActiveSave } from "@/engines/persistence/saveManager";
import { exportSaveAsJson, importSaveFromJson, listSnapshots, restoreSnapshot, deleteSave } from "@/engines/persistence/db";

export default function SettingsPage() {
  const router = useRouter();
  const meta = useGameStore((s) => s.meta);
  const world = useGameStore((s) => s.world);
  const manualSave = useGameStore((s) => s.manualSave);
  const { saves, loading, refresh, openSave } = useSaveList();
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof listSnapshots>>>([]);

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
    a.href = url;
    a.download = `${meta.name.replace(/\s+/g, "-")}-backup.json`;
    a.click();
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

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Settings</h1>

      {busyMessage && <p className="text-sm text-accent-400">{busyMessage}</p>}

      <Card>
        <CardHeader title="Current save" subtitle={meta?.name ?? "No save loaded"} />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleManualSave}
            disabled={!meta}
            className="rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
          >
            Manual save
          </button>
          <button
            onClick={handleSnapshot}
            disabled={!meta}
            className="rounded-card border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100 active:scale-95 disabled:opacity-40"
          >
            Backup snapshot
          </button>
          <button
            onClick={handleExport}
            disabled={!meta}
            className="rounded-card border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100 active:scale-95 disabled:opacity-40"
          >
            Export backup file
          </button>
          <label className="cursor-pointer rounded-card border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100 active:scale-95">
            Import backup file
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Backup snapshots" subtitle={`${snapshots.length} kept for this save (newest 5)`} />
        <div className="flex flex-col gap-2">
          {snapshots.map((s) => (
            <div key={s.snapshotKey} className="flex items-center justify-between gap-2 rounded-card border border-navy-600 bg-navy-800 px-3 py-2">
              <p className="text-sm text-ink-300">{new Date(s.createdAt).toLocaleString()}</p>
              <button
                onClick={() => handleRestoreSnapshot(s.snapshotKey, s.createdAt)}
                className="rounded-card border border-navy-500 px-2.5 py-1 text-xs text-ink-100 active:scale-95"
              >
                Restore
              </button>
            </div>
          ))}
          {snapshots.length === 0 && <p className="text-sm text-ink-500">No snapshots yet — take one before a risky transfer window or cup run.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Your saves" subtitle={loading ? "Loading…" : `${saves.length} save(s)`} />
        <div className="flex flex-col gap-2">
          {saves.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-card border border-navy-600 bg-navy-800 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-100">{s.name}</p>
                <p className="text-xs text-ink-500">
                  {s.currentDate} • <Badge tone={s.saveType === "manual" ? "success" : "neutral"}>{s.saveType}</Badge>
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => handleOpenSave(s.id)} className="rounded-card bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white active:scale-95">
                  Load
                </button>
                <button onClick={() => handleDelete(s.id)} className="rounded-card border border-danger-500 px-2.5 py-1 text-xs text-danger-500 active:scale-95">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {saves.length === 0 && !loading && <p className="text-sm text-ink-500">No saves yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="New career" />
        <p className="mb-2 text-sm text-ink-500">Start a fresh save. Your current save stays on disk untouched.</p>
        <button
          onClick={() => router.push("/new-game")}
          className="rounded-card border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100 active:scale-95"
        >
          Start new career
        </button>
      </Card>

      <Card>
        <CardHeader title="Editable player/manager database" />
        <p className="text-sm text-ink-500">
          Real-world player and manager data lives in JSON files under{" "}
          <code className="rounded bg-navy-800 px-1 py-0.5 font-data text-xs">src/data/</code>, editable by hand —
          see <code className="rounded bg-navy-800 px-1 py-0.5 font-data text-xs">src/data/README.md</code> for the
          schema. In-app dataset caching (import a JSON file here without rebuilding the app) is wired at the
          persistence layer (<code className="rounded bg-navy-800 px-1 py-0.5 font-data text-xs">localPlayerDb</code>{" "}
          store in <code className="rounded bg-navy-800 px-1 py-0.5 font-data text-xs">engines/persistence/db.ts</code>)
          — this screen is the natural place to add an upload control for it.
        </p>
      </Card>

      <Card>
        <CardHeader title="Cloud sync (optional)" />
        <p className="text-sm text-ink-500">
          Off by default — this app works fully offline. To enable best-effort sync to your own server or storage
          bucket, register a provider via{" "}
          <code className="rounded bg-navy-800 px-1 py-0.5 font-data text-xs">registerCloudSyncProvider()</code> in{" "}
          <code className="rounded bg-navy-800 px-1 py-0.5 font-data text-xs">engines/persistence/saveManager.ts</code>.
        </p>
      </Card>
    </div>
  );
}
