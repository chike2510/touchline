// ============================================================================
// Finance engine — daily/weekly cash flow. Kept deliberately simple (linear
// weekly wage burn, periodic income events) so it's easy to reason about and
// extend with amortised transfer fees, installment payments, FFP-style rules,
// etc. without redesigning the data model.
// ============================================================================
import type { SaveGameWorld, InboxItem } from "@/domain/types";
import { nanoid } from "nanoid";

const DAY_OF_WEEK_PAYDAY = 1; // Monday

function dayOfWeek(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}

export function tickFinanceDay(world: SaveGameWorld): void {
  for (const club of Object.values(world.clubs)) {
    // Sponsorship income trickles in daily (weekly total / 7) for smoother
    // balance curves rather than one big weekly spike.
    const dailySponsorship = club.finance.sponsorships.reduce((sum, s) => sum + s.incomeWeekly / 7, 0);
    club.finance.balance += dailySponsorship;

    if (dayOfWeek(world.currentDate) === DAY_OF_WEEK_PAYDAY) {
      const totalWages = club.squadIds.reduce((sum, id) => {
        const p = world.players[id];
        return sum + (p?.contract?.wageWeekly ?? 0);
      }, 0);
      const staffWages = club.staffIds.reduce((sum, id) => sum + (world.staff[id]?.contract?.wageWeekly ?? 0), 0);
      const managerWage = club.managerId ? world.managers[club.managerId]?.contract?.wageWeekly ?? 0 : 0;

      const totalOutgoing = totalWages + staffWages + managerWage;
      club.finance.balance -= totalOutgoing;
      club.finance.wageBudgetUsedWeekly = totalWages + staffWages;

      if (club.finance.balance < 0 && club.id === world.userClubId) {
        const item: InboxItem = {
          id: nanoid(10),
          category: "finance",
          subject: "Club finances in the red",
          body: `The board has flagged a negative balance of ${Math.round(club.finance.balance).toLocaleString()} after this week's wage run.`,
          date: world.currentDate,
          read: false,
          archived: false,
          priority: "high",
          actions: [
            { id: "goto-club", label: "Review finances", kind: "navigate", target: "/club" },
            { id: "ack", label: "Acknowledge", kind: "acknowledge" },
          ],
        };
        world.inboxItems[item.id] = item;
      }

      // Expiring sponsorships fall off the books automatically; renewal
      // negotiation is an off-pitch decision surfaced to inbox 30 days out.
      club.finance.sponsorships = club.finance.sponsorships.filter((s) => s.expiryDate > world.currentDate);
    }
  }
}

export function canAffordWage(world: SaveGameWorld, clubId: string, additionalWeeklyWage: number): boolean {
  const club = world.clubs[clubId];
  if (!club) return false;
  return club.finance.wageBudgetUsedWeekly + additionalWeeklyWage <= club.finance.wageBudgetWeekly;
}

export function canAffordTransferFee(world: SaveGameWorld, clubId: string, fee: number): boolean {
  const club = world.clubs[clubId];
  if (!club) return false;
  return fee <= club.finance.transferBudget && fee <= club.finance.balance + (club.finance.ownerInvestmentCap ?? 0);
}
