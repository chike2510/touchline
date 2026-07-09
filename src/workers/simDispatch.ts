// ============================================================================
// simDispatch — thin promise-based wrapper around the raw postMessage API so
// UI components (Matchday screen) can `await` simulation steps instead of
// juggling onmessage callbacks directly.
// ============================================================================
import type { ID, Player, PositionCode, TacticSetup } from "@/domain/types";
import type { MatchContext, MatchState, TeamMatchSetup } from "@/engines/match/matchTypes";

export class MatchSimClient {
  private worker: Worker;
  private latestState: MatchState | null = null;
  private listeners = new Set<(state: MatchState) => void>();

  constructor() {
    this.worker = new Worker(new URL("../workers/matchSim.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.kind === "state-update") {
        this.latestState = msg.state as MatchState;
        for (const listener of this.listeners) listener(this.latestState);
      } else if (msg.kind === "error") {
        console.error("[matchSim.worker]", msg.message);
      }
    };
  }

  onUpdate(listener: (state: MatchState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  init(params: {
    home: TeamMatchSetup; away: TeamMatchSetup; context: MatchContext; seed: number;
    players: Record<ID, Player>; chemistry: Record<ID, number>; familiarity: Record<ID, number>;
  }) {
    this.worker.postMessage({ kind: "init", ...params });
  }

  simulateToMinute(targetMinute: number) {
    this.worker.postMessage({ kind: "simulate-to-minute", targetMinute });
  }

  applySubstitution(clubId: ID, playerOffId: ID, playerOnId: ID, positionCode: PositionCode) {
    this.worker.postMessage({ kind: "apply-substitution", clubId, playerOffId, playerOnId, positionCode });
  }

  applyTacticChange(clubId: ID, tactic: TacticSetup) {
    this.worker.postMessage({ kind: "apply-tactic-change", clubId, tactic });
  }

  getState(): MatchState | null {
    return this.latestState;
  }

  terminate() {
    this.worker.terminate();
  }
}
