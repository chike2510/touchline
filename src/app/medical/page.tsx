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

const SEVERITY_TONE: Record<string, string> = { minor: "text-warning-500", moderate: "text-accent-400", severe: "text-danger-500" };

export default function MedicalCentrePage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];
  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const squad = club.squadIds.map((id) => world.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const injured = squad.filter((p) => p.injuryStatus);
  const suspended = squad.filter((p) => p.suspension);
  const fittest = [...squad].sort((a, b) => (100 - a.fatigue) < (100 - b.fatigue) ? 1 : -1).slice(0, 5);

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Medical Centre</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SectionCard title="Injuries" subtitle={`${injured.length} unavailable`}>
          {injured.length === 0 && <p className="text-sm text-ink-500">Clean bill of health.</p>}
          <div className="flex flex-col gap-2">
            {injured.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-card border border-navy-600 bg-navy-900 px-3 py-2">
                <div>
                  <p className="text-sm text-ink-100">{p.firstName} {p.lastName}</p>
                  <p className={`text-xs capitalize ${SEVERITY_TONE[p.injuryStatus!.severity]}`}>{p.injuryStatus!.description}</p>
                </div>
                <span className="font-data text-xs text-ink-400">{p.injuryStatus!.daysRemaining}d</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Suspensions" subtitle={`${suspended.length} unavailable`}>
          {suspended.length === 0 && <p className="text-sm text-ink-500">No suspended players.</p>}
          <div className="flex flex-col gap-2">
            {suspended.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-card border border-navy-600 bg-navy-900 px-3 py-2">
                <p className="text-sm text-ink-100">{p.firstName} {p.lastName}</p>
                <span className="font-data text-xs text-warning-500">{p.suspension!.matchesRemaining} match{p.suspension!.matchesRemaining === 1 ? "" : "es"}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Squad Freshness" subtitle="Least fatigued players this week">
        <div className="flex flex-col gap-1.5">
          {fittest.map((p) => <StatBar key={p.id} label={`${p.firstName[0]}. ${p.lastName}`} value={100 - p.fatigue} max={100} />)}
        </div>
      </SectionCard>

      <SectionCard title="Medical Facilities">
        <StatBar label="Medical facilities" value={club.facilities.medicalFacilities} />
      </SectionCard>
    </div>
  );
}
