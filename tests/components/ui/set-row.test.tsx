// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SetRow } from "@/components/ui/set-row";

afterEach(cleanup);

describe("SetRow (active)", () => {
  it("무게/회차 input을 모두 렌더하고, 회차칸이 잘리지 않도록 폭/축소 클래스를 가진다", () => {
    render(
      <SetRow
        setNumber={1}
        status="active"
        weight=""
        reps=""
        onWeightChange={() => {}}
        onRepsChange={() => {}}
        onCheck={() => {}}
      />,
    );
    const kg = screen.getByPlaceholderText("kg");
    const reps = screen.getByPlaceholderText("회");
    expect(kg).toBeInTheDocument();
    expect(reps).toBeInTheDocument();
    // 무게칸은 좁은 화면에서 줄어들 수 있어야 함 (overflow로 회차칸 밀어내지 않게)
    expect(kg.className).toContain("min-w-0");
    // 회차칸은 고정폭 + 축소 금지 (스피너 제거와 함께 잘림 방지)
    expect(reps.className).toContain("w-16");
    expect(reps.className).toContain("shrink-0");
  });

  it("무게·회차가 채워지면 ✓ 버튼 클릭 시 onCheck를 호출한다", () => {
    const onCheck = vi.fn();
    render(
      <SetRow
        setNumber={1}
        status="active"
        weight="60"
        reps="10"
        onWeightChange={() => {}}
        onRepsChange={() => {}}
        onCheck={onCheck}
        checkDisabled={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "✓" }));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it("값이 비면 checkDisabled로 ✓ 버튼이 비활성화된다", () => {
    render(
      <SetRow
        setNumber={1}
        status="active"
        weight=""
        reps=""
        onCheck={() => {}}
        checkDisabled
      />,
    );
    expect(screen.getByRole("button", { name: "✓" })).toBeDisabled();
  });
});
