// ============================================================================
// IndexedDB layer — the only place in the app that talks to `idb` directly.
// Everything else (saveManager, hooks, UI) goes through this module.
// ============================================================================
import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { SaveGameMeta, SaveGameWorld } from "@/domain/types";

const DB_NAME = "fm-sim-db";
const DB_VERSION = 1;

interface FmSimDB extends DBSchema {
  saveMeta: {
    key: string; // saveId
    value: SaveGameMeta;
    indexes: { "by-lastPlayed": string };
  };
  saveWorld: {
    key: string; // saveId
    value: SaveGameWorld;
  };
  snapshots: {
    key: string; // `${saveId}::${timestamp}`
    value: { snapshotKey: string; saveId: string; createdAt: string; meta: SaveGameMeta; world: SaveGameWorld };
  };
  localPlayerDb: {
    // The user-editable "real world" reference database (players/managers),
    // imported from the JSON files in src/data and cached here so edits made
    // in-app (Settings > Database) persist without rebuilding the app.
    key: string; // dataset key, e.g. "players", "managers", "leagues"
    value: { key: string; updatedAt: string; payload: unknown };
  };
  kv: {
    // Small generic key/value store: last-active save id, settings, etc.
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<FmSimDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<FmSimDB>> {
  if (typeof window === "undefined") {
    throw new Error("getDb() called on the server — IndexedDB is client-only.");
  }
  if (!dbPromise) {
    dbPromise = openDB<FmSimDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("saveMeta")) {
          const store = db.createObjectStore("saveMeta", { keyPath: "id" });
          store.createIndex("by-lastPlayed", "lastPlayedAt");
        }
        if (!db.objectStoreNames.contains("saveWorld")) {
          db.createObjectStore("saveWorld", { keyPath: "saveId" });
        }
        if (!db.objectStoreNames.contains("snapshots")) {
          db.createObjectStore("snapshots");
        }
        if (!db.objectStoreNames.contains("localPlayerDb")) {
          db.createObjectStore("localPlayerDb", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ---- Save meta --------------------------------------------------------------

export async function listSaveMeta(): Promise<SaveGameMeta[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("saveMeta", "by-lastPlayed");
  return all.reverse(); // most recent first
}

export async function putSaveMeta(meta: SaveGameMeta): Promise<void> {
  const db = await getDb();
  await db.put("saveMeta", meta);
}

export async function deleteSave(saveId: string): Promise<void> {
  const db = await getDb();
  await db.delete("saveMeta", saveId);
  await db.delete("saveWorld", saveId);
}

// ---- Save world (the big blob) ----------------------------------------------

export async function getSaveWorld(saveId: string): Promise<SaveGameWorld | undefined> {
  const db = await getDb();
  return db.get("saveWorld", saveId);
}

export async function putSaveWorld(world: SaveGameWorld): Promise<void> {
  const db = await getDb();
  await db.put("saveWorld", world);
}

// ---- Snapshots (backup points, e.g. before a risky sim or big transfer window) --

export async function createSnapshot(meta: SaveGameMeta, world: SaveGameWorld): Promise<string> {
  const db = await getDb();
  const snapKey = `${meta.id}::${Date.now()}`;
  await db.put("snapshots", { snapshotKey: snapKey, saveId: meta.id, createdAt: new Date().toISOString(), meta, world }, snapKey);
  return snapKey;
}

export async function listSnapshots(saveId: string) {
  const db = await getDb();
  const all = await db.getAll("snapshots");
  return all.filter((s) => s.saveId === saveId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function restoreSnapshot(snapshotKey: string): Promise<void> {
  const db = await getDb();
  const snap = await db.get("snapshots", snapshotKey);
  if (!snap) throw new Error(`Snapshot ${snapshotKey} not found`);
  await db.put("saveMeta", snap.meta);
  await db.put("saveWorld", snap.world);
}

export async function pruneOldSnapshots(saveId: string, keep = 5): Promise<void> {
  const db = await getDb();
  const all = await db.getAll("snapshots");
  const mine = all
    .map((s, i) => ({ ...s }))
    .filter((s) => s.saveId === saveId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const toDelete = mine.slice(keep);
  for (const snap of toDelete) {
    // We don't have the original key here, so re-derive by scanning keys.
    const tx = db.transaction("snapshots", "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.value.saveId === snap.saveId && cursor.value.createdAt === snap.createdAt) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

// ---- Local editable "real world" database -----------------------------------

export async function getLocalDbDataset(key: string): Promise<unknown | undefined> {
  const db = await getDb();
  const row = await db.get("localPlayerDb", key);
  return row?.payload;
}

export async function putLocalDbDataset(key: string, payload: unknown): Promise<void> {
  const db = await getDb();
  await db.put("localPlayerDb", { key, updatedAt: new Date().toISOString(), payload });
}

// ---- Generic KV --------------------------------------------------------------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get("kv", key);
  return row?.value as T | undefined;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put("kv", { key, value });
}

// ---- Export / Import (manual backup files, since cloud sync is optional) ----

export async function exportSaveAsJson(saveId: string): Promise<string> {
  const db = await getDb();
  const meta = await db.get("saveMeta", saveId);
  const world = await db.get("saveWorld", saveId);
  if (!meta || !world) throw new Error(`Save ${saveId} not found`);
  return JSON.stringify({ meta, world, exportedAt: new Date().toISOString() });
}

export async function importSaveFromJson(json: string): Promise<string> {
  const parsed = JSON.parse(json) as { meta: SaveGameMeta; world: SaveGameWorld };
  const db = await getDb();
  await db.put("saveMeta", parsed.meta);
  await db.put("saveWorld", parsed.world);
  return parsed.meta.id;
}
