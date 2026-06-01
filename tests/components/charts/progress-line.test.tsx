// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProgressLine } from "@/components/charts/ProgressLine";

// recharts ResponsiveContainer가 jsdom 0×0 이슈 → mock
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rc">{children}</div>
  ),
}));

afterEach(cleanup);

describe("ProgressLine", () => {
  it("데이터 2개 미만이면 '기록 부족' 메시지 표시", () => {
    render(
      <ProgressLine
        exerciseId="ex1"
        exerciseName="벤치프레스"
        data={[{ date: "2026-05-01", oneRepMax: 80 }]}
      />,
    );
    expect(screen.getByText(/기록 부족/)).toBeTruthy();
  });

  it("데이터 2개 이상이면 최신값 + 증감 표시 + 클릭 시 onClick 호출", () => {
    const onClick = vi.fn();
    render(
      <ProgressLine
        exerciseId="ex1"
        exerciseName="벤치프레스"
        data={[
          { date: "2026-04-01", oneRepMax: 70 },
          { date: "2026-05-01", oneRepMax: 82 },
        ]}
        onClick={onClick}
      />,
    );
    // 최신 82kg
    expect(screen.getByText(/82kg/)).toBeTruthy();
    // 증감 +12
    expect(screen.getByText(/\+12kg/)).toBeTruthy();
    // 클릭
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith("ex1");
  });
});
