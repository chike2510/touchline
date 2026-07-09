// ============================================================================
// Match simulation Web Worker. All heavy per-minute simulation runs here so
// the UI thread stays responsive for live tactical changes and animations.
// The worker holds a `players` snapshot (passed once at init) plus the live
// MatchState; it never touches IndexedDB directly — the main thread persists
// the final MatchResult once "finished" comes back.
// ============================================================================
/// <reference lib="webworker" />
import type { ID, Player } from "@/domain/types";
import type { MatchSimRequest, MatchSimResponse, MatchState } from "@/engines/match/matchTypes";
import { initMatchState, simulateToMinute, applySubstitution, applyTacticChange } from "@/engines/match/matchEngine";
import { computeSquadChemistry } from "@/engines/personality/personalityEngine";

declare const self: DedicatedWorkerGlobalScope;

let state: MatchState | null = null;
let playersSnapshot: Record<ID, Player> = {};
let chemistryByClub: Record<ID, number> = {};
let tacticFamiliarityByClub: Record<ID, number> = {};

function post(msg: MatchSimResponse) {
  self.postMessage(msg);
}

self.onmessage = (ev: MessageEvent<MatchSimRequest & { players?: Record<ID, Player>; chemistry?: Record<ID, number>; familiarity?: Record<ID, number> }>) => {
  const msg = ev.data;
  try {
    switch (msg.kind) {
      case "init": {
        playersSnapshot = (msg as unknown as { players: Record<ID, Player> }).players ?? {};
        chemistryByClub = (msg as unknown as { chemistry: Record<ID, number> }).chemistry ?? {
          [msg.home.clubId]: 60,
          [msg.away.clubId]: 60,
        };
        tacticFamiliarityByClub = (msg as unknown as { familiarity: Record<ID, number> }).familiarity ?? {
          [msg.home.clubId]: msg.home.tactic.familiarity,
          [msg.away.clubId]: msg.away.tactic.familiarity,
        };
        state = initMatchState(msg.home, msg.away, msg.context, msg.seed, playersSnapshot);
        post({ kind: "state-update", state });
        break;
      }
      case "simulate-to-minute": {
        if (!state) throw new Error("Match not initialised — send 'init' first.");
        simulateToMinute(state, msg.targetMinute, playersSnapshot, chemistryByClub, tacticFamiliarityByClub);
        post({ kind: "state-update", state });
        break;
      }
      case "apply-substitution": {
        if (!state) throw new Error("Match not initialised.");
        const player = playersSnapshot[msg.playerOnId];
        applySubstitution(state, msg.clubId, msg.playerOffId, msg.playerOnId, msg.positionCode, player?.fatigue ?? 0);
        post({ kind: "state-update", state });
        break;
      }
      case "apply-tactic-change": {
        if (!state) throw new Error("Match not initialised.");
        applyTacticChange(state, msg.clubId, msg.tactic);
        tacticFamiliarityByClub[msg.clubId] = msg.tactic.familiarity;
        post({ kind: "state-update", state });
        break;
      }
      case "get-state": {
        if (!state) throw new Error("Match not initialised.");
        post({ kind: "state-update", state });
        break;
      }
    }
  } catch (err) {
    post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

// Chemistry recompute helper exported for completeness — not currently
// wired to a message type since chemistry changes slowly (per-day, not
// per-minute); the main thread recomputes it via computeSquadChemistry and
// passes it in "init". Kept as a named export so a future
// "recompute-chemistry" message can reuse it without duplicating logic.
export { computeSquadChemistry };
