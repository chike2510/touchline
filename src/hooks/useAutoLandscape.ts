"use client";
import { useEffect, useState, useRef, useCallback } from "react";

export type AutoLandscapeStatus = "idle" | "locked" | "unsupported" | "blocked" | "prompt";

export function useAutoLandscape(): {
  status: AutoLandscapeStatus;
  triedLock: boolean;
  requestFullscreenAndLock: () => Promise<boolean>;
  exitFullscreenIfNeeded: () => Promise<void>;
} {
  const [status, setStatus] = useState<AutoLandscapeStatus>("idle");
  const triedLockRef = useRef(false);
  const enteredFullscreenRef = useRef(false);

  const tryLock = useCallback(async (): Promise<boolean> => {
    // Guard: feature detection
    const orient = (screen as any)?.orientation ?? (screen as any)?.mozOrientation ?? (screen as any)?.msOrientation;
    if (!orient || typeof (screen as any).orientation.lock !== "function") {
      setStatus("unsupported");
      return false;
    }

    try {
      // Some browsers require a fullscreen/user gesture. Try directly first.
      await (screen as any).orientation.lock("landscape");
      setStatus("locked");
      return true;
    } catch (err) {
      // Lock was rejected — it may be blocked unless fullscreen is active.
      setStatus("blocked");
      return false;
    }
  }, []);

  useEffect(() => {
    // Attempt to lock on mount once.
    if (triedLockRef.current) return;
    triedLockRef.current = true;
    (async () => {
      const ok = await tryLock();
      if (!ok && status !== "unsupported") {
        // If lock failed, show the prompt state.
        setStatus((s) => (s === "unsupported" ? s : "prompt"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestFullscreenAndLock = useCallback(async (): Promise<boolean> => {
    try {
      // Request fullscreen on the document element
      const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
      if (typeof el.requestFullscreen === "function") {
        await el.requestFullscreen();
        enteredFullscreenRef.current = true;
      }
      const ok = await tryLock();
      return ok;
    } catch (err) {
      // Could not enter fullscreen or lock
      setStatus("blocked");
      return false;
    }
  }, [tryLock]);

  const exitFullscreenIfNeeded = useCallback(async () => {
    try {
      if (enteredFullscreenRef.current && document.fullscreenElement && typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
        enteredFullscreenRef.current = false;
      }
      // Try to unlock the orientation when exiting
      if ((screen as any)?.orientation?.unlock) {
        try {
          (screen as any).orientation.unlock();
        } catch (e) {
          // ignore
        }
      }
      setStatus("idle");
    } catch (e) {
      // ignore
    }
  }, []);

  return { status, triedLock: triedLockRef.current, requestFullscreenAndLock, exitFullscreenIfNeeded };
}
