// ============================================================================
// Procedural generation — youth intakes and "regen" replacements for retired
// real-world players. Deterministic: given the same seed string, the same
// player is produced, so saves stay reproducible and diffable.
// ============================================================================
import type { Player, PositionCode, PlayerAttributes, PlayerPersonality, PersonalityTrait } from "@/domain/types";
import { nanoid } from "nanoid";

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const FIRST_NAMES_BY_NATION: Record<string, string[]> = {
  ENG: ["James", "Harry", "Jack", "Oliver", "Charlie", "George", "Thomas", "Daniel"],
  ESP: ["Alejandro", "Pablo", "Javier", "Diego", "Adrian", "Mario", "Sergio"],
  BRA: ["Gabriel", "Lucas", "Matheus", "Joao", "Pedro", "Rafael", "Vitor"],
  FRA: ["Lucas", "Hugo", "Nathan", "Enzo", "Mathis", "Leo", "Ethan"],
  NGA: ["Chidi", "Emeka", "Kelechi", "Uche", "Tunde", "Segun", "Ifeanyi"],
  DEFAULT: ["Alex", "Sam", "Chris", "Jordan", "Kai", "Leo", "Noah"],
};
const LAST_NAMES_BY_NATION: Record<string, string[]> = {
  ENG: ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Evans", "Walker"],
  ESP: ["Garcia", "Martinez", "Lopez", "Sanchez", "Perez", "Gomez"],
  BRA: ["Silva", "Santos", "Oliveira", "Souza", "Costa", "Pereira"],
  FRA: ["Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel"],
  NGA: ["Okafor", "Eze", "Adeyemi", "Balogun", "Nwosu", "Okoro"],
  DEFAULT: ["Anderson", "Clark", "Davis", "Lewis", "Young", "King"],
};

const POSITIONS_POOL: PositionCode[] = [
  "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST",
];

const TRAIT_POOL: PersonalityTrait[] = [
  "professional", "ambitious", "loyal", "temperamental", "influential",
  "media-friendly", "media-shy", "unsettled", "big-game-player", "resilient", "team-player",
];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function randRange(rand: () => number, min: number, max: number): number {
  return Math.round(min + rand() * (max - min));
}

export interface GeneratePlayerParams {
  seed: string;
  nationality: string;
  minAge?: number; maxAge?: number;
  targetCurrentAbility?: number; // used for youth intake tiers / regen replacement level
  potentialCeilingBias?: number; // 0-1, higher = more likely to roll a high ceiling
  asOfDate: string;
  isYouthProduct?: boolean;
}

export function generateProceduralPlayer(params: GeneratePlayerParams): Player {
  const rand = mulberry32(hashStringToInt(params.seed));
  const nation = params.nationality;
  const firstNames = FIRST_NAMES_BY_NATION[nation] ?? FIRST_NAMES_BY_NATION.DEFAULT!;
  const lastNames = LAST_NAMES_BY_NATION[nation] ?? LAST_NAMES_BY_NATION.DEFAULT!;

  const age = randRange(rand, params.minAge ?? 16, params.maxAge ?? 18);
  const dob = new Date(params.asOfDate);
  dob.setFullYear(dob.getFullYear() - age);

  const primaryPosition = pick(rand, POSITIONS_POOL);
  const baseCA = params.targetCurrentAbility ?? randRange(rand, 40, 90);
  const ceilingRoll = rand() * (params.potentialCeilingBias ?? 0.3) + rand() * 0.3;
  const potentialAbility = Math.min(200, Math.round(baseCA + ceilingRoll * 110));

  const attributes = generateAttributesForPosition(rand, primaryPosition, baseCA);
  const personality = generatePersonality(rand);

  const player: Player = {
    id: nanoid(12),
    firstName: pick(rand, firstNames),
    lastName: pick(rand, lastNames),
    nationality: nation,
    dateOfBirth: dob.toISOString().slice(0, 10),
    height_cm: randRange(rand, 168, 196),
    weight_kg: randRange(rand, 62, 88),
    foot: rand() < 0.75 ? "right" : rand() < 0.9 ? "left" : "both",
    positions: [primaryPosition],
    positionFamiliarity: { [primaryPosition]: 20 },
    attributes,
    personality,
    traits: [],
    currentAbility: baseCA,
    potentialAbility,
    form: 0,
    morale: 70,
    fatigue: 0,
    sharpness: 50,
    injuryStatus: null,
    suspension: null,
    clubId: null,
    nationalTeamId: null,
    contract: null,
    careerHistory: [],
    seasonStats: {
      appearances: 0, starts: 0, goals: 0, assists: 0, minutesPlayed: 0,
      yellowCards: 0, redCards: 0, averageRating: 0, cleanSheets: 0, motmAwards: 0,
    },
    isYouthProduct: params.isYouthProduct ?? true,
    isRegen: true,
    faceSeed: params.seed,
  };
  return player;
}

function generateAttributesForPosition(rand: () => number, position: PositionCode, baseCA: number): PlayerAttributes {
  const scale = baseCA / 100; // rough 0.4-1.8 multiplier applied to a 1-20 baseline
  const base = (min: number, max: number) => Math.max(1, Math.min(20, Math.round(randRange(rand, min, max) * scale)));

  const isGk = position === "GK";
  const isDefender = ["CB", "LB", "RB", "LWB", "RWB"].includes(position);
  const isAttacker = ["LW", "RW", "CF", "ST"].includes(position);

  return {
    technical: {
      passing: base(8, 14), dribbling: isAttacker ? base(10, 16) : base(6, 12),
      firstTouch: base(8, 14), finishing: isAttacker ? base(10, 16) : base(4, 10),
      crossing: base(6, 12), heading: isDefender ? base(10, 15) : base(6, 12),
      marking: isDefender ? base(10, 16) : base(4, 10),
      tackling: isDefender ? base(10, 16) : base(5, 11),
      longShots: base(6, 13), freeKicks: base(4, 12), penalties: base(6, 13),
      setPieceDelivery: base(5, 12),
    },
    mental: {
      vision: base(7, 14), composure: base(7, 14), decisions: base(7, 14),
      anticipation: base(7, 14), positioning: isDefender ? base(9, 15) : base(6, 12),
      concentration: base(7, 14), workRate: base(8, 15), teamwork: base(8, 15),
      leadership: base(5, 12), aggression: base(6, 14), bravery: base(7, 14),
      determination: base(8, 15),
    },
    physical: {
      pace: isAttacker ? base(10, 17) : base(7, 14), acceleration: isAttacker ? base(10, 17) : base(7, 14),
      stamina: base(9, 16), strength: isDefender ? base(10, 16) : base(7, 13),
      agility: base(8, 15), balance: base(8, 15), jumping: isDefender ? base(9, 15) : base(6, 12),
      naturalFitness: base(9, 16), injuryProneness: Math.max(1, Math.min(20, randRange(rand, 3, 12))),
    },
    goalkeeping: isGk
      ? {
          handling: base(9, 16), reflexes: base(9, 16), shotStopping: base(9, 16),
          aerialCommand: base(8, 15), distribution: base(7, 14), oneOnOnes: base(8, 15), sweeping: base(6, 13),
        }
      : {
          handling: 1, reflexes: 1, shotStopping: 1, aerialCommand: 1, distribution: 1, oneOnOnes: 1, sweeping: 1,
        },
  };
}

function generatePersonality(rand: () => number): PlayerPersonality {
  const traitCount = randRange(rand, 1, 3);
  const traits: PersonalityTrait[] = [];
  for (let i = 0; i < traitCount; i++) {
    const t = pick(rand, TRAIT_POOL);
    if (!traits.includes(t)) traits.push(t);
  }
  return {
    traits,
    professionalism: randRange(rand, 6, 18),
    ambition: randRange(rand, 6, 18),
    loyalty: randRange(rand, 4, 16),
    pressureResistance: randRange(rand, 5, 18),
    sociability: randRange(rand, 5, 18),
    controversyTendency: randRange(rand, 1, 12),
  };
}
