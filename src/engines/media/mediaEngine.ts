// ============================================================================
// Media engine — generates MediaStory items (transfer rumours, match
// reaction, press conferences) and applies the effects of the response the
// user selects. Kept separate from worldEngine's briefing so narrative
// generation can grow richer (templated storylines, rivalry-aware headlines)
// without bloating the calendar conductor.
// ============================================================================
import type { SaveGameWorld, MediaStory, MediaResponseOption, Fixture, MatchResult, InboxItem } from "@/domain/types";
import { nanoid } from "nanoid";
import { bumpFanSentiment } from "@/engines/fanSentiment/fanSentimentEngine";
import { bumpRivalry } from "@/engines/world/worldEngine";

const RESPONSE_TEMPLATES: MediaResponseOption[] = [
  { id: "diplomatic", label: "Give a measured, respectful answer", tone: "diplomatic", effects: { boardConfidenceDelta: 1 } },
  { id: "confident", label: "Back the team publicly", tone: "confident", effects: { moraleDelta: 3, fanSentimentDelta: 1 } },
  { id: "aggressive", label: "Call out the opponent/referee/critics", tone: "aggressive", effects: { rivalryDelta: 8, fanSentimentDelta: 2 } },
  { id: "humble", label: "Deflect credit to the players/staff", tone: "humble", effects: { moraleDelta: 2 } },
  { id: "deflect", label: "Refuse to be drawn on it", tone: "deflect", effects: {} },
];

export function generatePostMatchStory(
  world: SaveGameWorld,
  fixture: Fixture,
  result: MatchResult
): MediaStory {
  const home = world.clubs[fixture.homeClubId];
  const away = world.clubs[fixture.awayClubId];
  const headline =
    result.homeGoals === result.awayGoals
      ? `${home?.name} and ${away?.name} share the points`
      : result.homeGoals > result.awayGoals
      ? `${home?.name} defeat ${away?.name} ${result.homeGoals}-${result.awayGoals}`
      : `${away?.name} stun ${home?.name}, win ${result.awayGoals}-${result.homeGoals}`;

  const story: MediaStory = {
    id: nanoid(10),
    headline,
    body: `Full-time at ${home?.stadium.name ?? "the stadium"}: ${result.homeGoals}-${result.awayGoals}. Possession split ${result.possessionHome}% to ${100 - result.possessionHome}%.`,
    date: world.currentDate,
    category: "match-reaction",
    relatedClubIds: [fixture.homeClubId, fixture.awayClubId],
    relatedPlayerIds: result.motmPlayerId ? [result.motmPlayerId] : [],
    requiresResponse: fixture.homeClubId === world.userClubId || fixture.awayClubId === world.userClubId,
    responseOptions: RESPONSE_TEMPLATES,
  };
  world.mediaStories[story.id] = story;

  if (story.requiresResponse) {
    const item: InboxItem = {
      id: nanoid(10),
      category: "media",
      subject: `Press conference: ${headline}`,
      body: "The media want your reaction to the result.",
      date: world.currentDate,
      read: false,
      archived: false,
      priority: "normal",
      actions: RESPONSE_TEMPLATES.map((r) => ({ id: r.id, label: r.label, kind: "decision" as const, payload: { storyId: story.id } })),
      linkedEntityId: story.id,
    };
    world.inboxItems[item.id] = item;
  }
  return story;
}

export function applyMediaResponse(world: SaveGameWorld, storyId: string, responseId: string): void {
  const story = world.mediaStories[storyId];
  const response = story?.responseOptions?.find((r) => r.id === responseId);
  if (!story || !response) return;

  const club = world.clubs[world.userClubId];
  if (club) {
    if (response.effects.fanSentimentDelta) bumpFanSentiment(world, club.id, response.effects.fanSentimentDelta, response.tone);
    if (response.effects.boardConfidenceDelta) club.boardConfidence = Math.max(0, Math.min(100, club.boardConfidence + response.effects.boardConfidenceDelta));
    if (response.effects.moraleDelta) {
      for (const playerId of club.squadIds) {
        const player = world.players[playerId];
        if (player) player.morale = Math.max(0, Math.min(100, player.morale + response.effects.moraleDelta!));
      }
    }
    if (response.effects.rivalryDelta) {
      const otherClubId = story.relatedClubIds.find((id) => id !== club.id);
      if (otherClubId) bumpRivalry(world, club.id, otherClubId, response.effects.rivalryDelta, `Press: "${response.label}"`);
    }
  }
}
