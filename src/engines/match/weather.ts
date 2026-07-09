// ============================================================================
// Weather modifiers — small multipliers applied per tick. Kept as pure data
// + one lookup function so balancing is a one-file change.
// ============================================================================
import type { WeatherCondition } from "@/domain/types";

export interface WeatherModifiers {
  passingAccuracy: number; // multiplier
  shotAccuracy: number;
  staminaDrainRate: number;
  longBallEffectiveness: number; // wind especially affects this
  injuryRiskMultiplier: number;
}

const TABLE: Record<WeatherCondition, WeatherModifiers> = {
  clear:       { passingAccuracy: 1.00, shotAccuracy: 1.00, staminaDrainRate: 1.00, longBallEffectiveness: 1.00, injuryRiskMultiplier: 1.00 },
  overcast:    { passingAccuracy: 1.00, shotAccuracy: 1.00, staminaDrainRate: 1.00, longBallEffectiveness: 1.00, injuryRiskMultiplier: 1.00 },
  rain:        { passingAccuracy: 0.93, shotAccuracy: 0.92, staminaDrainRate: 1.05, longBallEffectiveness: 0.95, injuryRiskMultiplier: 1.10 },
  "heavy-rain":{ passingAccuracy: 0.85, shotAccuracy: 0.82, staminaDrainRate: 1.10, longBallEffectiveness: 0.88, injuryRiskMultiplier: 1.20 },
  snow:        { passingAccuracy: 0.88, shotAccuracy: 0.85, staminaDrainRate: 1.08, longBallEffectiveness: 0.90, injuryRiskMultiplier: 1.15 },
  windy:       { passingAccuracy: 0.95, shotAccuracy: 0.90, staminaDrainRate: 1.02, longBallEffectiveness: 0.75, injuryRiskMultiplier: 1.00 },
  hot:         { passingAccuracy: 0.98, shotAccuracy: 0.98, staminaDrainRate: 1.20, longBallEffectiveness: 1.00, injuryRiskMultiplier: 1.05 },
  cold:        { passingAccuracy: 0.97, shotAccuracy: 0.96, staminaDrainRate: 1.03, longBallEffectiveness: 1.00, injuryRiskMultiplier: 1.10 },
};

export function getWeatherModifiers(weather: WeatherCondition): WeatherModifiers {
  return TABLE[weather];
}
