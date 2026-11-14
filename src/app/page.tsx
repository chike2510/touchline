"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Clock3, FolderOpen, Gamepad2, Plus, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import { listSaveMeta, getSaveWorld } from "@/engines/persistence/db";
import { setActiveSave } from "@/engines/persistence/saveManager";
import { useGameStore } from "@/state/gameStore";
import type { SaveGameMeta } from "@/domain/types";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function LauncherPage() {
  const router = useRouter();
  const loadSave = useGameStore((s) => s.loadSave);
  const [saves, setSaves] = useState<SaveGameMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listSaveMeta()
      .then((items) => { if (active) setSaves(items); })
      .catch(() => { if (active) setError("Your local career library could not be opened. Please refresh and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function openCareer(save: SaveGameMeta) {
    setLoadingId(save.id);
    setError("");
    try {
      const world = await getSaveWorld(save.id);
      if (!world) throw new Error("The saved career data is missing.");
      await setActiveSave(save.id);
      loadSave({ ...save, lastPlayedAt: new Date().toISOString() }, world);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this career.");
      setLoadingId(null);
    }
  }

  const recent = saves[0];
  const visibleSaves = showAll ? saves : saves.slice(0, 3);

  return (
    <div className="launcher-page">
      <header className="launcher-topline">
        <Link href="/" className="launcher-brand" aria-label="Touchline home"><span className="launcher-mark">T</span><span>TOUCHLINE</span></Link>
        <span className="launcher-edition">FOOTBALL MANAGEMENT</span>
      </header>
      <main className="launcher-main">
        <section className="launcher-hero">
          <div className="launcher-hero-copy">
            <p className="launcher-kicker"><Sparkles size={14} /> YOUR CLUB. YOUR CALL.</p>
            <h1>Every great story<br/><span>starts somewhere.</span></h1>
            <p className="launcher-description">Build your football world, shape a team and make the decisions that define your career.</p>
            <div className="launcher-hero-actions">
              <Link href="/new-game" className="launcher-primary-action"><Plus size={18} /> Start a new career <ArrowRight size={17} /></Link>
              {recent && <button type="button" onClick={() => openCareer(recent)} disabled={!!loadingId} className="launcher-secondary-action"><Gamepad2 size={17} /> {loadingId === recent.id ? "Opening career…" : "Continue career"}</button>}
            </div>
          </div>
          <div className="launcher-hero-art" aria-hidden="true">
            <div className="launcher-orbit launcher-orbit-one"/><div className="launcher-orbit launcher-orbit-two"/>
            <div className="launcher-pitch"><div className="launcher-pitch-half"/><div className="launcher-pitch-circle"/><div className="launcher-pitch-box launcher-box-top"/><div className="launcher-pitch-box launcher-box-bottom"/><span className="launcher-pitch-ball">●</span></div>
            <div className="launcher-stamp"><span>THE</span><strong>TOUCHLINE</strong><small>MANAGER'S EDITION</small></div>
          </div>
        </section>
        {error && <div className="launcher-error" role="alert">{error}</div>}
        <section className="launcher-library">
          <div className="launcher-section-heading">
            <div><p className="launcher-kicker">CAREER LIBRARY</p><h2>{recent ? "Pick up where you left off" : "Your next chapter awaits"}</h2></div>
            {saves.length > 3 && <button type="button" onClick={() => setShowAll((v) => !v)} className="launcher-text-action">{showAll ? "Show recent" : "View all careers"} <ChevronRight size={15}/></button>}
          </div>
          {loading ? <div className="launcher-empty"><span className="launcher-loader"/> Looking for saved careers…</div>
            : saves.length === 0 ? (
              <div className="launcher-empty-card">
                <div className="launcher-empty-icon"><FolderOpen size={23}/></div>
                <div><h3>No saved careers yet</h3><p>Your careers will appear here after you create your first manager and club.</p></div>
                <Link href="/new-game" className="launcher-text-action">Create your first career <ArrowRight size={15}/></Link>
              </div>
            ) : (
              <div className="launcher-save-grid">
                {visibleSaves.map((save, index) => (
                  <button type="button" key={save.id} onClick={() => openCareer(save)} disabled={!!loadingId} className={index === 0 ? "launcher-save-card launcher-save-card-featured" : "launcher-save-card"}>
                    <span className="launcher-save-topline"><span className="launcher-save-type">{index === 0 ? "MOST RECENT" : "SAVED CAREER"}</span><span className="launcher-save-arrow"><ArrowRight size={15}/></span></span>
                    <span className="launcher-save-club">{save.clubName ?? "Unemployed"}</span>
                    <span className="launcher-save-manager">{save.managerName}</span>
                    <span className="launcher-save-meta"><span><CalendarDays size={13}/> {formatDate(save.currentDate)}</span><span><Clock3 size={13}/> Played {formatDate(save.lastPlayedAt)}</span></span>
                    <span className="launcher-save-open">{loadingId === save.id ? "Loading career…" : "Open career"}</span>
                  </button>
                ))}
              </div>
            )}
        </section>
      </main>
      <footer className="launcher-footer">
        <div className="launcher-footer-brand"><ShieldCheck size={15}/> BUILT FOR THE TOUCHLINE</div>
        <div>Local saves · Your decisions · Your football world</div>
        <Link href="/settings">Settings <ChevronRight size={13}/></Link>
      </footer>
    </div>
  );
}
