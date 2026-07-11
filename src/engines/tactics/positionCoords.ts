// ============================================================================
// x/y coordinates (0-100 scale, attacking toward y=100) for each slot in a
// formation, in the same order as FORMATION_SLOTS in aiTactics.ts. Shared by
// the Tactics page (static formation board) and the Matchday pitch
// visualization (live player dots), so both render the same shape.
// ============================================================================
export interface PitchCoord { x: number; y: number }

export const FORMATION_COORDS: Record<string, PitchCoord[]> = {
  "4-3-3": [
    { x: 50, y: 5 },   // GK
    { x: 15, y: 22 },  // LB
    { x: 38, y: 18 },  // CB
    { x: 62, y: 18 },  // CB
    { x: 85, y: 22 },  // RB
    { x: 35, y: 45 },  // CM
    { x: 50, y: 38 },  // CDM
    { x: 65, y: 45 },  // CM
    { x: 15, y: 75 },  // LW
    { x: 50, y: 85 },  // ST
    { x: 85, y: 75 },  // RW
  ],
  "4-4-2": [
    { x: 50, y: 5 },
    { x: 15, y: 22 },
    { x: 38, y: 18 },
    { x: 62, y: 18 },
    { x: 85, y: 22 },
    { x: 15, y: 50 },
    { x: 38, y: 48 },
    { x: 62, y: 48 },
    { x: 85, y: 50 },
    { x: 40, y: 82 },
    { x: 60, y: 82 },
  ],
  "4-2-3-1": [
    { x: 50, y: 5 },
    { x: 15, y: 22 },
    { x: 38, y: 18 },
    { x: 62, y: 18 },
    { x: 85, y: 22 },
    { x: 38, y: 40 },
    { x: 62, y: 40 },
    { x: 50, y: 60 },
    { x: 18, y: 75 },
    { x: 82, y: 75 },
    { x: 50, y: 88 },
  ],
  "3-5-2": [
    { x: 50, y: 5 },
    { x: 30, y: 18 },
    { x: 50, y: 15 },
    { x: 70, y: 18 },
    { x: 10, y: 45 },
    { x: 35, y: 48 },
    { x: 50, y: 42 },
    { x: 65, y: 48 },
    { x: 90, y: 45 },
    { x: 40, y: 82 },
    { x: 60, y: 82 },
  ],
  "4-1-4-1": [
    { x: 50, y: 5 },
    { x: 15, y: 22 },
    { x: 38, y: 18 },
    { x: 62, y: 18 },
    { x: 85, y: 22 },
    { x: 50, y: 38 },
    { x: 15, y: 55 },
    { x: 38, y: 52 },
    { x: 62, y: 52 },
    { x: 85, y: 55 },
    { x: 50, y: 85 },
  ],
  "3-4-3": [
    { x: 50, y: 5 },   // GK
    { x: 30, y: 18 },  // CB
    { x: 50, y: 15 },  // CB
    { x: 70, y: 18 },  // CB
    { x: 12, y: 50 },  // LM
    { x: 38, y: 46 },  // CM
    { x: 62, y: 46 },  // CM
    { x: 88, y: 50 },  // RM
    { x: 18, y: 82 },  // LW
    { x: 50, y: 88 },  // ST
    { x: 82, y: 82 },  // RW
  ],
  "5-3-2": [
    { x: 50, y: 5 },   // GK
    { x: 8, y: 42 },   // LWB
    { x: 32, y: 18 },  // CB
    { x: 50, y: 15 },  // CB
    { x: 68, y: 18 },  // CB
    { x: 92, y: 42 },  // RWB
    { x: 32, y: 50 },  // CM
    { x: 50, y: 45 },  // CM
    { x: 68, y: 50 },  // CM
    { x: 40, y: 84 },  // ST
    { x: 60, y: 84 },  // ST
  ],
  "4-4-1-1": [
    { x: 50, y: 5 },   // GK
    { x: 15, y: 22 },  // LB
    { x: 38, y: 18 },  // CB
    { x: 62, y: 18 },  // CB
    { x: 85, y: 22 },  // RB
    { x: 15, y: 50 },  // LM
    { x: 38, y: 48 },  // CM
    { x: 62, y: 48 },  // CM
    { x: 85, y: 50 },  // RM
    { x: 50, y: 70 },  // CF (deep-lying forward)
    { x: 50, y: 88 },  // ST
  ],
  "4-3-2-1": [
    { x: 50, y: 5 },   // GK
    { x: 15, y: 22 },  // LB
    { x: 38, y: 18 },  // CB
    { x: 62, y: 18 },  // CB
    { x: 85, y: 22 },  // RB
    { x: 35, y: 45 },  // CM
    { x: 50, y: 38 },  // CDM
    { x: 65, y: 45 },  // CM
    { x: 35, y: 68 },  // CAM
    { x: 65, y: 68 },  // CAM
    { x: 50, y: 88 },  // ST
  ],
};

export function coordsForFormation(formation: string): PitchCoord[] {
  return FORMATION_COORDS[formation] ?? FORMATION_COORDS["4-3-3"]!;
}
