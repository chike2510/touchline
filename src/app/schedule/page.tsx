"use client";
import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";

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

export default function SchedulePage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];

  const upcomingDays = useMemo(() => {
    if (!world) return [];
    const start = new Date(world.currentDate);
    const days: { date: string; phase: string; fixtureLabel?: string; events: string[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const day = world.calendar[iso];
      if (!day) continue;
      const fixture = day.fixtureId ? world.fixtures[day.fixtureId] : undefined;
      const fixtureLabel = fixture
        ? `${world.clubs[fixture.homeClubId]?.shortName ?? "?"} vs ${world.clubs[fixture.awayClubId]?.shortName ?? "?"}`
        : undefined;
      days.push({ date: iso, phase: day.phase, fixtureLabel, events: day.scheduledEvents.map((e) => e.description) });
    }
    return days;
  }, [world]);

  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Schedule</h1>

      <SectionCard title="Next 14 Days">
        <div className="flex flex-col gap-1.5">
          {upcomingDays.map((d) => (
            <div key={d.date} className="flex items-start justify-between gap-3 rounded-card border border-navy-600 bg-navy-900 px-3 py-2 text-sm">
              <div>
                <p className="text-ink-100">{new Date(d.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                {d.fixtureLabel && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-accent-400">
                    <ClubCrest clubId={club.id} abbreviation={club.abbreviation} color={club.colors.primary} size={14} />
                    {d.fixtureLabel}
                  </p>
                )}
                {d.events.map((e, i) => <p key={i} className="text-xs text-ink-500">{e}</p>)}
              </div>
              <span className="shrink-0 rounded-card bg-navy-800 px-2 py-1 text-[11px] capitalize text-ink-400">{d.phase.replace(/-/g, " ")}</span>
            </div>
          ))}
          {upcomingDays.length === 0 && <p className="text-sm text-ink-500">Nothing scheduled yet.</p>}
        </div>
      </SectionCard>
    </div>
  );
}
