"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { startSession } from "@/app/(app)/workout/actions";
import type { RoutineSummary } from "@/lib/queries/routines";

type Props = { routines: RoutineSummary[] };

export function RoutinesView({ routines }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startStart] = useTransition();

  const toggle = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleStart = (routine: RoutineSummary) => {
    if (routine.exercises.length === 0) {
      toast.error("이 루틴에는 운동이 없어요");
      return;
    }
    startStart(async () => {
      const result = await startSession({
        bodyPartIds: [],
        recommendedExerciseIds: routine.exercises.map((e) => e.id),
      });
      if (result && result.ok === false) {
        toast.error(result.error);
      }
    });
  };

  if (routines.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 mt-6 text-center">
        <div className="text-body text-text-muted">
          저장된 루틴이 없어요
        </div>
        <div className="text-caption text-text-muted mt-1">
          카톡 임포트나 PT 라벨이 있는 세션이 누적되면 여기에 모입니다
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3 mt-4">
      {routines.map((r) => {
        const isOpen = expanded.has(r.label);
        const preview = r.exercises.slice(0, 4);
        const remaining = Math.max(0, r.exercises.length - preview.length);
        return (
          <li key={r.label}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-h3 font-extrabold text-text">
                    {r.label}
                  </h2>
                  <div className="text-caption text-text-muted mt-0.5">
                    최근 {r.lastDate} · 총 {r.sessionCount}회 수행
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStart(r)}
                  disabled={isPending}
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  시작
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(isOpen ? r.exercises : preview).map((ex) => (
                  <span
                    key={ex.id}
                    className="inline-flex items-center text-caption px-2 py-0.5 rounded-md bg-accent-soft text-text"
                  >
                    {ex.name}
                    <span className="ml-1 text-text-muted">
                      {ex.occurrences}
                    </span>
                  </span>
                ))}
                {!isOpen && remaining > 0 && (
                  <span className="inline-flex items-center text-caption text-text-muted px-2 py-0.5">
                    +{remaining}
                  </span>
                )}
              </div>

              {r.exercises.length > preview.length && (
                <button
                  type="button"
                  onClick={() => toggle(r.label)}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-caption text-text-muted hover:text-text",
                  )}
                >
                  {isOpen ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      모두 보기 ({r.exercises.length}개)
                    </>
                  )}
                </button>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
