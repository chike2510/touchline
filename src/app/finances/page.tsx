"use client";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";

function money(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

export default function FinancesPage() {
  const world = useGameStore((s) => s.world);
  const club = world?.clubs[world.userClubId];

  if (!world || !club) return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;
  const f = club.finance;
  const wagePct = f.wageBudgetWeekly > 0 ? Math.round((f.wageBudgetUsedWeekly / f.wageBudgetWeekly) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 py-3">
      <h1 className="font-display text-2xl text-ink-100">Finances</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader title="Balance" />
          <p className={`text-2xl font-semibold ${f.balance < 0 ? "text-danger-500" : "text-ink-100"}`}>{money(f.balance)}</p>
        </Card>
        <Card>
          <CardHeader title="Transfer budget" />
          <p className="text-2xl font-semibold text-ink-100">{money(f.transferBudget)}</p>
        </Card>
        <Card>
          <CardHeader title="Wage budget" subtitle={`${wagePct}% used`} />
          <p className="text-2xl font-semibold text-ink-100">{money(f.wageBudgetUsedWeekly)} <span className="text-sm font-normal text-ink-500">/ {money(f.wageBudgetWeekly)} wk</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-700">
            <div className={`h-full rounded-full ${wagePct > 90 ? "bg-danger-500" : "bg-accent-500"}`} style={{ width: `${Math.min(100, wagePct)}%` }} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Income" subtitle="Seasonal" />
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Row label="Broadcast" value={money(f.broadcastIncomeSeasonal)} />
          <Row label="Matchday" value={money(f.matchdayIncomeSeasonal)} />
          <Row label="Debt" value={money(f.debt)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sponsorships" />
        <div className="flex flex-col gap-2">
          {f.sponsorships.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-navy-600 pb-2 text-sm last:border-0 last:pb-0">
              <div>
                <p className="font-medium text-ink-100">{s.name}</p>
                <p className="text-xs text-ink-500">{s.type} • until {s.expiryDate}</p>
              </div>
              <span className="font-data font-semibold text-ink-100">{money(s.incomeWeekly)}/wk</span>
            </div>
          ))}
          {f.sponsorships.length === 0 && <p className="text-sm text-ink-500">No active sponsorships.</p>}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink-500">{label}</p>
      <p className="font-data font-semibold text-ink-100">{value}</p>
    </div>
  );
}
