"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import {
  estimateMarketValue, submitTransferOffer, evaluateOfferAsSellingClub, evaluateOfferAsPlayer, completeTransfer,
} from "@/engines/transfers/transferEngine";
import type { ID, PositionCode } from "@/domain/types";

function formatMoney(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

const POSITION_GROUPS: Record<string, PositionCode[]> = {
  GK: ["GK"],
  DEF: ["CB", "LB", "RB", "LWB", "RWB"],
  MID: ["CDM", "CM", "CAM", "LM", "RM"],
  FWD: ["LW", "RW", "CF", "ST"],
};

// One player at a time with Prev/Next + a position filter, instead of a long
// scrollable list — fits a fixed landscape viewport.
export default function TransfersPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | keyof typeof POSITION_GROUPS>("ALL");
  const [index, setIndex] = useState(0);
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  const club = world?.clubs[world.userClubId];

  function matchesFilter(positions: PositionCode[]): boolean {
    if (posFilter === "ALL") return true;
    return positions.some((p) => POSITION_GROUPS[posFilter]!.includes(p));
  }

  const listings = useMemo(() => {
    if (!world) return [];
    return Object.values(world.players)
      .filter((p) => p.clubId && p.clubId !== world.userClubId)
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()))
      .filter((p) => matchesFilter(p.positions))
      .sort((a, b) => b.currentAbility - a.currentAbility)
      .slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, query, posFilter]);

  const mySquad = useMemo(() => {
    if (!world || !club) return [];
    return club.squadIds
      .map((id) => world.players[id])
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()))
      .filter((p) => matchesFilter(p.positions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, club, query, posFilter]);

  const list = tab === "buy" ? listings : mySquad;

  useEffect(() => { setIndex(0); }, [tab, query, posFilter]);
  useEffect(() => {
    if (index >= list.length && list.length > 0) setIndex(list.length - 1);
  }, [list.length, index]);

  if (!world || !club) return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;

  const player = list[index];

  function makeOffer(playerId: ID) {
    mutateWorld((w) => {
      const p = w.players[playerId];
      if (!p || !p.clubId) return;
      const value = estimateMarketValue(p, w.currentDate);
      const offer = submitTransferOffer(w, {
        playerId, fromClubId: p.clubId, toClubId: w.userClubId,
        type: "permanent", fee: Math.round(value * 1.05),
        wageOffer: Math.round((p.contract?.wageWeekly ?? 5000) * 1.15),
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

  function sellPlayer(playerId: ID) {
    mutateWorld((w) => {
      const p = w.players[playerId];
      if (!p || !p.clubId) return;
      const value = estimateMarketValue(p, w.currentDate);
      const fee = Math.round(value * 0.92);
      const wageOffer = Math.round((p.contract?.wageWeekly ?? 5000) * 1.05);

      const candidates = Object.values(w.clubs)
        .filter((c) => c.id !== w.userClubId)
        .filter((c) => c.finance.transferBudget >= fee)
        .filter((c) => c.finance.wageBudgetWeekly - c.finance.wageBudgetUsedWeekly >= wageOffer)
        .sort((a, b) => b.reputation - a.reputation);

      if (candidates.length === 0) {
        setStatusById((s) => ({ ...s, [playerId]: "No club could afford the asking price right now." }));
        return;
      }
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
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3 py-3 md:h-[calc(100dvh-5rem)]">
      <h1 className="shrink-0 font-display text-2xl text-ink-100">Transfers &amp; Scouting</h1>

      <div className="flex shrink-0 rounded-card border border-navy-600 bg-navy-900 p-1">
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

      <div className="flex shrink-0 gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="flex-1 rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-ink-100 outline-none"
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value as typeof posFilter)}
          className="rounded-card border border-navy-600 bg-navy-900 px-2 py-2 text-sm text-ink-100"
        >
          <option value="ALL">All positions</option>
          <option value="GK">Goalkeepers</option>
          <option value="DEF">Defenders</option>
          <option value="MID">Midfielders</option>
          <option value="FWD">Forwards</option>
        </select>
      </div>

      {tab === "buy" && (
        <p className="shrink-0 text-xs text-ink-500">
          Transfer budget: <span className="font-data font-semibold text-ink-100">{formatMoney(club.finance.transferBudget)}</span>
        </p>
      )}

      {list.length === 0 && <p className="text-sm text-ink-500">No players match your search.</p>}

      {player && (
        <div className="flex min-h-0 flex-1 items-center gap-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex w-10 shrink-0 items-center justify-center self-stretch rounded-card bg-navy-800 text-ink-300 disabled:opacity-30"
            aria-label="Previous player"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="min-w-0 flex-1">
            {tab === "buy" ? (
              <BuyCard
                player={player}
                world={world}
                status={statusById[player.id]}
                onOffer={() => makeOffer(player.id)}
              />
            ) : (
              <SellCard
                player={player}
                club={club}
                world={world}
                status={statusById[player.id]}
                onSell={() => sellPlayer(player.id)}
              />
            )}
          </div>

          <button
            onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
            disabled={index >= list.length - 1}
            className="flex w-10 shrink-0 items-center justify-center self-stretch rounded-card bg-navy-800 text-ink-300 disabled:opacity-30"
            aria-label="Next player"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {list.length > 0 && (
        <p className="shrink-0 text-center font-data text-xs text-ink-500">{index + 1} of {list.length}</p>
      )}
    </div>
  );
}

function BuyCard({
  player, world, status, onOffer,
}: { player: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["players"][string]; world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>; status?: string; onOffer: () => void }) {
  const playerClub = player.clubId ? world.clubs[player.clubId] : undefined;
  const value = estimateMarketValue(player, world.currentDate);
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <PlayerPhoto firstName={player.firstName} lastName={player.lastName} leagueId={playerClub?.leagueId ?? ""} clubId={playerClub?.id ?? ""} size={32} />
            {player.firstName} {player.lastName}
          </span>
        }
        subtitle={`${playerClub?.name ?? "Free agent"} • ${player.positions[0]} • ${player.nationality}`}
        right={<Badge tone="amber">{formatMoney(value)}</Badge>}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">{status ?? ""}</p>
        <button
          onClick={onOffer}
          className="rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-navy-950 transition-transform duration-150 active:scale-95"
        >
          Make offer
        </button>
      </div>
    </Card>
  );
}

function SellCard({
  player, club, world, status, onSell,
}: {
  player: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["players"][string];
  club: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["clubs"][string];
  world: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>; status?: string; onSell: () => void;
}) {
  const value = estimateMarketValue(player, world.currentDate);
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <PlayerPhoto firstName={player.firstName} lastName={player.lastName} leagueId={club.leagueId} clubId={club.id} size={32} />
            {player.firstName} {player.lastName}
          </span>
        }
        subtitle={`${player.positions[0]} • ${player.nationality}`}
        right={<Badge tone="amber">{formatMoney(value)}</Badge>}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">{status ?? ""}</p>
        <button
          onClick={onSell}
          className="rounded-card bg-danger-500 px-3 py-1.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-95"
        >
          Sell
        </button>
      </div>
    </Card>
  );
}
