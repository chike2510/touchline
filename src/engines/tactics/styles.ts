// ============================================================================
// Tactical style templates — the assistant-recommended starting points shown
// in the "Create Tactic" flow. Picking one pre-fills mentality plus every
// discrete instruction bundle across In Possession / Out of Possession /
// Attack / Transition; the manager can then fine-tune each tab by hand.
// "Clean Slate" applies balanced defaults and lets the manager build from
// scratch.
// ============================================================================
import type {
  AttackInstructions, DefensiveInstructions, InPossessionInstructions,
  MentalityLevel, TacticalStyleId, TransitionInstructions,
} from "@/domain/types";

export interface TacticalStyleDefinition {
  id: TacticalStyleId;
  label: string;
  proactiveness: number; // -2 very reactive .. 2 very proactive, drives the spectrum UI
  description: string;
  bullets: string[];
  defaults: {
    mentality: MentalityLevel;
    inPossession: InPossessionInstructions;
    outOfPossession: DefensiveInstructions;
    attack: AttackInstructions;
    transition: TransitionInstructions;
  };
}

export const TACTICAL_STYLES: Record<TacticalStyleId, TacticalStyleDefinition> = {
  "tiki-taka": {
    id: "tiki-taka", label: "Tiki-Taka", proactiveness: 2,
    description: "Short, patient passing to suffocate the opponent and pick the lock through possession.",
    bullets: ["Retains the ball through short passing triangles", "Draws the opposition out before playing through them"],
    defaults: {
      mentality: "attacking",
      inPossession: { tempo: "normal", passingDirectness: "short", width: "narrow", playThroughBias: "centre", buildUpFromBack: true, creativeFreedom: "expressive" },
      outOfPossession: { defensiveWidth: "narrow", defensiveLine: "high", closingDown: "all-over", tackling: "normal", marking: "zonal", offsideTrap: true, timeWasting: false },
      attack: { finalThirdCrossing: "look-for-overlap", finalThirdShooting: "work-into-box", finalThirdRunning: "through-balls", passingFocus: "centre", goalkeeperDistribution: "short" },
      transition: { counterPressIntensity: "committed", counterAttackSpeed: "hold-shape", transitionDirectness: "short" },
    },
  },
  "vertical-tiki-taka": {
    id: "vertical-tiki-taka", label: "Vertical Tiki-Taka", proactiveness: 2,
    description: "Short passing but with urgency — moves the ball forward through the thirds quickly.",
    bullets: ["Quick, short passing with a forward bias", "Presses hard the instant possession is lost"],
    defaults: {
      mentality: "attacking",
      inPossession: { tempo: "fast", passingDirectness: "mixed", width: "balanced", playThroughBias: "centre", buildUpFromBack: true, creativeFreedom: "expressive" },
      outOfPossession: { defensiveWidth: "narrow", defensiveLine: "high", closingDown: "all-over", tackling: "committed", marking: "zonal", offsideTrap: true, timeWasting: false },
      attack: { finalThirdCrossing: "look-for-overlap", finalThirdShooting: "shoot-on-sight", finalThirdRunning: "through-balls", passingFocus: "centre", goalkeeperDistribution: "short" },
      transition: { counterPressIntensity: "committed", counterAttackSpeed: "counter", transitionDirectness: "mixed" },
    },
  },
  "control-possession": {
    id: "control-possession", label: "Control Possession", proactiveness: 1,
    description: "Values the ball above all else, content to probe patiently for an opening.",
    bullets: ["Keeps the ball for long spells", "Low risk in possession, rarely gives the ball away cheaply"],
    defaults: {
      mentality: "balanced",
      inPossession: { tempo: "normal", passingDirectness: "short", width: "balanced", playThroughBias: "balanced", buildUpFromBack: true, creativeFreedom: "balanced" },
      outOfPossession: { defensiveWidth: "balanced", defensiveLine: "balanced", closingDown: "own-half", tackling: "normal", marking: "zonal", offsideTrap: false, timeWasting: false },
      attack: { finalThirdCrossing: "look-for-overlap", finalThirdShooting: "work-into-box", finalThirdRunning: "run-at-defence", passingFocus: "mixed", goalkeeperDistribution: "short" },
      transition: { counterPressIntensity: "normal", counterAttackSpeed: "hold-shape", transitionDirectness: "mixed" },
    },
  },
  gegenpress: {
    id: "gegenpress", label: "Gegenpress", proactiveness: 2,
    description: "Hunts the ball back the instant it's lost, high and aggressive all over the pitch.",
    bullets: ["Counter-presses ferociously the moment possession is lost", "High defensive line to squeeze the game"],
    defaults: {
      mentality: "very-attacking",
      inPossession: { tempo: "fast", passingDirectness: "direct", width: "wide", playThroughBias: "balanced", buildUpFromBack: false, creativeFreedom: "expressive" },
      outOfPossession: { defensiveWidth: "narrow", defensiveLine: "high", closingDown: "all-over", tackling: "committed", marking: "man", offsideTrap: true, timeWasting: false },
      attack: { finalThirdCrossing: "early-crosses", finalThirdShooting: "shoot-on-sight", finalThirdRunning: "through-balls", passingFocus: "mixed", goalkeeperDistribution: "mixed" },
      transition: { counterPressIntensity: "committed", counterAttackSpeed: "fast-break", transitionDirectness: "direct" },
    },
  },
  "wing-play": {
    id: "wing-play", label: "Wing Play", proactiveness: 1,
    description: "Looks to get quality crosses into the box, overloading the wide areas.",
    bullets: ["Gets the ball out wide as early as possible", "Full-backs overlap to exploit the flanks"],
    defaults: {
      mentality: "attacking",
      inPossession: { tempo: "normal", passingDirectness: "mixed", width: "wide", playThroughBias: "balanced", buildUpFromBack: true, creativeFreedom: "balanced" },
      outOfPossession: { defensiveWidth: "wide", defensiveLine: "balanced", closingDown: "own-half", tackling: "normal", marking: "zonal", offsideTrap: false, timeWasting: false },
      attack: { finalThirdCrossing: "early-crosses", finalThirdShooting: "work-into-box", finalThirdRunning: "run-at-defence", passingFocus: "both-flanks", goalkeeperDistribution: "mixed" },
      transition: { counterPressIntensity: "normal", counterAttackSpeed: "counter", transitionDirectness: "mixed" },
    },
  },
  "clean-slate": {
    id: "clean-slate", label: "Clean Slate", proactiveness: 0,
    description: "No preset identity — every instruction starts balanced so you can build the tactic by hand.",
    bullets: ["Balanced defaults across every instruction", "Full manual control from the first tab"],
    defaults: {
      mentality: "balanced",
      inPossession: { tempo: "normal", passingDirectness: "mixed", width: "balanced", playThroughBias: "balanced", buildUpFromBack: true, creativeFreedom: "balanced" },
      outOfPossession: { defensiveWidth: "balanced", defensiveLine: "balanced", closingDown: "own-half", tackling: "normal", marking: "zonal", offsideTrap: false, timeWasting: false },
      attack: { finalThirdCrossing: "look-for-overlap", finalThirdShooting: "work-into-box", finalThirdRunning: "run-at-defence", passingFocus: "mixed", goalkeeperDistribution: "mixed" },
      transition: { counterPressIntensity: "normal", counterAttackSpeed: "counter", transitionDirectness: "mixed" },
    },
  },
  "route-one": {
    id: "route-one", label: "Route One", proactiveness: -1,
    description: "Bypasses midfield entirely — long balls forward to a target man.",
    bullets: ["Goalkeeper and defence go long at every chance", "Target man competes for every knockdown"],
    defaults: {
      mentality: "defensive",
      inPossession: { tempo: "fast", passingDirectness: "long", width: "balanced", playThroughBias: "centre", buildUpFromBack: false, creativeFreedom: "disciplined" },
      outOfPossession: { defensiveWidth: "balanced", defensiveLine: "deep", closingDown: "sit-back", tackling: "normal", marking: "zonal", offsideTrap: false, timeWasting: false },
      attack: { finalThirdCrossing: "early-crosses", finalThirdShooting: "shoot-on-sight", finalThirdRunning: "run-at-defence", passingFocus: "centre", goalkeeperDistribution: "long" },
      transition: { counterPressIntensity: "cautious", counterAttackSpeed: "fast-break", transitionDirectness: "direct" },
    },
  },
  "fluid-counter-attack": {
    id: "fluid-counter-attack", label: "Fluid Counter-Attack", proactiveness: -1,
    description: "Sits off the ball then breaks with pace and support once it's won.",
    bullets: ["Soaks up pressure before springing forward", "Multiple runners join the break"],
    defaults: {
      mentality: "balanced",
      inPossession: { tempo: "fast", passingDirectness: "direct", width: "balanced", playThroughBias: "balanced", buildUpFromBack: false, creativeFreedom: "balanced" },
      outOfPossession: { defensiveWidth: "balanced", defensiveLine: "balanced", closingDown: "own-half", tackling: "normal", marking: "zonal", offsideTrap: false, timeWasting: false },
      attack: { finalThirdCrossing: "look-for-overlap", finalThirdShooting: "shoot-on-sight", finalThirdRunning: "through-balls", passingFocus: "mixed", goalkeeperDistribution: "mixed" },
      transition: { counterPressIntensity: "normal", counterAttackSpeed: "fast-break", transitionDirectness: "direct" },
    },
  },
  "direct-counter-attack": {
    id: "direct-counter-attack", label: "Direct Counter-Attack", proactiveness: -2,
    description: "Minimal risk on the ball, breaks as directly and quickly as possible.",
    bullets: ["Fewest passes possible once the ball is won", "Speed over control on the break"],
    defaults: {
      mentality: "defensive",
      inPossession: { tempo: "fast", passingDirectness: "direct", width: "narrow", playThroughBias: "centre", buildUpFromBack: false, creativeFreedom: "disciplined" },
      outOfPossession: { defensiveWidth: "narrow", defensiveLine: "deep", closingDown: "sit-back", tackling: "normal", marking: "zonal", offsideTrap: false, timeWasting: false },
      attack: { finalThirdCrossing: "early-crosses", finalThirdShooting: "shoot-on-sight", finalThirdRunning: "through-balls", passingFocus: "centre", goalkeeperDistribution: "long" },
      transition: { counterPressIntensity: "cautious", counterAttackSpeed: "fast-break", transitionDirectness: "direct" },
    },
  },
  catenaccio: {
    id: "catenaccio", label: "Catenaccio", proactiveness: -2,
    description: "Ultra-disciplined defensive shape built to shut games down.",
    bullets: ["Sits deep and compact, protects the box above all", "Breaks only with numbers behind the ball"],
    defaults: {
      mentality: "very-defensive",
      inPossession: { tempo: "slow", passingDirectness: "mixed", width: "narrow", playThroughBias: "balanced", buildUpFromBack: false, creativeFreedom: "disciplined" },
      outOfPossession: { defensiveWidth: "narrow", defensiveLine: "deep", closingDown: "sit-back", tackling: "cautious", marking: "man", offsideTrap: false, timeWasting: true },
      attack: { finalThirdCrossing: "look-for-overlap", finalThirdShooting: "work-into-box", finalThirdRunning: "run-at-defence", passingFocus: "mixed", goalkeeperDistribution: "long" },
      transition: { counterPressIntensity: "cautious", counterAttackSpeed: "counter", transitionDirectness: "direct" },
    },
  },
  "park-the-bus": {
    id: "park-the-bus", label: "Park the Bus", proactiveness: -2,
    description: "Everyone behind the ball, defends the box with everything and looks to survive.",
    bullets: ["Maximum men behind the ball at all times", "Concedes possession freely to protect the result"],
    defaults: {
      mentality: "very-defensive",
      inPossession: { tempo: "slow", passingDirectness: "long", width: "narrow", playThroughBias: "balanced", buildUpFromBack: false, creativeFreedom: "disciplined" },
      outOfPossession: { defensiveWidth: "narrow", defensiveLine: "deep", closingDown: "sit-back", tackling: "cautious", marking: "zonal", offsideTrap: false, timeWasting: true },
      attack: { finalThirdCrossing: "early-crosses", finalThirdShooting: "shoot-on-sight", finalThirdRunning: "run-at-defence", passingFocus: "mixed", goalkeeperDistribution: "long" },
      transition: { counterPressIntensity: "cautious", counterAttackSpeed: "hold-shape", transitionDirectness: "long" },
    },
  },
};

export const STYLE_ORDER: TacticalStyleId[] = [
  "tiki-taka", "vertical-tiki-taka", "control-possession", "gegenpress", "wing-play",
  "clean-slate", "route-one", "fluid-counter-attack", "direct-counter-attack", "catenaccio", "park-the-bus",
];
