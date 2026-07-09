"use client";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20 pt-2">{children}</main>
      <BottomNav />
    </div>
  );
}
