"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardList, ArrowLeftRight, Settings, CalendarDays,
  Inbox, Dumbbell, Search, Briefcase, Shield, Landmark, Sprout, Stethoscope,
  Trophy, Database, Star, X, ChevronRight,
} from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { ClubCrest } from "@/components/ui/ClubCrest";

type NavItem = { href: string; label: string; Icon: React.ComponentType<any> };

const CORE_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", Icon: LayoutDashboard },
  { href: "/tactics", label: "Tactics", Icon: ClipboardList },
  { href: "/squad", label: "Squad", Icon: Users },
  { href: "/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", Icon: Settings },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/training", label: "Training", Icon: Dumbbell },
  { href: "/schedule", label: "Schedule", Icon: CalendarDays },
  { href: "/scouting", label: "Scouting", Icon: Search },
  { href: "/staff", label: "Staff", Icon: Briefcase },
  { href: "/club", label: "Club", Icon: Shield },
  { href: "/finances", label: "Finances", Icon: Landmark },
  { href: "/youth", label: "Youth Academy", Icon: Sprout },
  { href: "/medical", label: "Medical Centre", Icon: Stethoscope },
  { href: "/competitions", label: "Competitions", Icon: Trophy },
  { href: "/data-hub", label: "Data Hub", Icon: Database },
];

export function Sidebar({ menuOpen, onCloseMenu }: { menuOpen: boolean; onCloseMenu: () => void }) {
  const pathname = usePathname();
  const world = useGameStore((s) => s.world);
  const meta = useGameStore((s) => s.meta);
  const club = world ? world.clubs[world.userClubId] : undefined;
  const manager = world ? world.managers[world.userManagerId] : undefined;
  const boardConfidence = club?.boardConfidence ?? 0;
  const reputationStars = Math.round((manager?.reputation ?? 0) / 40);

  // Matchday is contextual: it takes the Settings slot only during the user's
  // match build-up or live match. Settings remains available inside the menu.
  const phase = world?.calendar[world.currentDate]?.phase;
  const matchdayAvailable = phase === "matchday-build-up" || phase === "matchday-live";
  const primaryItems = matchdayAvailable
    ? CORE_ITEMS.slice(0, 4).concat([{ href: "/matchday", label: "Matchday", Icon: CalendarDays }])
    : CORE_ITEMS;
  const drawerItems = matchdayAvailable
    ? CORE_ITEMS.concat([{ href: "/matchday", label: "Matchday", Icon: CalendarDays }], MORE_ITEMS)
    : CORE_ITEMS.concat(MORE_ITEMS);

  function isActive(href: string) {
    return pathname === href || (href !== "/home" && pathname?.startsWith(href));
  }

  return (
    <>
      <aside className="app-sidebar glass-panel fixed inset-x-0 bottom-0 z-40 flex h-16 w-full shrink-0 flex-row overflow-hidden rounded-none border-x-0 border-b-0 md:sticky md:top-0 md:h-dvh md:w-60 md:flex-col md:overflow-y-auto md:border-y-0 md:border-l-0">
        <div className="hidden shrink-0 items-center gap-2.5 border-b border-glass-border px-2.5 py-3 md:flex md:px-4">
          <ClubCrest clubId={club?.id} abbreviation={club?.abbreviation ?? "TL"} color={club?.colors.primary} size={32} />
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-semibold leading-tight text-ink-100">{club?.name ?? meta?.clubName ?? "Touchline"}</p>
            <p className="truncate text-[11px] leading-tight text-ink-500">{manager ? manager.firstName + " " + manager.lastName : "No manager"}</p>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="flex min-w-0 flex-1 flex-row items-center justify-around gap-0.5 overflow-x-auto px-1 py-1 md:flex-col md:items-stretch md:overflow-visible md:px-2.5 md:py-2">
          {primaryItems.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={active
                  ? "flex min-w-10 shrink-0 items-center justify-center gap-2.5 rounded-card border-l-2 border-accent-500 bg-accent-500/12 px-2 py-2.5 text-[13px] font-medium text-accent-300 md:justify-start md:px-2.5 md:py-2"
                  : "flex min-w-10 shrink-0 items-center justify-center gap-2.5 rounded-card border-l-2 border-transparent px-2 py-2.5 text-[13px] text-ink-300 transition-all duration-150 hover:bg-navy-700/60 hover:text-ink-100 md:justify-start md:px-2.5 md:py-2"}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden className="shrink-0" />
                <span className="hidden truncate md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 flex-col gap-2 border-t border-glass-border px-4 py-3 md:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500/30 to-pulse-500/30 text-[11px] font-semibold text-ink-100 ring-1 ring-glass-border">
              {manager ? (manager.firstName?.[0] ?? "?") + (manager.lastName?.[0] ?? "") : "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-ink-100">{manager ? manager.firstName + " " + manager.lastName : "No manager"}</p>
              <p className="text-[11px] leading-tight text-ink-500">Manager</p>
            </div>
          </div>
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-wide text-ink-500">Reputation</p>
            <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className={i < reputationStars ? "fill-warning-500 text-warning-500" : "text-navy-600"} />)}</div>
          </div>
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[11px] text-ink-500">
              <span>Board Confidence</span><span className="text-ink-200">{boardConfidence}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-navy-700"><div className="h-full rounded-full bg-positive-500" style={{ width: String(boardConfidence) + "%" }} /></div>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div className="app-menu-backdrop fixed inset-0 z-[80] flex justify-end">
          <button type="button" aria-label="Close navigation menu" onClick={onCloseMenu} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <section role="dialog" aria-modal="true" aria-label="Club navigation" className="app-menu-drawer relative z-10 flex h-full w-[min(390px,90vw)] flex-col border-l border-glass-border bg-[#0b0e18] shadow-2xl">
            <header className="flex items-center justify-between border-b border-glass-border px-5 py-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-400">Touchline</p><h2 className="mt-1 text-lg font-semibold text-ink-100">Manager menu</h2></div>
              <button type="button" onClick={onCloseMenu} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-navy-700"><X size={20} /></button>
            </header>
            <div className="flex items-center gap-3 border-b border-glass-border px-5 py-4">
              <ClubCrest clubId={club?.id} abbreviation={club?.abbreviation ?? "TL"} color={club?.colors.primary} size={40} />
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink-100">{club?.name ?? meta?.clubName ?? "Touchline"}</p><p className="truncate text-xs text-ink-500">{manager ? manager.firstName + " " + manager.lastName : "Create a career to get started"}</p></div>
            </div>
            <nav aria-label="All game sections" className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-4">
              {drawerItems.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href} onClick={onCloseMenu} aria-current={active ? "page" : undefined}
                    className={active
                      ? "flex min-h-12 items-center gap-2 rounded-card border border-accent-500/60 bg-accent-500/12 px-3 py-3 text-sm text-accent-300"
                      : "flex min-h-12 items-center gap-2 rounded-card border border-navy-700 bg-navy-900/80 px-3 py-3 text-sm text-ink-300 transition-colors hover:border-navy-500 hover:bg-navy-800"}>
                    <Icon size={16} className="shrink-0" /><span className="min-w-0 truncate">{label}</span><ChevronRight size={13} className="ml-auto shrink-0 opacity-50" />
                  </Link>
                );
              })}
            </nav>
            <footer className="border-t border-glass-border px-5 py-3 text-[11px] text-ink-500">Specialist sections stay here so your main game navigation stays focused.</footer>
          </section>
        </div>
      )}
    </>
  );
}

export { CORE_ITEMS as NAV_ITEMS };
