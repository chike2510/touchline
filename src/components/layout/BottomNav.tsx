"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardList, ArrowLeftRight, CalendarDays, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", Icon: LayoutDashboard },
  { href: "/squad", label: "Squad", Icon: Users },
  { href: "/tactics", label: "Tactics", Icon: ClipboardList },
  { href: "/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { href: "/matchday", label: "Match", Icon: CalendarDays },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="glass-panel fixed bottom-0 left-0 right-0 z-20 mx-auto flex rounded-none border-x-0 border-b-0 md:hidden">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors duration-150 ${
              active ? "text-accent-400" : "text-ink-500"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
            <span>{label}</span>
            <span
              className={`h-0.5 w-6 rounded-full transition-opacity duration-150 ${
                active ? "bg-accent-400 opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
