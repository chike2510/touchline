"use client";
import { useState } from "react";
import type { Player } from "@/domain/types";
import { Badge, StatBar } from "@/components/ui/Badge";

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function PlayerCard({ player }: { player: Player }) {
  const [expanded, setExpanded] = useState(false);
  const age = ageFromDob(player.dateOfBirth);

  return (
    <div className="rounded-card border border-navy-600 bg-navy-900 shadow-card">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 font-data text-xs text-ink-300">
            {player.positions[0]}
          </div>
          <div>
            <p className="font-medium text-ink-100">
              {player.firstName} {player.lastName}
            </p>
            <p className="text-xs text-ink-500">
              {age} yrs • {player.nationality} • Form {player.form > 0 ? `+${player.form}` : player.form}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {player.injuryStatus && <Badge tone="rival">Injured</Badge>}
          {player.suspension && <Badge tone="amber">Suspended</Badge>}
          <span className="font-data text-sm text-accent-400">{Math.round(player.currentAbility / 10)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-navy-600 px-4 py-3">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Morale" value={player.morale} />
            <MiniStat label="Fatigue" value={100 - player.fatigue} inverted />
            <MiniStat label="Sharpness" value={player.sharpness} />
          </div>
          <div className="chalk-divider my-3" />
          <div className="flex flex-col gap-1.5">
            <StatBar label="Passing" value={player.attributes.technical.passing} />
            <StatBar label="Dribbling" value={player.attributes.technical.dribbling} />
            <StatBar label="Finishing" value={player.attributes.technical.finishing} />
            <StatBar label="Tackling" value={player.attributes.technical.tackling} />
            <StatBar label="Pace" value={player.attributes.physical.pace} />
            <StatBar label="Stamina" value={player.attributes.physical.stamina} />
            <StatBar label="Vision" value={player.attributes.mental.vision} />
            <StatBar label="Composure" value={player.attributes.mental.composure} />
          </div>
          {player.personality.traits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {player.personality.traits.map((t) => (
                <Badge key={t}>{t.replace(/-/g, " ")}</Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) {
  const good = inverted ? value > 60 : value > 60;
  return (
    <div className="rounded-card bg-navy-800 px-2 py-2">
      <p className={`font-data text-lg ${good ? "text-ink-100" : "text-accent-400"}`}>{Math.round(value)}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}
