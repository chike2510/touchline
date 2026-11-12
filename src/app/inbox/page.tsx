"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { applyMediaResponse } from "@/engines/media/mediaEngine";
import { applyContractDecision, contractFailureText } from "@/engines/contracts/contractEngine";
import type { InboxAction, InboxItem } from "@/domain/types";

const PRIORITY_TONE: Record<InboxItem["priority"], "neutral" | "amber" | "rival" | "success"> = {
  low: "neutral", normal: "neutral", high: "amber", urgent: "rival",
};

// One message at a time with Prev/Next, instead of a long scrollable list —
// the whole thing fits a fixed landscape viewport without needing to scroll.
export default function InboxPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const items = world
    ? Object.values(world.inboxItems)
        .filter((i) => !i.archived)
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    : [];

  useEffect(() => {
    if (index >= items.length && items.length > 0) setIndex(items.length - 1);
  }, [items.length, index]);

  if (!world) return <EmptyState />;

  const item = items[index];

  function handleAction(target: InboxItem, action: InboxAction) {
    mutateWorld((w) => {
      const t = w.inboxItems[target.id];
      if (t) t.read = true;
      if (action.kind === "decision" && action.payload?.storyId) {
        applyMediaResponse(w, action.payload.storyId as string, action.id);
        if (t) t.archived = true;
      }
      if (action.kind === "acknowledge" && t) t.archived = true;
      if (action.kind === "decision" && action.payload?.contractAction) {
        const r = applyContractDecision(w, action.payload);
        if (t && r?.ok) t.archived = true;
        else if (t && r && !r.ok && !t.body.includes("[Last attempt]")) t.body += ` [Last attempt] ${contractFailureText[r.reason] ?? r.reason}`;
      }
    });
    if (action.kind === "navigate" && action.target) router.push(action.target);
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3 py-3 md:h-[calc(100dvh-5rem)]">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="font-display text-2xl text-ink-100">Inbox</h1>
        {items.length > 0 && (
          <span className="font-data text-xs text-ink-500">{index + 1} of {items.length}</span>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-ink-500">Nothing new. Tap Continue at the top to move the calendar forward.</p>
      )}

      {item && (
        <div className="flex min-h-0 flex-1 items-stretch gap-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex w-10 shrink-0 items-center justify-center rounded-card bg-navy-800 text-ink-300 disabled:opacity-30"
            aria-label="Previous message"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Card>
              <CardHeader
                title={item.subject}
                subtitle={item.date}
                right={<Badge tone={PRIORITY_TONE[item.priority]}>{item.category}</Badge>}
              />
              <p className="mb-3 text-sm text-ink-300">{item.body}</p>
              <div className="flex flex-wrap gap-2">
                {item.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(item, action)}
                    className="rounded-card border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100 transition-transform duration-150 active:scale-95"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <button
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={index >= items.length - 1}
            className="flex w-10 shrink-0 items-center justify-center rounded-card bg-navy-800 text-ink-300 disabled:opacity-30"
            aria-label="Next message"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[60dvh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-display text-xl text-ink-100">No save loaded</p>
      <p className="text-sm text-ink-500">Start a new career from Settings, or check your saves.</p>
    </div>
  );
}
