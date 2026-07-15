"use client";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { OrientationController } from "./OrientationController";
import { PlayerProfileModal } from "@/components/squad/PlayerProfileModal";
import { useGameStore } from "@/state/gameStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const flushPendingSave = useGameStore((s) => s.flushPendingSave);

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
    <div className="flex min-h-dvh">
      <OrientationController />
      <PlayerProfileModal />
      <Sidebar />
      <div className="flex min-h-dvh flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-20 pt-2 md:pb-4">
          <div className="mx-auto max-w-[1600px] px-4 md:px-6">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
