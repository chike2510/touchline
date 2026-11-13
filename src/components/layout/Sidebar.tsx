"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Users, ClipboardList, Dumbbell, CalendarDays, Search,
  ArrowLeftRight, Briefcase, Shield, Landmark, Sprout, Stethoscope, Trophy, Database, Settings, Star,
} from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";

// Order matches the reference sidebar exactly.
const NAV_ITEMS = [
  { href: "/home", label: "Home", Icon: LayoutDashboard },
  { href: "/tactics", label: "Tactics", Icon: ClipboardList },
  { href: "/squad", label: "Squad", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/training", label: "Training", Icon: Dumbbell },
  { href: "/schedule", label: "Schedule", Icon: CalendarDays },
  { href: "/scouting", label: "Scouting", Icon: Search },
  { href: "/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { href: "/staff", label: "Staff", Icon: Briefcase },
  { href: "/club", label: "Club", Icon: Shield },
  { href: "/finances", label: "Finances", Icon: Landmark },
  { href: "/youth", label: "Youth Academy", Icon: Sprout },
  { href: "/medical", label: "Medical Centre", Icon: Stethoscope },
  { href: "/competitions", label: "Competitions", Icon: Trophy },
  { href: "/data-hub", label: "Data Hub", Icon: Database },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const world = useGameStore((s) => s.world);
  const meta = useGameStore((s) => s.meta);
  const club = world ? world.clubs[world.userClubId] : undefined;
  const manager = world ? world.managers[world.userManagerId] : undefined;
  const boardConfidence = club?.boardConfidence ?? 0;
  const reputationStars = Math.round((manager?.reputation ?? 0) / 40); // 1-200 -> 0-5

  return (
    <aside className="app-sidebar glass-panel fixed inset-x-0 bottom-0 z-40 flex h-16 w-full shrink-0 flex-row overflow-hidden rounded-none border-x-0 border-b-0 md:sticky md:top-0 md:h-dvh md:w-60 md:flex-col md:overflow-y-auto md:border-y-0 md:border-l-0">
      <div className="hidden shrink-0 items-center gap-2.5 border-b border-glass-border px-2.5 py-3 md:flex md:px-4">
        <ClubCrest clubId={club?.id} abbreviation={club?.abbreviation ?? "TL"} color={club?.colors.primary} size={32} />
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-sm font-semibold leading-tight text-ink-100">{club?.name ?? meta?.clubName ?? "Touchline"}</p>
          <p className="truncate text-[11px] leading-tight text-ink-500">{manager ? `${manager.firstName} ${manager.lastName}` : "No manager"}</p>
        </div>
      </div>

      <nav className="flex min-w-0 flex-1 flex-row items-center justify-around gap-0.5 overflow-x-auto px-1 py-1 md:flex-col md:items-stretch md:overflow-visible md:px-2.5 md:py-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/home" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-10 shrink-0 items-center justify-center gap-2.5 rounded-card px-2 py-2.5 text-[13px] transition-all duration-150 md:justify-start md:px-2.5 md:py-2 ${
                active
                  ? "border-l-2 border-accent-500 bg-accent-500/12 font-medium text-accent-300"
                  : "border-l-2 border-transparent text-ink-300 hover:bg-navy-700/60 hover:text-ink-100"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} aria-hidden className="shrink-0" />
              <span className="hidden truncate md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden shrink-0 flex-col gap-2 border-t border-glass-border px-4 py-3 md:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500/30 to-pulse-500/30 text-[11px] font-semibold text-ink-100 ring-1 ring-glass-border">
            {manager ? `${manager.firstName[0]}${manager.lastName[0]}` : "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium leading-tight text-ink-100">
              {manager ? `${manager.firstName} ${manager.lastName}` : "No manager"}
            </p>
            <p className="text-[11px] leading-tight text-ink-500">Manager</p>
          </div>
        </div>

        <div>
          <p className="mb-0.5 text-[10px] uppercase tracking-wide text-ink-500">Reputation</p>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={13}
                className={i < reputationStars ? "fill-warning-500 text-warning-500" : "text-navy-600"}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-0.5 flex items-center justify-between text-[11px] text-ink-500">
            <span>Board Confidence</span>
            <span className="text-ink-200">{boardConfidence}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-navy-700">
            <div className="h-full rounded-full bg-positive-500" style={{ width: `${boardConfidence}%` }} />
          </div>
        </div>
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
