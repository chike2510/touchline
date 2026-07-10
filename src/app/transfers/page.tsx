"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { estimateMarketValue, submitTransferOffer, evaluateOfferAsSellingClub, evaluateOfferAsPlayer, completeTransfer } from "@/engines/transfers/transferEngine";

function formatMoney(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

export default function TransfersPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [query, setQuery] = useState("");
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  const listings = useMemo(() => {
    if (!world) return [];
    return Object.values(world.players)
      .filter((p) => p.clubId && p.clubId !== world.userClubId)
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 30);
  }, [world, query]);

  if (!world) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  function makeOffer(playerId: string) {
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

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Transfers &amp; Scouting</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players…"
        className="rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-ink-100 outline-none"
      />
      <div className="flex flex-col gap-2">
        {listings.map((player) => {
          const club = world.clubs[player.clubId!];
          const value = estimateMarketValue(player, world.currentDate);
          return (
            <Card key={player.id}>
              <CardHeader
                title={`${player.firstName} ${player.lastName}`}
                subtitle={`${club?.name ?? "Free agent"} • ${player.positions[0]}`}
                right={<Badge tone="amber">{formatMoney(value)}</Badge>}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-500">{statusById[player.id] ?? ""}</p>
                <button
                  onClick={() => makeOffer(player.id)}
                  className="rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-95"
                >
                  Make offer
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
