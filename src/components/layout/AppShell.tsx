"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { OrientationController } from "./OrientationController";
import { PlayerProfileModal } from "@/components/squad/PlayerProfileModal";
import { useGameStore } from "@/state/gameStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const flushPendingSave = useGameStore((s) => s.flushPendingSave);
  const [menuOpen, setMenuOpen] = useState(false);

  // Mobile OSes background/kill tabs aggressively and without warning — the
  // debounced autosave in mutateWorld could still be mid-wait when that
  // happens, silently dropping whatever the user just did. Flushing
  // immediately on the earliest signal the tab might be going away (hidden,
  // pagehide, or actual unload) closes that gap.
  useEffect(() => {
    function handleHidden() {
      if (document.visibilityState === "hidden") void flushPendingSave();
    }
    document.addEventListener("visibilitychange", handleHidden);
    window.addEventListener("pagehide", () => void flushPendingSave());
    window.addEventListener("beforeunload", () => void flushPendingSave());
    return () => {
      document.removeEventListener("visibilitychange", handleHidden);
    };
  }, [flushPendingSave]);

  return (
    <div className="app-shell flex min-h-dvh w-full min-w-0 overflow-x-hidden">
      <OrientationController />
      <PlayerProfileModal />
      <Sidebar menuOpen={menuOpen} onCloseMenu={() => setMenuOpen(false)} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        <main className="app-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-24 pt-2 sm:px-4 md:px-6 md:pb-4">
          <div className="mx-auto w-full min-w-0 max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
