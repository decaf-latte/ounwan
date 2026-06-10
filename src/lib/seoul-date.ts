// 모든 서버 시간 계산은 KST 기준. Vercel 함수는 UTC라 그대로 쓰면
// 한국 새벽~오전(00:00~09:00 KST) 시간대에 "오늘"이 어제로 잡힌다.

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

export type SeoulDateParts = {
  year: number;
  /** 1-indexed (1=Jan, 12=Dec) */
  month: number;
  /** 1-31 */
  day: number;
  /** 월=0 ... 일=6 */
  dayOfWeek: number;
};

/** 현재 시각의 서울 wall-clock 파츠 */
export function seoulTodayParts(now: Date = new Date()): SeoulDateParts {
  const shifted = new Date(now.getTime() + SEOUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: (shifted.getUTCDay() + 6) % 7,
  };
}

/** YYYY-MM-DD (서울 기준 오늘) */
export function seoulTodayIso(now: Date = new Date()): string {
  const { year, month, day } = seoulTodayParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 서울 기준 YYYY-MM-DD 00:00 → UTC ISO 문자열.
 * Date.UTC가 month/day overflow를 자동 처리하므로 day=32, month=13 같은 값도 OK.
 */
export function seoulMidnightUtcIso(
  year: number,
  monthOneIndexed: number,
  day: number,
): string {
  return new Date(
    Date.UTC(year, monthOneIndexed - 1, day, -9, 0, 0),
  ).toISOString();
}

/** UTC timestamp → 서울 기준 일자(1-31) */
export function seoulDayOfMonth(utcIso: string): number {
  return new Date(new Date(utcIso).getTime() + SEOUL_OFFSET_MS).getUTCDate();
}

/** UTC timestamp → 서울 기준 요일 (월=0...일=6) */
export function seoulDayOfWeek(utcIso: string): number {
  const shifted = new Date(new Date(utcIso).getTime() + SEOUL_OFFSET_MS);
  return (shifted.getUTCDay() + 6) % 7;
}
