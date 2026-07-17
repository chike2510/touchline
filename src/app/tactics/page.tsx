"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormationPitch, caToOverall } from "@/components/tactics/FormationPitch";
import { Info, Star, X } from "lucide-react";
import { coordsForFormation } from "@/engines/tactics/positionCoords";
import {
  FORMATION_SLOTS, FORMATION_CATEGORY, buildTacticFromStyle, pickAutoLineup, remapOutOfPossessionFormation,
} from "@/engines/tactics/aiTactics";
import { ROLE_CATALOG, rolesForSlot } from "@/engines/tactics/roles";
import { TACTICAL_STYLES, STYLE_ORDER } from "@/engines/tactics/styles";
import type {
  ID, Player, PositionCode, RoleCode, RoleDuty, SetPieceRoutine, TacticSetup,
  TempoLevel, WidthLevel, PassingDirectness, PlayThroughBias, CreativeFreedomLevel,
  DefensiveLineLevel, ClosingDownLevel, TacklingLevel, PassingFocus, GkDistribution, CounterAttackSpeed,
} from "@/domain/types";

const FORMATIONS = Object.keys(FORMATION_SLOTS);
const MENTALITIES: TacticSetup["mentality"][] = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"];
const TABS = ["Formation", "In Possession", "Out of Possession", "Attack", "Transition", "Defence", "Set Pieces", "Captain"] as const;
type Tab = (typeof TABS)[number];

// Ordered slot -> playerId, matching each formation slot to whichever
// starter is assigned that slot in a given phase's slot-assignment map.
function orderAssignments(slots: PositionCode[], slotAssignments: Record<ID, PositionCode>): (string | null)[] {
  const remaining = new Map(Object.entries(slotAssignments));
  return slots.map((slotPos) => {
    const match = [...remaining.entries()].find(([, s]) => s === slotPos);
    if (match) { remaining.delete(match[0]); return match[0]; }
    return null;
  });
}

export default function TacticsPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("Formation");
  const [creatingTactic, setCreatingTactic] = useState(false);

  const club = world?.clubs[world.userClubId];
  const tactic = world?.activeTactic;

  const inSlots = tactic ? FORMATION_SLOTS[tactic.inPossession.formation] ?? FORMATION_SLOTS["4-3-3"]! : [];
  const inCoords = tactic ? coordsForFormation(tactic.inPossession.formation) : [];
  const inAssignments = useMemo(
    () => (tactic ? orderAssignments(inSlots, tactic.inPossession.slotAssignments) : []),
    [tactic, inSlots]
  );
  const roleLabels = useMemo(
    () => inAssignments.map((id) => (id && tactic ? ROLE_CATALOG[tactic.playerRoles[id]!.roleCode]?.shortLabel : undefined)),
    [inAssignments, tactic]
  );

  const outSlots = tactic ? FORMATION_SLOTS[tactic.outOfPossession.formation] ?? FORMATION_SLOTS["4-3-3"]! : [];
  const outCoords = tactic ? coordsForFormation(tactic.outOfPossession.formation) : [];
  const outAssignments = useMemo(
    () => (tactic ? orderAssignments(outSlots, tactic.outOfPossession.slotAssignments) : []),
    [tactic, outSlots]
  );

  const assignedIds = new Set(inAssignments.filter((a): a is string => !!a));
  const bench = (club?.squadIds ?? []).filter((id) => !assignedIds.has(id));
  const startingXI = inAssignments.filter((a): a is string => !!a);

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

  // Reassigns a player to a slot in the IN-POSSESSION formation. The
  // out-of-possession shape keeps the same 11 players, re-derived from the
  // new starting XI order so both shapes stay in sync.
  function handleAssign(slotIndex: number, playerId: string) {
    const newAssignments = [...inAssignments];
    const priorIndex = newAssignments.indexOf(playerId);
    if (priorIndex !== -1) newAssignments[priorIndex] = null;
    newAssignments[slotIndex] = playerId;

    const newInSlots: Record<ID, PositionCode> = {};
    const newRoles: TacticSetup["playerRoles"] = {};
    newAssignments.forEach((id, i) => {
      if (!id) return;
      const slot = inSlots[i]!;
      newInSlots[id] = slot;
      const existingRole = tactic!.playerRoles[id];
      const roleValid = existingRole && ROLE_CATALOG[existingRole.roleCode].slots.includes(slot);
      newRoles[id] = roleValid ? existingRole! : { roleCode: rolesForSlot(slot)[0]?.code ?? "CM", duty: "support" };
    });
    const orderedXI = newAssignments.filter((id): id is string => !!id);
    const newOutSlots = remapOutOfPossessionFormation(orderedXI, tactic!.inPossession.formation, tactic!.outOfPossession.formation);

    updateTactic({
      inPossession: { ...tactic!.inPossession, slotAssignments: newInSlots },
      outOfPossession: { ...tactic!.outOfPossession, slotAssignments: newOutSlots },
      playerRoles: newRoles,
    }, -2);
    setSelectedSlot(null);
  }

  function handleRoleChange(playerId: string, roleCode: RoleCode) {
    const duties = ROLE_CATALOG[roleCode].duties;
    const duty: RoleDuty = duties.includes("support") ? "support" : duties[0]!;
    updateTactic({ playerRoles: { ...tactic!.playerRoles, [playerId]: { roleCode, duty } } }, -1);
  }

  function handleDutyChange(playerId: string, duty: RoleDuty) {
    const role = tactic!.playerRoles[playerId];
    if (!role) return;
    updateTactic({ playerRoles: { ...tactic!.playerRoles, [playerId]: { ...role, duty } } }, -1);
  }

  function handleOutOfPossessionFormationChange(formation: string) {
    const newOutSlots = remapOutOfPossessionFormation(startingXI, tactic!.inPossession.formation, formation);
    updateTactic({ outOfPossession: { ...tactic!.outOfPossession, formation, slotAssignments: newOutSlots } }, -2);
  }

  function setCaptain(playerId: string) {
    mutateWorld((w) => { w.clubs[w.userClubId]!.captainId = playerId; });
  }

  function handleCreateTactic(styleId: TacticSetup["tacticalStyleId"], formation: string) {
    const { startingXI: freshXI } = pickAutoLineup(club!.squadIds, world!.players, formation);
    const fresh = buildTacticFromStyle(styleId, formation, freshXI, tactic!.name);
    mutateWorld((w) => {
      w.activeTactic = fresh;
      w.savedTactics = [...w.savedTactics, fresh];
    });
    setCreatingTactic(false);
    setTab("Formation");
  }

  const style = TACTICAL_STYLES[tactic.tacticalStyleId];
  const selectedPlayerId = selectedSlot !== null ? inAssignments[selectedSlot] : null;
  const selectedRole = selectedPlayerId ? tactic.playerRoles[selectedPlayerId] : null;

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Tactics</h1>
          <p className="text-xs text-ink-500">{style.label} · {tactic.mentality.replace(/-/g, " ")} · Familiarity {Math.round(tactic.familiarity)}/100</p>
        </div>
        <button
          onClick={() => setCreatingTactic(true)}
          className="rounded-card bg-gradient-to-r from-accent-500 to-accent-600 px-3 py-2 text-xs font-semibold text-navy-950"
        >
          Create Tactic
        </button>
      </div>

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
            <CardHeader title="In-possession shape" subtitle={`${tactic.inPossession.formation} — tap a slot to reassign or set role/duty`} />
            <div className="mx-auto max-w-sm">
              <FormationPitch
                coords={inCoords}
                slotPositions={inSlots}
                assignments={inAssignments}
                players={world.players}
                onSlotClick={(i) => setSelectedSlot(i)}
                selectedSlot={selectedSlot}
                roleLabels={roleLabels}
              />
            </div>

            {selectedSlot !== null && (
              <>
                <PlayerPicker
                  slotPosition={inSlots[selectedSlot]!}
                  candidateIds={club.squadIds}
                  currentId={inAssignments[selectedSlot] ?? null}
                  players={world.players}
                  onPick={(id) => handleAssign(selectedSlot, id)}
                  onClose={() => setSelectedSlot(null)}
                />
                {selectedPlayerId && selectedRole && (
                  <RoleDutyPicker
                    slot={inSlots[selectedSlot]!}
                    roleCode={selectedRole.roleCode}
                    duty={selectedRole.duty}
                    onRoleChange={(r) => handleRoleChange(selectedPlayerId, r)}
                    onDutyChange={(d) => handleDutyChange(selectedPlayerId, d)}
                  />
                )}
              </>
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

          <SquadRoleList club={club} players={world.players} slots={inSlots} assignments={inAssignments} roleLabels={roleLabels} />
        </div>
      )}

      {tab === "In Possession" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Mentality" />
            <div className="flex flex-wrap gap-1.5">
              {MENTALITIES.map((m) => (
                <button
                  key={m}
                  onClick={() => updateTactic({ mentality: m })}
                  className={`rounded-card px-2.5 py-1.5 text-xs capitalize ${
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
            <CardHeader title="Build-up" />
            <div className="flex flex-col gap-3">
            <Segmented
  label="Tempo"
  value={tactic.inPossession.instructions.tempo}
  options={["slow", "normal", "fast"] as TempoLevel[]}
  onChange={(v) =>
    updateTactic({
      inPossession: {
        ...tactic.inPossession,
        instructions: {
          ...tactic.inPossession.instructions,
          tempo: v,
        },
      },
    })
  }
/>
              <Segmented label="Passing directness" value={tactic.inPossession.instructions.passingDirectness}
                options={["short", "mixed", "direct", "long"] as PassingDirectness[]}
                onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, passingDirectness: v } } })} />
              <Segmented label="Width" value={tactic.inPossession.instructions.width}
                options={["narrow", "balanced", "wide"] as WidthLevel[]}
                onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, width: v } } })} />
              <Segmented label="Play through" value={tactic.inPossession.instructions.playThroughBias}
                options={["left", "centre", "balanced", "right"] as PlayThroughBias[]}
                onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, playThroughBias: v } } })} />
              <Segmented label="Creative freedom" value={tactic.inPossession.instructions.creativeFreedom}
                options={["disciplined", "balanced", "expressive"] as CreativeFreedomLevel[]}
                onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, creativeFreedom: v } } })} />
              <ToggleRow label="Build up from the back" value={tactic.inPossession.instructions.buildUpFromBack}
                onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, buildUpFromBack: v } } })} />
            </div>
          </Card>
        </div>
      )}

      {tab === "Out of Possession" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Out-of-possession shape"
              subtitle="The block your team morphs into without the ball"
              right={
                <select
                  value={tactic.outOfPossession.formation}
                  onChange={(e) => handleOutOfPossessionFormationChange(e.target.value)}
                  className="rounded-card border border-navy-600 bg-navy-800 px-2 py-1 text-sm text-ink-100"
                >
                  {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              }
            />
            <div className="mx-auto max-w-sm">
              <FormationPitch
                coords={outCoords}
                slotPositions={outSlots}
                assignments={outAssignments}
                players={world.players}
                onSlotClick={() => {}}
                selectedSlot={null}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Why two shapes?" />
            <p className="text-xs leading-relaxed text-ink-400">
              Your team plays {tactic.inPossession.formation} on the ball and drops into {tactic.outOfPossession.formation} without it.
              The match engine and live pitch view morph between the two automatically as possession changes.
            </p>
          </Card>
        </div>
      )}

      {tab === "Attack" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Final third" />
            <div className="flex flex-col gap-3">
              <Segmented label="Crossing" value={tactic.attack.finalThirdCrossing}
                options={["early-crosses", "look-for-overlap"] as const}
                labels={{ "early-crosses": "Early crosses", "look-for-overlap": "Look for overlap" }}
                onChange={(v) => updateTactic({ attack: { ...tactic.attack, finalThirdCrossing: v } })} />
              <Segmented label="Shooting" value={tactic.attack.finalThirdShooting}
                options={["shoot-on-sight", "work-into-box"] as const}
                labels={{ "shoot-on-sight": "Shoot on sight", "work-into-box": "Work into box" }}
                onChange={(v) => updateTactic({ attack: { ...tactic.attack, finalThirdShooting: v } })} />
              <Segmented label="Running" value={tactic.attack.finalThirdRunning}
                options={["run-at-defence", "through-balls"] as const}
                labels={{ "run-at-defence": "Run at defence", "through-balls": "Through balls" }}
                onChange={(v) => updateTactic({ attack: { ...tactic.attack, finalThirdRunning: v } })} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Passing & distribution" />
            <div className="flex flex-col gap-3">
              <Segmented label="Passing focus" value={tactic.attack.passingFocus}
                options={["left", "centre", "right", "both-flanks", "mixed"] as PassingFocus[]}
                onChange={(v) => updateTactic({ attack: { ...tactic.attack, passingFocus: v } })} />
              <Segmented label="Goalkeeper distribution" value={tactic.attack.goalkeeperDistribution}
                options={["short", "mixed", "long"] as GkDistribution[]}
                onChange={(v) => updateTactic({ attack: { ...tactic.attack, goalkeeperDistribution: v } })} />
            </div>
          </Card>
        </div>
      )}

      {tab === "Transition" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="When we win the ball" />
            <div className="flex flex-col gap-3">
              <Segmented label="Counter-press intensity" value={tactic.transition.counterPressIntensity}
                options={["cautious", "normal", "committed"] as TacklingLevel[]}
                onChange={(v) => updateTactic({ transition: { ...tactic.transition, counterPressIntensity: v } })} />
              <Segmented label="Counter-attack speed" value={tactic.transition.counterAttackSpeed}
                options={["hold-shape", "counter", "fast-break"] as CounterAttackSpeed[]}
                labels={{ "hold-shape": "Hold shape", counter: "Counter", "fast-break": "Fast break" }}
                onChange={(v) => updateTactic({ transition: { ...tactic.transition, counterAttackSpeed: v } })} />
              <Segmented label="Transition directness" value={tactic.transition.transitionDirectness}
                options={["short", "mixed", "direct", "long"] as PassingDirectness[]}
                onChange={(v) => updateTactic({ transition: { ...tactic.transition, transitionDirectness: v } })} />
            </div>
          </Card>
          <div />
        </div>
      )}

      {tab === "Defence" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Defensive shape" />
            <div className="flex flex-col gap-3">
              <Segmented label="Defensive line" value={tactic.outOfPossession.instructions.defensiveLine}
                options={["deep", "balanced", "high"] as DefensiveLineLevel[]}
                onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, defensiveLine: v } } })} />
              <Segmented label="Closing down" value={tactic.outOfPossession.instructions.closingDown}
                options={["sit-back", "own-half", "all-over"] as ClosingDownLevel[]}
                labels={{ "sit-back": "Sit back", "own-half": "Own half", "all-over": "All over" }}
                onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, closingDown: v } } })} />
              <Segmented label="Tackling" value={tactic.outOfPossession.instructions.tackling}
                options={["cautious", "normal", "committed"] as TacklingLevel[]}
                onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, tackling: v } } })} />
              <Segmented label="Marking" value={tactic.outOfPossession.instructions.marking}
                options={["zonal", "man"] as const}
                onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, marking: v } } })} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Discipline" />
            <div className="flex flex-col gap-3">
              <ToggleRow label="Offside trap" value={tactic.outOfPossession.instructions.offsideTrap}
                onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, offsideTrap: v } } })} />
              <ToggleRow label="Time wasting" value={tactic.outOfPossession.instructions.timeWasting}
                onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, timeWasting: v } } })} />
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

      {creatingTactic && (
        <CreateTacticModal currentFormation={tactic.inPossession.formation} onConfirm={handleCreateTactic} onClose={() => setCreatingTactic(false)} />
      )}
    </div>
  );
}

// ---- Formation tab helpers ---------------------------------------------------

function SquadRoleList({
  club, players, slots, assignments, roleLabels,
}: {
  club: NonNullable<ReturnType<typeof useGameStore.getState>["world"]>["clubs"][string];
  players: Record<ID, Player>; slots: PositionCode[]; assignments: (string | null)[]; roleLabels: (string | undefined)[];
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
              <span className="font-data text-xs text-ink-500">{roleLabels[i] ?? slotPos}</span>
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

function RoleDutyPicker({
  slot, roleCode, duty, onRoleChange, onDutyChange,
}: { slot: PositionCode; roleCode: RoleCode; duty: RoleDuty; onRoleChange: (r: RoleCode) => void; onDutyChange: (d: RoleDuty) => void }) {
  const options = rolesForSlot(slot);
  const currentDuties = ROLE_CATALOG[roleCode].duties;
  return (
    <div className="mt-3 rounded-card border border-navy-600 bg-navy-800 p-3">
      <p className="mb-1.5 text-xs text-ink-500">Role</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map((r) => (
          <button
            key={r.code}
            onClick={() => onRoleChange(r.code)}
            title={r.description}
            className={`rounded-card px-2.5 py-1.5 text-xs ${
              roleCode === r.code ? "bg-accent-500 font-semibold text-navy-950" : "bg-navy-700 text-ink-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-xs text-ink-500">Duty</p>
      <div className="flex flex-wrap gap-1.5">
        {currentDuties.map((d) => (
          <button
            key={d}
            onClick={() => onDutyChange(d)}
            className={`rounded-card px-2.5 py-1.5 text-xs capitalize ${
              duty === d ? "bg-pulse-500 font-semibold text-navy-950" : "bg-navy-700 text-ink-300"
            }`}
          >
            {d}
          </button>
        ))}
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

// ---- Set pieces ---------------------------------------------------------------

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

// ---- Discrete controls (never raw sliders) -------------------------------------

function Segmented<T extends string>({
  label, value, options, labels, onChange,
}: { label: string; value: T; options: readonly T[]; labels?: Partial<Record<T, string>>; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-ink-300">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-card px-2.5 py-1.5 text-xs capitalize ${
              value === opt ? "bg-accent-500 font-semibold text-navy-950" : "bg-navy-800 text-ink-300"
            }`}
          >
            {labels?.[opt] ?? opt.replace(/-/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-300">{label}</span>
      <div className="flex gap-1.5">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            className={`rounded-card px-2.5 py-1.5 text-xs ${
              value === v ? "bg-accent-500 font-semibold text-navy-950" : "bg-navy-800 text-ink-300"
            }`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Create Tactic modal -------------------------------------------------------

function CreateTacticModal({
  currentFormation, onConfirm, onClose,
}: { currentFormation: string; onConfirm: (styleId: TacticSetup["tacticalStyleId"], formation: string) => void; onClose: () => void }) {
  const [category, setCategory] = useState<"3-at-back" | "4-at-back" | "5-at-back">(FORMATION_CATEGORY[currentFormation] ?? "4-at-back");
  const [formation, setFormation] = useState(currentFormation);
  const [styleId, setStyleId] = useState<TacticSetup["tacticalStyleId"]>("clean-slate");

  const formationsInCategory = FORMATIONS.filter((f) => FORMATION_CATEGORY[f] === category);
  const style = TACTICAL_STYLES[styleId];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-navy-900 sm:rounded-card">
        <div className="flex items-center justify-between border-b border-navy-700 px-4 py-3">
          <p className="font-display text-lg text-ink-100">Create Tactic</p>
          <button onClick={onClose} className="text-ink-500"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-1.5 text-xs font-medium text-ink-500">Formation</p>
          <div className="mb-2 flex gap-1 rounded-card border border-navy-600 bg-navy-800 p-1">
            {(["3-at-back", "4-at-back", "5-at-back"] as const).map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); const first = FORMATIONS.find((f) => FORMATION_CATEGORY[f] === c); if (first) setFormation(first); }}
                className={`flex-1 rounded-card px-2 py-1.5 text-xs capitalize ${category === c ? "bg-accent-500 font-semibold text-navy-950" : "text-ink-400"}`}
              >
                {c.replace("-at-back", " at the back")}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-col gap-1">
            {formationsInCategory.map((f) => (
              <button
                key={f}
                onClick={() => setFormation(f)}
                className={`flex items-center justify-between rounded-card px-3 py-2 text-sm ${
                  formation === f ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"
                }`}
              >
                <span>{f}</span>
                {formation === f && <span className="text-xs">Selected</span>}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-xs font-medium text-ink-500">Tactical style</p>
          <div className="flex flex-col gap-1">
            {STYLE_ORDER.map((id) => {
              const s = TACTICAL_STYLES[id];
              return (
                <button
                  key={id}
                  onClick={() => setStyleId(id)}
                  className={`rounded-card px-3 py-2 text-left text-sm ${
                    styleId === id ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {s.label}
                    {s.proactiveness >= 2 && <Star size={11} className="text-warning-500" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-card border border-navy-700 p-2.5">
            <p className="text-xs text-ink-300">{style.description}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {style.bullets.map((b) => (
                <li key={b} className="flex gap-1.5 text-xs text-ink-500">
                  <span className="text-accent-400">›</span>{b}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-2 border-t border-navy-700 p-4">
          <button onClick={onClose} className="flex-1 rounded-card border border-navy-600 py-2.5 text-sm text-ink-300">Cancel</button>
          <button
            onClick={() => onConfirm(styleId, formation)}
            className="flex-1 rounded-card bg-gradient-to-r from-accent-500 to-accent-600 py-2.5 text-sm font-semibold text-navy-950"
          >
            Confirm Tactic
          </button>
        </div>
      </div>
    </div>
  );
}
