"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import {
  estimateMarketValue, submitTransferOffer, evaluateOfferAsSellingClub, evaluateOfferAsPlayer, completeTransfer,
} from "@/engines/transfers/transferEngine";
import type { ID } from "@/domain/types";

function formatMoney(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

export default function TransfersPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  const club = world?.clubs[world.userClubId];

  const listings = useMemo(() => {
    if (!world) return [];
    return Object.values(world.players)
      .filter((p) => p.clubId && p.clubId !== world.userClubId)
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 30);
  }, [world, query]);

  const mySquad = useMemo(() => {
    if (!world || !club) return [];
    return club.squadIds
      .map((id) => world.players[id])
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()));
  }, [world, club, query]);

  if (!world || !club) return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;

  function makeOffer(playerId: ID) {
    mutateWorld((w) => {
      const player = w.players[playerId];
      if (!player || !player.clubId) return;
      const value = estimateMarketValue(player, w.currentDate);
      const offer = submitTransferOffer(w, {
        playerId, fromClubId: player.clubId, toClubId: w.userClubId,
        type: "permanent", fee: Math.round(value * 1.05),
        wageOffer: Math.round((player.contract?.wageWeekly ?? 5000) * 1.15),
        contractLengthYears: 3,
      });
      const clubDecision = evaluateOfferAsSellingClub(w, offer);
      if (clubDecision === "rejected") {
        offer.status = "rejected";
        setStatusById((s) => ({ ...s, [playerId]: "Rejected by selling club" }));
        return;
      }
      const playerDecision = evaluateOfferAsPlayer(w, offer);
      if (playerDecision !== "accepts") {
        offer.status = playerDecision === "wants-more" ? "player-considering" : "rejected";
        setStatusById((s) => ({ ...s, [playerId]: playerDecision === "wants-more" ? "Player wants better terms" : "Player refuses the move" }));
        return;
      }
      completeTransfer(w, offer);
      setStatusById((s) => ({ ...s, [playerId]: "Deal completed!" }));
    });
  }

  // Selling: the user's own club is the seller, so there's no "does the
  // selling club accept" check (that's you) — instead we look for an AI
  // club that can actually afford the fee and wage, weighted toward bigger
  // clubs for better players, and complete the deal directly.
  function sellPlayer(playerId: ID) {
    mutateWorld((w) => {
      const player = w.players[playerId];
      if (!player || !player.clubId) return;
      const value = estimateMarketValue(player, w.currentDate);
      const fee = Math.round(value * 0.92);
      const wageOffer = Math.round((player.contract?.wageWeekly ?? 5000) * 1.05);

      const candidates = Object.values(w.clubs)
        .filter((c) => c.id !== w.userClubId)
        .filter((c) => c.finance.transferBudget >= fee)
        .filter((c) => c.finance.wageBudgetWeekly - c.finance.wageBudgetUsedWeekly >= wageOffer)
        .sort((a, b) => b.reputation - a.reputation);

      if (candidates.length === 0) {
        setStatusById((s) => ({ ...s, [playerId]: "No club could afford the asking price right now." }));
        return;
      }
      // Weight toward the top few affording clubs rather than always the
      // single richest, so it doesn't always end up at the exact same club.
      const pool = candidates.slice(0, Math.min(5, candidates.length));
      const buyer = pool[Math.floor(Math.random() * pool.length)]!;

      const offer = submitTransferOffer(w, {
        playerId, fromClubId: w.userClubId, toClubId: buyer.id,
        type: "permanent", fee, wageOffer, contractLengthYears: 3,
      });
      completeTransfer(w, offer);
      setStatusById((s) => ({ ...s, [playerId]: `Sold to ${buyer.name} for ${formatMoney(fee)}!` }));
    });
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Transfers &amp; Scouting</h1>

      <div className="flex rounded-card border border-navy-600 bg-navy-900 p-1">
        <button
          onClick={() => setTab("buy")}
          className={`flex-1 rounded-card px-3 py-1.5 text-sm transition-colors duration-150 ${tab === "buy" ? "bg-accent-500 font-semibold text-navy-950" : "text-ink-500"}`}
        >
          Buy
        </button>
        <button
          onClick={() => setTab("sell")}
          className={`flex-1 rounded-card px-3 py-1.5 text-sm transition-colors duration-150 ${tab === "sell" ? "bg-accent-500 font-semibold text-navy-950" : "text-ink-500"}`}
        >
          Sell
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players…"
        className="rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-ink-100 outline-none"
      />

      {tab === "buy" && (
        <div className="flex flex-col gap-2">
          <Card>
            <p className="text-sm text-ink-300">
              Transfer budget: <span className="font-data font-semibold text-ink-100">{formatMoney(club.finance.transferBudget)}</span>
            </p>
          </Card>
          {listings.map((player) => {
            const playerClub = world.clubs[player.clubId!];
            const value = estimateMarketValue(player, world.currentDate);
            return (
              <Card key={player.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <PlayerPhoto playerId={player.id} size={26} />
                      {player.firstName} {player.lastName}
                    </span>
                  }
                  subtitle={`${playerClub?.name ?? "Free agent"} • ${player.positions[0]}`}
                  right={<Badge tone="amber">{formatMoney(value)}</Badge>}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-500">{statusById[player.id] ?? ""}</p>
                  <button
                    onClick={() => makeOffer(player.id)}
                    className="rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-navy-950 transition-transform duration-150 active:scale-95"
                  >
                    Make offer
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "sell" && (
        <div className="flex flex-col gap-2">
          <Card>
            <p className="text-sm text-ink-300">Tap "Sell" to find a buying club and complete the deal at an estimated market fee.</p>
          </Card>
          {mySquad.map((player) => {
            const value = estimateMarketValue(player, world.currentDate);
            return (
              <Card key={player.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <PlayerPhoto playerId={player.id} size={26} />
                      {player.firstName} {player.lastName}
                    </span>
                  }
                  subtitle={player.positions[0]}
                  right={<Badge tone="amber">{formatMoney(value)}</Badge>}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-500">{statusById[player.id] ?? ""}</p>
                  <button
                    onClick={() => sellPlayer(player.id)}
                    className="rounded-card bg-danger-500 px-3 py-1.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-95"
                  >
                    Sell
                  </button>
                </div>
              </Card>
            );
          })}
          {mySquad.length === 0 && <p className="text-sm text-ink-500">No players match your search.</p>}
        </div>
      )}
    </div>
  );
}
