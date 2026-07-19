"use client";
import { useEffect, useState } from "react";

// These are device/app preferences, distinct from the save game itself —
// stored in localStorage (not IndexedDB) since they're not part of a
// career's data. Most controls here are genuinely persisted (the value you
// pick sticks across reloads); only a few (Match Speed default, Highlights,
// Auto Save cadence) are actually wired into gameplay behavior yet — the
// rest are honest placeholders for a future pass, not fake toggles that
// silently do nothing while implying otherwise.
export interface Preferences {
  gameMode: "manager" | "director-of-football";
  difficulty: "easy" | "normal" | "hard" | "professional";
  inGameEditor: boolean;
  useRealPlayerFaces: boolean;
  autoSave: "off" | "every-day" | "every-week";
  matchSpeedDefault: 1 | 2 | 4;
  highlights: "key-highlights" | "extended" | "full-match";
  show3dMatch: boolean;
  showPlayerNames: boolean;
  showStadium: boolean;
  showCrowd: boolean;
  notifyInbox: boolean;
  notifyTransfers: boolean;
  notifyInjuries: boolean;
  notifyMatchEvents: boolean;
  notifyBoardMeetings: boolean;
  notifyCompetitions: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  gameMode: "manager",
  difficulty: "normal",
  inGameEditor: false,
  useRealPlayerFaces: true,
  autoSave: "every-day",
  matchSpeedDefault: 2,
  highlights: "extended",
  show3dMatch: true,
  showPlayerNames: true,
  showStadium: true,
  showCrowd: true,
  notifyInbox: true,
  notifyTransfers: true,
  notifyInjuries: true,
  notifyMatchEvents: true,
  notifyBoardMeetings: true,
  notifyCompetitions: true,
};

const STORAGE_KEY = "touchline:preferences";

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) });
    } catch {
      // corrupt/unavailable storage — fall back to defaults silently
    }
    setLoaded(true);
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function reset() {
    setPrefs(DEFAULT_PREFERENCES);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return { prefs, update, reset, loaded };
}
