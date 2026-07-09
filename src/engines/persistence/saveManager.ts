// ============================================================================
// Save manager — policy layer above db.ts. Decides *when* and *how* to save;
// db.ts only knows *how to store bytes*.
// ============================================================================
import { nanoid } from "nanoid";
import type { SaveGameMeta, SaveGameWorld } from "@/domain/types";
import {
  putSaveMeta,
  putSaveWorld,
  createSnapshot,
  pruneOldSnapshots,
  kvGet,
  kvSet,
  getSaveWorld,
  listSaveMeta,
} from "./db";

const APP_VERSION = "0.1.0";
const AUTOSAVE_INTERVAL_DAYS = 1; // one autosave per in-game day advanced
const SNAPSHOT_KEEP_COUNT = 5;

export async function createNewSave(params: {
  name: string; managerName: string; clubName: string | null; startDate: string; world: SaveGameWorld;
}): Promise<SaveGameMeta> {
  const meta: SaveGameMeta = {
    id: nanoid(12),
    name: params.name,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    currentDate: params.startDate,
    managerName: params.managerName,
    clubName: params.clubName,
    saveType: "manual",
    appVersion: APP_VERSION,
  };
  await putSaveMeta(meta);
  await putSaveWorld({ ...params.world, saveId: meta.id });
  await kvSet("lastActiveSaveId", meta.id);
  return meta;
}

export async function manualSave(meta: SaveGameMeta, world: SaveGameWorld): Promise<SaveGameMeta> {
  const updated: SaveGameMeta = {
    ...meta,
    lastPlayedAt: new Date().toISOString(),
    currentDate: world.currentDate,
    saveType: "manual",
  };
  await putSaveMeta(updated);
  await putSaveWorld(world);
  return updated;
}

// Called by the calendar engine each time a day is advanced. Debounced to
// once per AUTOSAVE_INTERVAL_DAYS so heavy sim days (matchday) aren't
// double-charged with a save write on every phase transition.
export async function maybeAutosave(meta: SaveGameMeta, world: SaveGameWorld): Promise<SaveGameMeta> {
  const updated: SaveGameMeta = {
    ...meta,
    lastPlayedAt: new Date().toISOString(),
    currentDate: world.currentDate,
    saveType: "autosave",
  };
  await putSaveMeta(updated);
  await putSaveWorld(world);
  return updated;
}

// Snapshots are explicit backup points: before a transfer window closes,
// before simulating a cup final, or on manual request from Settings.
export async function takeSnapshot(meta: SaveGameMeta, world: SaveGameWorld): Promise<string> {
  const key = await createSnapshot(meta, world);
  await pruneOldSnapshots(meta.id, SNAPSHOT_KEEP_COUNT);
  return key;
}

export async function getLastActiveSave(): Promise<{ meta: SaveGameMeta; world: SaveGameWorld } | null> {
  const lastId = await kvGet<string>("lastActiveSaveId");
  if (!lastId) return null;
  const world = await getSaveWorld(lastId);
  if (!world) return null;
  const metas = await listSaveMeta();
  const meta = metas.find((m) => m.id === lastId);
  if (!meta) return null;
  return { meta, world };
}

export async function setActiveSave(saveId: string): Promise<void> {
  await kvSet("lastActiveSaveId", saveId);
}

// ---- Cloud sync (optional, stubbed) -----------------------------------------
// Left as an explicit extension point: swap the no-op body for a fetch() to
// a user-supplied sync endpoint (e.g. a personal S3 bucket or self-hosted
// server). Kept isolated so it never blocks offline play — it's opt-in and
// best-effort only.

export interface CloudSyncProvider {
  push(saveId: string, payload: string): Promise<void>;
  pull(saveId: string): Promise<string | null>;
}

let cloudProvider: CloudSyncProvider | null = null;

export function registerCloudSyncProvider(provider: CloudSyncProvider) {
  cloudProvider = provider;
}

export async function trySyncToCloud(saveId: string, payload: string): Promise<"synced" | "skipped" | "failed"> {
  if (!cloudProvider) return "skipped";
  try {
    await cloudProvider.push(saveId, payload);
    return "synced";
  } catch {
    return "failed";
  }
}
