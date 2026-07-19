"use client";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatBar, Badge } from "@/components/ui/Badge";

function formatMoney(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

export default function ClubPage() {
  const world = useGameStore((s) => s.world);
  if (!world) return <p className="px-4 py-6 text-sm text-ink-500">No save loaded.</p>;

  const club = world.clubs[world.userClubId];
  if (!club) return null;

  return (
    <div className="flex flex-col gap-3 py-3">
      <h1 className="font-display text-2xl text-ink-100">Club</h1>

      <Card>
        <CardHeader title="Finances" subtitle={`Balance: ${formatMoney(club.finance.balance)}`} />
        <div className="grid grid-cols-2 gap-2 text-sm text-ink-300">
          <p>Transfer budget: <span className="font-data text-accent-400">{formatMoney(club.finance.transferBudget)}</span></p>
          <p>Wage budget/wk: <span className="font-data text-accent-400">{formatMoney(club.finance.wageBudgetWeekly)}</span></p>
          <p>Used wages/wk: <span className="font-data">{formatMoney(club.finance.wageBudgetUsedWeekly)}</span></p>
          <p>Sponsorships: <span className="font-data">{club.finance.sponsorships.length}</span></p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Board &amp; fans" right={<Badge tone={club.fanSentiment.recentTrend === "falling" ? "rival" : "success"}>{club.fanSentiment.recentTrend}</Badge>} />
        <div className="flex flex-col gap-1.5">
          <StatBar label="Board confidence" value={club.boardConfidence} max={100} />
          <StatBar label="Fan sentiment" value={club.fanSentiment.overall} max={100} />
          <StatBar label="Ticket demand" value={club.fanSentiment.ticketDemand} max={100} />
          <StatBar label="Protest risk" value={club.fanSentiment.protestRisk} max={100} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Facilities" />
        <div className="flex flex-col gap-1.5">
          <StatBar label="Training" value={club.facilities.trainingFacilities} />
          <StatBar label="Youth" value={club.facilities.youthFacilities} />
          <StatBar label="Medical" value={club.facilities.medicalFacilities} />
          <StatBar label="Data analysis" value={club.facilities.dataAnalysis} />
          <StatBar label="Youth recruitment" value={club.facilities.youthRecruitment} />
          <StatBar label="Stadium" value={club.facilities.stadiumFacilities} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Club culture" subtitle={club.culture.playingPhilosophy} />
        <div className="flex flex-wrap gap-1.5">
          {club.culture.identityTags.length === 0 && <span className="text-sm text-ink-500">No distinct identity yet — this evolves with results and history.</span>}
          {club.culture.identityTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
        </div>
      </Card>

      <Card>
        <CardHeader title="Trophy cabinet" />
        {club.trophyCabinet.length === 0
          ? <p className="text-sm text-ink-500">Empty for now — go build a legacy.</p>
          : club.trophyCabinet.map((t, i) => (
              <p key={i} className="text-sm text-ink-300">{t.season} — {t.competitionName} ({t.result})</p>
            ))}
      </Card>
    </div>
  );
}
