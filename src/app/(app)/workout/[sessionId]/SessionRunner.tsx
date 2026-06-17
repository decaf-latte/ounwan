"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
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
import { SetRow, type SetSide } from "@/components/ui/set-row";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  finishSession,
  removeExerciseFromSession,
  deleteSet,
  deleteSession,
  addExerciseToSession,
  addSidedVariantToSession,
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
import type { CardioLog } from "@/lib/queries/cardio";

type Props = {
  session: WorkoutSession;
  exercises: ExerciseWithBodyParts[];
  initialSets: WorkoutSet[];
  prefillDefaults: Record<string, LastMainSet>; // exerciseId → 지난번 값
  initialCardio: CardioLog[];
  /** 세션에 추가할 수 있는 전체 사용자 운동 카탈로그 */
  catalog: ExerciseWithBodyParts[];
};

type DraftSet = {
  setNumber: number;
  weightKg: string;
  reps: string;
  side: SetSide;
};

/** 변형 카드 (한쪽씩) — 이름 끝이 (왼쪽) / (오른쪽) */
function inferVariantSide(name: string): SetSide {
  if (name.endsWith("(왼쪽)")) return "left";
  if (name.endsWith("(오른쪽)")) return "right";
  return "both";
}

type SaveSetVars = {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  side: SetSide;
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
  catalog,
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
      const cardSide = inferVariantSide(ex.name);

      if (existing.length > 0) {
        out[ex.id] = existing.map((s) => ({
          setNumber: s.set_number,
          weightKg: s.weight_kg?.toString() ?? "",
          reps: s.reps?.toString() ?? "",
          side: ((s.side as SetSide | null) ?? cardSide) as SetSide,
        }));
        while (out[ex.id].length < n) {
          out[ex.id].push({
            setNumber: out[ex.id].length + 1,
            weightKg: defaultWeight,
            reps: defaultReps,
            side: cardSide,
          });
        }
      } else {
        out[ex.id] = Array.from({ length: n }, (_, i) => ({
          setNumber: i + 1,
          weightKg: defaultWeight,
          reps: defaultReps,
          side: cardSide,
        }));
      }
    }
    return out;
  });

  const [savedSets, setSavedSets] = useState<WorkoutSet[]>(initialSets);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  // router.refresh() 후 새로 추가된 운동(변형 카드 등)에 drafts 슬롯 초기화.
  // 첫 마운트 후 exercises prop이 변경될 때 동기화한다.
  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const ex of exercises) {
        if (next[ex.id]) continue;
        const n = ex.default_sets ?? 3;
        const prefill = prefillDefaults[ex.id];
        const defaultWeight =
          prefill?.weightKg != null ? String(prefill.weightKg) : "";
        const defaultReps = prefill?.reps != null ? String(prefill.reps) : "";
        const cardSide = inferVariantSide(ex.name);
        next[ex.id] = Array.from({ length: n }, (_, i) => ({
          setNumber: i + 1,
          weightKg: defaultWeight,
          reps: defaultReps,
          side: cardSide,
        }));
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [exercises, prefillDefaults]);
  const [isFinishing, startFinish] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [, startSetDelete] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [cardioCount, setCardioCount] = useState(initialCardio.length);
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false);
  const [isDeletingSession, startDeleteSession] = useTransition();
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [isAddingExercise, startAddExercise] = useTransition();
  const router = useRouter();

  const addableExercises = useMemo(() => {
    const inSession = new Set(exercises.map((e) => e.id));
    const q = exerciseSearch.trim().toLowerCase();
    return catalog
      .filter((e) => !inSession.has(e.id))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [catalog, exercises, exerciseSearch]);

  const handleAddExercise = (exerciseId: string) => {
    startAddExercise(async () => {
      const result = await addExerciseToSession({
        sessionId: session.id,
        exerciseId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("운동 추가됨");
      setAddExerciseOpen(false);
      setExerciseSearch("");
      router.refresh();
    });
  };

  const handleAddSet = (exerciseId: string, side: SetSide = "both") => {
    setDrafts((prev) => {
      const list = prev[exerciseId] ?? [];
      const last = list[list.length - 1];
      const next: DraftSet = {
        setNumber: (last?.setNumber ?? 0) + 1,
        weightKg: last?.weightKg ?? "",
        reps: last?.reps ?? "",
        side,
      };
      return { ...prev, [exerciseId]: [...list, next] };
    });
  };

  const handleAddVariant = (
    parentExerciseId: string,
    parentName: string,
    side: "left" | "right",
  ) => {
    const sideKo = side === "left" ? "왼쪽" : "오른쪽";
    if (!window.confirm(`${parentName} (${sideKo}) 추가할까요?`)) return;
    startAddExercise(async () => {
      const result = await addSidedVariantToSession({
        sessionId: session.id,
        parentExerciseId,
        side,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${parentName} (${sideKo}) 추가됨`);
      router.refresh();
    });
  };

  const handleRemoveLastDraft = (exerciseId: string) => {
    const list = drafts[exerciseId] ?? [];
    if (list.length === 0) return;
    const last = list[list.length - 1];
    const savedTarget = savedSets.find(
      (s) =>
        s.exercise_id === exerciseId &&
        s.set_number === last.setNumber &&
        s.parent_set_id === null,
    );

    if (!savedTarget) {
      setDrafts((prev) => ({ ...prev, [exerciseId]: list.slice(0, -1) }));
      return;
    }

    // 저장된 세트면 DB에서도 삭제 (optimistic: 둘 다 즉시 제거, 실패 시 롤백)
    const prevSaved = savedSets;
    const prevDrafts = drafts;
    setSavedSets((curr) => curr.filter((s) => s.id !== savedTarget.id));
    setDrafts((prev) => ({ ...prev, [exerciseId]: list.slice(0, -1) }));
    startSetDelete(async () => {
      const result = await deleteSet(savedTarget.id);
      if (!result.ok) {
        setSavedSets(prevSaved);
        setDrafts(prevDrafts);
        toast.error(result.error);
      }
    });
  };

  const handleDeleteSession = () => {
    startDeleteSession(async () => {
      const result = await deleteSession(session.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("세션 삭제됨");
      router.replace("/workout/new");
    });
  };

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
      const totalDrafts = drafts[ex.id]?.length ?? 0;
      const savedMainSets = savedSets.filter(
        (s) => s.exercise_id === ex.id && s.parent_set_id === null,
      ).length;
      if (savedMainSets < totalDrafts) return ex.id;
    }
    return null;
  }, [exercises, drafts, savedSets]);

  // 사용자가 고른 운동이 완료(또는 삭제)되면 무시 → computedActiveId가 다음 운동을 가리킴.
  const effectivePickedId = useMemo(() => {
    if (!userPickedExId) return null;
    const target = exercises.find((e) => e.id === userPickedExId);
    if (!target) return null;
    const totalDrafts = drafts[userPickedExId]?.length ?? 0;
    const saved = savedSets.filter(
      (s) => s.exercise_id === userPickedExId && s.parent_set_id === null,
    ).length;
    if (saved >= totalDrafts) return null;
    return userPickedExId;
  }, [userPickedExId, exercises, drafts, savedSets]);

  const activeExerciseId = effectivePickedId ?? computedActiveId;
  const allDone = activeExerciseId === null;

  const completionByEx = useMemo(() => {
    const out: Record<string, { saved: number; target: number }> = {};
    for (const ex of exercises) {
      const saved = savedSets.filter(
        (s) => s.exercise_id === ex.id && s.parent_set_id === null,
      ).length;
      out[ex.id] = { saved, target: drafts[ex.id]?.length ?? 0 };
    }
    return out;
  }, [exercises, drafts, savedSets]);

  const saveSet = useMutation<WorkoutSet, Error, SaveSetVars, SaveSetCtx>({
    mutationFn: async (vars) => {
      const payload: WorkoutSetInsert = {
        session_id: session.id,
        exercise_id: vars.exerciseId,
        set_number: vars.setNumber,
        weight_kg: vars.weightKg,
        reps: vars.reps,
        side: vars.side,
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
        side: vars.side,
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
          {(drafts[ex.id] ?? []).map((draft, idx) => {
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
                side={draft.side}
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
                    side: draft.side,
                  });
                }}
              />
            );
          })}
          {!editMode &&
            (inferVariantSide(ex.name) !== "both" ? (
              // 변형 카드 (X (왼쪽) / X (오른쪽)) — 단일 + 세트 추가
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleAddSet(ex.id, inferVariantSide(ex.name))
                  }
                >
                  + 세트 추가
                </Button>
                {(drafts[ex.id]?.length ?? 0) > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLastDraft(ex.id)}
                    className="ml-auto text-text-muted"
                  >
                    − 세트
                  </Button>
                )}
              </div>
            ) : (
              // 원본 카드 — 양쪽 / 왼쪽 / 오른쪽 (왼/오는 변형 카드 새로 생성)
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-caption text-text-muted mr-1">
                  + 세트:
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddSet(ex.id, "both")}
                >
                  양쪽
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isAddingExercise}
                  onClick={() => handleAddVariant(ex.id, ex.name, "left")}
                >
                  왼쪽
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isAddingExercise}
                  onClick={() => handleAddVariant(ex.id, ex.name, "right")}
                >
                  오른쪽
                </Button>
                {(drafts[ex.id]?.length ?? 0) > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLastDraft(ex.id)}
                    className="ml-auto text-text-muted"
                  >
                    − 세트
                  </Button>
                )}
              </div>
            ))}
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddExerciseOpen(true)}
              disabled={isAddingExercise}
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" />
              운동
            </Button>
            <Button
              variant={editMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? "완료" : "편집"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="세션 삭제"
              onClick={() => setDeleteSessionOpen(true)}
              disabled={isDeletingSession}
            >
              <Trash2 className="w-4 h-4 text-text-muted" />
            </Button>
          </div>
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

      <Dialog open={addExerciseOpen} onOpenChange={setAddExerciseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>운동 추가</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            placeholder="운동 이름 검색"
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
            className="w-full p-2 bg-surface border border-accent-soft rounded-md text-body focus:border-accent focus:outline-none"
            autoFocus
          />
          <ul className="max-h-72 overflow-y-auto -mx-1 mt-2">
            {addableExercises.length === 0 ? (
              <li className="px-3 py-4 text-caption text-text-muted text-center">
                {catalog.length === 0
                  ? "사용 가능한 운동이 없어요"
                  : "이미 세션에 모두 들어있어요"}
              </li>
            ) : (
              addableExercises.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => handleAddExercise(ex.id)}
                    disabled={isAddingExercise}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent-soft transition-colors text-body text-text disabled:opacity-50"
                  >
                    {ex.name}
                  </button>
                </li>
              ))
            )}
          </ul>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost">닫기</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteSessionOpen} onOpenChange={setDeleteSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 세션을 통째로 삭제할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-text-muted">
            저장한 모든 운동·세트·유산소가 함께 지워집니다. 되돌릴 수 없어요.
          </p>
          <DialogFooter>
            <DialogClose
              disabled={isDeletingSession}
              render={<Button variant="ghost">취소</Button>}
            />
            <Button
              variant="default"
              disabled={isDeletingSession}
              onClick={handleDeleteSession}
            >
              {isDeletingSession ? "삭제 중..." : "세션 삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
