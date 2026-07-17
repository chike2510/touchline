// ============================================================================
// Authentic football role catalog. Every role can only be assigned to a
// player occupying certain broad pitch slots, and only supports certain
// duties — this is what "Support authentic football roles" means in
// practice, rather than a free-text label nobody reads.
// ============================================================================
import type { PositionCode, RoleCode, RoleDuty } from "@/domain/types";

export interface RoleDefinition {
  code: RoleCode;
  label: string;
  shortLabel: string; // for pitch tokens, e.g. "DLP"
  slots: PositionCode[]; // which formation slots this role can occupy
  duties: RoleDuty[]; // valid duties for this role
  description: string;
}

export const ROLE_CATALOG: Record<RoleCode, RoleDefinition> = {
  GK: { code: "GK", label: "Goalkeeper", shortLabel: "GK", slots: ["GK"], duties: ["defend"], description: "Sticks to the line, focuses purely on shot-stopping." },
  SK: { code: "SK", label: "Sweeper Keeper", shortLabel: "SK", slots: ["GK"], duties: ["defend", "support", "attack"], description: "Rushes off the line to act as an auxiliary defender and starts attacks with distribution." },

  CB: { code: "CB", label: "Centre-Back", shortLabel: "CB", slots: ["CB"], duties: ["defend", "support"], description: "Straightforward defensive centre-back, holds the line." },
  NCB: { code: "NCB", label: "No-Nonsense Centre-Back", shortLabel: "NCB", slots: ["CB"], duties: ["defend"], description: "Clears the danger first, no risks on the ball." },
  BPD: { code: "BPD", label: "Ball-Playing Defender", shortLabel: "BPD", slots: ["CB"], duties: ["defend", "support"], description: "Steps into midfield and plays out from the back." },

  FB: { code: "FB", label: "Full-Back", shortLabel: "FB", slots: ["LB", "RB"], duties: ["defend", "support", "attack"], description: "Balanced full-back, tracks back and supports going forward." },
  WB: { code: "WB", label: "Wing-Back", shortLabel: "WB", slots: ["LB", "RB", "LWB", "RWB"], duties: ["support", "attack"], description: "Bombs up and down the flank, provides the width." },
  IWB: { code: "IWB", label: "Inverted Wing-Back", shortLabel: "IWB", slots: ["LB", "RB", "LWB", "RWB"], duties: ["defend", "support"], description: "Tucks infield to form an auxiliary midfielder in possession." },
  CWB: { code: "CWB", label: "Complete Wing-Back", shortLabel: "CWB", slots: ["LWB", "RWB"], duties: ["support", "attack"], description: "Elite two-way wing-back, dangerous in both boxes." },

  HB: { code: "HB", label: "Half-Back", shortLabel: "HB", slots: ["CDM"], duties: ["defend"], description: "Drops between the centre-backs in possession to form a back three." },
  DM: { code: "DM", label: "Defensive Midfielder", shortLabel: "DM", slots: ["CDM"], duties: ["defend", "support"], description: "Screens the back line, breaks up play." },
  DLP: { code: "DLP", label: "Deep-Lying Playmaker", shortLabel: "DLP", slots: ["CDM", "CM"], duties: ["defend", "support"], description: "Dictates tempo from deep with range of passing." },
  RPM: { code: "RPM", label: "Roaming Playmaker", shortLabel: "RPM", slots: ["CM"], duties: ["support"], description: "Drifts across the pitch to find pockets of space on the ball." },

  CM: { code: "CM", label: "Central Midfielder", shortLabel: "CM", slots: ["CM"], duties: ["defend", "support", "attack"], description: "Box-to-box, balances defensive duty with support play." },
  BWM: { code: "BWM", label: "Ball-Winning Midfielder", shortLabel: "BWM", slots: ["CDM", "CM"], duties: ["defend", "support"], description: "Aggressively presses to win the ball back." },
  MEZ: { code: "MEZ", label: "Mezzala", shortLabel: "MEZ", slots: ["CM"], duties: ["support", "attack"], description: "Drives into the half-spaces from central midfield." },
  CAR: { code: "CAR", label: "Carrilero", shortLabel: "CAR", slots: ["CM"], duties: ["support"], description: "Shuttles the width of midfield, links defence to attack." },

  AP: { code: "AP", label: "Advanced Playmaker", shortLabel: "AP", slots: ["CAM"], duties: ["support", "attack"], description: "Creates chances just behind the striker." },
  AM: { code: "AM", label: "Attacking Midfielder", shortLabel: "AM", slots: ["CAM"], duties: ["support", "attack"], description: "Roams between the lines looking to create and finish." },
  SS: { code: "SS", label: "Shadow Striker", shortLabel: "SS", slots: ["CAM"], duties: ["attack"], description: "Makes late runs from midfield to arrive in the box." },

  IF: { code: "IF", label: "Inside Forward", shortLabel: "IF", slots: ["LW", "RW", "LM", "RM"], duties: ["support", "attack"], description: "Cuts inside off the flank onto their stronger foot." },
  IW: { code: "IW", label: "Inverted Winger", shortLabel: "IW", slots: ["LW", "RW", "LM", "RM"], duties: ["support", "attack"], description: "Drifts inside to combine centrally rather than cross." },
  W: { code: "W", label: "Winger", shortLabel: "W", slots: ["LW", "RW", "LM", "RM"], duties: ["support", "attack"], description: "Hugs the touchline and looks to beat the full-back and cross." },

  AF: { code: "AF", label: "Advanced Forward", shortLabel: "AF", slots: ["ST", "CF"], duties: ["attack"], description: "Runs the channels and in behind, pure goal threat." },
  DLF: { code: "DLF", label: "Deep-Lying Forward", shortLabel: "DLF", slots: ["ST", "CF"], duties: ["support", "attack"], description: "Drops deep to link play and bring others into the game." },
  PF: { code: "PF", label: "Pressing Forward", shortLabel: "PF", slots: ["ST", "CF"], duties: ["defend", "support", "attack"], description: "Leads the press from the front, harries centre-backs." },
  TM: { code: "TM", label: "Target Man", shortLabel: "TM", slots: ["ST", "CF"], duties: ["support", "attack"], description: "Holds the ball up, wins aerial duels, brings others into play." },
  CF: { code: "CF", label: "Complete Forward", shortLabel: "CF", slots: ["ST", "CF"], duties: ["support", "attack"], description: "All-round forward — holds up, creates, and finishes." },
};

export function rolesForSlot(slot: PositionCode): RoleDefinition[] {
  return Object.values(ROLE_CATALOG).filter((r) => r.slots.includes(slot));
}

export function defaultRoleForSlot(slot: PositionCode): RoleCode {
  const candidates = rolesForSlot(slot);
  return candidates[0]?.code ?? "CM";
}

export function defaultDutyForRole(roleCode: RoleCode): RoleDuty {
  const role = ROLE_CATALOG[roleCode];
  if (role.duties.includes("support")) return "support";
  return role.duties[0] ?? "support";
}
