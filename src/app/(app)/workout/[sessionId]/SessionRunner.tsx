"use client";

import { useMemo, useState, useTransition } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSwipeable } from "react-swipeable";
import { toast } from "sonner";
import { X } from "lucide-react";
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
} from "@/app/(app)/workout/actions";
import { ExerciseList } from "@/components/workout/ExerciseList";
import type { WorkoutSession } from "@/lib/queries/sessions";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type {
  WorkoutSet,
  WorkoutSetInsert,
  LastMainSet,
} from "@/lib/queries/sets";

type Props = {
  session: WorkoutSession;
  exercises: ExerciseWithBodyParts[];
  initialSets: WorkoutSet[];
  prefillDefaults: Record<string, LastMainSet>; // exerciseId → 지난번 값
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
  isRemoving: boolean;
  onRemove: (exerciseId: string) => void;
  children: React.ReactNode;
};

function ExerciseCardWrapper({
  exerciseId,
  exerciseName,
  isActive,
  isAnyActive,
  isRemoving,
  onRemove,
  children,
}: ExerciseCardWrapperProps) {
  const [revealed, setRevealed] = useState(false);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setRevealed(true),
    onSwipedRight: () => setRevealed(false),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false, // 모바일 전용. 데스크탑은 ✕ 백업.
    delta: 30, // 30px 이상 스와이프해야 발동
  });

  return (
    <div className="relative overflow-hidden rounded-xl mt-3">
      {/* ✕ 버튼 — swipe-tracked Card 밖 absolute sibling (z-10). 탭이 swipe로 가로채지지 않음. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(exerciseId);
        }}
        disabled={isRemoving}
        className={cn(
          "absolute top-2 right-2 z-10 p-2 rounded-md",
          "text-text-muted hover:text-text hover:bg-accent-soft",
        )}
        aria-label={`${exerciseName} 운동 삭제`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* swipe-left 시 노출되는 뒤쪽 삭제 버튼 */}
      <button
        type="button"
        onClick={() => onRemove(exerciseId)}
        disabled={isRemoving}
        className="absolute right-0 top-0 bottom-0 w-20 bg-danger text-surface font-bold text-body flex items-center justify-center"
        aria-label={`${exerciseName} 운동 삭제`}
      >
        삭제
      </button>

      {/* 카드 본체 — swipe handler 여기에만 부착 */}
      <Card
        {...swipeHandlers}
        className={cn(
          "p-4 relative transition-transform duration-200 ease-soft",
          revealed && "-translate-x-20",
          isActive && "border-2 border-accent",
          !isActive && isAnyActive && "opacity-65",
        )}
        onClick={() => revealed && setRevealed(false)}
      >
        {children}
      </Card>
    </div>
  );
}

export function SessionRunner({
  session,
  exercises,
  initialSets,
  prefillDefaults,
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
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

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
        isRemoving={isRemoving}
        onRemove={handleRemoveClick}
      >
        <div className="pr-8">
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
        <header>
          <h1 className="text-h2 font-extrabold text-text">운동 진행 중</h1>
          <p className="text-caption text-text-muted">
            {new Date(session.started_at).toLocaleString("ko-KR")}
          </p>
        </header>

        {/* 모바일: 모든 운동 카드 펼침 */}
        <div className="space-y-4 lg:hidden">{exercises.map(cardFor)}</div>

        {/* lg+: active 운동 카드 1개 또는 모든 운동 완료 메시지 */}
        <div className="hidden lg:block">
          {allDone ? (
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

        <Separator />

        <Button
          className="w-full lg:max-w-xs"
          size="lg"
          variant="default"
          disabled={isFinishing || savedSets.length === 0}
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
