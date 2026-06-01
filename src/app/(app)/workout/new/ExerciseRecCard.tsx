// src/app/(app)/workout/new/ExerciseRecCard.tsx
"use client";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

type Props = {
  exercise: ExerciseWithBodyParts;
  included: boolean;
  onToggle: (exerciseId: string, included: boolean) => void;
};

export function ExerciseRecCard({ exercise, included, onToggle }: Props) {
  return (
    <Card
      className={cn(
        "p-3 flex items-center gap-3 transition-opacity",
        !included && "opacity-50",
      )}
    >
      <Checkbox
        id={`rec-${exercise.id}`}
        checked={included}
        onCheckedChange={(checked) => onToggle(exercise.id, checked)}
        aria-label={`${exercise.name} ${included ? "제외하기" : "다시 포함하기"}`}
      />
      <label htmlFor={`rec-${exercise.id}`} className="flex-1 cursor-pointer">
        <div className="text-body font-semibold text-text">{exercise.name}</div>
        <div className="text-caption text-text-muted">
          기본 {exercise.default_sets ?? 3}세트
          {exercise.default_reps_min && exercise.default_reps_max
            ? ` · ${exercise.default_reps_min}~${exercise.default_reps_max}회`
            : ""}
        </div>
      </label>
    </Card>
  );
}
