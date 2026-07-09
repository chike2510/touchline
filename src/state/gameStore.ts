// ============================================================================
// gameStore — in-memory representation of the active save. UI components
// read from here; mutations go through actions that call the relevant
// engine, then persist via engines/persistence/saveManager.
// ============================================================================
import { create } from "zustand";
import type { SaveGameMeta, SaveGameWorld } from "@/domain/types";
import { advancePhase } from "@/engines/calendar/calendarEngine";
import { maybeAutosave, manualSave as persistManualSave } from "@/engines/persistence/saveManager";

interface GameState {
  meta: SaveGameMeta | null;
  world: SaveGameWorld | null;
  isLoading: boolean;
  loadSave: (meta: SaveGameMeta, world: SaveGameWorld) => void;
  clearSave: () => void;
  advanceOnePhase: () => Promise<void>;
  manualSave: () => Promise<void>;
  mutateWorld: (mutator: (world: SaveGameWorld) => void) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  meta: null,
  world: null,
  isLoading: false,

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

  manualSave: async () => {
    const { meta, world } = get();
    if (!meta || !world) return;
    const updatedMeta = await persistManualSave(meta, world);
    set({ meta: updatedMeta });
  },

  // Escape hatch for engines that mutate world state directly (transfers,
  // media responses, team talks) without going through the calendar.
  mutateWorld: (mutator) => {
    const { world } = get();
    if (!world) return;
    const next = { ...world };
    mutator(next);
    set({ world: next });
  },
}));
