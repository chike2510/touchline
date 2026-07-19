"use client";
import { useGameStore } from "@/state/gameStore";
import { formatMoneyPerWeek } from "@/lib/format";
import type { StaffRole } from "@/domain/types";

const ROLE_LABELS: Record<StaffRole, string> = {
  "assistant-manager": "Assistant Manager",
  "head-of-youth-development": "Head of Youth Development",
  "chief-scout": "Chief Scout",
  "head-physio": "Head Physio",
  "fitness-coach": "Fitness Coach",
  "goalkeeping-coach": "Goalkeeping Coach",
  "first-team-coach": "First-Team Coach",
  "data-analyst": "Data Analyst",
  "loan-manager": "Loan Manager",
};

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

export default function StaffPage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];
  if (!world || !club) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const staff = club.staffIds.map((id) => world.staff[id]).filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Staff</h1>

      <SectionCard title="Backroom Staff" subtitle={`${staff.length} on staff`}>
        {staff.length === 0 && <p className="text-sm text-ink-500">No staff hired yet.</p>}
        <div className="flex flex-col gap-2">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-card border border-navy-600 bg-navy-900 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink-100">{s.firstName} {s.lastName}</p>
                <p className="text-xs text-ink-500">{ROLE_LABELS[s.role]} · {s.nationality}</p>
              </div>
              <div className="text-right">
                <p className="font-data text-sm text-positive-500">{s.contract ? formatMoneyPerWeek(s.contract.wageWeekly) : "—"}</p>
                <p className="text-xs text-ink-500">{s.contract ? `Until ${s.contract.expiryDate.slice(0, 10)}` : "No contract"}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Hiring">
        <p className="text-sm text-ink-500">
          A staff market (browsing and hiring free-agent coaches/scouts) isn&apos;t simulated yet — the staff above were assigned at save creation.
        </p>
      </SectionCard>
    </div>
  );
}
