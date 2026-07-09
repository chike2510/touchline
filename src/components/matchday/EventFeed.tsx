"use client";
import type { MatchEvent } from "@/engines/match/matchTypes";
import type { ID, Player } from "@/domain/types";

const EVENT_LABEL: Partial<Record<MatchEvent["type"], { text: string; className: string }>> = {
  goal: { text: "GOAL", className: "text-floodlight-400" },
  "yellow-card": { text: "YC", className: "text-floodlight-500" },
  "red-card": { text: "RC", className: "text-rival-500" },
  "second-yellow": { text: "RC", className: "text-rival-500" },
  substitution: { text: "SUB", className: "text-chalk-300" },
  injury: { text: "INJ", className: "text-rival-500" },
  "half-time": { text: "HT", className: "text-chalk-300" },
  kickoff: { text: "KO", className: "text-chalk-300" },
};

export function EventFeed({ events, players }: { events: MatchEvent[]; players: Record<ID, Player> }) {
  const sorted = [...events].sort((a, b) => b.minute - a.minute);
  return (
    <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-card border border-pitch-700 bg-pitch-900 p-3">
      {sorted.length === 0 && <p className="text-sm text-chalk-300">No events yet.</p>}
      {sorted.map((e, i) => {
        const player = e.playerId ? players[e.playerId] : undefined;
        const label = EVENT_LABEL[e.type];
        return (
          <div key={i} className="flex items-baseline gap-2 text-sm">
            <span className="w-8 shrink-0 font-data text-chalk-300">{e.minute}&apos;</span>
            <span className={`w-9 shrink-0 font-data text-xs font-semibold ${label?.className ?? "text-chalk-300"}`}>
              {label?.text ?? "—"}
            </span>
            <span className="text-chalk-200">
              {e.description}
              {player && <span className="text-chalk-100"> — {player.firstName} {player.lastName}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
