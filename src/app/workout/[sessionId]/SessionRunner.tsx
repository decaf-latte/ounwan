"use client";

import { useMemo, useState, useTransition } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { finishSession } from "@/app/workout/actions";
import type { WorkoutSession } from "@/lib/queries/sessions";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type { WorkoutSet, WorkoutSetInsert } from "@/lib/queries/sets";

type Props = {
  session: WorkoutSession;
  exercises: ExerciseWithBodyParts[];
  initialSets: WorkoutSet[];
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

export function SessionRunner({ session, exercises, initialSets }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>(() => {
    const out: Record<string, DraftSet[]> = {};
    for (const ex of exercises) {
      const existing = initialSets
        .filter((s) => s.exercise_id === ex.id && s.parent_set_id === null)
        .sort((a, b) => a.set_number - b.set_number);
      const n = ex.default_sets ?? 3;
      if (existing.length > 0) {
        out[ex.id] = existing.map((s) => ({
          setNumber: s.set_number,
          weightKg: s.weight_kg?.toString() ?? "",
          reps: s.reps?.toString() ?? "",
        }));
        while (out[ex.id].length < n) {
          out[ex.id].push({
            setNumber: out[ex.id].length + 1,
            weightKg: "",
            reps: "",
          });
        }
      } else {
        out[ex.id] = Array.from({ length: n }, (_, i) => ({
          setNumber: i + 1,
          weightKg: "",
          reps: "",
        }));
      }
    }
    return out;
  });

  const [savedSets, setSavedSets] = useState<WorkoutSet[]>(initialSets);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [isFinishing, startFinish] = useTransition();

  const setKey = (exId: string, n: number) => `${exId}:${n}`;
  const isSaved = (exerciseId: string, setNumber: number) =>
    savedSets.some(
      (s) =>
        s.exercise_id === exerciseId &&
        s.set_number === setNumber &&
        s.parent_set_id === null,
    );

  const updateDraft = (
    exId: string,
    idx: number,
    patch: Partial<DraftSet>,
  ) => {
    setDrafts((prev) => {
      const copy = { ...prev };
      copy[exId] = [...copy[exId]];
      copy[exId][idx] = { ...copy[exId][idx], ...patch };
      return copy;
    });
  };

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
      const result = await finishSession(session.id);
      if (result && result.ok === false) {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">운동 진행 중</h1>
        <p className="text-xs text-muted-foreground">
          {new Date(session.started_at).toLocaleString("ko-KR")}
        </p>
      </header>

      {exercises.map((ex) => (
        <Card key={ex.id}>
          <CardHeader>
            <CardTitle className="text-base">{ex.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts[ex.id].map((draft, idx) => {
              const saved = isSaved(ex.id, draft.setNumber);
              const pending = pendingKeys.has(setKey(ex.id, draft.setNumber));
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="w-10 text-muted-foreground">
                    {draft.setNumber}세트
                  </span>
                  <Input
                    inputMode="decimal"
                    type="number"
                    step="0.5"
                    placeholder="kg"
                    className="flex-1"
                    disabled={saved}
                    value={draft.weightKg}
                    onChange={(e) =>
                      updateDraft(ex.id, idx, { weightKg: e.target.value })
                    }
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    inputMode="numeric"
                    type="number"
                    placeholder="회"
                    className="flex-1"
                    disabled={saved}
                    value={draft.reps}
                    onChange={(e) =>
                      updateDraft(ex.id, idx, { reps: e.target.value })
                    }
                  />
                  <Button
                    size="sm"
                    variant={saved ? "default" : "outline"}
                    disabled={pending || saved || !draft.weightKg || !draft.reps}
                    onClick={() => {
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
                  >
                    ✓
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Separator />

      <Button
        className="w-full"
        size="lg"
        variant="default"
        disabled={isFinishing || savedSets.length === 0}
        onClick={handleFinish}
      >
        {isFinishing ? "종료 중..." : "운동 종료"}
      </Button>
    </div>
  );
}
