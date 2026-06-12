"use client";

import { Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type SetRowStatus = "done" | "active" | "upcoming";
export type SetSide = "both" | "left" | "right";

const SIDE_LABEL: Record<SetSide, string> = {
  both: "양쪽",
  left: "왼쪽",
  right: "오른쪽",
};

type Props = {
  setNumber: number;
  status: SetRowStatus;
  /** done이면 표시할 값, active이면 input value, upcoming이면 무시 */
  weight: string;
  reps: string;
  /** 양쪽/왼쪽/오른쪽 — 기본 both. done 상태에서 라벨로 노출. */
  side?: SetSide;
  onWeightChange?: (v: string) => void;
  onRepsChange?: (v: string) => void;
  onCheck?: () => void;
  checkDisabled?: boolean;
  /** 편집 모드에서 done 세트 삭제 — 있으면 ⊖ 버튼 노출 */
  onDelete?: () => void;
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
  side = "both",
  onWeightChange,
  onRepsChange,
  onCheck,
  checkDisabled,
  onDelete,
}: Props) {
  if (status === "done") {
    return (
      <div className="flex items-center gap-2 mt-2 p-2 bg-accent-soft rounded-md">
        <div className="w-6 h-6 bg-accent text-text rounded-full flex items-center justify-center text-caption font-bold">
          ✓
        </div>
        <div className="flex-1 text-body text-text">
          <strong>{setNumber}세트</strong>
          {side !== "both" && (
            <span className="ml-1 text-caption text-accent-strong font-semibold">
              {SIDE_LABEL[side]}
            </span>
          )}
        </div>
        <div className="text-body text-text font-bold">
          {weight}kg × {reps}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`${setNumber}세트 삭제`}
            className="shrink-0 p-1 rounded text-danger hover:bg-danger/10"
          >
            <Minus className="w-4 h-4" />
          </button>
        )}
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
      <div className="shrink-0 w-6 h-6 bg-surface border-2 border-accent-soft text-text-muted rounded-full flex items-center justify-center text-caption font-semibold">
        {setNumber}
      </div>
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        placeholder="kg"
        className="min-w-0 flex-1 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={weight}
        onChange={(e) => onWeightChange?.(e.target.value)}
      />
      <span className="shrink-0 text-caption text-text-muted">×</span>
      <input
        inputMode="numeric"
        type="number"
        placeholder="회"
        className="w-16 shrink-0 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={reps}
        onChange={(e) => onRepsChange?.(e.target.value)}
      />
      {side !== "both" && (
        <span className="shrink-0 text-caption font-bold text-accent-strong">
          {SIDE_LABEL[side]}
        </span>
      )}
      <button
        type="button"
        disabled={checkDisabled}
        onClick={onCheck}
        className={cn(
          "shrink-0 w-8 h-8 rounded-md flex items-center justify-center font-bold text-body",
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
