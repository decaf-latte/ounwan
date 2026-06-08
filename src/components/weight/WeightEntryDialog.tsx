"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  upsertBodyWeight,
  deleteBodyWeight,
} from "@/app/(app)/dashboard/weight-actions";
import type { BodyWeightRow, WeightSlot } from "@/lib/queries/body-weights";

type Props = {
  todayWeights: BodyWeightRow[];
  defaultDate: string; // YYYY-MM-DD
};

const SLOT_LABEL: Record<WeightSlot, string> = {
  morning: "아침",
  evening: "저녁",
};

export function WeightFab({ todayWeights, defaultDate }: Props) {
  const [open, setOpen] = useState(false);
  const [logDate, setLogDate] = useState(defaultDate);
  const [slot, setSlot] = useState<WeightSlot>("morning");
  const [weight, setWeight] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLogDate(defaultDate);
    setSlot("morning");
    setWeight("");
  }, [open, defaultDate]);

  const existing = todayWeights.find(
    (w) => w.log_date === logDate && w.slot === slot,
  );

  const handleSubmit = () => {
    const n = Number.parseFloat(weight);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("올바른 무게를 입력해주세요");
      return;
    }
    startTransition(async () => {
      const result = await upsertBodyWeight({
        logDate,
        slot,
        weightKg: n,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${SLOT_LABEL[slot]} ${n.toFixed(1)}kg 저장됨`);
      setOpen(false);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteBodyWeight(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("삭제됨");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="몸무게 기록"
            className={cn(
              "fixed right-5 z-30 w-14 h-14 rounded-full shadow-lg",
              "flex items-center justify-center",
              "bg-text text-surface hover:opacity-90 transition-opacity",
              // 모바일: 운동 시작 CTA(52px) 위. lg: 사이드바라 right-bottom 일반 위치
              "bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem+52px+0.75rem)]",
              "lg:bottom-6",
            )}
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>몸무게 기록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="weight-date">날짜</Label>
            <Input
              id="weight-date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>

          <div>
            <Label>시간대</Label>
            <div className="flex gap-2 mt-1">
              {(["morning", "evening"] as const).map((s) => {
                const active = slot === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-body font-semibold transition-colors",
                      active
                        ? "bg-text text-surface border-text"
                        : "bg-surface border-accent-soft text-text-muted",
                    )}
                  >
                    {SLOT_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="weight-kg">
              무게 (kg)
              {existing && (
                <span className="ml-2 text-caption text-text-muted">
                  현재 저장됨: {existing.weight_kg}kg
                </span>
              )}
            </Label>
            <Input
              id="weight-kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="500"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={existing ? `${existing.weight_kg}` : "66.5"}
              autoFocus
            />
          </div>

          {todayWeights.length > 0 && (
            <div>
              <Label>해당 날짜 기록</Label>
              <div className="space-y-1 mt-1">
                {todayWeights
                  .filter((w) => w.log_date === logDate)
                  .map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-lg border border-accent-soft px-3 py-2"
                    >
                      <span className="text-body">
                        <span className="font-semibold">
                          {SLOT_LABEL[w.slot as WeightSlot]}
                        </span>{" "}
                        <span className="text-text-muted">
                          {w.weight_kg}kg
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(w.id)}
                        disabled={isPending}
                        aria-label="삭제"
                        className="p-1 text-text-muted hover:text-text"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose
            disabled={isPending}
            render={<Button variant="ghost">취소</Button>}
          />
          <Button onClick={handleSubmit} disabled={isPending || !weight}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
