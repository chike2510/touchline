"use client";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormationPitch, caToOverall } from "@/components/tactics/FormationPitch";
import { coordsForFormation } from "@/engines/tactics/positionCoords";
import { FORMATION_SLOTS } from "@/engines/tactics/aiTactics";
import type { ID, Player, PositionCode, TacticSetup } from "@/domain/types";

const FORMATIONS = Object.keys(FORMATION_SLOTS);
const MENTALITIES: TacticSetup["mentality"][] = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"];

export default function TacticsPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const club = world?.clubs[world.userClubId];
  const tactic = world?.activeTactic;
  const slots = tactic ? FORMATION_SLOTS[tactic.formation] ?? FORMATION_SLOTS["4-3-3"]! : [];
  const coords = tactic ? coordsForFormation(tactic.formation) : [];

  // Derive an ordered assignments array (slot index -> playerId) from the
  // tactic's playerRoles map by matching each assigned player's positionCode
  // against the formation's slot list, in order.
  const assignments = useMemo(() => {
    if (!tactic) return [];
    const remaining = new Map(Object.entries(tactic.playerRoles));
    return slots.map((slotPos) => {
      const match = [...remaining.entries()].find(([, role]) => role.positionCode === slotPos);
      if (match) {
        remaining.delete(match[0]);
        return match[0];
      }
      return null;
    });
  }, [tactic, slots]);

  const assignedIds = new Set(assignments.filter((a): a is string => !!a));
  const bench = (club?.squadIds ?? []).filter((id) => !assignedIds.has(id));

  if (!world || !club || !tactic) {
    return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;
  }

  function updateTactic(patch: Partial<TacticSetup>, familiarityDelta = -3) {
    mutateWorld((w) => {
      w.activeTactic = { ...w.activeTactic, ...patch, familiarity: Math.max(0, Math.min(100, w.activeTactic.familiarity + familiarityDelta)) };
    });
  }

  function handleFormationChange(formation: string) {
    // Rebuild playerRoles from scratch against the new slot list, keeping
    // whichever currently-assigned players still fit a slot by position,
    // greedily, and leaving the rest for the manager to fill in.
    const newSlots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"]!;
    const currentPlayerIds = [...assignedIds, ...bench];
    const usedIds = new Set<string>();
    const newRoles: TacticSetup["playerRoles"] = {};
    for (const slotPos of newSlots) {
      const candidate = currentPlayerIds.find((id) => {
        if (usedIds.has(id)) return false;
        const p = world.players[id];
        return p?.positions.includes(slotPos);
      });
      if (candidate) {
        usedIds.add(candidate);
        newRoles[candidate] = { positionCode: slotPos, role: "Default", duty: "support" };
      }
    }
    mutateWorld((w) => {
      w.activeTactic = { ...w.activeTactic, formation, playerRoles: newRoles, familiarity: 20 };
    });
  }

  function handleAssign(slotIndex: number, playerId: string) {
    const slotPos = slots[slotIndex]!;
    const newAssignments = [...assignments];
    // If this player already occupies another slot, vacate it first.
    const priorIndex = newAssignments.indexOf(playerId);
    if (priorIndex !== -1) newAssignments[priorIndex] = null;
    newAssignments[slotIndex] = playerId;

    const newRoles: TacticSetup["playerRoles"] = {};
    newAssignments.forEach((id, i) => {
      if (id) newRoles[id] = { positionCode: slots[i]!, role: "Default", duty: "support" };
    });
    updateTactic({ playerRoles: newRoles }, -2);
    setSelectedSlot(null);
  }

  return (
    <div className="flex flex-col gap-4 py-3">
      <h1 className="font-display text-2xl text-ink-100">Tactics</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Formation & lineup"
            subtitle="Tap a slot to change who plays there"
            right={
              <select
                value={tactic.formation}
                onChange={(e) => handleFormationChange(e.target.value)}
                className="rounded-card border border-navy-600 bg-navy-800 px-2 py-1 text-sm text-ink-100"
              >
                {FORMATIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            }
          />
          <div className="mx-auto max-w-sm">
            <FormationPitch
              coords={coords}
              slotPositions={slots}
              assignments={assignments}
              players={world.players}
              onSlotClick={(i) => setSelectedSlot(i)}
              selectedSlot={selectedSlot}
            />
          </div>

          {selectedSlot !== null && (
            <PlayerPicker
              slotPosition={slots[selectedSlot]!}
              candidateIds={club.squadIds}
              currentId={assignments[selectedSlot]}
              players={world.players}
              onPick={(id) => handleAssign(selectedSlot, id)}
              onClose={() => setSelectedSlot(null)}
            />
          )}

          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-ink-500">Bench ({bench.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {bench.map((id) => {
                const p = world.players[id];
                if (!p) return null;
                return (
                  <span key={id} className="rounded-card bg-navy-800 px-2 py-1 text-xs text-ink-300">
                    {p.lastName} <span className="text-ink-500">({caToOverall(p.currentAbility)})</span>
                  </span>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Mentality" subtitle={`Familiarity ${tactic.familiarity}/100`} />
            <div className="flex flex-wrap gap-1.5">
              {MENTALITIES.map((m) => (
                <button
                  key={m}
                  onClick={() => updateTactic({ mentality: m })}
                  className={`rounded-card px-2.5 py-1.5 text-xs ${
                    tactic.mentality === m ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"
                  }`}
                >
                  {m.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="In possession" />
            <div className="flex flex-col gap-3">
              <SliderRow label="Tempo" value={tactic.inPossession.tempo} onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, tempo: v } })} />
              <SliderRow label="Passing directness" value={tactic.inPossession.passingDirectness} onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, passingDirectness: v } })} />
              <SliderRow label="Width" value={tactic.inPossession.width} onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, width: v } })} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Out of possession" />
            <div className="flex flex-col gap-3">
              <SliderRow label="Pressing intensity" value={tactic.outOfPossession.pressingIntensity} onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, pressingIntensity: v } })} />
              <SliderRow label="Defensive line" value={tactic.outOfPossession.defensiveLine} onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, defensiveLine: v } })} />
              <SliderRow label="Tackling aggression" value={tactic.outOfPossession.tacklingAggression} onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, tacklingAggression: v } })} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlayerPicker({
  slotPosition, candidateIds, currentId, players, onPick, onClose,
}: {
  slotPosition: PositionCode; candidateIds: ID[]; currentId: ID | null;
  players: Record<ID, Player>;
  onPick: (id: ID) => void; onClose: () => void;
}) {
  const list = candidateIds
    .map((id) => players[id])
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => {
      const aFit = a.positions.includes(slotPosition) ? 1 : 0;
      const bFit = b.positions.includes(slotPosition) ? 1 : 0;
      return bFit - aFit || b.currentAbility - a.currentAbility;
    });

  return (
    <div className="mt-3 rounded-card border border-navy-600 bg-navy-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-100">Select {slotPosition}</p>
        <button onClick={onClose} className="text-xs text-ink-500">Close</button>
      </div>
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {list.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`flex items-center justify-between rounded-card px-2 py-1.5 text-left text-sm ${
              p.id === currentId ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-700"
            }`}
          >
            <span className="truncate">
              {p.firstName} {p.lastName}
              {!p.positions.includes(slotPosition) && <span className="ml-1 text-xs text-warning-500">(out of position)</span>}
            </span>
            <span className="font-data text-ink-500">{caToOverall(p.currentAbility)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-ink-300">
        <span>{label}</span>
        <span className="font-data text-ink-500">{Math.round(value)}</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-navy-600 accent-accent-500"
      />
    </div>
  );
}
