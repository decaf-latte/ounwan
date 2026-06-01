// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MiniCalendar, type DayEntry } from "@/components/ui/mini-calendar";

afterEach(cleanup);

const dotsByDate: Record<number, DayEntry> = {
  5: { bodyPartColors: ["#FF6B6B", "#4ECDC4"], sessionIds: ["s1"] },
  12: { bodyPartColors: ["#FFE66D"], sessionIds: ["s2", "s3"] }, // 같은 날 2 세션
};

describe("MiniCalendar", () => {
  it("운동한 날짜에 부위 도트 N개 + 다중 세션은 첫 sessionId만 onClick에 전달", () => {
    const onDateClick = vi.fn();
    render(
      <MiniCalendar
        year={2026}
        month={6}
        todayDayOfMonth={8}
        dotsByDate={dotsByDate}
        onDateClick={onDateClick}
      />,
    );
    // 12일 셀 클릭 → sessionIds[0] = "s2" 전달
    const day12 = screen.getByRole("button", { name: /6월 12일.*세션 2개/ });
    fireEvent.click(day12);
    expect(onDateClick).toHaveBeenCalledWith("s2");
  });

  it("onDateClick 미지정 시 운동한 날도 button 아닌 div로 렌더 (대시보드 비활성 모드)", () => {
    render(
      <MiniCalendar
        year={2026}
        month={6}
        todayDayOfMonth={8}
        dotsByDate={dotsByDate}
      />,
    );
    // 5일은 운동한 날이지만 button 아닌 div
    expect(screen.queryByRole("button", { name: /6월 5일/ })).toBeNull();
  });
});
