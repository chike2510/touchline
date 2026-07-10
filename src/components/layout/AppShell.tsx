"use client";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { OrientationController } from "./OrientationController";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <OrientationController />
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
