// ============================================================================
// Facilities engine — facility levels are 1-20 scales that gate/modify other
// engines (training speed, youth intake quality, medical recovery, scouting
// accuracy, matchday atmosphere ceiling). This module owns upgrade proposals
// and the slow board-approval + construction-time flow.
// ============================================================================
import type { SaveGameWorld, ClubFacilities, InboxItem } from "@/domain/types";
import { nanoid } from "nanoid";

export interface FacilityUpgrade {
  id: string;
  clubId: string;
  facility: keyof ClubFacilities;
  targetLevel: number;
  cost: number;
  daysRemaining: number;
}

// In-memory queue keyed by club — persisted alongside the world blob would
// require adding a field to SaveGameWorld; left as a documented extension
// point (add `facilityUpgrades: Record<ID, FacilityUpgrade[]>` to
// SaveGameWorld in domain/types.ts when wiring this up for real).
const upgradeCostPerLevel = 250_000;

export function proposeFacilityUpgrade(
  world: SaveGameWorld,
  clubId: string,
  facility: keyof ClubFacilities
): FacilityUpgrade | null {
  const club = world.clubs[clubId];
  if (!club) return null;
  const currentLevel = club.facilities[facility];
  if (currentLevel >= 20) return null;
  const targetLevel = currentLevel + 1;
  const cost = upgradeCostPerLevel * targetLevel;
  if (cost > club.finance.balance) return null;
  return {
    id: nanoid(8),
    clubId,
    facility,
    targetLevel,
    cost,
    daysRemaining: 60,
  };
}

export function completeFacilityUpgrade(world: SaveGameWorld, upgrade: FacilityUpgrade): void {
  const club = world.clubs[upgrade.clubId];
  if (!club) return;
  club.finance.balance -= upgrade.cost;
  club.facilities[upgrade.facility] = upgrade.targetLevel;

  const item: InboxItem = {
    id: nanoid(10),
    category: "board",
    subject: `${facilityLabel(upgrade.facility)} upgrade complete`,
    body: `${club.name}'s ${facilityLabel(upgrade.facility).toLowerCase()} now rated ${upgrade.targetLevel}/20.`,
    date: world.currentDate,
    read: false,
    archived: false,
    priority: "low",
    actions: [{ id: "ack", label: "Acknowledge", kind: "acknowledge" }],
  };
  world.inboxItems[item.id] = item;
}

function facilityLabel(key: keyof ClubFacilities): string {
  const labels: Record<keyof ClubFacilities, string> = {
    trainingFacilities: "Training facilities",
    youthFacilities: "Youth facilities",
    medicalFacilities: "Medical facilities",
    dataAnalysis: "Data analysis suite",
    youthRecruitment: "Youth recruitment network",
    stadiumFacilities: "Stadium facilities",
  };
  return labels[key];
}

// Placeholder daily tick — real implementation should walk the (future)
// facilityUpgrades queue and decrement daysRemaining, calling
// completeFacilityUpgrade() at zero. Left as a no-op until that field
// exists on SaveGameWorld so this file compiles standalone today.
export function tickFacilitiesDay(_world: SaveGameWorld): void {
  // Intentionally empty — see module doc comment above.
}
