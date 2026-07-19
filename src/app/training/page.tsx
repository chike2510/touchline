"use client";
import { useGameStore } from "@/state/gameStore";
import { StatBar } from "@/components/ui/Badge";

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel flex flex-col gap-2 rounded-card p-4">
      <div>
        <p className="text-sm font-bold text-ink-100">{title}</p>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function TrainingPage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];
  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const squad = club.squadIds.map((id) => world.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const avgFatigue = squad.length ? squad.reduce((a, p) => a + p.fatigue, 0) / squad.length : 0;
  const avgSharpness = squad.length ? squad.reduce((a, p) => a + p.sharpness, 0) / squad.length : 0;

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Training</h1>

      <SectionCard title="Squad Condition" subtitle="Real, live squad averages">
        <StatBar label="Condition" value={100 - avgFatigue} max={100} />
        <StatBar label="Sharpness" value={avgSharpness} max={100} />
        <StatBar label="Training facilities" value={club.facilities.trainingFacilities} />
      </SectionCard>

      <SectionCard title="Weekly Schedule">
        <p className="text-sm text-ink-500">
          A full training engine (weekly focus, intensity, individual drills, and their effect on attribute growth
          and injury risk) isn&apos;t built yet — training doesn&apos;t currently change player development. Squad
          fatigue and sharpness above are real and update from matches, but not from a training schedule.
        </p>
      </SectionCard>
    </div>
  );
}
