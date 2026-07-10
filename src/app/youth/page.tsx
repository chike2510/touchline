"use client";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { caToOverall } from "@/components/tactics/FormationPitch";

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function YouthAcademyPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const club = world?.clubs[world.userClubId];

  if (!world || !club) return <p className="py-6 text-sm text-ink-500">No save loaded.</p>;

  const youthPlayers = club.youthSquadIds.map((id) => world.players[id]).filter(Boolean);

  function promote(playerId: string) {
    mutateWorld((w) => {
      const c = w.clubs[w.userClubId]!;
      c.youthSquadIds = c.youthSquadIds.filter((id) => id !== playerId);
      c.squadIds.push(playerId);
      const p = w.players[playerId];
      if (p) p.isYouthProduct = true;
    });
  }

  return (
    <div className="flex flex-col gap-4 py-3">
      <h1 className="font-display text-2xl text-ink-100">Youth Academy</h1>

      <Card>
        <CardHeader title="Facilities" subtitle="Higher ratings mean bigger, better annual intakes" />
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Row label="Youth facilities" value={`${club.facilities.youthFacilities}/20`} />
          <Row label="Youth recruitment" value={`${club.facilities.youthRecruitment}/20`} />
          <Row label="Youth emphasis" value={`${club.culture.youthEmphasis}%`} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Youth squad" subtitle={`${youthPlayers.length} players`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-left text-xs text-ink-500">
                <th className="px-2 py-1.5">Pos</th>
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5 text-right">Age</th>
                <th className="px-2 py-1.5 text-right">CA</th>
                <th className="px-2 py-1.5 text-right">PA</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {youthPlayers.map((p) => p && (
                <tr key={p.id} className="border-b border-navy-600 last:border-0">
                  <td className="px-2 py-1.5 font-data text-ink-500">{p.positions[0]}</td>
                  <td className="px-2 py-1.5 font-medium text-ink-100">{p.firstName} {p.lastName}</td>
                  <td className="px-2 py-1.5 text-right font-data text-ink-300">{ageFromDob(p.dateOfBirth)}</td>
                  <td className="px-2 py-1.5 text-right font-data text-ink-100">{caToOverall(p.currentAbility)}</td>
                  <td className="px-2 py-1.5 text-right font-data text-accent-400">{caToOverall(p.potentialAbility)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => promote(p.id)} className="rounded-card bg-accent-500 px-2 py-1 text-xs font-semibold text-white active:scale-95">
                      Promote
                    </button>
                  </td>
                </tr>
              ))}
              {youthPlayers.length === 0 && (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-ink-500">No youth players yet — the next annual intake runs automatically as the calendar advances.</td></tr>
              )}
            </tbody>
          </table>
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
