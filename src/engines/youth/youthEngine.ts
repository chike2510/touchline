// ============================================================================
// Youth engine — orchestrates the annual intake event per club, sizing and
// quality gated by youthFacilities/youthRecruitment, and promotes/releases
// youth players based on age and development trajectory.
// ============================================================================
import type { SaveGameWorld, InboxItem } from "@/domain/types";
import { generateProceduralPlayer } from "./generator";
import { nanoid } from "nanoid";

export function runYouthIntake(world: SaveGameWorld, clubId: string): void {
  const club = world.clubs[clubId];
  if (!club) return;

  const intakeSize = 1 + Math.round(club.facilities.youthFacilities / 5); // 1-5 players
  const qualityBias = club.facilities.youthRecruitment / 20;

  const newPlayerIds: string[] = [];
  for (let i = 0; i < intakeSize; i++) {
    const player = generateProceduralPlayer({
      seed: `${world.seed}::youth::${clubId}::${world.currentDate}::${i}`,
      nationality: club.countryCode,
      minAge: 15,
      maxAge: 16,
      targetCurrentAbility: 25 + qualityBias * 20,
      potentialCeilingBias: qualityBias,
      asOfDate: world.currentDate,
      isYouthProduct: true,
    });
    player.clubId = clubId;
    world.players[player.id] = player;
    club.youthSquadIds.push(player.id);
    newPlayerIds.push(player.id);
  }

  if (clubId === world.userClubId) {
    const item: InboxItem = {
      id: nanoid(10),
      category: "youth",
      subject: `Youth intake — ${newPlayerIds.length} new prospects`,
      body: `The academy has produced ${newPlayerIds.length} new players this year. Head of Youth Development recommends a look at your U18 squad.`,
      date: world.currentDate,
      read: false,
      archived: false,
      priority: "normal",
      actions: [{ id: "goto-squad", label: "View youth squad", kind: "navigate", target: "/squad?tab=youth" }],
    };
    world.inboxItems[item.id] = item;
  }
}

// Promotes a youth player to the senior squad list (does not change
// attributes — promotion is an administrative/registration action; the
// player already trains alongside seniors via applyTrainingDay, which reads
// both squadIds and youthSquadIds).
export function promoteYouthPlayer(world: SaveGameWorld, clubId: string, playerId: string): void {
  const club = world.clubs[clubId];
  if (!club) return;
  club.youthSquadIds = club.youthSquadIds.filter((id) => id !== playerId);
  if (!club.squadIds.includes(playerId)) club.squadIds.push(playerId);
  const player = world.players[playerId];
  if (player) player.isYouthProduct = true;
}

export function releaseYouthPlayer(world: SaveGameWorld, clubId: string, playerId: string): void {
  const club = world.clubs[clubId];
  if (!club) return;
  club.youthSquadIds = club.youthSquadIds.filter((id) => id !== playerId);
  const player = world.players[playerId];
  if (player) player.clubId = null;
}
