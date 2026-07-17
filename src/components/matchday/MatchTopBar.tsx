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
  const statusLabel = status === "half-time" ? "HT" : status === "finished" ? "FT" : `${minute}'`;
  return (
    <div className="glass-panel flex flex-col gap-1.5 rounded-card px-3 py-2">
      <div className="flex items-center justify-between text-[11px] text-ink-500">
        <span className="truncate">{competitionName}</span>
        <span className="flex items-center gap-1">
          {WEATHER_ICON[weather]}
          <span className="capitalize">{weather.replace("-", " ")}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <ClubCrest clubId={homeCrestClubId} abbreviation={homeName.slice(0, 3).toUpperCase()} color={homeColor} size={22} />
          <span className="truncate text-sm text-ink-200">{homeName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-card bg-navy-900 px-2.5 py-1">
          <span className="font-data text-lg font-bold text-ink-100">{homeGoals} – {awayGoals}</span>
          <span className={`font-data text-xs ${status === "first-half" || status === "second-half" ? "text-accent-400" : "text-ink-500"}`}>
            {statusLabel}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="truncate text-right text-sm text-ink-200">{awayName}</span>
          <ClubCrest clubId={awayCrestClubId} abbreviation={awayName.slice(0, 3).toUpperCase()} color={awayColor} size={22} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
        <span className="truncate">{stadiumName}</span>
        <span>•</span>
        <span>{attendance.toLocaleString()} attendance</span>
      </div>
    </div>
  );
}
