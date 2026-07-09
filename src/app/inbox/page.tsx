"use client";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/state/gameStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { applyMediaResponse } from "@/engines/media/mediaEngine";
import type { InboxAction, InboxItem } from "@/domain/types";

const PRIORITY_TONE: Record<InboxItem["priority"], "neutral" | "amber" | "rival" | "success"> = {
  low: "neutral", normal: "neutral", high: "amber", urgent: "rival",
};

export default function InboxPage() {
  const world = useGameStore((s) => s.world);
  const mutateWorld = useGameStore((s) => s.mutateWorld);
  const router = useRouter();

  if (!world) {
    return <EmptyState />;
  }

  const items = Object.values(world.inboxItems)
    .filter((i) => !i.archived)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

  function handleAction(item: InboxItem, action: InboxAction) {
    mutateWorld((w) => {
      const target = w.inboxItems[item.id];
      if (target) target.read = true;
      if (action.kind === "decision" && action.payload?.storyId) {
        applyMediaResponse(w, action.payload.storyId as string, action.id);
        if (target) target.archived = true;
      }
      if (action.kind === "acknowledge" && target) {
        target.archived = true;
      }
    });
    if (action.kind === "navigate" && action.target) {
      router.push(action.target);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      <h1 className="font-display text-2xl text-chalk-100">Inbox</h1>
      {items.length === 0 && (
        <p className="text-sm text-chalk-300">Nothing new. Tap Continue at the top to move the calendar forward.</p>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader
            title={item.subject}
            subtitle={item.date}
            right={<Badge tone={PRIORITY_TONE[item.priority]}>{item.category}</Badge>}
          />
          <p className="mb-3 text-sm text-chalk-200">{item.body}</p>
          <div className="flex flex-wrap gap-2">
            {item.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(item, action)}
                className="rounded-card border border-pitch-600 bg-pitch-800 px-3 py-1.5 text-sm text-chalk-100 transition-transform duration-150 active:scale-95"
              >
                {action.label}
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[60dvh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-display text-xl text-chalk-100">No save loaded</p>
      <p className="text-sm text-chalk-300">Start a new career from Settings, or check your saves.</p>
    </div>
  );
}
