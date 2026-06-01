"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { recommendExercises } from "@/lib/workout/recommendation";
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

  const toggleBP = (id: number) => {
    setSelectedBP((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowRecommendations(false);
  };

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

  const handleStart = () => {
    startTransition(async () => {
      const result = await startSession({
        bodyPartIds: [...selectedBP],
        recommendedExerciseIds: recommendations.map((r) => r.exerciseId),
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
                  setShowRecommendations(false);
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
                  <li
                    key={r.exerciseId}
                    className="rounded-md border border-accent-soft bg-surface p-3 text-body"
                  >
                    <div className="font-bold text-text">{ex.name}</div>
                    <div className="text-caption text-text-muted mt-0.5">
                      기본 {ex.default_sets ?? 3}세트
                      {ex.default_reps_min && ex.default_reps_max
                        ? ` · ${ex.default_reps_min}~${ex.default_reps_max}회`
                        : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
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
            recommendations.length === 0
          }
          onClick={handleStart}
        >
          {isPending ? "시작 중..." : "운동 시작"}
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
