// src/components/workout/SessionDetailDialog.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSessionWithDetailsClient } from "@/lib/queries/sessions-client";
import { bodyPartStyle } from "@/lib/workout/body-part-color";

type Props = {
  sessionId: string | null;
  onClose: () => void;
};

function formatDateKo(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function BodyPartTag({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-caption font-medium text-text dark:saturate-90 dark:brightness-95"
      style={bodyPartStyle(color)}
    >
      {name}
    </span>
  );
}

export function SessionDetailDialog({ sessionId, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => fetchSessionWithDetailsClient(sessionId!),
    enabled: !!sessionId,
  });

  return (
    <Dialog open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {data ? formatDateKo(data.started_at) : "세션 상세"}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <p className="text-body text-text-muted">
            불러올 수 없어요. 다시 시도해 주세요.
          </p>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {data.bodyParts.map((bp) => (
                <BodyPartTag key={bp.id} name={bp.name_ko} color={bp.color} />
              ))}
            </div>
            {data.exercises.map((ex) => (
              <article
                key={ex.id}
                className="rounded-lg border border-border p-3"
              >
                <h3 className="text-h3 font-bold text-text">{ex.name}</h3>
                <div className="text-caption text-text-muted mt-1">
                  {ex.sets.map((s, i) => (
                    <span key={i}>
                      {s.weight_kg ?? "-"}kg × {s.reps ?? "-"}회
                      {i < ex.sets.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
