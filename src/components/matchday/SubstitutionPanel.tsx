"use client";
import { useState } from "react";
import type { ID, Player, PositionCode } from "@/domain/types";

export function SubstitutionPanel({
  onPitchIds, benchIds, players, substitutionsUsed, maxSubstitutions, onSubstitute,
}: {
  onPitchIds: ID[]; benchIds: ID[]; players: Record<ID, Player>;
  substitutionsUsed: number; maxSubstitutions: number;
  onSubstitute: (offId: ID, onId: ID, position: PositionCode) => void;
}) {
  const [offId, setOffId] = useState<ID | "">("");
  const [onId, setOnId] = useState<ID | "">("");
  const remaining = maxSubstitutions - substitutionsUsed;

  function handleSubmit() {
    if (!offId || !onId) return;
    const incoming = players[onId];
    const outgoing = players[offId];
    onSubstitute(offId, onId, incoming?.positions[0] ?? outgoing?.positions[0] ?? "CM");
    setOffId("");
    setOnId("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-navy-600 bg-navy-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-100">Substitutions</p>
        <span className="font-data text-xs text-ink-500">{remaining} remaining</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={offId}
          onChange={(e) => setOffId(e.target.value)}
          className="rounded-card border border-navy-600 bg-navy-800 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="">Off…</option>
          {onPitchIds.map((id) => {
            const p = players[id];
            return p ? <option key={id} value={id}>{p.firstName} {p.lastName}</option> : null;
          })}
        </select>
        <select
          value={onId}
          onChange={(e) => setOnId(e.target.value)}
          className="rounded-card border border-navy-600 bg-navy-800 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="">On…</option>
          {benchIds.map((id) => {
            const p = players[id];
            return p ? <option key={id} value={id}>{p.firstName} {p.lastName}</option> : null;
          })}
        </select>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!offId || !onId || remaining <= 0}
        className="rounded-card bg-navy-600 px-3 py-1.5 text-sm font-medium text-ink-100 transition-transform duration-150 active:scale-95 disabled:opacity-40"
      >
        Make substitution
      </button>
    </div>
  );
}
