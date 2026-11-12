"use client";
import { ClubCrest } from "@/components/ui/ClubCrest";
import type { WeatherCondition } from "@/domain/types";
import { CloudRain, CloudSnow, Cloud, Sun, Wind, Thermometer, Snowflake } from "lucide-react";

const WEATHER_ICON: Record<WeatherCondition, React.ReactNode> = {
  clear: <Sun size={13} />, overcast: <Cloud size={13} />, rain: <CloudRain size={13} />,
  "heavy-rain": <CloudRain size={13} />, snow: <CloudSnow size={13} />, windy: <Wind size={13} />,
  hot: <Thermometer size={13} />, cold: <Snowflake size={13} />,
};

export function MatchTopBar({
  competitionName, homeName, awayName, homeCrestClubId, awayCrestClubId, homeColor, awayColor,
  homeGoals, awayGoals, minute, status, stadiumName, attendance, weather,
}: {
  competitionName: string;
  homeName: string; awayName: string;
  homeCrestClubId?: string; awayCrestClubId?: string;
  homeColor?: string; awayColor?: string;
  homeGoals: number; awayGoals: number;
  minute: number;
  status: "not-started" | "first-half" | "half-time" | "second-half" | "extra-time" | "finished";
  stadiumName: string; attendance: number; weather: WeatherCondition;
}) {
  const isLive = status === "first-half" || status === "second-half" || status === "extra-time";
  const statusLabel = status === "half-time" ? "HALF-TIME"
    : status === "finished" ? "FULL-TIME"
      : status === "not-started" ? "UP NEXT" : `${minute}'`;
  const statusTone = isLive ? "text-accent-300" : "text-ink-400";

  return (
    <section className="glass-panel relative overflow-hidden rounded-card px-3 py-3 sm:px-4" aria-label="Live match scoreboard">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400 shadow-[0_0_10px_rgba(114,255,174,0.9)]" />
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            {competitionName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wider text-ink-500">
          <span className="flex items-center gap-1.5">
            {WEATHER_ICON[weather]}
            <span className="capitalize tracking-normal">{weather.replace("-", " ")}</span>
          </span>
          <span className="h-3 w-px bg-navy-600" />
          <span className={`flex items-center gap-1.5 font-bold ${statusTone}`}>
            {isLive && <span className="match-live-dot h-1.5 w-1.5 rounded-full bg-accent-400" />}
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ClubCrest clubId={homeCrestClubId} abbreviation={homeName.slice(0, 3).toUpperCase()} color={homeColor} size={30} />
          <span className="min-w-0 truncate text-sm font-semibold text-ink-100 sm:text-base">{homeName}</span>
        </div>

        <div className="flex min-w-[94px] flex-col items-center rounded-card border border-white/5 bg-black/25 px-3 py-2 sm:min-w-[112px]">
          <span className="font-data text-2xl font-bold leading-none tracking-tight text-white sm:text-3xl">
            {homeGoals}<span className="px-1.5 text-ink-500">:</span>{awayGoals}
          </span>
          <span className={`mt-1 font-data text-[10px] font-semibold tracking-[0.16em] ${statusTone}`}>
            {status === "half-time" ? "HT" : status === "finished" ? "FT" : status === "not-started" ? "—" : `${minute} MIN`}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <span className="min-w-0 truncate text-right text-sm font-semibold text-ink-100 sm:text-base">{awayName}</span>
          <ClubCrest clubId={awayCrestClubId} abbreviation={awayName.slice(0, 3).toUpperCase()} color={awayColor} size={30} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 border-t border-white/5 pt-2 text-[10px] tracking-wide text-ink-500">
        <span className="max-w-[48%] truncate">{stadiumName}</span>
        <span className="text-navy-500">•</span>
        <span className="font-data tabular-nums">{attendance.toLocaleString()} IN ATTENDANCE</span>
      </div>
    </section>
  );
}
