// ============================================================================
// Transfer engine — player valuation, offer lifecycle, and the negotiation
// state machine. Scouting accuracy is handled in scouting.ts (kept separate
// since it's conceptually "information gathering" vs. this file's
// "negotiation and dealmaking").
// ============================================================================
import type { SaveGameWorld, Player, TransferOffer, TransferListing } from "@/domain/types";
import { nanoid } from "nanoid";
import { canAffordTransferFee, canAffordWage } from "@/engines/finance/financeEngine";

// Baseline market value from current ability, age curve, contract length
// remaining, and current form — deliberately simple (a real market-value
// model would also weight league reputation, international caps, and
// position scarcity; those are natural coefficients to add here later).
export function estimateMarketValue(player: Player, asOfDate: string): number {
  const age = ageFromDob(player.dateOfBirth, asOfDate);
  const ageMultiplier =
    age < 21 ? 1.3 : age < 24 ? 1.5 : age < 28 ? 1.2 : age < 31 ? 0.85 : age < 34 ? 0.5 : 0.2;

  const abilityValue = Math.pow(player.currentAbility / 20, 2.1) * 250_000;
  const formMultiplier = 1 + player.form * 0.03;

  const contractYearsLeft = player.contract
    ? Math.max(0, (new Date(player.contract.expiryDate).getTime() - new Date(asOfDate).getTime()) / (365 * 86400000))
    : 0;
  const contractMultiplier = contractYearsLeft <= 0.5 ? 0.4 : contractYearsLeft < 1.5 ? 0.7 : 1;

  return Math.round(abilityValue * ageMultiplier * formMultiplier * contractMultiplier);
}

function ageFromDob(dob: string, asOf: string): number {
  const birth = new Date(dob);
  const ref = new Date(asOf);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

export function listPlayerForTransfer(
  world: SaveGameWorld,
  playerId: string,
  reason: TransferListing["reason"],
  askingPrice: number | null
): TransferListing {
  const player = world.players[playerId];
  if (!player || !player.clubId) throw new Error(`Player ${playerId} not found or has no club`);
  const listing: TransferListing = {
    playerId,
    clubId: player.clubId,
    askingPrice,
    listedDate: world.currentDate,
    loanAvailable: reason === "surplus",
    reason,
  };
  world.transferListings[playerId] = listing;
  return listing;
}

export function submitTransferOffer(
  world: SaveGameWorld,
  params: {
    playerId: string; fromClubId: string; toClubId: string;
    type: TransferOffer["type"]; fee: number; wageOffer: number; contractLengthYears: number;
  }
): TransferOffer {
  const offer: TransferOffer = {
    id: nanoid(10),
    playerId: params.playerId,
    fromClubId: params.fromClubId,
    toClubId: params.toClubId,
    type: params.type,
    fee: params.fee,
    addOns: [],
    wageOffer: params.wageOffer,
    contractLengthYears: params.contractLengthYears,
    status: "pending",
    submittedDate: world.currentDate,
  };
  world.transferOffers[offer.id] = offer;
  return offer;
}

// AI-side club response to an incoming offer. Real depth would weight squad
// need, listing status, rivalry (won't sell to a hated rival below a
// premium), and manager transferAggression; this baseline covers the core
// "is the fee good enough relative to valuation and listing status" check.
export function evaluateOfferAsSellingClub(world: SaveGameWorld, offer: TransferOffer): "accepted" | "rejected" {
  const player = world.players[offer.playerId];
  if (!player) return "rejected";
  const value = estimateMarketValue(player, world.currentDate);
  const listing = world.transferListings[offer.playerId];
  const acceptThreshold = listing ? value * 0.85 : value * 1.15;
  return offer.fee >= acceptThreshold ? "accepted" : "rejected";
}

// Player-side response once a fee is agreed: wage vs. current, squad status
// promise, ambition/loyalty personality traits, and club reputation delta.
export function evaluateOfferAsPlayer(world: SaveGameWorld, offer: TransferOffer): "accepts" | "wants-more" | "refuses" {
  const player = world.players[offer.playerId];
  if (!player) return "refuses";
  const currentWage = player.contract?.wageWeekly ?? 0;
  const wageDelta = currentWage > 0 ? (offer.wageOffer - currentWage) / currentWage : 1;
  const destinationClub = world.clubs[offer.toClubId];
  const originClub = world.clubs[offer.fromClubId];
  const reputationDelta = (destinationClub?.reputation ?? 0) - (originClub?.reputation ?? 0);

  const ambitionScore = player.personality.ambition / 20;
  const score = wageDelta * 0.5 + reputationDelta / 100 * ambitionScore;

  if (score > 0.15) return "accepts";
  if (score > -0.1) return "wants-more";
  return "refuses";
}

export function completeTransfer(world: SaveGameWorld, offer: TransferOffer): void {
  const player = world.players[offer.playerId];
  if (!player) return;
  const buyer = world.clubs[offer.toClubId];
  const seller = world.clubs[offer.fromClubId];
  if (!buyer || !seller) return;
  if (!canAffordTransferFee(world, buyer.id, offer.fee)) return;
  if (!canAffordWage(world, buyer.id, offer.wageOffer)) return;

  buyer.finance.balance -= offer.fee;
  buyer.finance.transferBudget = Math.max(0, buyer.finance.transferBudget - offer.fee);
  seller.finance.balance += offer.fee;

  seller.squadIds = seller.squadIds.filter((id) => id !== player.id);
  buyer.squadIds.push(player.id);
  player.clubId = buyer.id;
  player.careerHistory.push({
    clubId: seller.id, clubName: seller.name,
    from: player.contract?.startDate ?? world.currentDate, to: world.currentDate,
    appearances: player.seasonStats.appearances, goals: player.seasonStats.goals,
  });
  player.contract = {
    playerId: player.id, clubId: buyer.id,
    wageWeekly: offer.wageOffer,
    startDate: world.currentDate,
    expiryDate: addYears(world.currentDate, offer.contractLengthYears),
  };
  delete world.transferListings[player.id];
  offer.status = "completed";
}

function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}
