"use client";
import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

// Browsers only allow screen.orientation.lock() in an installed/fullscreen
// PWA context (standalone display mode) — a regular browser tab will throw
// or silently reject it, by design, so the user's address bar can't be
// yanked sideways without their consent. We still attempt the lock (it's a
// no-op cost if unsupported) and back it with a full-screen "please rotate"
// overlay so the experience is still guided everywhere else.
export async function tryEnterFullscreenLandscape(): Promise<void> {
  try {
    if (document.fullscreenElement == null && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Requires a user gesture in most browsers — safe to ignore if it fails,
    // installed/standalone launches are already effectively full-screen.
  }
  const orientation = (screen as unknown as { orientation?: ScreenOrientation }).orientation;
  if (orientation && "lock" in orientation) {
    try {
      await (orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock("landscape");
    } catch {
      // Expected outside standalone/fullscreen mode.
    }
  }
}

export function OrientationController() {
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);

  useEffect(() => {
    void tryEnterFullscreenLandscape();

    function checkOrientation() {
      const narrow = window.innerWidth < 900; // treat as "phone-sized", not a small desktop window
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortraitPhone(narrow && portrait);
    }

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  if (!isPortraitPhone) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-navy-950 px-8 text-center">
      <RotateCw size={40} className="animate-spin text-accent-400" style={{ animationDuration: "2.2s" }} aria-hidden />
      <p className="font-display text-lg text-ink-100">Rotate your device</p>
      <p className="text-sm text-ink-500">
        Touchline is designed for landscape — turn your phone sideways for the full tactics board and matchday view.
      </p>
      <button
        onClick={() => void tryEnterFullscreenLandscape()}
        className="rounded-card bg-accent-500 px-4 py-2 text-sm font-semibold text-white active:scale-95"
      >
        Try full-screen + auto-rotate
      </button>
    </div>
  );
}
