"use client";
import { useState } from "react";

export function ClubCrest({
  clubId, abbreviation, color, size = 40, className = "",
}: {
  clubId: string | undefined; abbreviation: string | undefined; color: string | undefined;
  size?: number; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = clubId ? `/logos/${clubId}.png` : undefined;

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-card font-bold text-white ${className}`}
        style={{ width: size, height: size, backgroundColor: color ?? "#3B82F6", fontSize: size * 0.32 }}
      >
        {abbreviation ?? "?"}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={abbreviation ?? "Club crest"}
      width={size}
      height={size}
      className={`shrink-0 rounded-card object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
