import { cn } from "@/lib/utils";

type DayState = "done" | "missed" | "today";

type Props = {
  /** 요일 텍스트 (월/화/...) */
  day: string;
  state: DayState;
  className?: string;
};

export function DayChip({ day, state, className }: Props) {
  return (
    <div
      className={cn(
        "flex-1 aspect-square rounded-sm flex items-center justify-center text-tiny font-bold",
        state === "done" && "bg-accent text-text",
        state === "missed" && "bg-surface text-text-ghost font-semibold",
        state === "today" &&
          "bg-accent-soft text-text border-2 border-dashed border-accent",
        className,
      )}
    >
      {day}
    </div>
  );
}
