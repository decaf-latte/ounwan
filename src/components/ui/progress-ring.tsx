/**
 * 진행 링 (Apple Health 스타일).
 * size: 외곽 픽셀, strokeWidth: 라인 굵기, radius: 자동 계산
 */

export function computeDashOffset(
  value: number,
  max: number,
  radius: number,
): number {
  const clamped = Math.max(0, Math.min(value, max));
  const circumference = 2 * Math.PI * radius;
  return circumference * (1 - clamped / max);
}

type Props = {
  /** 0~max 사이 값 */
  value: number;
  max?: number;
  /** 외곽 픽셀 (기본 64) */
  size?: number;
  /** 라인 굵기 (기본 8) */
  strokeWidth?: number;
  /** 추가 클래스 (예: 색상 오버라이드) */
  className?: string;
};

export function ProgressRing({
  value,
  max = 100,
  size = 64,
  strokeWidth = 8,
  className,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = computeDashOffset(value, max, radius);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`${value} of ${max}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-soft)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
