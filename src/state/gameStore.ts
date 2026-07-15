// ============================================================================
// gameStore — in-memory representation of the active save. UI components
// read from here; mutations go through actions that call the relevant
// engine, then persist via engines/persistence/saveManager.
// ============================================================================
import { create } from "zustand";
import type { SaveGameMeta, SaveGameWorld } from "@/domain/types";
import { advancePhase, advanceUntilNextMatchOrDecisionNeeded } from "@/engines/calendar/calendarEngine";
import { maybeAutosave, manualSave as persistManualSave } from "@/engines/persistence/saveManager";

let debouncedSaveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 700;

interface GameState {
  meta: SaveGameMeta | null;
  world: SaveGameWorld | null;
  isLoading: boolean;
  simStatus: "idle" | "simming";
  viewingPlayerId: string | null;
  openPlayerProfile: (playerId: string) => void;
  closePlayerProfile: () => void;
  loadSave: (meta: SaveGameMeta, world: SaveGameWorld) => void;
  clearSave: () => void;
  advanceOnePhase: () => Promise<void>;
  simToNextMatch: () => Promise<"matchday" | "decision-pending" | "max-days-reached" | "none">;
  manualSave: () => Promise<void>;
  flushPendingSave: () => Promise<void>;
  mutateWorld: (mutator: (world: SaveGameWorld) => void) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  meta: null,
  world: null,
  isLoading: false,
  simStatus: "idle",
  viewingPlayerId: null,
  openPlayerProfile: (playerId) => set({ viewingPlayerId: playerId }),
  closePlayerProfile: () => set({ viewingPlayerId: null }),

  loadSave: (meta, world) => set({ meta, world }),
  clearSave: () => set({ meta: null, world: null }),

  // Applies one calendar phase transition, then autosaves. Autosave is
  // fire-and-forget from the UI's perspective (it doesn't block phase
  // advancement) but awaited here so callers can show a save indicator.
  advanceOnePhase: async () => {
    const { meta, world } = get();
    if (!meta || !world) return;
    const nextWorld = { ...world };
    advancePhase(nextWorld);
    set({ world: nextWorld });
    const updatedMeta = await maybeAutosave(meta, nextWorld);
    set({ meta: updatedMeta });
  },

  // Fast-forwards through empty days (training, off-pitch, briefings) until
  // the next matchday or an urgent decision surfaces — this is the "Sim to
  // next match" button. Without it, reaching a fixture a week away means
  // clicking Continue through every intervening phase one at a time, which
  // is what made the game feel like it "never" got to the next match.
  simToNextMatch: async () => {
    const { meta, world } = get();
    if (!meta || !world) return "none";
    set({ simStatus: "simming" });
    const clonedWorld = { ...world };
    const { world: resultWorld, stoppedReason } = advanceUntilNextMatchOrDecisionNeeded(clonedWorld);
    set({ world: resultWorld, simStatus: "idle" });
    const updatedMeta = await maybeAutosave(meta, resultWorld);
    set({ meta: updatedMeta });
    return stoppedReason;
  },

  manualSave: async () => {
    const { meta, world } = get();
    if (!meta || !world) return;
    const updatedMeta = await persistManualSave(meta, world);
    set({ meta: updatedMeta });
  },

  // Bypasses the debounce entirely — call this from a visibilitychange/
  // beforeunload listener so a save is never lost to the debounce window
  // when the tab is about to be backgrounded or killed (the exact moment
  // mobile OSes are most likely to kill it).
  flushPendingSave: async () => {
    if (debouncedSaveTimer) { clearTimeout(debouncedSaveTimer); debouncedSaveTimer = null; }
    const { meta, world } = get();
    if (!meta || !world) return;
    const updatedMeta = await maybeAutosave(meta, world);
    set({ meta: updatedMeta });
  },

  // Escape hatch for engines that mutate world state directly (transfers,
  // media responses, team talks, substitutions, tactic changes, confirming
  // match results). This used to be memory-only — nothing here ever wrote
  // to IndexedDB, only advanceOnePhase/simToNextMatch did. That meant any
  // action that went through here (which is most of them) only survived if
  // the user happened to advance a calendar phase again before the tab got
  // killed — on mobile, where the OS aggressively kills backgrounded tabs,
  // that's exactly what looked like "the save randomly resets". Now every
  // mutation persists too, fire-and-forget so the UI stays synchronous.
  mutateWorld: (mutator) => {
    const { world, meta } = get();
    if (!world) return;
    const next = { ...world };
    mutator(next);
    set({ world: next });
    if (meta) {
      if (debouncedSaveTimer) clearTimeout(debouncedSaveTimer);
      debouncedSaveTimer = setTimeout(() => {
        const { meta: latestMeta, world: latestWorld } = get();
        if (latestMeta && latestWorld) {
          void maybeAutosave(latestMeta, latestWorld).then((updatedMeta) => set({ meta: updatedMeta }));
        }
      }, DEBOUNCE_MS);
    }
  },
}));
