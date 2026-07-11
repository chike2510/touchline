"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Users, ClipboardList, Search, ArrowLeftRight,
  Landmark, Sprout, Shield, CalendarDays, Settings,
} from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";

const NAV_ITEMS = [
  { href: "/home", label: "Home", Icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/squad", label: "Squad", Icon: Users },
  { href: "/tactics", label: "Tactics", Icon: ClipboardList },
  { href: "/scouting", label: "Scouting", Icon: Search },
  { href: "/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { href: "/finances", label: "Finances", Icon: Landmark },
  { href: "/youth", label: "Youth Academy", Icon: Sprout },
  { href: "/club", label: "Club", Icon: Shield },
  { href: "/matchday", label: "Matchday", Icon: CalendarDays },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const world = useGameStore((s) => s.world);
  const meta = useGameStore((s) => s.meta);
  const club = world ? world.clubs[world.userClubId] : undefined;
  const manager = world ? world.managers[world.userManagerId] : undefined;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-navy-600 bg-navy-900 md:flex">
      <div className="flex items-center gap-3 border-b border-navy-600 px-4 py-4">
        <ClubCrest clubId={club?.id} abbreviation={club?.abbreviation ?? "TL"} color={club?.colors.primary} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-100">{club?.name ?? meta?.clubName ?? "Touchline"}</p>
          <p className="truncate text-xs text-ink-500">{club ? "1st in Premier League" : "No club loaded"}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/home" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`mx-2 flex items-center gap-3 rounded-card px-3 py-2 text-sm transition-colors duration-150 ${
                active ? "bg-accent-500/15 font-medium text-accent-400" : "text-ink-300 hover:bg-navy-800 hover:text-ink-100"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-navy-600 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-ink-100">
          {manager ? `${manager.firstName[0]}${manager.lastName[0]}` : "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-100">
            {manager ? `${manager.firstName} ${manager.lastName}` : "No manager"}
          </p>
          <p className="text-xs text-ink-500">Manager</p>
        </div>
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
