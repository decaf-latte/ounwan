// src/lib/queries/cardio-types.ts
// 서버 전용 import(next/headers) 없는 순수 타입/상수.
// 클라이언트 컴포넌트(CardioCard 등)가 안전하게 import 가능.
import type { Tables } from "@/types/database.types";

export type CardioLog = Tables<"cardio_logs">;

/** 유산소 머신 (UI 3택1). text 컬럼이라 값 자유지만 표준 3종. */
export const CARDIO_MACHINES = ["천국의계단", "인클라인", "러닝머신"] as const;
export type CardioMachine = (typeof CARDIO_MACHINES)[number];
