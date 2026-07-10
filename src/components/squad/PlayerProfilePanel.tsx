"use client";
import type { Player } from "@/domain/types";
import { AttributeRadar } from "@/components/squad/AttributeRadar";
import { caToOverall } from "@/components/tactics/FormationPitch";

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function PlayerProfilePanel({ player, onClose }: { player: Player; onClose: () => void }) {
  const { technical, mental, physical, goalkeeping } = player.attributes;
  const isGk = player.positions[0] === "GK";

  return (
    <div className="flex flex-col gap-4 rounded-card border border-navy-600 bg-navy-800 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold text-ink-100">{player.firstName} {player.lastName}</p>
          <p className="text-sm text-ink-500">
            {player.positions.join(" / ")} • {ageFromDob(player.dateOfBirth)} yrs • {player.nationality} • {player.foot}-footed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-card bg-accent-500/20 px-2.5 py-1 text-sm font-bold text-accent-400">
            {caToOverall(player.currentAbility)}
          </span>
          <button onClick={onClose} className="text-xs text-ink-500">Close</button>
        </div>
      </div>

      <AttributeRadar player={player} />

      <div className="grid grid-cols-3 gap-4 text-xs">
        {/* Cast specific attribute groups to a generic record so they satisfy AttrGroup's index signature */}
        <AttrGroup title="Technical" attrs={technical as unknown as Record<string, number>} />
        <AttrGroup title="Mental" attrs={mental as unknown as Record<string, number>} />
        <AttrGroup title="Physical" attrs={physical as unknown as Record<string, number>} />
      </div>

      {isGk && (
        <div className="grid grid-cols-3 gap-4 text-xs">
          <AttrGroup title="Goalkeeping" attrs={goalkeeping as unknown as Record<string, number>} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 border-t border-navy-600 pt-3 text-sm">
        <InfoRow label="Form" value={player.form.toFixed(1)} />
        <InfoRow label="Morale" value={`${player.morale}/100`} />
        <InfoRow label="Fatigue" value={`${player.fatigue}/100`} />
        <InfoRow label="Sharpness" value={`${player.sharpness}/100`} />
        <InfoRow label="Wage" value={player.contract ? `£${player.contract.wageWeekly.toLocaleString()}/wk` : "Free agent"} />
        <InfoRow label="Contract until" value={player.contract?.expiryDate ?? "—"} />
      </div>

      {player.personality.traits.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-500">Personality</p>
          <div className="flex flex-wrap gap-1.5">
            {player.personality.traits.map((t) => (
              <span key={t} className="rounded-card bg-navy-700 px-2 py-0.5 text-xs text-ink-300">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttrGroup({ title, attrs }: { title: string; attrs: Record<string, number> }) {
  return (
    <div>
      <p className="mb-1.5 font-medium text-ink-300">{title}</p>
      <div className="flex flex-col gap-0.5">
        {Object.entries(attrs).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="capitalize text-ink-500">{key.replace(/([A-Z])/g, " $1")}</span>
            <span className="font-data text-ink-100">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-100">{value}</span>
    </div>
  );
}
