// Sent-off handling at the match-setup boundary. The match engine already stops counting a
// carded player (onPitch=false) in strength; this makes the SETUP agree, so the sub board never lists
// a dismissed player as on the pitch and a sub is never wasted on one. Pure reads; no engine changes.
import type { MatchState } from "@/engines/match/matchTypes";
import type { TeamMatchSetup } from "@/engines/match/matchTypes";

export function sentOffIds(state: MatchState, clubId?: string): string[] {
  return Object.values(state.playerStates).filter((s) => !s.onPitch && (s.redCards > 0 || s.yellowCards >= 2) && (!clubId || s.clubId === clubId)).map((s) => s.playerId);
}

export function activeXI(state: MatchState, setup: TeamMatchSetup): string[] {
  const off = new Set(sentOffIds(state, setup.clubId));
  return setup.startingXI.filter((id) => !off.has(id));
}

export function canSubstituteOff(state: MatchState, setup: TeamMatchSetup, playerOffId: string): boolean {
  return activeXI(state, setup).includes(playerOffId);
}
