"use client";
import { useEffect, useRef, useState } from "react";
import { MatchSimClient } from "@/workers/simDispatch";
import type { MatchState } from "@/engines/match/matchTypes";
import type { ID, Player, PositionCode, TacticSetup } from "@/domain/types";
import { useGameStore } from "@/state/gameStore";
import { computeSquadChemistry } from "@/engines/personality/personalityEngine";
import type { MatchContext, TeamMatchSetup } from "@/engines/match/matchTypes";

// Owns a MatchSimClient for the lifetime of a live match screen. The caller
// provides the initial team setups; this hook exposes the running state plus
// controls for substitutions, tactic changes, and advancing the clock —
// which is how "live tactical changes and substitutions during matches" are
// wired end-to-end from the UI down to the worker.
export function useLiveMatch(params: {
  home: TeamMatchSetup; away: TeamMatchSetup; context: MatchContext; seed: number;
} | null) {
  const world = useGameStore((s) => s.world);
  const clientRef = useRef<MatchSimClient | null>(null);
  const [state, setState] = useState<MatchState | null>(null);

  useEffect(() => {
    if (!params || !world) return;
    const client = new MatchSimClient();
    clientRef.current = client;
    const unsubscribe = client.onUpdate(setState);

    const chemistry: Record<ID, number> = {
      [params.home.clubId]: computeSquadChemistry(world, params.home.clubId),
      [params.away.clubId]: computeSquadChemistry(world, params.away.clubId),
    };
    const familiarity: Record<ID, number> = {
      [params.home.clubId]: params.home.tactic.familiarity,
      [params.away.clubId]: params.away.tactic.familiarity,
    };
    client.init({ ...params, players: world.players, chemistry, familiarity });

    return () => {
      unsubscribe();
      client.terminate();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.home.clubId, params?.away.clubId, params?.seed]);

  const playToMinute = (minute: number) => clientRef.current?.simulateToMinute(minute);
  const substitute = (clubId: ID, off: ID, on: ID, position: PositionCode) =>
    clientRef.current?.applySubstitution(clubId, off, on, position);
  const changeTactic = (clubId: ID, tactic: TacticSetup) => clientRef.current?.applyTacticChange(clubId, tactic);

  return { state, playToMinute, substitute, changeTactic };
}

export function usePlayer(playerId: ID | null | undefined): Player | null {
  const world = useGameStore((s) => s.world);
  if (!playerId || !world) return null;
  return world.players[playerId] ?? null;
}
