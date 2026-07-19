"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { PlayerPhoto } from "@/components/ui/PlayerPhoto";
import {
  estimateMarketValue, submitTransferOffer, evaluateOfferAsSellingClub, evaluateOfferAsPlayer, completeTransfer,
} from "@/engines/transfers/transferEngine";
import { formatMoney, formatMoneyPerWeek } from "@/lib/format";
import type { TransferOffer } from "@/domain/types";

function squadStatusLabel(currentAbility: number, squadAvg: number): string {
  if (currentAbility >= squadAvg + 15) return "Star Player";
  if (currentAbility >= squadAvg + 5) return "Important Player";
  if (currentAbility >= squadAvg - 10) return "Squad Player";
  return "Fringe Player";
}

export default function MakeOfferPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const router = useRouter();
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);

  const [tab, setTab] = useState<"Offer Details" | "Player Info" | "Reports" | "Comparison">("Offer Details");
  const [offerType, setOfferType] = useState<"permanent" | "loan">("permanent");
  const [fee, setFee] = useState<number | null>(null);
  const [afterAppearances, setAfterAppearances] = useState(0);
  const [afterCaps, setAfterCaps] = useState(0);
  const [sellOnPct, setSellOnPct] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const player = world?.players[playerId];
  const playerClub = player?.clubId ? world?.clubs[player.clubId] : undefined;
  const userClub = world?.clubs[world.userClubId];

  const value = player && world ? estimateMarketValue(player, world.currentDate) : 0;
  const currentFee = fee ?? Math.round(value);
  const listing = world && player ? world.transferListings[player.id] : undefined;
  const askingPrice = listing?.askingPrice ?? Math.round(value * 1.1);

  const interestedClubsCount = useMemo(() => {
    if (!world || !player) return 0;
    return new Set(
      Object.values(world.transferOffers)
        .filter((o) => o.playerId === player.id && o.status === "pending")
        .map((o) => o.fromClubId)
    ).size;
  }, [world, player]);

  const recentOffers = useMemo(() => {
    if (!world || !player) return [];
    return Object.values(world.transferOffers)
      .filter((o) => o.playerId === player.id)
      .sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1))
      .slice(0, 5);
  }, [world, player]);

  const squadAvgAbility = useMemo(() => {
    if (!world || !playerClub) return 0;
    const squad = playerClub.squadIds.map((id) => world.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
    return squad.length ? squad.reduce((a, p) => a + p.currentAbility, 0) / squad.length : 0;
  }, [world, playerClub]);

  if (!world || !player || !userClub) return <p className="px-4 py-6 text-sm text-ink-500">Player not found.</p>;

  const totalOfferValue = currentFee + afterAppearances + afterCaps;
  const acceptThreshold = listing ? value * 0.85 : value * 1.15;
  const prediction =
    totalOfferValue >= acceptThreshold ? { label: "Good Offer", tone: "text-positive-500" } :
    totalOfferValue >= acceptThreshold * 0.85 ? { label: "Below Expectations", tone: "text-warning-500" } :
    { label: "Unlikely To Be Accepted", tone: "text-danger-500" };

  function submitOffer() {
    mutateWorld((w) => {
      const p = w.players[playerId];
      if (!p || !p.clubId) return;
      const addOns: TransferOffer["addOns"] = [];
      if (afterAppearances > 0) addOns.push({ condition: "After league appearances", amount: afterAppearances });
      if (afterCaps > 0) addOns.push({ condition: "After international caps", amount: afterCaps });
      if (sellOnPct > 0) addOns.push({ condition: `Sell-on ${sellOnPct}%`, amount: 0 });

      const offer = submitTransferOffer(w, {
        playerId, fromClubId: p.clubId, toClubId: w.userClubId,
        type: offerType === "loan" ? "loan" : "permanent",
        fee: currentFee, wageOffer: Math.round((p.contract?.wageWeekly ?? 5000) * 1.15),
        contractLengthYears: 3, addOns,
      });
      const clubDecision = evaluateOfferAsSellingClub(w, offer);
      if (clubDecision === "rejected") { offer.status = "rejected"; setStatus("Rejected by selling club."); return; }
      const playerDecision = evaluateOfferAsPlayer(w, offer);
      if (playerDecision !== "accepts") {
        offer.status = playerDecision === "wants-more" ? "player-considering" : "rejected";
        setStatus(playerDecision === "wants-more" ? "Player wants better personal terms." : "Player refuses the move.");
        return;
      }
      completeTransfer(w, offer);
      setStatus("Deal completed! Player has joined your club.");
    });
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push("/transfers")} className="rounded-full p-1.5 text-ink-400 hover:bg-navy-800">
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-xl text-ink-100">Make an Offer</h1>
      </div>

      <div className="glass-panel flex items-center gap-3 rounded-card p-3">
        <PlayerPhoto firstName={player.firstName} lastName={player.lastName} leagueId={playerClub?.leagueId ?? ""} clubId={playerClub?.id ?? ""} size={56} />
        <div className="flex-1">
          <p className="font-display text-lg text-ink-100">{player.firstName} {player.lastName}</p>
          <p className="text-xs text-ink-500">{player.positions.join(", ")} · {player.nationality} · {playerClub?.name ?? "Free agent"}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-500">Current Value</p>
          <p className="font-data font-semibold text-positive-500">{formatMoney(value)}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-navy-700">
        {(["Offer Details", "Player Info", "Reports", "Comparison"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-accent-500 font-medium text-ink-100" : "text-ink-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Offer Details" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-3">
            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Offer Type</p>
              <div className="flex gap-2">
                {(["permanent", "loan"] as const).map((t) => (
                  <button key={t} onClick={() => setOfferType(t)}
                    className={`rounded-card px-3 py-1.5 text-sm capitalize ${offerType === t ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}>
                    {t === "permanent" ? "Transfer Offer" : "Loan Offer"}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Offer Fee</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setFee(Math.max(0, currentFee - 500_000))} className="rounded-card bg-navy-800 px-3 py-1.5 text-ink-300">−</button>
                <span className="flex-1 rounded-card border border-navy-600 bg-navy-900 px-3 py-1.5 text-center font-data text-lg text-ink-100">{formatMoney(currentFee)}</span>
                <button onClick={() => setFee(currentFee + 500_000)} className="rounded-card bg-navy-800 px-3 py-1.5 text-ink-300">+</button>
              </div>
              <p className="mt-1 text-xs text-ink-500">Suggested: {formatMoney(value * 0.9)} – {formatMoney(value * 1.2)}</p>
            </div>

            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Additional Fees</p>
              <div className="flex flex-col gap-2">
                <StepperRow label="Add-on After League Appearances" value={afterAppearances} step={500_000} onChange={setAfterAppearances} />
                <StepperRow label="Add-on After International Caps" value={afterCaps} step={500_000} onChange={setAfterCaps} />
                <StepperRow label="Sell-on Percentage" value={sellOnPct} step={5} suffix="%" max={50} onChange={setSellOnPct} />
              </div>
            </div>

            {status && (
              <div className="rounded-card border border-navy-600 bg-navy-900 p-3 text-sm text-ink-200">{status}</div>
            )}

            <div className="flex gap-2">
              <button onClick={() => router.push("/transfers")} className="flex-1 rounded-card border border-navy-600 py-2.5 text-sm text-ink-300">Cancel</button>
              <button onClick={submitOffer} className="flex-1 rounded-card bg-gradient-to-r from-accent-500 to-accent-600 py-2.5 text-sm font-semibold text-white">Submit Offer</button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Current Situation</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <Row label="Asking Price" value={formatMoney(askingPrice)} />
                <Row label="Interested Clubs" value={String(interestedClubsCount)} />
                <Row label="Contracted Until" value={player.contract?.expiryDate.slice(0, 10) ?? "Free agent"} />
                <Row label="Squad Status" value={squadStatusLabel(player.currentAbility, squadAvgAbility)} />
                <Row label="Wage" value={player.contract ? formatMoneyPerWeek(player.contract.wageWeekly) : "—"} />
              </div>
            </div>

            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Club Finances Impact</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <Row label="Transfer Budget Cost" value={formatMoney(currentFee)} />
                <Row label="Wage Budget Impact" value={player.contract ? `+${formatMoneyPerWeek(Math.round(player.contract.wageWeekly * 1.15) - player.contract.wageWeekly)}` : "—"} />
                <Row label="Future Fee Cost" value={formatMoney(totalOfferValue)} />
              </div>
            </div>

            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Board Response Prediction</p>
              <p className={`font-display text-lg font-bold ${prediction.tone}`}>{prediction.label}</p>
              <p className="text-xs text-ink-500">Based on estimated value vs. total offer.</p>
            </div>

            <div className="glass-panel rounded-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Recent Offers</p>
              {recentOffers.length === 0 && <p className="text-xs text-ink-500">No previous offers for this player.</p>}
              <div className="flex flex-col gap-1.5">
                {recentOffers.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-xs">
                    <span className="text-ink-300">{world.clubs[o.fromClubId]?.shortName ?? "?"}</span>
                    <span className="font-data text-ink-100">{formatMoney(o.fee)}</span>
                    <span className={o.status === "completed" ? "text-positive-500" : o.status === "rejected" ? "text-danger-500" : "text-warning-500"}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Player Info" && (
        <div className="glass-panel rounded-card p-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Row label="Age" value={String(Math.floor((Date.now() - new Date(player.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)))} />
            <Row label="Height" value={`${player.height_cm} cm`} />
            <Row label="Foot" value={player.foot} />
            <Row label="Nationality" value={player.nationality} />
          </div>
        </div>
      )}

      {tab === "Reports" && (
        <div className="glass-panel rounded-card p-4">
          {Object.values(world.scoutingReports).filter((r) => r.playerId === player.id).length === 0 ? (
            <p className="text-sm text-ink-500">No scouting reports for this player yet.</p>
          ) : (
            Object.values(world.scoutingReports).filter((r) => r.playerId === player.id).map((r) => (
              <div key={r.id} className="border-b border-navy-700 py-2 text-sm last:border-0">
                <p className="text-ink-200">{r.notes}</p>
                <p className="text-xs text-ink-500">Confidence {r.confidence}% · {r.recommendation.replace("-", " ")}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Comparison" && (
        <div className="glass-panel rounded-card p-4">
          <p className="text-sm text-ink-500">Select players from your squad on the Squad page to compare attributes side by side — a dedicated comparison tool isn&apos;t built yet.</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-data font-semibold text-ink-100">{value}</span>
    </div>
  );
}

function StepperRow({
  label, value, step, onChange, suffix = "", max,
}: { label: string; value: number; step: number; onChange: (v: number) => void; suffix?: string; max?: number }) {
  const display = suffix === "%" ? `${value}%` : formatMoney(value);
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(0, value - step))} className="rounded-card bg-navy-800 px-2 py-0.5 text-xs text-ink-300">−</button>
        <span className="w-20 text-center font-data text-xs text-ink-100">{display}</span>
        <button onClick={() => onChange(max ? Math.min(max, value + step) : value + step)} className="rounded-card bg-navy-800 px-2 py-0.5 text-xs text-ink-300">+</button>
      </div>
    </div>
  );
}
