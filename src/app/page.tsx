"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAutoLoadSave } from "@/hooks/useSaveGame";

export default function HomePage() {
  const status = useAutoLoadSave();
  const router = useRouter();

  useEffect(() => {
    if (status === "loaded") router.replace("/home");
    if (status === "no-save") router.replace("/new-game");
  }, [status, router]);

  return (
    <div className="flex h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-2xl text-ink-100">Touchline</p>
      <p className="text-sm text-ink-500">Loading your save…</p>
    </div>
  );
}
