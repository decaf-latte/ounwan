"use client";
import { cn } from "@/lib/utils";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

type Props = {
  exercises: ExerciseWithBodyParts[];
  activeExerciseId: string | null;
  completionByEx: Record<string, { saved: number; target: number }>;
  onSelectExercise: (id: string) => void;
};

export function ExerciseList({
  exercises,
  activeExerciseId,
  completionByEx,
  onSelectExercise,
}: Props) {
  return (
    <aside className="hidden lg:block w-56 shrink-0 space-y-2">
      <h2 className="text-caption text-text-muted uppercase mb-2">운동 목록</h2>
      {exercises.map((ex) => {
        const c = completionByEx[ex.id] ?? {
          saved: 0,
          target: ex.default_sets ?? 3,
        };
        const done = c.saved >= c.target;
        const active = ex.id === activeExerciseId;
        return (
          <button
            key={ex.id}
            type="button"
            onClick={() => onSelectExercise(ex.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-colors",
              active
                ? "border-2 border-accent bg-accent-soft"
                : done
                  ? "border-border bg-surface opacity-60"
                  : "border-border bg-surface hover:bg-accent-soft",
            )}
          >
            <div className="text-body font-semibold text-text">
              {done ? "✓ " : active ? "▶ " : ""}
              {ex.name}
            </div>
            <div className="text-caption text-text-muted">
              {c.saved}/{c.target} 세트
            </div>
          </button>
        );
      })}
    </aside>
  );
}
