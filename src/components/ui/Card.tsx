import type { ReactNode } from "react";

export function Card({
  children, className = "", onClick,
}: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-full rounded-card border border-navy-600 bg-navy-900 p-4 text-left shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <h3 className="font-display text-lg leading-tight text-ink-100">{title}</h3>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
