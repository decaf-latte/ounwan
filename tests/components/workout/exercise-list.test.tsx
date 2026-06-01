// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ExerciseList } from "@/components/workout/ExerciseList";

afterEach(cleanup);

const exercises = [
  { id: "a", name: "벤치프레스", default_sets: 3, exercise_body_parts: [] },
  { id: "b", name: "랫풀다운", default_sets: 3, exercise_body_parts: [] },
] as never;

describe("ExerciseList", () => {
  it("active 운동에 aria-current를 부착하고 클릭 시 콜백을 호출한다", () => {
    const onSelect = vi.fn();
    render(
      <ExerciseList
        exercises={exercises}
        activeExerciseId="b"
        completionByEx={{
          a: { saved: 3, target: 3 },
          b: { saved: 1, target: 3 },
        }}
        onSelectExercise={onSelect}
      />,
    );
    const activeBtn = screen.getByRole("button", { name: /랫풀다운/ });
    expect(activeBtn).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: /벤치프레스/ }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("완료된 운동에 ✓ 표시 + opacity-60 적용", () => {
    render(
      <ExerciseList
        exercises={exercises}
        activeExerciseId={null}
        completionByEx={{
          a: { saved: 3, target: 3 },
          b: { saved: 0, target: 3 },
        }}
        onSelectExercise={() => {}}
      />,
    );
    const doneBtn = screen.getByRole("button", { name: /벤치프레스/ });
    expect(doneBtn.textContent).toContain("✓");
    expect(doneBtn.className).toContain("opacity-60");
  });
});
