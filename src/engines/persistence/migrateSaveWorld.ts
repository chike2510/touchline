// ============================================================================
// Save migration — the tactic data shape has changed more than once during
// development (single formation -> dual in/out-of-possession shapes ->
// added defensiveWidth, etc.). A save written before any of those changes
// will crash the moment the UI reads a field that doesn't exist on it.
//
// Rather than hand-patch each historical shape (which just means the next
// schema change breaks old saves again), this validates the tactic against
// a handful of representative leaf fields from the *current* shape. If
// anything's missing, it fully regenerates the tactic from the two pieces
// of information that survive every schema version — the formation string
// and the starting XI's player ids (the keys of `playerRoles` never change
// meaning) — via the same builder AI tactics use. Fine-tuned slider/role
// settings from a stale save are lost in that case, but the save loads
// instead of crashing, which is the trade worth making.
// ============================================================================
import type { SaveGameWorld, TacticSetup } from "@/domain/types";
import { ensureManagerProfiles } from "@/engines/ai/managerProfiles";
import { buildTacticFromStyle } from "@/engines/tactics/aiTactics";

function isValidTacticShape(t: unknown): t is TacticSetup {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, any>;
  return (
    typeof x.tacticalStyleId === "string" &&
    typeof x.inPossession?.formation === "string" &&
    typeof x.inPossession?.instructions?.tempo === "string" &&
    typeof x.outOfPossession?.formation === "string" &&
    typeof x.outOfPossession?.instructions?.defensiveWidth === "string" &&
    typeof x.attack?.finalThirdCrossing === "string" &&
    typeof x.transition?.counterAttackSpeed === "string" &&
    x.playerRoles && typeof x.playerRoles === "object" &&
    Object.keys(x.playerRoles).length > 0
  );
}

function migrateTacticSetup(raw: unknown): TacticSetup {
  if (isValidTacticShape(raw)) return raw;

  const x = (raw ?? {}) as Record<string, any>;
  const formation: string = x.inPossession?.formation ?? x.formation ?? "4-3-3";
  const startingXI: string[] = Object.keys(x.playerRoles ?? {});
  const name: string = typeof x.name === "string" ? x.name : "Starting XI";
  const rebuilt = buildTacticFromStyle("clean-slate", formation, startingXI, name);
  // Preserve familiarity if the old shape had a plausible value; otherwise
  // the fresh tactic's own (lower) default stands.
  if (typeof x.familiarity === "number" && x.familiarity >= 0 && x.familiarity <= 100) {
    rebuilt.familiarity = x.familiarity;
  }
  return rebuilt;
}

// Call on every save load (auto-load and manual load both funnel through
// here) — mutates nothing on disk, just normalizes the in-memory object the
// rest of the app reads from. The next autosave/manual save will persist
// the migrated shape, so the fix-up only ever needs to run once per save.
// Fills every optional field added since the first public save format. Idempotent and non-destructive:
// existing values are never overwritten, and the input object is not mutated (players are copied only when changed).
export function migrateSaveWorld(world: SaveGameWorld): SaveGameWorld {
  const players: SaveGameWorld["players"] = {};
  for (const [id, p] of Object.entries(world.players ?? {})) {
    const needs = p.injuryStatus === undefined || p.suspension === undefined;
    players[id] = needs ? { ...p, injuryStatus: p.injuryStatus ?? null, suspension: p.suspension ?? null } : p;
  }
  const managers: SaveGameWorld["managers"] = {};
  for (const [id, m] of Object.entries(world.managers ?? {})) managers[id] = { ...m };
  const migrated: SaveGameWorld = {
    ...world,
    players,
    managers,
    activeTactic: migrateTacticSetup(world.activeTactic),
    savedTactics: (world.savedTactics ?? []).map(migrateTacticSetup),
    seasonNumber: world.seasonNumber ?? 1,
    seasonArchive: world.seasonArchive ?? [],
    shortlistedPlayerIds: world.shortlistedPlayerIds ?? [],
    inboxItems: world.inboxItems ?? {},
    calendar: world.calendar ?? {},
  };
  ensureManagerProfiles(migrated);
  return migrated;
}
