// src/components/workout/SessionDetailDialog.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X, Plus } from "lucide-react";
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
  addSetToSession,
} from "@/app/(app)/workout/actions";

type CatalogItem = { id: string; name: string };

type Props = {
  sessionId: string | null;
  catalog: CatalogItem[];
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

/** 무게/회수 인라인 입력 행 — 세트 추가 + 운동 추가 공용 */
function WeightRepsInput({
  weight,
  reps,
  onWeight,
  onReps,
  onSubmit,
  disabled,
}: {
  weight: string;
  reps: string;
  onWeight: (v: string) => void;
  onReps: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        placeholder="kg"
        className="min-w-0 flex-1 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={weight}
        onChange={(e) => onWeight(e.target.value)}
      />
      <span className="shrink-0 text-caption text-text-muted">×</span>
      <input
        inputMode="numeric"
        type="number"
        placeholder="회"
        className="w-16 shrink-0 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={reps}
        onChange={(e) => onReps(e.target.value)}
      />
      <Button
        size="sm"
        disabled={disabled || !weight || !reps}
        onClick={onSubmit}
      >
        추가
      </Button>
    </div>
  );
}

export function SessionDetailDialog({ sessionId, catalog, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // 세트 추가 폼 (어느 운동에 추가 중인지)
  const [addSetFor, setAddSetFor] = useState<string | null>(null);
  const [setWeight, setSetWeight] = useState("");
  const [setReps, setSetReps] = useState("");

  // 운동 추가 폼
  const [addingExercise, setAddingExercise] = useState(false);
  const [newExerciseId, setNewExerciseId] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => fetchSessionWithDetailsClient(sessionId!),
    enabled: !!sessionId,
  });

  const refreshDetail = () => {
    queryClient.invalidateQueries({ queryKey: ["session-detail", sessionId] });
    router.refresh();
  };

  const resetForms = () => {
    setAddSetFor(null);
    setSetWeight("");
    setSetReps("");
    setAddingExercise(false);
    setNewExerciseId("");
    setExWeight("");
    setExReps("");
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

  const submitAddSet = (exerciseId: string) => {
    if (!sessionId) return;
    const w = parseFloat(setWeight);
    const r = parseInt(setReps, 10);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
      toast.error("무게(0 이상)와 회수(1 이상)를 확인하세요");
      return;
    }
    startTransition(async () => {
      const result = await addSetToSession({
        sessionId,
        exerciseId,
        weightKg: w,
        reps: r,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("세트를 추가했어요");
      resetForms();
      refreshDetail();
    });
  };

  const submitAddExercise = () => {
    if (!sessionId || !newExerciseId) {
      toast.error("운동을 선택하세요");
      return;
    }
    const w = parseFloat(exWeight);
    const r = parseInt(exReps, 10);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
      toast.error("무게(0 이상)와 회수(1 이상)를 확인하세요");
      return;
    }
    startTransition(async () => {
      const result = await addSetToSession({
        sessionId,
        exerciseId: newExerciseId,
        weightKg: w,
        reps: r,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("운동을 추가했어요");
      resetForms();
      refreshDetail();
    });
  };

  return (
    <Dialog
      open={!!sessionId}
      onOpenChange={(open) => {
        if (!open) {
          resetForms();
          onClose();
        }
      }}
    >
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
          <div className="space-y-3">
            {data.bodyParts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.bodyParts.map((bp) => (
                  <BodyPartTag key={bp.id} name={bp.name_ko} color={bp.color} />
                ))}
              </div>
            )}

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

                {/* 세트 추가 */}
                {addSetFor === ex.id ? (
                  <div className="mt-2">
                    <WeightRepsInput
                      weight={setWeight}
                      reps={setReps}
                      onWeight={setSetWeight}
                      onReps={setSetReps}
                      onSubmit={() => submitAddSet(ex.id)}
                      disabled={isPending}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      resetForms();
                      setAddSetFor(ex.id);
                    }}
                    className="mt-2 flex items-center gap-1 text-caption text-accent font-semibold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> 세트 추가
                  </button>
                )}
              </article>
            ))}

            {/* 운동 추가 */}
            {addingExercise ? (
              <div className="rounded-lg border border-accent p-3 space-y-2">
                <select
                  value={newExerciseId}
                  onChange={(e) => setNewExerciseId(e.target.value)}
                  className="w-full p-2 bg-surface border border-accent-soft rounded-md text-body focus:border-accent focus:outline-none"
                >
                  <option value="">운동 선택</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <WeightRepsInput
                  weight={exWeight}
                  reps={exReps}
                  onWeight={setExWeight}
                  onReps={setExReps}
                  onSubmit={submitAddExercise}
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={resetForms}
                  className="text-caption text-text-muted hover:underline"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  resetForms();
                  setAddingExercise(true);
                }}
                className="w-full flex items-center justify-center gap-1 p-2 rounded-lg border border-dashed border-accent text-accent text-body font-semibold hover:bg-accent-soft"
              >
                <Plus className="w-4 h-4" /> 운동 추가
              </button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
