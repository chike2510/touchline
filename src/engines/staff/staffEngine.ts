// ============================================================================
// Staff engine — applies daily training effects using coaching staff quality,
// and manages staff hiring/attribute-driven bonuses consumed by other engines
// (youth development speed, injury recovery speed via medical staff, etc.)
// ============================================================================
import type { SaveGameWorld, Player, Staff } from "@/domain/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function coachingQualityForClub(world: SaveGameWorld, clubId: string): number {
  const club = world.clubs[clubId];
  if (!club) return 10;
  const coaches = club.staffIds
    .map((id) => world.staff[id])
    .filter((s): s is Staff => !!s && (s.role === "first-team-coach" || s.role === "assistant-manager"));
  if (coaches.length === 0) return 10;
  const avg = coaches.reduce((sum, c) => sum + c.attributes.coaching, 0) / coaches.length;
  return avg;
}

// Small daily nudge toward potentialAbility, scaled by professionalism,
// coaching quality, training facility level, age (younger = faster growth,
// older = plateua/decline), fatigue (overworked players train worse) and
// sharpness. This intentionally moves attributes in *composite* ability
// space (currentAbility) rather than editing every individual attribute
// per-attribute drift can be layered on top for more granular UI feedback
// feedback once the base loop is validated.
export function applyTrainingDay(world: SaveGameWorld): void {
  for (const club of Object.values(world.clubs)) {
    const coaching = coachingQualityForClub(world, club.id);
    const facilityBonus = club.facilities.trainingFacilities / 20; // 0..1

    for (const playerId of [...club.squadIds, ...club.youthSquadIds]) {
      const player = world.players[playerId];
      if (!player || player.injuryStatus) continue;

      const age = ageFromDob(player.dateOfBirth, world.currentDate);
      const ageFactor = age < 21 ? 1.3 : age < 26 ? 1.0 : age < 30 ? 0.6 : age < 34 ? 0.25 : 0.05;
      const fatiguePenalty = clamp(1 - player.fatigue / 150, 0.3, 1);
      const professionalismFactor = player.personality.professionalism / 20;

      const growthPotentialGap = player.potentialAbility - player.currentAbility;
      if (growthPotentialGap > 0) {
        const dailyGrowth =
          growthPotentialGap *
          0.0015 *
          (coaching / 20) *
          (0.5 + facilityBonus) *
          ageFactor *
          fatiguePenalty *
          professionalismFactor;
        player.currentAbility = clamp(player.currentAbility + dailyGrowth, 1, player.potentialAbility);
      } else if (ageFactor < 0.3) {
        // Past-peak decline for veterans, softened by professionalism.
        const decline = 0.01 * (1 - professionalismFactor) * (0.3 - ageFactor);
        player.currentAbility = clamp(player.currentAbility - decline, 1, 200);
      }

      // Training itself is mildly taxing; recovery is handled by
      // engines/finance? No — recovery/fatigue decay is applied in the
      // calendar's off-pitch/rest handling once implemented per-day-type
      // (match day vs. light day vs. double session). Baseline nudge here:
      player.fatigue = clamp(player.fatigue + 3 - facilityBonus * 2, 0, 100);
      player.sharpness = clamp(player.sharpness + 1, 0, 100);
    }
  }
}

function ageFromDob(dob: string, asOf: string): number {
  const birth = new Date(dob);
  const ref = new Date(asOf);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

// Medical staff quality reduces injury.daysRemaining faster than baseline.
export function applyMedicalRecovery(world: SaveGameWorld): void {
  for (const club of Object.values(world.clubs)) {
    const physios = club.staffIds
      .map((id) => world.staff[id])
      .filter((s): s is Staff => !!s && s.role === "head-physio");
    const physioQuality = physios.length
      ? physios.reduce((s, p) => s + p.attributes.physiotherapy, 0) / physios.length
      : 10;
    const medicalFacilityBonus = club.facilities.medicalFacilities / 20;
    const recoveryRate = 1 + (physioQuality / 20) * 0.5 + medicalFacilityBonus * 0.5;

    for (const playerId of club.squadIds) {
      const player: Player | undefined = world.players[playerId];
      if (!player?.injuryStatus) continue;
      player.injuryStatus.daysRemaining = Math.max(0, player.injuryStatus.daysRemaining - recoveryRate);
      if (player.injuryStatus.daysRemaining <= 0) player.injuryStatus = null;
    }
  }
}
