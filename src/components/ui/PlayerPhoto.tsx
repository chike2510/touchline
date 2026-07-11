"use client";
import { useState } from "react";
import { UserRound } from "lucide-react";

export function PlayerPhoto({
  playerId, size = 40, className = "",
}: {
  playerId: string | undefined; size?: number; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = playerId ? `/players/${playerId}.png` : undefined;

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-navy-700 text-ink-500 ${className}`}
        style={{ width: size, height: size }}
      >
        <UserRound size={size * 0.55} aria-hidden />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
