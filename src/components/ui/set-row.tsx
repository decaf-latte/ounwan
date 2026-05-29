"use client";

import { cn } from "@/lib/utils";

export type SetRowStatus = "done" | "active" | "upcoming";

type Props = {
  setNumber: number;
  status: SetRowStatus;
  /** done이면 표시할 값, active이면 input value, upcoming이면 무시 */
  weight: string;
  reps: string;
  onWeightChange?: (v: string) => void;
  onRepsChange?: (v: string) => void;
  onCheck?: () => void;
  checkDisabled?: boolean;
};

/**
 * 세트 1줄 — 3가지 상태:
 * - done: 완료된 세트 (✓ 채워진 원 + 값 표시)
 * - active: 입력 중 (number input 활성)
 * - upcoming: 아직 안 함 (회색 placeholder)
 */
export function SetRow({
  setNumber,
  status,
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  onCheck,
  checkDisabled,
}: Props) {
  if (status === "done") {
    return (
      <div className="flex items-center gap-2 mt-2 p-2 bg-accent-soft rounded-md">
        <div className="w-6 h-6 bg-accent text-text rounded-full flex items-center justify-center text-caption font-bold">
          ✓
        </div>
        <div className="flex-1 text-body text-text">
          <strong>{setNumber}세트</strong>
        </div>
        <div className="text-body text-text font-bold">
          {weight}kg × {reps}
        </div>
      </div>
    );
  }

  if (status === "upcoming") {
    return (
      <div className="flex items-center gap-2 mt-2 opacity-50">
        <div className="w-6 h-6 bg-surface border-2 border-accent-soft text-text-muted rounded-full flex items-center justify-center text-caption">
          {setNumber}
        </div>
        <div className="flex-1 text-body text-text-muted">— kg × —</div>
      </div>
    );
  }

  // active
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-6 h-6 bg-surface border-2 border-accent-soft text-text-muted rounded-full flex items-center justify-center text-caption font-semibold">
        {setNumber}
      </div>
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        placeholder="kg"
        className="flex-1 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={weight}
        onChange={(e) => onWeightChange?.(e.target.value)}
      />
      <span className="text-caption text-text-muted">×</span>
      <input
        inputMode="numeric"
        type="number"
        placeholder="회"
        className="w-14 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={reps}
        onChange={(e) => onRepsChange?.(e.target.value)}
      />
      <button
        type="button"
        disabled={checkDisabled}
        onClick={onCheck}
        className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center font-bold text-body",
          checkDisabled
            ? "bg-surface border border-accent-soft text-text-ghost"
            : "bg-accent text-text",
        )}
      >
        ✓
      </button>
    </div>
  );
}
