"use client";
import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { tryEnterFullscreenLandscape } from "@/components/layout/OrientationController";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (isIOS()) return; // Safari never fires beforeinstallprompt — handled separately below

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      void tryEnterFullscreenLandscape();
    }
    setDeferredPrompt(null);
  }

  if (installed) {
    return (
      <p className="text-sm text-positive-500">
        Installed — launching from your home screen opens in landscape, full-screen, fully offline.
      </p>
    );
  }

  if (isIOS()) {
    return (
      <div className="text-sm text-ink-300">
        <button
          onClick={() => setShowIOSSteps((s) => !s)}
          className="flex items-center gap-1.5 rounded-card border border-navy-600 bg-navy-800 px-3 py-1.5 text-ink-100"
        >
          <Share size={14} aria-hidden /> How to add to Home Screen
        </button>
        {showIOSSteps && (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-300">
            <li>Tap the Share button in Safari&apos;s toolbar.</li>
            <li>Scroll down and tap &quot;Add to Home Screen&quot;.</li>
            <li>Tap Add — Touchline now launches full-screen, landscape, from your home screen.</li>
          </ol>
        )}
      </div>
    );
  }

  if (!deferredPrompt) {
    return <p className="text-sm text-ink-500">Your browser hasn&apos;t offered an install prompt yet — try reloading the page, or check your browser menu for &quot;Install app&quot;.</p>;
  }

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-1.5 rounded-card bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
    >
      <Download size={14} aria-hidden /> Add to Home Screen
    </button>
  );
}
