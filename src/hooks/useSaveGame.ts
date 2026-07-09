"use client";
import { useEffect, useState } from "react";
import { getLastActiveSave } from "@/engines/persistence/saveManager";
import { listSaveMeta, getSaveWorld } from "@/engines/persistence/db";
import { useGameStore } from "@/state/gameStore";
import type { SaveGameMeta } from "@/domain/types";

// Attempts to auto-load the last-played save when the app mounts. Returns
// `status` so the shell can show a loading state or route to /new-game.
export function useAutoLoadSave() {
  const [status, setStatus] = useState<"loading" | "loaded" | "no-save">("loading");
  const loadSave = useGameStore((s) => s.loadSave);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getLastActiveSave();
        if (cancelled) return;
        if (result) {
          loadSave(result.meta, result.world);
          setStatus("loaded");
        } else {
          setStatus("no-save");
        }
      } catch (err) {
        console.error("Failed to auto-load save:", err);
        setStatus("no-save");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSave]);

  return status;
}

// For the Settings > Load Game screen — lists all saves without pulling the
// full world blob for each one.
export function useSaveList() {
  const [saves, setSaves] = useState<SaveGameMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const all = await listSaveMeta();
    setSaves(all);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const loadSpecificSave = useGameStore((s) => s.loadSave);
  const openSave = async (saveId: string) => {
    const world = await getSaveWorld(saveId);
    const meta = saves.find((m) => m.id === saveId);
    if (world && meta) loadSpecificSave(meta, world);
  };

  return { saves, loading, refresh, openSave };
}
