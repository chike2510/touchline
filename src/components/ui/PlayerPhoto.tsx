"use client";

import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PlayerPhoto({
  firstName,
  lastName,
  leagueId,
  clubId,
  size = 40,
  className = "",
}: {
  firstName: string;
  lastName: string;
  leagueId: string;
  clubId: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    const file = `${slugify(firstName)}-${slugify(lastName)}.png`;
    return `/players/${leagueId}/${clubId}/${file}`;
  }, [firstName, lastName, leagueId, clubId]);

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-navy-700 text-ink-500 ${className}`}
        style={{ width: size, height: size }}
      >
        <UserRound size={size * 0.55} aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${firstName} ${lastName}`}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}