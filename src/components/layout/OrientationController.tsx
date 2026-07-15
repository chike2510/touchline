"use client";
import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import Link from "next/link";

// IMPORTANT PLATFORM CONSTRAINT: screen.orientation.lock() is only granted
// by mobile browsers when the page is running as an installed/standalone
// PWA (added to home screen and launched from there) — it is refused in a
// plain browser tab, fullscreen or not, on both Android Chrome and iOS
// Safari. This isn't something a "try harder" button can work around; the
// previous version offered a button that entered fullscreen (which *does*
// work in a tab) but implied it would also rotate the screen, which then
// silently failed and made it look like the button "didn't work" or
// "reverted". This version is honest about which state you're in instead.
export async function tryEnterFullscreenLandscape(): Promise<void> {
  try {
    if (document.fullscreenElement == null && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Requires a user gesture in most browsers — safe to ignore.
  }
  const orientation = (screen as unknown as { orientation?: ScreenOrientation }).orientation;
  if (orientation && "lock" in orientation) {
    try {
      await (orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock("landscape");
    } catch {
      // Expected outside standalone/installed mode — see note above.
    }
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function OrientationController() {
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    // Only auto-attempt the lock where it can actually succeed — attempting
    // it in a plain tab just to have it silently fail achieves nothing.
    if (isStandalone()) void tryEnterFullscreenLandscape();

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

      {installed ? (
        // We're in standalone mode and the lock still didn't take (rare,
        // but some OS/browser combinations restrict it further) — a manual
        // rotate is genuinely the only option left here.
        <p className="text-xs text-ink-500">Manual rotation needed on this device.</p>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            Auto-rotate only works once Touchline is installed to your home screen — browsers block it in a regular tab.
          </p>
          <Link
            href="/settings"
            className="rounded-card bg-accent-500 px-4 py-2 text-sm font-semibold text-navy-950 active:scale-95"
          >
            Go to Settings to install
          </Link>
        </>
      )}
    </div>
  );
}
