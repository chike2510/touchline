import { describe, expect, it } from "vitest";
import { applySubstitution, removeSentOffPlayersFromSetup } from "@/engines/match/matchEngine";
import type { MatchState } from "@/engines/match/matchTypes";

function matchState(): MatchState {
  const home = { clubId: "home", startingXI: ["sent", "active"], bench: ["sub"], substitutesUsed: 0, maxSubstitutions: 5 };
  const away = { clubId: "away", startingXI: ["away-player"], bench: [], substitutesUsed: 0, maxSubstitutions: 5 };
  return {
    home, away,
    playerStates: {
      sent: { playerId: "sent", clubId: "home", onPitch: false, minutesPlayed: 20, fatigue: 20, rating: 4.5, goals: 0, assists: 0, yellowCards: 0, redCards: 1, shots: 0, shotsOnTarget: 0, positionCode: "CB" },
      active: { playerId: "active", clubId: "home", onPitch: true, minutesPlayed: 20, fatigue: 20, rating: 6, goals: 0, assists: 0, yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0, positionCode: "ST" },
      sub: { playerId: "sub", clubId: "home", onPitch: false, minutesPlayed: 0, fatigue: 0, rating: 6, goals: 0, assists: 0, yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0, positionCode: "ST" },
      "away-player": { playerId: "away-player", clubId: "away", onPitch: true, minutesPlayed: 20, fatigue: 20, rating: 6, goals: 0, assists: 0, yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0, positionCode: "ST" },
    },
  } as unknown as MatchState;
}

describe("dismissed-player match state", () => {
  it("removes a red-carded player from the active XI without deleting their match record", () => {
    const state = matchState();
    removeSentOffPlayersFromSetup(state, "home");
    expect(state.home.startingXI).toEqual(["active"]);
    expect(state.playerStates.sent?.redCards).toBe(1);
    expect(state.playerStates.sent?.onPitch).toBe(false);
  });

  it("does not allow a sent-off player to be substituted as if still on the pitch", () => {
    const state = matchState();
    expect(applySubstitution(state, "home", "sent", "sub", "ST", 0)).toBe(false);
    expect(state.home.substitutesUsed).toBe(0);
    expect(state.home.bench).toContain("sub");
  });

  it("still permits a valid substitution for an active player", () => {
    const state = matchState();
    expect(applySubstitution(state, "home", "active", "sub", "ST", 0)).toBe(true);
    expect(state.home.startingXI).toEqual(["sent", "sub"]);
    expect(state.playerStates.active?.onPitch).toBe(false);
    expect(state.playerStates.sub?.onPitch).toBe(true);
  });
});
