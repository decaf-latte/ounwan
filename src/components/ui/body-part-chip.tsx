"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

/**
 * 부위 선택 칩 (가슴, 등, 어깨...).
 * 선택: 진한 배경 (bg-text) + 표면 텍스트.
 * 미선택: 표면 배경 + 부드러운 보더.
 */
export function BodyPartChip({ label, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-full text-body font-medium transition-colors",
        selected
          ? "bg-text text-surface"
          : "bg-surface border border-accent-soft text-text hover:bg-accent-soft",
      )}
    >
      {label}
    </button>
  );
}
