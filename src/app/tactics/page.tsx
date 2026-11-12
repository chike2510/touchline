"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormationPitch, caToOverall } from "@/components/tactics/FormationPitch";
import { LeveledSlider } from "@/components/tactics/LeveledSlider";
import { Info, Star, X, LayoutGrid, ListTree } from "lucide-react";
import { coordsForFormation } from "@/engines/tactics/positionCoords";
import {
  FORMATION_SLOTS, FORMATION_CATEGORY, buildTacticFromStyle, pickAutoLineup,
  remapOutOfPossessionFormation, reshapeTactic,
} from "@/engines/tactics/aiTactics";
import { ROLE_CATALOG, rolesForSlot } from "@/engines/tactics/roles";
import type { RoleDefinition } from "@/engines/tactics/roles";
import { TACTICAL_STYLES, STYLE_ORDER } from "@/engines/tactics/styles";
import type {
  ID, Player, PositionCode, RoleCode, RoleDuty, SetPieceRoutine, TacticSetup,
} from "@/domain/types";

const FORMATIONS = Object.keys(FORMATION_SLOTS);
const MENTALITIES: TacticSetup["mentality"][] = ["very-defensive", "defensive", "balanced", "attacking", "very-attacking"];
const TOP_TABS = ["Overview", "Player", "Set Pieces", "Penalties", "Captains", "Match Plans"] as const;
type TopTab = (typeof TOP_TABS)[number];
const DUTY_ABBR: Record<RoleDuty, string> = { defend: "De", support: "Su", attack: "At", automatic: "Au" };

function orderAssignments(slots: PositionCode[], slotAssignments: Record<ID, PositionCode>): (string | null)[] {
  const remaining = new Map(Object.entries(slotAssignments));
  return slots.map((slotPos) => {
    const match = [...remaining.entries()].find(([, s]) => s === slotPos);
    if (match) { remaining.delete(match[0]); return match[0]; }
    return null;
  });
}

// Plain-English bullet summaries for the left-column cards. These read off
// the same authentic discrete fields the sliders on the right edit — there's
// no separate "summary" data, just a different presentation of it. Wording
// is an approximation of the reference mockup's phrasing where our field set
// doesn't line up 1:1 (e.g. we don't model a distinct "overlap side" or "play
// for set pieces" flag).
function describeInPossession(t: TacticSetup): string[] {
  const out: string[] = [];
  const { passingDirectness, width, buildUpFromBack, playThroughBias } = t.inPossession.instructions;
  if (passingDirectness === "short") out.push("Shorter Passing");
  if (passingDirectness === "long") out.push("Longer Passing");
  if (passingDirectness === "direct") out.push("Direct Passing");
  if (t.attack.finalThirdRunning === "through-balls") out.push("Pass Into Space");
  if (t.attack.finalThirdRunning === "run-at-defence") out.push("Run At Defence");
  if (buildUpFromBack) out.push("Play Out Of Defence");
  if (t.attack.finalThirdShooting === "work-into-box") out.push("Work Ball Into Box");
  if (t.attack.finalThirdShooting === "shoot-on-sight") out.push("Shoot On Sight");
  if (playThroughBias !== "balanced") out.push(`Focus Play Down The ${playThroughBias[0]!.toUpperCase()}${playThroughBias.slice(1)}`);
  if (width === "wide") out.push("Work The Ball Wide");
  if (width === "narrow") out.push("Play Narrow");
  if (t.inPossession.instructions.tempo === "fast") out.push("Slightly Higher Tempo");
  if (t.inPossession.instructions.tempo === "slow") out.push("Slightly Lower Tempo");
  return out.length ? out : ["Balanced approach"];
}

function describeTransition(t: TacticSetup): string[] {
  const out: string[] = [];
  const { counterPressIntensity, counterAttackSpeed, transitionDirectness } = t.transition;
  out.push(counterAttackSpeed === "fast-break" ? "Fast Break" : counterAttackSpeed === "counter" ? "Counter" : "Hold Shape");
  if (counterPressIntensity === "committed") out.push("Counter-Press");
  if (transitionDirectness === "short") out.push("Take Short Kicks");
  if (transitionDirectness === "direct" || transitionDirectness === "long") out.push("Distribute Long");
  return out;
}

function describeOutOfPossession(t: TacticSetup): string[] {
  const out: string[] = [];
  const { defensiveLine, closingDown, tackling, offsideTrap, marking } = t.outOfPossession.instructions;
  if (defensiveLine === "high") out.push("Higher Defensive Line");
  if (defensiveLine === "deep") out.push("Deeper Defensive Line");
  if (closingDown === "all-over") out.push("High Press");
  if (closingDown === "sit-back") out.push("Sit Back");
  if (tackling === "committed") out.push("Much More Often");
  if (marking === "man") out.push("Man Marking");
  if (offsideTrap) out.push("Offside Trap");
  if (t.attack.goalkeeperDistribution !== "short") out.push("Prevent Short GK Distribution");
  return out.length ? out : ["Balanced shape"];
}

function fluidityLabel(t: TacticSetup): string {
  const cf = t.inPossession.instructions.creativeFreedom;
  return cf === "expressive" ? "Flexible" : cf === "disciplined" ? "Structured" : "Balanced";
}

function intensityScore(t: TacticSetup): number {
  const map3 = (v: string, low: string, mid: string) => (v === low ? 15 : v === mid ? 55 : 90);
  const closing = map3(t.outOfPossession.instructions.closingDown, "sit-back", "own-half");
  const tackling = map3(t.outOfPossession.instructions.tackling, "cautious", "normal");
  const press = map3(t.transition.counterPressIntensity, "cautious", "normal");
  return Math.round((closing + tackling + press) / 3);
}

export default function TacticsPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("Overview");
  const [creatingTactic, setCreatingTactic] = useState(false);
  const [changingFormation, setChangingFormation] = useState(false);
  const [pitchPhase, setPitchPhase] = useState<"in" | "out">("in");

  const club = world?.clubs[world.userClubId];
  const tactic = world?.activeTactic;

  const inSlots = tactic ? FORMATION_SLOTS[tactic.inPossession.formation] ?? FORMATION_SLOTS["4-3-3"]! : [];
  const inCoords = tactic ? coordsForFormation(tactic.inPossession.formation) : [];
  const inAssignments = useMemo(
    () => (tactic ? orderAssignments(inSlots, tactic.inPossession.slotAssignments) : []),
    [tactic, inSlots]
  );
  const roleLabels = useMemo(
    () => inAssignments.map((id) => {
      if (!id || !tactic) return undefined;
      const role = tactic.playerRoles[id];
      if (!role) return undefined;
      return `${ROLE_CATALOG[role.roleCode].shortLabel}-${DUTY_ABBR[role.duty]}`;
    }),
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

  function handleInPossessionFormationChange(formation: string) {
    const reshaped = reshapeTactic(tactic!, formation, startingXI);
    updateTactic({
      inPossession: reshaped.inPossession,
      outOfPossession: reshaped.outOfPossession,
      playerRoles: reshaped.playerRoles,
    }, -30);
    setChangingFormation(false);
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
    setTopTab("Overview");
  }

  const style = TACTICAL_STYLES[tactic.tacticalStyleId];
  const selectedPlayerId = selectedSlot !== null ? inAssignments[selectedSlot] : null;
  const selectedRole = selectedPlayerId ? tactic.playerRoles[selectedPlayerId] : null;
  const intensity = intensityScore(tactic);

  return (
    <div className="tactics-page-layout flex flex-col gap-3 py-3">
      <div className="flex gap-1 overflow-x-auto border-b border-navy-700">
        {TOP_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={`shrink-0 px-3 py-2 text-sm transition-colors duration-150 ${
              topTab === t ? "border-b-2 border-accent-500 font-medium text-ink-100" : "text-ink-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {topTab === "Overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_1fr_300px]">
          {/* Left column */}
          <div className="flex flex-col gap-3">
            <button onClick={() => setCreatingTactic(true)} className="rounded-card border border-navy-600 bg-navy-900 p-3 text-left hover:bg-navy-800">
              <p className="text-[11px] uppercase tracking-wide text-ink-500">Tactical Style</p>
              <p className="font-medium text-ink-100">{style.label}</p>
            </button>

            <div className="rounded-card border border-navy-600 bg-navy-900 p-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-500">Mentality</p>
              <div className="flex flex-wrap gap-1">
                {MENTALITIES.map((m) => (
                  <button
                    key={m}
                    onClick={() => updateTactic({ mentality: m })}
                    className={`rounded-card px-2 py-1 text-[11px] capitalize ${tactic.mentality === m ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}
                  >
                    {m.replace(/-/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <BulletCard title="In Possession" bullets={describeInPossession(tactic)} />
            <BulletCard title="In Transition" bullets={describeTransition(tactic)} />
            <BulletCard title="Out Of Possession" bullets={describeOutOfPossession(tactic)} />
          </div>

          {/* Center column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-card border border-navy-600 bg-navy-900 px-3 py-2">
              <button onClick={() => setChangingFormation(true)} className="text-left">
                <p className="text-[11px] uppercase tracking-wide text-ink-500">Formation</p>
                <p className="text-sm font-semibold text-ink-100">
                  {tactic.inPossession.formation} <span className="text-ink-500">IN POSSESSION</span>
                </p>
              </button>
              <div className="flex gap-4">
                <MiniBar label="Familiarity" value={tactic.familiarity} />
                <MiniBar label="Intensity" value={intensity} tone="danger" />
              </div>
            </div>

            <div className="relative rounded-card border border-navy-600 bg-navy-900 p-3">
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
                <button
                  onClick={() => setPitchPhase((p) => (p === "in" ? "out" : "in"))}
                  title="Toggle in/out of possession shape"
                  className={`rounded-card p-1.5 ${pitchPhase === "in" ? "bg-accent-500 text-white" : "bg-navy-800 text-ink-400"}`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button title="Squad list view" className="rounded-card bg-navy-800 p-1.5 text-ink-400">
                  <ListTree size={14} />
                </button>
              </div>

              <div className="mx-auto max-w-sm">
                {pitchPhase === "in" ? (
                  <FormationPitch
                    coords={inCoords} slotPositions={inSlots} assignments={inAssignments}
                    players={world.players} onSlotClick={(i) => setSelectedSlot(i)} selectedSlot={selectedSlot}
                    roleLabels={roleLabels}
                  />
                ) : (
                  <FormationPitch
                    coords={outCoords} slotPositions={outSlots} assignments={outAssignments}
                    players={world.players} onSlotClick={() => {}} selectedSlot={null}
                  />
                )}
              </div>

              <div className="mt-2 inline-flex items-center gap-1.5 rounded-card bg-navy-800 px-2.5 py-1 text-xs text-ink-300">
                <span className="h-2 w-2 rounded-full bg-accent-400" /> Team Fluidity: {fluidityLabel(tactic)}
              </div>

              {selectedSlot !== null && pitchPhase === "in" && (
                <>
                  <PlayerPicker
                    slotPosition={inSlots[selectedSlot]!} candidateIds={club.squadIds}
                    currentId={inAssignments[selectedSlot] ?? null} players={world.players}
                    onPick={(id) => handleAssign(selectedSlot, id)} onClose={() => setSelectedSlot(null)}
                  />
                  {selectedPlayerId && selectedRole && (
                    <RoleDutyPicker
                      slot={inSlots[selectedSlot]!} roleCode={selectedRole.roleCode} duty={selectedRole.duty}
                      onRoleChange={(r) => handleRoleChange(selectedPlayerId, r)}
                      onDutyChange={(d) => handleDutyChange(selectedPlayerId, d)}
                    />
                  )}
                </>
              )}
            </div>

            <div className="rounded-card border border-navy-600 bg-navy-900 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-500">Substitutes ({bench.length})</p>
              <div className="flex flex-wrap gap-2">
                {bench.map((id) => {
                  const p = world.players[id];
                  if (!p) return null;
                  return (
                    <div key={id} className="flex flex-col items-center gap-0.5 rounded-card bg-navy-800 px-2 py-1.5 text-center">
                      <span className="font-data text-xs font-bold text-ink-100">{p.positions[0]}</span>
                      <span className="max-w-[64px] truncate text-[11px] text-ink-300">{p.lastName}</span>
                      <span className="text-[10px] text-positive-500">{100 - p.fatigue}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: sliders */}
          <div className="flex flex-col gap-3">
            <div className="rounded-card border border-positive-500/30 bg-navy-900 p-3">
              <p className="mb-2 rounded-card bg-positive-500/15 px-2 py-1 text-center text-xs font-bold uppercase tracking-wide text-positive-500">
                In Possession
              </p>
              <div className="flex flex-col gap-3">
                <LeveledSlider label="Attacking Width" value={tactic.inPossession.instructions.width}
                  levels={["narrow", "balanced", "wide"] as const}
                  onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, width: v } } })} />
                <LeveledSlider label="Approach Play" value={tactic.attack.finalThirdRunning}
                  levels={["run-at-defence", "through-balls"] as const}
                  labels={{ "run-at-defence": "Run at defence", "through-balls": "Pass into space" }}
                  onChange={(v) => updateTactic({ attack: { ...tactic.attack, finalThirdRunning: v } })} />
                <PairToggle label="Crossing" value={tactic.attack.finalThirdCrossing}
                  a="early-crosses" b="look-for-overlap" aLabel="Early Crosses" bLabel="Look For Overlap"
                  onChange={(v) => updateTactic({ attack: { ...tactic.attack, finalThirdCrossing: v } })} />
                <PairToggle label="Shooting" value={tactic.attack.finalThirdShooting}
                  a="work-into-box" b="shoot-on-sight" aLabel="Work Into Box" bLabel="Shoot On Sight"
                  onChange={(v) => updateTactic({ attack: { ...tactic.attack, finalThirdShooting: v } })} />
                <LeveledSlider label="Passing Directness" value={tactic.inPossession.instructions.passingDirectness}
                  levels={["short", "mixed", "direct", "long"] as const}
                  onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, passingDirectness: v } } })} />
                <LeveledSlider label="Tempo" value={tactic.inPossession.instructions.tempo}
                  levels={["slow", "normal", "fast"] as const}
                  onChange={(v) => updateTactic({ inPossession: { ...tactic.inPossession, instructions: { ...tactic.inPossession.instructions, tempo: v } } })} />
                <ToggleRow label="Time Wasting" value={tactic.outOfPossession.instructions.timeWasting}
                  onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, timeWasting: v } } })} />
              </div>
            </div>

            <div className="rounded-card border border-accent-500/30 bg-navy-900 p-3">
              <p className="mb-2 rounded-card bg-accent-500/15 px-2 py-1 text-center text-xs font-bold uppercase tracking-wide text-accent-400">
                Out Of Possession
              </p>
              <div className="flex flex-col gap-3">
                <LeveledSlider label="Defensive Line" value={tactic.outOfPossession.instructions.defensiveLine}
                  levels={["deep", "balanced", "high"] as const}
                  onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, defensiveLine: v } } })} />
                <LeveledSlider label="Defensive Width" value={tactic.outOfPossession.instructions.defensiveWidth}
                  levels={["narrow", "balanced", "wide"] as const}
                  onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, defensiveWidth: v } } })} />
                <LeveledSlider label="Pressing" value={tactic.outOfPossession.instructions.closingDown}
                  levels={["sit-back", "own-half", "all-over"] as const}
                  labels={{ "sit-back": "Rarely", "own-half": "Sometimes", "all-over": "Much More Often" }}
                  onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, closingDown: v } } })} />
                <LeveledSlider label="Trigger Press" value={tactic.transition.counterPressIntensity}
                  levels={["cautious", "normal", "committed"] as const}
                  labels={{ cautious: "Rarely", normal: "Sometimes", committed: "Much More Often" }}
                  onChange={(v) => updateTactic({ transition: { ...tactic.transition, counterPressIntensity: v } })} />
                <LeveledSlider label="Tackling" value={tactic.outOfPossession.instructions.tackling}
                  levels={["cautious", "normal", "committed"] as const}
                  labels={{ cautious: "Stay on feet", normal: "Normal", committed: "Get stuck in" }}
                  onChange={(v) => updateTactic({ outOfPossession: { ...tactic.outOfPossession, instructions: { ...tactic.outOfPossession.instructions, tackling: v } } })} />
                <ToggleRow label="Prevent Short GK Distribution" value={tactic.attack.goalkeeperDistribution !== "short"}
                  onChange={(v) => updateTactic({ attack: { ...tactic.attack, goalkeeperDistribution: v ? "mixed" : "short" } })} />
              </div>
            </div>
          </div>
        </div>
      )}

      {topTab === "Player" && (
        <Card>
          <CardHeader title="Player Instructions" subtitle="Tap a slot on the pitch to change that player's role and duty" />
          <div className="mx-auto max-w-sm">
            <FormationPitch
              coords={inCoords} slotPositions={inSlots} assignments={inAssignments}
              players={world.players} onSlotClick={(i) => setSelectedSlot(i)} selectedSlot={selectedSlot}
              roleLabels={roleLabels}
            />
          </div>
          {selectedSlot !== null && selectedPlayerId && selectedRole && (
            <RoleDutyPicker
              slot={inSlots[selectedSlot]!} roleCode={selectedRole.roleCode} duty={selectedRole.duty}
              onRoleChange={(r) => handleRoleChange(selectedPlayerId, r)}
              onDutyChange={(d) => handleDutyChange(selectedPlayerId, d)}
            />
          )}
        </Card>
      )}

      {topTab === "Set Pieces" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SetPieceCard
            title="Corners" routine={tactic.setPieces.cornersAttacking} startingXI={startingXI} players={world.players}
            routineOptions={["near-post", "far-post", "short-corner"]}
            onChange={(patch) => updateSetPieces({ cornersAttacking: { ...tactic.setPieces.cornersAttacking, ...patch } })}
          />
          <SetPieceCard
            title="Free kicks" routine={tactic.setPieces.freeKicksAttacking} startingXI={startingXI} players={world.players}
            routineOptions={["direct-shot", "edge-of-box", "far-post"]}
            onChange={(patch) => updateSetPieces({ freeKicksAttacking: { ...tactic.setPieces.freeKicksAttacking, ...patch } })}
          />
          <Card>
            <CardHeader title="Defending corners" />
            <div className="flex gap-1.5">
              {(["zonal", "man-marking", "mixed"] as const).map((m) => (
                <button key={m} onClick={() => updateSetPieces({ cornersDefending: m })}
                  className={`rounded-card px-2.5 py-1.5 text-xs capitalize ${tactic.setPieces.cornersDefending === m ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}>
                  {m.replace("-", " ")}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {topTab === "Penalties" && (
        <Card>
          <CardHeader title="Penalty takers" subtitle="Ranked by composure and finishing" />
          <div className="flex flex-col gap-1">
            {startingXI
              .map((id) => world.players[id])
              .filter((p): p is Player => !!p)
              .sort((a, b) => (b.attributes.mental.composure + b.attributes.technical.finishing) - (a.attributes.mental.composure + a.attributes.technical.finishing))
              .map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-card bg-navy-800 px-3 py-2 text-sm">
                  <span className="text-ink-200">{i + 1}. {p.firstName} {p.lastName}</span>
                  <span className="font-data text-xs text-ink-500">Composure {p.attributes.mental.composure} · Finishing {p.attributes.technical.finishing}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {topTab === "Captains" && (
        <Card>
          <CardHeader title="Captain" subtitle="Pick your on-pitch leader" />
          <div className="flex flex-col gap-1">
            {[...club.squadIds]
              .map((id) => world.players[id])
              .filter((p): p is Player => !!p)
              .sort((a, b) => b.attributes.mental.leadership - a.attributes.mental.leadership)
              .map((p) => (
                <button key={p.id} onClick={() => setCaptain(p.id)}
                  className={`flex items-center justify-between rounded-card px-3 py-2 text-left text-sm ${club.captainId === p.id ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"}`}>
                  <span>{p.firstName} {p.lastName} {club.captainId === p.id && <span className="ml-1 text-xs">(C)</span>}</span>
                  <span className="font-data text-xs text-ink-500">Leadership {p.attributes.mental.leadership}</span>
                </button>
              ))}
          </div>
        </Card>
      )}

      {topTab === "Match Plans" && (
        <Card>
          <CardHeader title="Match Plans" />
          <p className="text-sm text-ink-500">
            Conditional plans (e.g. auto-switching mentality when winning/drawing/losing) aren&apos;t simulated yet —
            for now, use the live mentality change from the Matchday tactics panel during a match.
          </p>
        </Card>
      )}

      {creatingTactic && (
        <CreateTacticModal currentFormation={tactic.inPossession.formation} onConfirm={handleCreateTactic} onClose={() => setCreatingTactic(false)} />
      )}
      {changingFormation && (
        <FormationPopover currentFormation={tactic.inPossession.formation} onPick={handleInPossessionFormationChange} onClose={() => setChangingFormation(false)} />
      )}
    </div>
  );
}

// ---- Small display helpers -----------------------------------------------------

function BulletCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="rounded-card border border-navy-600 bg-navy-900 p-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-500">{title}</p>
      <ul className="flex flex-col gap-1">
        {bullets.map((b) => <li key={b} className="text-sm text-ink-200">{b}</li>)}
      </ul>
    </div>
  );
}

function MiniBar({ label, value, tone = "positive" }: { label: string; value: number; tone?: "positive" | "danger" }) {
  return (
    <div className="w-20">
      <p className="text-[10px] text-ink-500">{label}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
        <div className={`h-full rounded-full ${tone === "positive" ? "bg-positive-500" : "bg-accent-500"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PairToggle<T extends string>({
  label, value, a, b, aLabel, bLabel, onChange,
}: { label: string; value: T; a: T; b: T; aLabel: string; bLabel: string; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <div className="flex overflow-hidden rounded-card border border-navy-600">
        <button onClick={() => onChange(a)} className={`flex-1 px-2 py-1.5 text-xs ${value === a ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}>{aLabel}</button>
        <button onClick={() => onChange(b)} className={`flex-1 px-2 py-1.5 text-xs ${value === b ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}>{bLabel}</button>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
      <div className="flex gap-1.5">
        {[false, true].map((v) => (
          <button key={String(v)} onClick={() => onChange(v)}
            className={`rounded-card px-2.5 py-1 text-xs ${value === v ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoleDutyPicker({
  slot, roleCode, duty, onRoleChange, onDutyChange,
}: { slot: PositionCode; roleCode: RoleCode; duty: RoleDuty; onRoleChange: (r: RoleCode) => void; onDutyChange: (d: RoleDuty) => void }) {
  const options: RoleDefinition[] = rolesForSlot(slot);
  const currentDuties = ROLE_CATALOG[roleCode].duties;
  return (
    <div className="mt-3 rounded-card border border-navy-600 bg-navy-800 p-3">
      <p className="mb-1.5 text-xs text-ink-500">Role</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map((r) => (
          <button key={r.code} onClick={() => onRoleChange(r.code)} title={r.description}
            className={`rounded-card px-2.5 py-1.5 text-xs ${roleCode === r.code ? "bg-accent-500 font-semibold text-white" : "bg-navy-700 text-ink-300"}`}>
            {r.label}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-xs text-ink-500">Duty</p>
      <div className="flex flex-wrap gap-1.5">
        {currentDuties.map((d) => (
          <button key={d} onClick={() => onDutyChange(d)}
            className={`rounded-card px-2.5 py-1.5 text-xs capitalize ${duty === d ? "bg-pulse-500 font-semibold text-navy-950" : "bg-navy-700 text-ink-300"}`}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerPicker({
  slotPosition, candidateIds, currentId, players, onPick, onClose,
}: { slotPosition: PositionCode; candidateIds: ID[]; currentId: ID | null; players: Record<ID, Player>; onPick: (id: ID) => void; onClose: () => void }) {
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
          <div key={p.id} className={`flex items-center justify-between rounded-card px-2 py-1.5 text-sm ${p.id === currentId ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-700"}`}>
            <button onClick={() => onPick(p.id)} className="flex flex-1 items-center justify-between text-left">
              <span className="truncate">
                {p.firstName} {p.lastName}
                {!p.positions.includes(slotPosition) && <span className="ml-1 text-xs text-warning-500">(out of position)</span>}
              </span>
              <span className="ml-2 font-data text-ink-500">{caToOverall(p.currentAbility)}</span>
            </button>
            <button onClick={() => openPlayerProfile(p.id)} className="ml-2 shrink-0 rounded-full p-1 text-ink-500 hover:text-accent-400" title="View full attributes">
              <Info size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetPieceCard({
  title, routine, startingXI, players, routineOptions, onChange,
}: { title: string; routine: SetPieceRoutine; startingXI: ID[]; players: Record<ID, Player>; routineOptions: SetPieceRoutine["routine"][]; onChange: (patch: Partial<SetPieceRoutine>) => void }) {
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
          <select value={routine.designatedTakerId ?? ""} onChange={(e) => onChange({ designatedTakerId: e.target.value || null })}
            className="w-full rounded-card border border-navy-600 bg-navy-800 px-2 py-1.5 text-sm text-ink-100">
            <option value="">— none —</option>
            {xi.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-500">Routine</p>
          <div className="flex flex-wrap gap-1.5">
            {routineOptions.map((r) => (
              <button key={r} onClick={() => onChange({ routine: r })}
                className={`rounded-card px-2.5 py-1 text-xs capitalize ${routine.routine === r ? "bg-accent-500 font-semibold text-white" : "bg-navy-800 text-ink-300"}`}>
                {r.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-500">Aerial targets (up to 3)</p>
          <div className="flex flex-wrap gap-1.5">
            {xi.map((p) => (
              <button key={p.id} onClick={() => toggleTarget(p.id)}
                className={`rounded-card px-2 py-1 text-xs ${targets.has(p.id) ? "bg-accent-500/20 text-accent-400" : "bg-navy-800 text-ink-300"}`}>
                {p.lastName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FormationPopover({ currentFormation, onPick, onClose }: { currentFormation: string; onPick: (f: string) => void; onClose: () => void }) {
  const [category, setCategory] = useState<"3-at-back" | "4-at-back" | "5-at-back">(FORMATION_CATEGORY[currentFormation] ?? "4-at-back");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card bg-navy-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg text-ink-100">Change formation</p>
          <button onClick={onClose}><X size={18} className="text-ink-500" /></button>
        </div>
        <div className="mb-2 flex gap-1 rounded-card border border-navy-600 bg-navy-800 p-1">
          {(["3-at-back", "4-at-back", "5-at-back"] as const).map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`flex-1 rounded-card px-2 py-1.5 text-xs capitalize ${category === c ? "bg-accent-500 font-semibold text-white" : "text-ink-400"}`}>
              {c.replace("-at-back", " at back")}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {FORMATIONS.filter((f) => FORMATION_CATEGORY[f] === category).map((f) => (
            <button key={f} onClick={() => onPick(f)} className={`rounded-card px-3 py-2 text-left text-sm ${f === currentFormation ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
              <button key={c} onClick={() => { setCategory(c); const first = FORMATIONS.find((f) => FORMATION_CATEGORY[f] === c); if (first) setFormation(first); }}
                className={`flex-1 rounded-card px-2 py-1.5 text-xs capitalize ${category === c ? "bg-accent-500 font-semibold text-white" : "text-ink-400"}`}>
                {c.replace("-at-back", " at the back")}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-col gap-1">
            {formationsInCategory.map((f) => (
              <button key={f} onClick={() => setFormation(f)}
                className={`flex items-center justify-between rounded-card px-3 py-2 text-sm ${formation === f ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"}`}>
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
                <button key={id} onClick={() => setStyleId(id)}
                  className={`rounded-card px-3 py-2 text-left text-sm ${styleId === id ? "bg-accent-500/20 text-accent-400" : "text-ink-200 hover:bg-navy-800"}`}>
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
              {style.bullets.map((b) => <li key={b} className="flex gap-1.5 text-xs text-ink-500"><span className="text-accent-400">›</span>{b}</li>)}
            </ul>
          </div>
        </div>
        <div className="flex gap-2 border-t border-navy-700 p-4">
          <button onClick={onClose} className="flex-1 rounded-card border border-navy-600 py-2.5 text-sm text-ink-300">Cancel</button>
          <button onClick={() => onConfirm(styleId, formation)} className="flex-1 rounded-card bg-gradient-to-r from-accent-500 to-accent-600 py-2.5 text-sm font-semibold text-white">
            Confirm Tactic
          </button>
        </div>
      </div>
    </div>
  );
}
