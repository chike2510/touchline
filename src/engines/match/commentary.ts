// ============================================================================
// Turns a MatchEvent (which the engine stamps with a terse, generic
// description like "GOAL!" or "Booked.") into a varied commentary sentence
// for display. Kept as a presentation-layer transform rather than baked into
// matchEngine.ts, so the simulation stays deterministic/testable and this
// can be extended with new phrasing independently.
// ============================================================================
import type { Club, ID, Player } from "@/domain/types";
import type { MatchEvent } from "./matchTypes";

function seededPick<T>(items: T[], seed: number): T {
  const x = Math.abs(Math.sin(seed * 12.9898) * 43758.5453);
  const idx = Math.floor((x - Math.floor(x)) * items.length);
  return items[idx]!;
}

function name(players: Record<ID, Player>, id?: ID): string {
  const p = id ? players[id] : undefined;
  return p ? `${p.firstName} ${p.lastName}` : "The player";
}

function lastName(players: Record<ID, Player>, id?: ID): string {
  const p = id ? players[id] : undefined;
  return p ? p.lastName : "he";
}

export interface CommentaryLine {
  minute: number;
  text: string;
  type: MatchEvent["type"];
  emphasis: "normal" | "high";
}

export function buildCommentaryFeed(
  events: MatchEvent[],
  players: Record<ID, Player>,
  clubs: { home: Club | undefined; away: Club | undefined; homeClubId: ID }
): CommentaryLine[] {
  let homeGoals = 0, awayGoals = 0;
  const lines: CommentaryLine[] = [];

  for (const e of events) {
    const seed = e.minute * 7 + lines.length * 3;
    const scoringClubIsHome = e.clubId === clubs.homeClubId;
    if (e.type === "goal") {
      if (scoringClubIsHome) homeGoals += 1; else awayGoals += 1;
    }

    lines.push({
      minute: e.minute,
      type: e.type,
      emphasis: e.type === "goal" || e.type === "red-card" || e.type === "second-yellow" ? "high" : "normal",
      text: phraseFor(e, players, clubs, seed, homeGoals, awayGoals),
    });
  }

  return lines.reverse(); // most recent first, matching the old EventFeed order
}

function phraseFor(
  e: MatchEvent,
  players: Record<ID, Player>,
  clubs: { home: Club | undefined; away: Club | undefined; homeClubId: ID },
  seed: number,
  homeGoals: number,
  awayGoals: number
): string {
  const p = name(players, e.playerId);
  const last = lastName(players, e.playerId);
  const scoringClub = e.clubId === clubs.homeClubId ? clubs.home : clubs.away;

  switch (e.type) {
    case "kickoff":
      return seededPick(
        [
          `We're underway at ${clubs.home?.stadium.name ?? "the stadium"}!`,
          `Kick-off! ${clubs.home?.name ?? "The home side"} get us started.`,
        ],
        seed
      );
    case "goal":
      return seededPick(
        [
          `GOAL! ${p} finds the net for ${scoringClub?.name ?? "them"}! It's ${homeGoals}-${awayGoals}.`,
          `${last} scores! ${scoringClub?.shortName ?? "They"} lead the celebrations — ${homeGoals}-${awayGoals} now.`,
          `They've done it — ${p} with the finish! ${homeGoals}-${awayGoals} on the night.`,
        ],
        seed
      );
    case "own-goal":
      return `Own goal! A cruel moment as the ball ends up in the wrong net. ${homeGoals}-${awayGoals}.`;
    case "chance-created":
      return seededPick(
        [
          `Great effort from ${p} — so close!`,
          `${p} goes close there, the keeper equal to it.`,
          `That's a real chance for ${scoringClub?.name ?? "them"} — just wide.`,
        ],
        seed
      );
    case "chance-missed":
      return seededPick(
        [`${p} really should have done better there.`, `${last} can't quite make the connection.`], seed
      );
    case "corner":
      return `Corner for ${scoringClub?.name ?? "the attacking side"}.`;
    case "free-kick":
      return `Free kick in a promising area for ${scoringClub?.name ?? "them"}.`;
    case "penalty-awarded":
      return `Penalty! The referee points to the spot.`;
    case "penalty-scored":
      return `${p} makes no mistake from twelve yards! ${homeGoals}-${awayGoals}.`;
    case "penalty-missed":
      return `${p} can't convert from the spot — huge let-off there.`;
    case "yellow-card":
      return seededPick([`${p} is booked.`, `Yellow card shown to ${last}.`], seed);
    case "red-card":
      return `RED CARD! ${p} is sent off — big moment in this match.`;
    case "second-yellow":
      return `Second yellow for ${last} — he has to go!`;
    case "injury":
      return `${p} is down and looks to be in some discomfort.`;
    case "substitution":
      return `Substitution: ${p} comes on.`;
    case "tactic-change":
      return e.description; // already specific and useful as-is
    case "half-time":
      return `That's half-time. ${homeGoals}-${awayGoals} at the break.`;
    case "full-time":
      return `Full-time! Final score ${homeGoals}-${awayGoals}.`;
    default:
      return e.description;
  }
}
