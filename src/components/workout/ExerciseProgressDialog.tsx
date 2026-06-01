// src/components/workout/ExerciseProgressDialog.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSeriesChart } from "@/components/charts/MultiSeriesChart";
import { fetchExerciseProgressionClient } from "@/lib/queries/sessions-client";

type Props = {
  exerciseId: string | null;
  exerciseName: string;
  onClose: () => void;
};

export function ExerciseProgressDialog({
  exerciseId,
  exerciseName,
  onClose,
}: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["exercise-progression", exerciseId],
    queryFn: () => fetchExerciseProgressionClient(exerciseId!, 12),
    enabled: !!exerciseId,
  });

  return (
    <Dialog open={!!exerciseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{exerciseName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <p className="text-body text-text-muted">차트를 불러올 수 없어요.</p>
        ) : data && data.length >= 2 ? (
          <MultiSeriesChart data={data} />
        ) : (
          <p className="text-body text-text-muted">
            아직 기록이 부족해요. 2회 이상 기록 후 다시 봐주세요.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
