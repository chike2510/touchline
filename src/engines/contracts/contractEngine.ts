// User contract decisions for expiring/expired deals. Domain-level only (no UI): the inbox action
// handler or any future screen calls these. Pure world mutations, deterministic, idempotent.
import type { InboxItem, SaveGameWorld } from "@/domain/types";

export interface RenewalOffer { years: number; wageWeekly: number; }
export type ContractResult = { ok: true; compensation?: number } | { ok: false; reason: string };

const DAY = 86400000;
export const addYearsIso = (iso: string, years: number) => new Date(Date.parse(iso) + Math.round(years * 365) * DAY).toISOString().slice(0, 10);

function ageOf(dob: string, date: string): number { return Math.floor((Date.parse(date) - Date.parse(dob)) / (365.25 * DAY)); }

export function expiredContractPlayerIds(world: SaveGameWorld, clubId: string): string[] {
  const club = world.clubs[clubId]; if (!club) return [];
  return club.squadIds.filter((id) => { const c = world.players[id]?.contract; return !!c && c.expiryDate <= world.currentDate; });
}

// What the player would ask for. Rises with ability, falls with age 31+, never below current wage x 0.9.
export function suggestedRenewal(world: SaveGameWorld, playerId: string): RenewalOffer | null {
  const p = world.players[playerId]; if (!p?.contract) return null;
  const age = ageOf(p.dateOfBirth, world.currentDate);
  const years = age >= 33 ? 1 : age >= 30 ? 2 : age <= 22 ? 4 : 3;
  const ability = Math.max(1, p.currentAbility);
  const ask = Math.max(p.contract.wageWeekly * 0.9, p.contract.wageWeekly * (0.95 + (ability - 100) / 400));
  return { years, wageWeekly: Math.round(ask / 100) * 100 };
}

// Wage budget headroom: weekly wages of players + staff compared with the club's wage budget. The raise
// being offered counts against it; releases free it up.
export function wageHeadroom(world: SaveGameWorld, clubId: string): number {
  const club = world.clubs[clubId]; if (!club) return 0;
  const players = club.squadIds.reduce((s, id) => s + (world.players[id]?.contract?.wageWeekly ?? 0), 0);
  const staff = club.staffIds.reduce((s, id) => s + (world.staff[id]?.contract?.wageWeekly ?? 0), 0);
  return club.finance.wageBudgetWeekly - players - staff;
}

export function renewPlayerContract(world: SaveGameWorld, playerId: string, offer: RenewalOffer): ContractResult {
  const club = world.clubs[world.userClubId]; const p = world.players[playerId];
  if (!club || !p || !p.contract || !club.squadIds.includes(playerId)) return { ok: false, reason: "not-in-squad" };
  if (!(offer.years >= 1 && offer.years <= 5) || !(offer.wageWeekly > 0)) return { ok: false, reason: "invalid-offer" };
  const ask = suggestedRenewal(world, playerId)!;
  if (offer.wageWeekly < ask.wageWeekly * 0.9) return { ok: false, reason: "player-rejected" };
  const raise = offer.wageWeekly - p.contract.wageWeekly;
  if (raise > 0 && raise > wageHeadroom(world, club.id)) return { ok: false, reason: "wage-budget-exceeded" };
  const start = p.contract.expiryDate > world.currentDate ? p.contract.expiryDate : world.currentDate;
  p.contract = { ...p.contract, wageWeekly: Math.round(offer.wageWeekly), startDate: start, expiryDate: addYearsIso(start, offer.years) };
  resolveContractInbox(world, playerId);
  return { ok: true };
}

// Release a player: no payout beyond the current week. Contract cleared, club removed, kept in the
// world as a free agent so history, stats and any later signing still work.
export function releasePlayer(world: SaveGameWorld, playerId: string): ContractResult {
  const club = world.clubs[world.userClubId]; const p = world.players[playerId];
  if (!club || !p || !club.squadIds.includes(playerId)) return { ok: false, reason: "not-in-squad" };
  // Unexpired deals cost half the wages still owed; expired ones cost nothing.
  let compensation = 0;
  if (p.contract && p.contract.expiryDate > world.currentDate) {
    const weeks = Math.ceil((Date.parse(p.contract.expiryDate) - Date.parse(world.currentDate)) / (7 * DAY));
    compensation = Math.round(weeks * p.contract.wageWeekly * 0.5);
    club.finance.balance -= compensation;
  }
  club.squadIds = club.squadIds.filter((id) => id !== playerId);
  p.clubId = null; p.contract = null;
  if (world.shortlistedPlayerIds) world.shortlistedPlayerIds = world.shortlistedPlayerIds.filter((id) => id !== playerId);
  resolveContractInbox(world, playerId);
  return { ok: true, compensation };
}

// Players still listed as expired after the user ignored the inbox: auto-release when the grace period passes.
export function releaseUnresolvedExpiries(world: SaveGameWorld, graceDays = 30): string[] {
  const out: string[] = [];
  for (const id of expiredContractPlayerIds(world, world.userClubId)) {
    const c = world.players[id]!.contract!;
    if (Date.parse(world.currentDate) - Date.parse(c.expiryDate) >= graceDays * DAY && releasePlayer(world, id).ok) out.push(id);
  }
  return out;
}

export function contractInboxItem(world: SaveGameWorld, playerId: string): InboxItem | null {
  const p = world.players[playerId]; const offer = suggestedRenewal(world, playerId); if (!p || !offer) return null;
  return {
    id: `contract-${playerId}`, category: "contract", subject: `${p.firstName} ${p.lastName}: contract expired`,
    body: `${p.firstName} ${p.lastName} is out of contract. Renew for ${offer.years} year(s) at ${offer.wageWeekly.toLocaleString()} per week, or release.`,
    date: world.currentDate, read: false, archived: false, priority: "high", linkedEntityId: playerId,
    actions: [
      { id: "renew", label: "Renew", kind: "decision", target: "contract", payload: { contractAction: "renew", playerId, years: offer.years, wageWeekly: offer.wageWeekly } },
      { id: "release", label: "Release", kind: "decision", target: "contract", payload: { contractAction: "release", playerId } },
    ],
  };
}

function resolveContractInbox(world: SaveGameWorld, playerId: string): void {
  const it = world.inboxItems[`contract-${playerId}`]; if (it) { it.archived = true; it.read = true; }
}

// Entry point for the inbox action handler.
export function applyContractDecision(world: SaveGameWorld, payload: Record<string, unknown> | undefined): ContractResult | null {
  if (!payload || typeof payload.contractAction !== "string" || typeof payload.playerId !== "string") return null;
  if (payload.contractAction === "release") return releasePlayer(world, payload.playerId);
  if (payload.contractAction === "renew") return renewPlayerContract(world, payload.playerId, { years: Number(payload.years), wageWeekly: Number(payload.wageWeekly) });
  return null;
}

export const contractFailureText: Record<string, string> = {
  "player-rejected": "The player rejected the offer: it is below his asking wage.",
  "wage-budget-exceeded": "The wage budget cannot cover that raise.",
  "invalid-offer": "Offer must be 1 to 5 years at a positive wage.",
  "not-in-squad": "Player is no longer in your squad.",
};
