"use client";

import { useMemo, useState, useTransition } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SetRow } from "@/components/ui/set-row";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  finishSession,
  removeExerciseFromSession,
  deleteSet,
} from "@/app/(app)/workout/actions";
import { ExerciseList } from "@/components/workout/ExerciseList";
import { CardioCard } from "@/components/workout/CardioCard";
import type { WorkoutSession } from "@/lib/queries/sessions";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type {
  WorkoutSet,
  WorkoutSetInsert,
  LastMainSet,
} from "@/lib/queries/sets";
import type { CardioLog } from "@/lib/queries/cardio-types";

type Props = {
  session: WorkoutSession;
  exercises: ExerciseWithBodyParts[];
  initialSets: WorkoutSet[];
  prefillDefaults: Record<string, LastMainSet>; // exerciseId → 지난번 값
  initialCardio: CardioLog[];
};

type DraftSet = {
  setNumber: number;
  weightKg: string;
  reps: string;
};

type SaveSetVars = {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
};

type SaveSetCtx = {
  tempId: string;
  key: string;
};

type ExerciseCardWrapperProps = {
  exerciseId: string;
  exerciseName: string;
  isActive: boolean;
  isAnyActive: boolean;
  editMode: boolean;
  isRemoving: boolean;
  onRemove: (exerciseId: string) => void;
  /** 있으면 카드 탭으로 이 운동을 활성화 (비활성 카드에만 전달) */
  onSelect?: () => void;
  children: React.ReactNode;
};

function ExerciseCardWrapper({
  exerciseId,
  exerciseName,
  isActive,
  isAnyActive,
  editMode,
  isRemoving,
  onRemove,
  onSelect,
  children,
}: ExerciseCardWrapperProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "p-4 relative mt-3",
        // 진행 강조(테두리/흐림)는 평소에만. 편집 중엔 모든 카드 동일하게 보여 삭제 편하게.
        !editMode && isActive && "border-2 border-accent",
        !editMode && !isActive && isAnyActive && "opacity-65",
        onSelect && "cursor-pointer hover:opacity-100 hover:border-accent/40",
      )}
    >
      {editMode && (
        <button
          type="button"
          onClick={() => onRemove(exerciseId)}
          disabled={isRemoving}
          className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-danger/10 text-danger text-caption font-semibold hover:bg-danger/20 disabled:opacity-50"
          aria-label={`${exerciseName} 운동 삭제`}
        >
          운동 삭제
        </button>
      )}
      {onSelect && (
        <span className="absolute top-3 right-3 text-caption text-accent font-semibold">
          탭하여 선택
        </span>
      )}
      {children}
    </Card>
  );
}

export function SessionRunner({
  session,
  exercises,
  initialSets,
  prefillDefaults,
  initialCardio,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>(() => {
    const out: Record<string, DraftSet[]> = {};
    for (const ex of exercises) {
      const existing = initialSets
        .filter((s) => s.exercise_id === ex.id && s.parent_set_id === null)
        .sort((a, b) => a.set_number - b.set_number);
      const n = ex.default_sets ?? 3;
      // prefill 값 (없으면 빈 문자열)
      const prefill = prefillDefaults[ex.id];
      const defaultWeight =
        prefill?.weightKg != null ? String(prefill.weightKg) : "";
      const defaultReps = prefill?.reps != null ? String(prefill.reps) : "";

      if (existing.length > 0) {
        out[ex.id] = existing.map((s) => ({
          setNumber: s.set_number,
          weightKg: s.weight_kg?.toString() ?? "",
          reps: s.reps?.toString() ?? "",
        }));
        while (out[ex.id].length < n) {
          out[ex.id].push({
            setNumber: out[ex.id].length + 1,
            weightKg: defaultWeight,
            reps: defaultReps,
          });
        }
      } else {
        out[ex.id] = Array.from({ length: n }, (_, i) => ({
          setNumber: i + 1,
          weightKg: defaultWeight,
          reps: defaultReps,
        }));
      }
    }
    return out;
  });

  const [savedSets, setSavedSets] = useState<WorkoutSet[]>(initialSets);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [isFinishing, startFinish] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [, startSetDelete] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [cardioCount, setCardioCount] = useState(initialCardio.length);

  // 편집 모드: done 세트 1개 삭제 (optimistic + 실패 시 롤백)
  const handleDeleteSet = (exerciseId: string, setNumber: number) => {
    const target = savedSets.find(
      (s) =>
        s.exercise_id === exerciseId &&
        s.set_number === setNumber &&
        s.parent_set_id === null,
    );
    if (!target) return;
    const prev = savedSets;
    setSavedSets((curr) => curr.filter((s) => s.id !== target.id));
    startSetDelete(async () => {
      const result = await deleteSet(target.id);
      if (!result.ok) {
        setSavedSets(prev);
        toast.error(result.error);
      }
    });
  };

  const setKey = (exId: string, n: number) => `${exId}:${n}`;
  const isSaved = (exerciseId: string, setNumber: number) =>
    savedSets.some(
      (s) =>
        s.exercise_id === exerciseId &&
        s.set_number === setNumber &&
        s.parent_set_id === null,
    );

  const [userPickedExId, setUserPickedExId] = useState<string | null>(null);

  const computedActiveId = useMemo(() => {
    for (const ex of exercises) {
      const targetSets = ex.default_sets ?? 3;
      const savedMainSets = savedSets.filter(
        (s) => s.exercise_id === ex.id && s.parent_set_id === null,
      ).length;
      if (savedMainSets < targetSets) return ex.id;
    }
    return null;
  }, [exercises, savedSets]);

  // 사용자가 고른 운동이 완료(또는 삭제)되면 무시 → computedActiveId가 다음 운동을 가리킴.
  // setState-in-effect 대신 순수 파생으로 처리 (stale pick 자동 해소).
  const effectivePickedId = useMemo(() => {
    if (!userPickedExId) return null;
    const target = exercises.find((e) => e.id === userPickedExId);
    if (!target) return null;
    const targetSets = target.default_sets ?? 3;
    const saved = savedSets.filter(
      (s) => s.exercise_id === userPickedExId && s.parent_set_id === null,
    ).length;
    if (saved >= targetSets) return null;
    return userPickedExId;
  }, [userPickedExId, exercises, savedSets]);

  const activeExerciseId = effectivePickedId ?? computedActiveId;
  const allDone = activeExerciseId === null;

  const completionByEx = useMemo(() => {
    const out: Record<string, { saved: number; target: number }> = {};
    for (const ex of exercises) {
      const saved = savedSets.filter(
        (s) => s.exercise_id === ex.id && s.parent_set_id === null,
      ).length;
      out[ex.id] = { saved, target: ex.default_sets ?? 3 };
    }
    return out;
  }, [exercises, savedSets]);

  const saveSet = useMutation<WorkoutSet, Error, SaveSetVars, SaveSetCtx>({
    mutationFn: async (vars) => {
      const payload: WorkoutSetInsert = {
        session_id: session.id,
        exercise_id: vars.exerciseId,
        set_number: vars.setNumber,
        weight_kg: vars.weightKg,
        reps: vars.reps,
        side: "both",
        drop_order: 0,
        parent_set_id: null,
      };
      const { data, error } = await supabase
        .from("workout_sets")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkoutSet;
    },
    onMutate: async (vars) => {
      const tempId = `temp-${vars.exerciseId}-${vars.setNumber}-${Date.now()}`;
      const key = setKey(vars.exerciseId, vars.setNumber);
      const optimistic: WorkoutSet = {
        id: tempId,
        session_id: session.id,
        exercise_id: vars.exerciseId,
        set_number: vars.setNumber,
        weight_kg: vars.weightKg,
        reps: vars.reps,
        side: "both",
        drop_order: 0,
        parent_set_id: null,
        memo: null,
        created_at: new Date().toISOString(),
      };
      setPendingKeys((prev) => new Set(prev).add(key));
      setSavedSets((curr) => [...curr, optimistic]);
      return { tempId, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        setSavedSets((curr) => curr.filter((s) => s.id !== ctx.tempId));
        setPendingKeys((p) => {
          const n = new Set(p);
          n.delete(ctx.key);
          return n;
        });
      }
      toast.error("저장 실패. 다시 시도해주세요.");
      console.error(err);
    },
    onSuccess: (data, _vars, ctx) => {
      setSavedSets((curr) =>
        curr.map((s) => (ctx && s.id === ctx.tempId ? data : s)),
      );
      if (ctx) {
        setPendingKeys((p) => {
          const n = new Set(p);
          n.delete(ctx.key);
          return n;
        });
      }
    },
  });

  const handleFinish = () => {
    startFinish(async () => {
      // celebrate를 redirect 전에 호출 (페이지 떠나기 전 1프레임)
      void celebrate();
      const result = await finishSession(session.id);
      if (result && result.ok === false) {
        toast.error(result.error);
      }
    });
  };

  const hasSavedSetsFor = (exerciseId: string): boolean =>
    savedSets.some(
      (s) => s.exercise_id === exerciseId && s.parent_set_id === null,
    );

  const handleRemoveClick = (exerciseId: string) => {
    if (hasSavedSetsFor(exerciseId)) {
      // 저장된 세트 있음 — 확인 다이얼로그
      setRemoveTarget(exerciseId);
    } else {
      // 즉시 삭제
      confirmRemove(exerciseId);
    }
  };

  const confirmRemove = (exerciseId: string) => {
    startRemove(async () => {
      const remaining = exercises
        .filter((e) => e.id !== exerciseId)
        .map((e) => e.id);
      const result = await removeExerciseFromSession({
        sessionId: session.id,
        exerciseId,
        remainingExerciseIds: remaining,
      });
      if (result && result.ok === false) {
        toast.error(result.error);
      }
      setRemoveTarget(null);
    });
  };

  const cardFor = (ex: ExerciseWithBodyParts) => {
    const prefill = prefillDefaults[ex.id];
    return (
      <ExerciseCardWrapper
        key={ex.id}
        exerciseId={ex.id}
        exerciseName={ex.name}
        isActive={ex.id === activeExerciseId}
        isAnyActive={activeExerciseId !== null}
        editMode={editMode}
        isRemoving={isRemoving}
        onRemove={handleRemoveClick}
        onSelect={
          !editMode && ex.id !== activeExerciseId
            ? () => setUserPickedExId(ex.id)
            : undefined
        }
      >
        <div className={cn(editMode ? "pr-24" : "pr-2")}>
          <div className="text-h3 font-extrabold text-text">{ex.name}</div>
          {prefill && (prefill.weightKg != null || prefill.reps != null) && (
            <div className="text-caption text-text-muted mt-0.5">
              지난번 {prefill.weightKg ?? "-"}kg × {prefill.reps ?? "-"}
            </div>
          )}
        </div>
        <div className="mt-1">
          {drafts[ex.id].map((draft, idx) => {
            const saved = isSaved(ex.id, draft.setNumber);
            const isActive = ex.id === activeExerciseId && !saved;
            const status = saved ? "done" : isActive ? "active" : "upcoming";
            const isPending = pendingKeys.has(setKey(ex.id, draft.setNumber));

            return (
              <SetRow
                key={idx}
                setNumber={draft.setNumber}
                status={status}
                weight={draft.weightKg}
                reps={draft.reps}
                onWeightChange={(v) =>
                  setDrafts((prev) => {
                    const copy = { ...prev };
                    copy[ex.id] = [...copy[ex.id]];
                    copy[ex.id][idx] = { ...draft, weightKg: v };
                    return copy;
                  })
                }
                onRepsChange={(v) =>
                  setDrafts((prev) => {
                    const copy = { ...prev };
                    copy[ex.id] = [...copy[ex.id]];
                    copy[ex.id][idx] = { ...draft, reps: v };
                    return copy;
                  })
                }
                checkDisabled={isPending || !draft.weightKg || !draft.reps}
                onDelete={
                  editMode && saved
                    ? () => handleDeleteSet(ex.id, draft.setNumber)
                    : undefined
                }
                onCheck={() => {
                  const w = parseFloat(draft.weightKg);
                  const r = parseInt(draft.reps, 10);
                  if (
                    !Number.isFinite(w) ||
                    !Number.isFinite(r) ||
                    w < 0 ||
                    r <= 0
                  ) {
                    toast.error(
                      "무게(0 이상)와 회수(1 이상)를 올바르게 입력하세요",
                    );
                    return;
                  }
                  saveSet.mutate({
                    exerciseId: ex.id,
                    setNumber: draft.setNumber,
                    weightKg: w,
                    reps: r,
                  });
                }}
              />
            );
          })}
        </div>
      </ExerciseCardWrapper>
    );
  };

  return (
    <div className="lg:flex lg:gap-6">
      <ExerciseList
        exercises={exercises}
        activeExerciseId={activeExerciseId}
        completionByEx={completionByEx}
        onSelectExercise={setUserPickedExId}
      />

      <div className="flex-1 space-y-4 min-w-0">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-h2 font-extrabold text-text">운동 진행 중</h1>
            <p className="text-caption text-text-muted">
              {new Date(session.started_at).toLocaleString("ko-KR")}
            </p>
          </div>
          <Button
            variant={editMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "완료" : "편집"}
          </Button>
        </header>

        {/* 모바일: 모든 운동 카드 펼침 */}
        <div className="space-y-4 lg:hidden">{exercises.map(cardFor)}</div>

        {/* lg+: 편집 중엔 전체, 평소엔 active 1개 또는 완료 메시지 */}
        <div className="hidden lg:block">
          {editMode ? (
            exercises.map(cardFor)
          ) : allDone ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-h2 font-extrabold text-accent">
                모든 운동 완료 🎉
              </p>
              <p className="text-body text-text-muted">
                아래 버튼으로 세션을 끝낼 수 있어요.
              </p>
            </div>
          ) : (
            exercises.filter((ex) => ex.id === activeExerciseId).map(cardFor)
          )}
        </div>

        {/* 유산소 — 항상 최하단 */}
        <CardioCard
          sessionId={session.id}
          initialCardio={initialCardio}
          onCountChange={setCardioCount}
        />

        <Separator />

        <Button
          className="w-full lg:max-w-xs"
          size="lg"
          variant="default"
          disabled={
            isFinishing || (savedSets.length === 0 && cardioCount === 0)
          }
          onClick={handleFinish}
        >
          {isFinishing ? "종료 중..." : "운동 종료"}
        </Button>
      </div>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 운동 삭제할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-text-muted">
            이미 저장한 세트도 같이 지워집니다. 되돌릴 수 없어요.
          </p>
          <DialogFooter>
            <DialogClose
              disabled={isRemoving}
              render={<Button variant="ghost">취소</Button>}
            />
            <Button
              variant="default"
              disabled={isRemoving}
              onClick={() => removeTarget && confirmRemove(removeTarget)}
            >
              {isRemoving ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
