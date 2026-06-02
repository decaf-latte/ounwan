"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ExerciseRecCard } from "./ExerciseRecCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  recommendExercises,
  candidatesForBodyParts,
} from "@/lib/workout/recommendation";
import { startSession, saveTemplate } from "@/app/(app)/workout/actions";
import { BodyPartChip } from "@/components/ui/body-part-chip";
import type { StartFormProps } from "./start-form-types";

export function StartForm({
  bodyParts,
  exercises,
  templates,
  recentSets,
}: StartFormProps) {
  const [selectedBP, setSelectedBP] = useState<Set<number>>(new Set());
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [excludedExerciseIds, setExcludedExerciseIds] = useState<Set<string>>(
    new Set(),
  );
  // 추천 상위 3개 밖에서 사용자가 직접 추가한 운동 (기본 미포함)
  const [addedExerciseIds, setAddedExerciseIds] = useState<Set<string>>(
    new Set(),
  );
  const [showOthers, setShowOthers] = useState(false);

  const resetSelection = () => {
    setShowRecommendations(false);
    setExcludedExerciseIds(new Set());
    setAddedExerciseIds(new Set());
    setShowOthers(false);
  };

  const toggleBP = (id: number) => {
    setSelectedBP((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    resetSelection(); // 부위 바뀌면 추천/추가 선택 모두 초기화
  };

  const toggleInclude = useCallback((exId: string, included: boolean) => {
    setExcludedExerciseIds((prev) => {
      const next = new Set(prev);
      if (included) next.delete(exId);
      else next.add(exId);
      return next;
    });
  }, []);

  // "다른 운동" 목록 토글 — 기본 미포함이므로 included=추가됨 여부
  const toggleAdded = useCallback((exId: string, included: boolean) => {
    setAddedExerciseIds((prev) => {
      const next = new Set(prev);
      if (included) next.add(exId);
      else next.delete(exId);
      return next;
    });
  }, []);

  const recommendations = useMemo(() => {
    if (selectedBP.size === 0) return [];
    return recommendExercises({
      bodyPartIds: [...selectedBP],
      exercises,
      recentSets,
      perBodyPart: 3,
    });
  }, [selectedBP, exercises, recentSets]);

  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  const recommendedExerciseIds = useMemo(
    () =>
      recommendations
        .map((r) => r.exerciseId)
        .filter((id) => !excludedExerciseIds.has(id)),
    [recommendations, excludedExerciseIds],
  );

  // 추천 상위 3개 밖의 등/기타 운동 (로잉머신 등) — 직접 추가용
  const otherCandidates = useMemo(() => {
    if (selectedBP.size === 0) return [];
    const recIds = new Set(recommendations.map((r) => r.exerciseId));
    return candidatesForBodyParts(exercises, [...selectedBP])
      .filter((ex) => !recIds.has(ex.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [selectedBP, exercises, recommendations]);

  // 최종 선택 = (추천 − 제외) ∪ (직접 추가)
  const selectedExerciseIds = useMemo(() => {
    const out = [...recommendedExerciseIds];
    for (const id of addedExerciseIds) if (!out.includes(id)) out.push(id);
    return out;
  }, [recommendedExerciseIds, addedExerciseIds]);

  const handleStart = () => {
    startTransition(async () => {
      const result = await startSession({
        bodyPartIds: [...selectedBP],
        recommendedExerciseIds: selectedExerciseIds,
        templateId: null,
      });
      if (result && result.ok === false) {
        toast.error(result.error);
      }
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveTemplate({
        name: templateName,
        bodyPartIds: [...selectedBP],
      });
      if (result.ok === false) {
        toast.error(result.error);
        return;
      }
      toast.success("템플릿 저장됨");
      setSaveOpen(false);
      setTemplateName("");
    });
  };

  return (
    <div className="space-y-6">
      <section className="mt-6">
        <h2 className="text-caption font-semibold text-text-muted mb-2">
          부위 선택
        </h2>
        <div className="flex flex-wrap gap-2">
          {bodyParts.map((bp) => (
            <BodyPartChip
              key={bp.id}
              label={bp.name_ko}
              selected={selectedBP.has(bp.id)}
              onClick={() => toggleBP(bp.id)}
            />
          ))}
        </div>
      </section>

      {templates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
            저장된 분할
          </h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Badge
                key={t.id}
                variant="outline"
                className="cursor-pointer px-3 py-1.5"
                onClick={() => {
                  setSelectedBP(
                    new Set(
                      t.routine_template_body_parts.map((m) => m.body_part_id),
                    ),
                  );
                  resetSelection();
                }}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <Separator />

      <Button
        type="button"
        variant="outline"
        disabled={selectedBP.size === 0}
        onClick={() => setShowRecommendations(true)}
      >
        추천 보기 ({selectedBP.size}개 부위)
      </Button>

      {showRecommendations && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            추천 운동 ({recommendations.length}개)
          </h2>
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                선택한 부위의 운동이 카탈로그에 없습니다.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2 mt-3">
              {recommendations.map((r) => {
                const ex = exerciseById.get(r.exerciseId);
                if (!ex) return null;
                return (
                  <li key={r.exerciseId}>
                    <ExerciseRecCard
                      exercise={ex}
                      included={!excludedExerciseIds.has(r.exerciseId)}
                      onToggle={toggleInclude}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {otherCandidates.length > 0 && (
            <div className="pt-1">
              {!showOthers ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowOthers(true)}
                >
                  다른 운동 추가 ({otherCandidates.length})
                </Button>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    다른 운동 — 직접 추가
                  </h3>
                  <ul className="space-y-2">
                    {otherCandidates.map((ex) => (
                      <li key={ex.id}>
                        <ExerciseRecCard
                          exercise={ex}
                          included={addedExerciseIds.has(ex.id)}
                          onToggle={toggleAdded}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          disabled={
            isPending ||
            selectedBP.size === 0 ||
            !showRecommendations ||
            selectedExerciseIds.length === 0
          }
          onClick={handleStart}
        >
          {isPending
            ? "시작 중..."
            : `운동 시작 (${selectedExerciseIds.length})`}
        </Button>

        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger
            disabled={isPending || selectedBP.size === 0}
            render={
              <Button type="button" variant="ghost" className="w-full">
                이 분할 저장
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>분할 이름</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="tpl-name">예: 가슴+어깨</Label>
              <Input
                id="tpl-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="가슴+어깨"
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose
                disabled={isPending}
                render={<Button variant="ghost">취소</Button>}
              />
              <Button
                onClick={handleSave}
                disabled={isPending || !templateName.trim()}
              >
                {isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
