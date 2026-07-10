"use client";
import type { MatchEvent } from "@/engines/match/matchTypes";
import type { ID, Player, Club } from "@/domain/types";

const EVENT_LABEL: Partial<Record<MatchEvent["type"], { text: string; className: string }>> = {
  goal: { text: "GOAL", className: "text-accent-400" },
  "yellow-card": { text: "YC", className: "text-accent-500" },
  "red-card": { text: "RC", className: "text-danger-500" },
  "second-yellow": { text: "RC", className: "text-danger-500" },
  substitution: { text: "SUB", className: "text-ink-500" },
  injury: { text: "INJ", className: "text-danger-500" },
  "half-time": { text: "HT", className: "text-ink-500" },
  kickoff: { text: "KO", className: "text-ink-500" },
};

export function EventFeed({ events, players, homeClub, awayClub, homeClubId }: { events: MatchEvent[]; players: Record<ID, Player>; homeClub?: Club; awayClub?: Club; homeClubId?: string }) {
  const sorted = [...events].sort((a, b) => b.minute - a.minute);
  return (
    <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-card border border-navy-600 bg-navy-900 p-3">
      {sorted.length === 0 && <p className="text-sm text-ink-500">No events yet.</p>}
      {sorted.map((e, i) => {
        const player = e.playerId ? players[e.playerId] : undefined;
        const label = EVENT_LABEL[e.type];
        return (
          <div key={i} className="flex items-baseline gap-2 text-sm">
            <span className="w-8 shrink-0 font-data text-ink-500">{e.minute}&apos;</span>
            <span className={`w-9 shrink-0 font-data text-xs font-semibold ${label?.className ?? "text-ink-500"}`}>
              {label?.text ?? "—"}
            </span>
            <span className="text-ink-300">
              {e.description}
              {player && <span className="text-ink-100"> — {player.firstName} {player.lastName}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
