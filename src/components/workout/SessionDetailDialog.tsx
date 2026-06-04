// src/components/workout/SessionDetailDialog.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchSessionWithDetailsClient } from "@/lib/queries/sessions-client";
import { bodyPartStyle } from "@/lib/workout/body-part-color";
import {
  deleteSession,
  deleteSessionExercise,
  deleteSet,
} from "@/app/(app)/workout/actions";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => fetchSessionWithDetailsClient(sessionId!),
    enabled: !!sessionId,
  });

  // 운동/세트 삭제 후 — 모달 내용 + 캘린더/리스트 갱신
  const refreshDetail = () => {
    queryClient.invalidateQueries({ queryKey: ["session-detail", sessionId] });
    router.refresh();
  };

  const handleDeleteSession = () => {
    if (!sessionId) return;
    if (!window.confirm("이 날 운동 기록을 통째로 삭제할까요? 되돌릴 수 없어요.")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteSession(sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("세션을 삭제했어요");
      onClose();
      router.refresh();
    });
  };

  const handleDeleteExercise = (exerciseId: string, exerciseName: string) => {
    if (!sessionId) return;
    if (!window.confirm(`'${exerciseName}' 기록을 삭제할까요?`)) return;
    startTransition(async () => {
      const result = await deleteSessionExercise({ sessionId, exerciseId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("운동을 삭제했어요");
      refreshDetail();
    });
  };

  const handleDeleteSet = (setId: string) => {
    startTransition(async () => {
      const result = await deleteSet(setId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refreshDetail();
    });
  };

  return (
    <Dialog open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md lg:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>
              {data ? formatDateKo(data.started_at) : "세션 상세"}
            </DialogTitle>
            {data && (
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={handleDeleteSession}
                aria-label="세션 전체 삭제"
                className="text-text-muted hover:text-danger"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
          </div>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <p className="text-body text-text-muted">
            불러올 수 없어요. 다시 시도해 주세요.
          </p>
        ) : data ? (
          data.exercises.length === 0 ? (
            <p className="text-body text-text-muted py-8 text-center">
              남은 운동 기록이 없어요. 닫으면 목록에서 사라집니다.
            </p>
          ) : (
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
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-h3 font-bold text-text">{ex.name}</h3>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDeleteExercise(ex.id, ex.name)}
                      aria-label={`${ex.name} 운동 삭제`}
                      className="shrink-0 p-1 rounded text-text-muted hover:text-danger hover:bg-accent-soft disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {ex.sets.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 text-caption text-text-muted"
                      >
                        <span>
                          {s.set_number}세트 · {s.weight_kg ?? "-"}kg ×{" "}
                          {s.reps ?? "-"}회
                        </span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteSet(s.id)}
                          aria-label={`${s.set_number}세트 삭제`}
                          className="shrink-0 p-1 rounded text-text-ghost hover:text-danger hover:bg-accent-soft disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
