"use client";
import type { MatchEvent } from "@/engines/match/matchTypes";
import type { Club, ID, Player } from "@/domain/types";
import { buildCommentaryFeed } from "@/engines/match/commentary";

const EVENT_LABEL: Partial<Record<MatchEvent["type"], { text: string; className: string }>> = {
  goal: { text: "GOAL", className: "text-accent-400" },
  "yellow-card": { text: "YC", className: "text-accent-500" },
  "red-card": { text: "RC", className: "text-danger-500" },
  "second-yellow": { text: "RC", className: "text-danger-500" },
  substitution: { text: "SUB", className: "text-ink-500" },
  injury: { text: "INJ", className: "text-danger-500" },
  "half-time": { text: "HT", className: "text-ink-500" },
  "full-time": { text: "FT", className: "text-ink-500" },
  kickoff: { text: "KO", className: "text-ink-500" },
  "penalty-scored": { text: "PEN", className: "text-accent-400" },
};

export function EventFeed({
  events, players, homeClub, awayClub, homeClubId,
}: {
  events: MatchEvent[]; players: Record<ID, Player>;
  homeClub: Club | undefined; awayClub: Club | undefined; homeClubId: ID;
}) {
  const lines = buildCommentaryFeed(events, players, { home: homeClub, away: awayClub, homeClubId });

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-card border border-navy-600 bg-navy-900 p-3">
      {lines.length === 0 && <p className="text-sm text-ink-500">Kick-off is moments away…</p>}
      {lines.map((line, i) => {
        const label = EVENT_LABEL[line.type];
        return (
          <div key={i} className={`flex items-baseline gap-2 text-sm ${line.emphasis === "high" ? "font-medium" : ""}`}>
            <span className="w-8 shrink-0 font-data text-ink-500">{line.minute}&apos;</span>
            <span className={`w-9 shrink-0 font-data text-xs font-semibold ${label?.className ?? "text-ink-500"}`}>
              {label?.text ?? "•"}
            </span>
            <span className={line.emphasis === "high" ? "text-ink-100" : "text-ink-300"}>{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}
