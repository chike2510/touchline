"use client";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormationPitch, caToOverall } from "@/components/tactics/FormationPitch";
import { Info } from "lucide-react";
import { coordsForFormation } from "@/engines/tactics/positionCoords";
import { FORMATION_SLOTS } from "@/engines/tactics/aiTactics";
import type { ID, Player, PositionCode, SetPieceRoutine, TacticSetup } from "@/domain/types";

const FORMATIONS = Object.keys(FORMATION_SLOTS);
const MENTALITIES: TacticSetup["mentality"][] = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"];
const TABS = ["Formation", "Shape", "Set Pieces", "Captain"] as const;
type Tab = (typeof TABS)[number];

export default function TacticsPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("Formation");

  const club = world?.clubs[world.userClubId];
  const tactic = world?.activeTactic;
  const slots = tactic ? FORMATION_SLOTS[tactic.formation] ?? FORMATION_SLOTS["4-3-3"]! : [];
  const coords = tactic ? coordsForFormation(tactic.formation) : [];

  const assignments = useMemo(() => {
    if (!tactic) return [] as (string | null)[];
    const remaining = new Map(Object.entries(tactic.playerRoles));
    return slots.map((slotPos) => {
      const match = [...remaining.entries()].find(([, role]) => role.positionCode === slotPos);
      if (match) { remaining.delete(match[0]); return match[0]; }
      return null;
    });
  }, [tactic, slots]);

  const assignedIds = new Set(assignments.filter((a): a is string => !!a));
  const bench = (club?.squadIds ?? []).filter((id) => !assignedIds.has(id));
  const startingXI = assignments.filter((a): a is string => !!a);

  if (!world || !club || !tactic) {
    return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;
  }

  function updateTactic(patch: Partial<TacticSetup>, familiarityDelta = -3) {
    mutateWorld((w) => {
      w.activeTactic = { ...w.activeTactic, ...patch, familiarity: Math.max(0, Math.min(100, w.activeTactic.familiarity + familiarityDelta)) };
    });
  }

  function updateSetPieces(patch: Partial<TacticSetup["setPieces"]>) {
    updateTactic({ setPieces: { ...tactic!.setPieces, ...patch } }, 0);
  }

  function handleFormationChange(formation: string) {
    if (!world) return;
    const newSlots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"]!;
    const currentPlayerIds = [...assignedIds, ...bench];
    const usedIds = new Set<string>();
    const newRoles: TacticSetup["playerRoles"] = {};
    for (const slotPos of newSlots) {
      const candidate = currentPlayerIds.find((id) => {
        if (usedIds.has(id)) return false;
        const p = world.players[id];
        return p?.positions.includes(slotPos) ?? false;
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

  function setCaptain(playerId: string) {
    mutateWorld((w) => {
      w.clubs[w.userClubId]!.captainId = playerId;
    });
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Tactics</h1>

      <div className="flex gap-1 overflow-x-auto rounded-card border border-navy-600 bg-navy-900 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-card px-3 py-1.5 text-sm transition-colors duration-150 ${
              tab === t ? "bg-accent-500 font-semibold text-navy-950" : "text-ink-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Formation" && (
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
                  {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
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
                currentId={assignments[selectedSlot] ?? null}
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

          <SquadRoleList club={club} tactic={tactic} players={world.players} slots={slots} assignments={assignments} />
        </div>
      )}

      {tab === "Shape" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Mentality" subtitle={`Familiarity ${tactic.familiarity}/100`} />
            <div className="flex flex-wrap gap-1.5">
              {MENTALITIES.map((m) => (
                <button
                  key={m}
                  onClick={() => updateTactic({ mentality: m })}
                  className={`rounded-card px-2.5 py-1.5 text-xs ${
                    tactic.mentality === m ? "bg-accent-500 font-semibold text-navy-950" : "bg-navy-800 text-ink-300"
                  }`}
                >
                  {m.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </Card>

          <div />

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
      )}

      {tab === "Set Pieces" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SetPieceCard
            title="Corners"
            routine={tactic.setPieces.cornersAttacking}
            startingXI={startingXI}
            players={world.players}
            routineOptions={["near-post", "far-post", "short-corner"]}
            onChange={(patch) => updateSetPieces({ cornersAttacking: { ...tactic.setPieces.cornersAttacking, ...patch } })}
          />
          <SetPieceCard
            title="Free kicks"
            routine={tactic.setPieces.freeKicksAttacking}
            startingXI={startingXI}
            players={world.players}
            routineOptions={["direct-shot", "edge-of-box", "far-post"]}
            onChange={(patch) => updateSetPieces({ freeKicksAttacking: { ...tactic.setPieces.freeKicksAttacking, ...patch } })}
          />
          <Card>
            <CardHeader title="Defending corners" />
            <div className="flex gap-1.5">
              {(["zonal", "man-marking", "mixed"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => updateSetPieces({ cornersDefending: m })}
                  className={`rounded-card px-2.5 py-1.5 text-xs capitalize ${
                    tactic.setPieces.cornersDefending === m ? "bg-accent-500 font-semibold text-navy-950" : "bg-navy-800 text-ink-300"
                  }`}
                >
                  {m.replace("-", " ")}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "Captain" && (
        <Card>
          <CardHeader title="Captain" subtitle="Pick your on-pitch leader" />
          <div className="flex flex-col gap-1">
            {[...club.squadIds]
              .map((id) => world.players[id])
              .filter((p): p is Player => !!p)
              .sort((a, b) => b.attributes.mental.leadership - a.attributes.mental.leadership)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => setCaptain(p.id)}
                  className={`flex items-center justify-between rounded-card px-3 py-2 text-left text-sm ${
                    club.captainId === p.id ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"
                  }`}
                >
                  <span>{p.firstName} {p.lastName} {club.captainId === p.id && <span className="ml-1 text-xs">(C)</span>}</span>
                  <span className="font-data text-xs text-ink-500">Leadership {p.attributes.mental.leadership}</span>
                </button>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SquadRoleList({
  club, tactic, players, slots, assignments,
}: {
  club: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["clubs"][string];
  tactic: TacticSetup; players: Record<ID, Player>; slots: PositionCode[]; assignments: (string | null)[];
}) {
  return (
    <Card>
      <CardHeader title="Squad" subtitle="Current roles" />
      <div className="flex flex-col gap-1 text-sm">
        {slots.map((slotPos, i) => {
          const playerId = assignments[i];
          const player = playerId ? players[playerId] : undefined;
          return (
            <div key={i} className="flex items-center justify-between border-b border-navy-700 py-1 last:border-0">
              <span className="font-data text-xs text-ink-500">{slotPos}</span>
              <span className={player ? "text-ink-200" : "text-ink-500"}>
                {player ? `${player.firstName[0]}. ${player.lastName}` : "— empty —"}
                {player && club.captainId === player.id && <span className="ml-1 text-accent-400">(C)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SetPieceCard({
  title, routine, startingXI, players, routineOptions, onChange,
}: {
  title: string; routine: SetPieceRoutine; startingXI: ID[]; players: Record<ID, Player>;
  routineOptions: SetPieceRoutine["routine"][]; onChange: (patch: Partial<SetPieceRoutine>) => void;
}) {
  const xi = startingXI.map((id) => players[id]).filter((p): p is Player => !!p);
  const targets = new Set(routine.targetPlayerIds);

  function toggleTarget(id: ID) {
    const next = new Set(targets);
    if (next.has(id)) next.delete(id); else if (next.size < 3) next.add(id);
    onChange({ targetPlayerIds: [...next] });
  }

  return (
    <Card>
      <CardHeader title={title} />
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs text-ink-500">Taker</p>
          <select
            value={routine.designatedTakerId ?? ""}
            onChange={(e) => onChange({ designatedTakerId: e.target.value || null })}
            className="w-full rounded-card border border-navy-600 bg-navy-800 px-2 py-1.5 text-sm text-ink-100"
          >
            <option value="">— none —</option>
            {xi.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-500">Routine</p>
          <div className="flex flex-wrap gap-1.5">
            {routineOptions.map((r) => (
              <button
                key={r}
                onClick={() => onChange({ routine: r })}
                className={`rounded-card px-2.5 py-1 text-xs capitalize ${
                  routine.routine === r ? "bg-accent-500 font-semibold text-navy-950" : "bg-navy-800 text-ink-300"
                }`}
              >
                {r.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-500">Aerial targets (up to 3)</p>
          <div className="flex flex-wrap gap-1.5">
            {xi.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleTarget(p.id)}
                className={`rounded-card px-2 py-1 text-xs ${
                  targets.has(p.id) ? "bg-accent-500/20 text-accent-400" : "bg-navy-800 text-ink-300"
                }`}
              >
                {p.lastName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PlayerPicker({
  slotPosition, candidateIds, currentId, players, onPick, onClose,
}: {
  slotPosition: PositionCode; candidateIds: ID[]; currentId: ID | null;
  players: Record<ID, Player>;
  onPick: (id: ID) => void; onClose: () => void;
}) {
  const openPlayerProfile = useGameStore((s) => s.openPlayerProfile);
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
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-card px-2 py-1.5 text-sm ${
              p.id === currentId ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-700"
            }`}
          >
            <button onClick={() => onPick(p.id)} className="flex flex-1 items-center justify-between text-left">
              <span className="truncate">
                {p.firstName} {p.lastName}
                {!p.positions.includes(slotPosition) && <span className="ml-1 text-xs text-warning-500">(out of position)</span>}
              </span>
              <span className="ml-2 font-data text-ink-500">{caToOverall(p.currentAbility)}</span>
            </button>
            <button
              onClick={() => openPlayerProfile(p.id)}
              className="ml-2 shrink-0 rounded-full p-1 text-ink-500 hover:text-accent-400"
              title="View full attributes"
            >
              <Info size={14} />
            </button>
          </div>
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
