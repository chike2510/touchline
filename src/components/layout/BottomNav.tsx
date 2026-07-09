"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox, Users, ArrowLeftRight, Shield, CalendarDays, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/squad", label: "Squad", Icon: Users },
  { href: "/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { href: "/club", label: "Club", Icon: Shield },
  { href: "/matchday", label: "Matchday", Icon: CalendarDays },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-6xl border-t border-pitch-700 bg-pitch-950/95 backdrop-blur">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors duration-150 ${
              active ? "text-floodlight-400" : "text-chalk-300"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
            <span>{label}</span>
            <span
              className={`h-0.5 w-6 rounded-full transition-opacity duration-150 ${
                active ? "bg-floodlight-400 opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
