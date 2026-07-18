// Every reference screenshot uses compact money formatting (£78.4M, £2.45M
// p/w, £850K) rather than full digit grouping — this is the single shared
// implementation so every rebuilt page formats money identically.
export function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}£${Math.round(abs)}`;
}

export function formatMoneyPerWeek(n: number): string {
  return `${formatMoney(n)} p/w`;
}

export function formatMoneyFull(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}
