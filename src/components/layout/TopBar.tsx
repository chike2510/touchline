"use client";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, HelpCircle, Bell, Settings as SettingsIcon, ChevronRight, Menu } from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { formatMoney, formatMoneyPerWeek } from "@/lib/format";

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();
  const meta = useGameStore((s) => s.meta);
  const world = useGameStore((s) => s.world);
  const advanceOnePhase = useGameStore((s) => s.advanceOnePhase);
  const simStatus = useGameStore((s) => s.simStatus);

  const club = world ? world.clubs[world.userClubId] : undefined;
  const manager = world ? world.managers[world.userManagerId] : undefined;
  const today = world ? world.calendar[world.currentDate] : undefined;
  const isLive = today?.phase === "matchday-live";
  const unread = world ? Object.values(world.inboxItems).filter((m) => !m.read && !m.archived).length : 0;

  const dateLabel = world
    ? new Date(world.currentDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
    : "—";
  // The engine only tracks a calendar date, not a time of day — this is a
  // fixed display value matching the reference, not a real clock.
  const timeLabel = "10:30";

  async function handleContinue() {
    if (isLive) { router.push("/matchday"); return; }
    await advanceOnePhase();
    // isLive recomputes from world state on the next render; if a match just
    // kicked off, the button will read "Go to match" and a second tap enters it.
  }

  return (
    <header className="app-topbar glass-panel sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-none border-x-0 border-t-0 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <button type="button" onClick={onOpenMenu} aria-label="Open navigation menu" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-ink-300 transition-colors hover:bg-navy-700 hover:text-ink-100">
          <Menu size={21} aria-hidden />
        </button>
        <ClubCrest clubId={club?.id} abbreviation={club?.abbreviation ?? "TL"} color={club?.colors.primary} size={36} />
        <div className="min-w-0">
          <p className="truncate font-display text-base leading-tight text-ink-100">{club?.name ?? meta?.clubName ?? "Touchline"}</p>
          <p className="truncate text-xs leading-tight text-ink-500">{manager ? `${manager.firstName} ${manager.lastName}` : "No manager"}</p>
        </div>
      </div>

      <div className="hidden items-center gap-4 sm:flex">
        <div className="flex items-center gap-1.5 text-ink-300">
          <CalendarDays size={14} className="text-ink-500" aria-hidden />
          <span className="text-xs">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-ink-300">
          <Clock size={14} className="text-ink-500" aria-hidden />
          <span className="font-data text-xs">{timeLabel}</span>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!world || simStatus === "simming"}
        className="flex items-center gap-1.5 rounded-card bg-gradient-to-r from-accent-500 to-accent-600 px-5 py-2 text-sm font-bold text-white shadow-glow transition-transform duration-150 active:scale-95 disabled:opacity-40"
      >
        {isLive ? "Go to match" : simStatus === "simming" ? "Simming…" : "Continue"}
        <ChevronRight size={16} aria-hidden />
      </button>

      <div className="hidden items-center gap-6 lg:flex">
        <Stat label="Budget" value={formatMoney(club?.finance.transferBudget ?? 0)} />
        <Stat label="Wage Budget" value={formatMoneyPerWeek(club?.finance.wageBudgetWeekly ?? 0)} />
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">Board Confidence</p>
          <div className="flex items-center gap-2">
            <span className="font-data text-sm font-semibold text-positive-500">{club?.boardConfidence ?? 0}%</span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-700">
              <div className="h-full rounded-full bg-positive-500" style={{ width: `${club?.boardConfidence ?? 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="relative rounded-full p-1.5 text-ink-400 hover:bg-navy-700 hover:text-ink-100" title="Notifications" onClick={() => router.push("/inbox")}>
          <Bell size={17} aria-hidden />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        <button className="rounded-full p-1.5 text-ink-400 hover:bg-navy-700 hover:text-ink-100" title="Help">
          <HelpCircle size={17} aria-hidden />
        </button>
        <button className="rounded-full p-1.5 text-ink-400 hover:bg-navy-700 hover:text-ink-100" title="Settings" onClick={() => router.push("/settings")}>
          <SettingsIcon size={17} aria-hidden />
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
      <p className="font-data text-sm font-semibold text-positive-500">{value}</p>
    </div>
  );
}
