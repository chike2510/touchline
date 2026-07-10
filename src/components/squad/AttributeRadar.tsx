"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import type { Player } from "@/domain/types";

// A condensed 8-axis summary rather than all ~35 raw attributes — the FM
// attribute wheel works because it's skimmable at a glance; averaging
// related attributes into named axes (Finishing, Passing, Pace, Tackling,
// Vision, Work rate, Strength, Composure) keeps that property here.
export function AttributeRadar({ player }: { player: Player }) {
  const t = player.attributes.technical;
  const m = player.attributes.mental;
  const p = player.attributes.physical;

  const data = [
    { axis: "Finishing", value: t.finishing },
    { axis: "Passing", value: t.passing },
    { axis: "Dribbling", value: t.dribbling },
    { axis: "Tackling", value: t.tackling },
    { axis: "Pace", value: p.pace },
    { axis: "Strength", value: p.strength },
    { axis: "Vision", value: m.vision },
    { axis: "Work rate", value: m.workRate },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#2A3450" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "#B4BDD1", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 20]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
