"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Users, ClipboardList, Search, ArrowLeftRight,
  Landmark, Sprout, Shield, Settings,
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
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

// Fixed-height sidebar (no internal scroll): header + footer are a known
// height, and the nav list divides the remaining space evenly rather than
// growing past the viewport — this is what was pushing Settings off-screen
// on shorter landscape phone heights.
export function Sidebar() {
  const pathname = usePathname();
  const world = useGameStore((s) => s.world);
  const meta = useGameStore((s) => s.meta);
  const club = world ? world.clubs[world.userClubId] : undefined;
  const manager = world ? world.managers[world.userManagerId] : undefined;

  return (
    <aside className="glass-panel hidden h-dvh w-56 shrink-0 flex-col rounded-none border-y-0 border-l-0 md:flex">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-glass-border px-3 py-2.5">
        <ClubCrest clubId={club?.id} abbreviation={club?.abbreviation ?? "TL"} color={club?.colors.primary} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-ink-100">{club?.name ?? meta?.clubName ?? "Touchline"}</p>
          <p className="truncate text-[11px] leading-tight text-ink-500">{club ? "1st in Premier League" : "No club loaded"}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col justify-between gap-0.5 overflow-hidden px-2 py-1.5">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/home" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-0 flex-1 items-center gap-2.5 rounded-card px-2.5 text-[13px] transition-all duration-150 ${
                active
                  ? "bg-accent-500/12 font-medium text-accent-300 shadow-glow"
                  : "text-ink-300 hover:bg-navy-700/60 hover:text-ink-100"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} aria-hidden className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-glass-border px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500/30 to-pulse-500/30 text-[11px] font-semibold text-ink-100 ring-1 ring-glass-border">
          {manager ? `${manager.firstName[0]}${manager.lastName[0]}` : "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight text-ink-100">
            {manager ? `${manager.firstName} ${manager.lastName}` : "No manager"}
          </p>
          <p className="text-[11px] leading-tight text-ink-500">Manager</p>
        </div>
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
