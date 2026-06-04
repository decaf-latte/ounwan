import { describe, it, expect } from "vitest";
import {
  recommendExercises,
  candidatesForBodyParts,
  type RecommendInput,
} from "@/lib/workout/recommendation";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

function makeEx(
  id: string,
  primaryBP: number,
  createdDaysAgo = 100,
): ExerciseWithBodyParts {
  const createdAt = new Date(
    Date.now() - createdDaysAgo * 86_400_000,
  ).toISOString();
  return {
    id,
    user_id: "u",
    name: `ex-${id}`,
    equipment: "machine",
    is_unilateral: false,
    parent_exercise_id: null,
    default_sets: 3,
    default_reps_min: 8,
    default_reps_max: 12,
    notes: null,
    created_at: createdAt,
    exercise_body_parts: [
      {
        exercise_id: id,
        body_part_id: primaryBP,
        is_primary: true,
      },
    ],
  };
}

function set(exerciseId: string, daysAgo: number) {
  return {
    exercise_id: exerciseId,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}

describe("recommendExercises", () => {
  it("선택된 부위에 해당하는 primary 운동만 후보로 삼는다", () => {
    const input: RecommendInput = {
      bodyPartIds: [1],
      exercises: [
        makeEx("a", 1),
        makeEx("b", 2),
      ],
      recentSets: [],
      perBodyPart: 3,
    };
    const result = recommendExercises(input);
    expect(result.map((r) => r.exerciseId)).toEqual(["a"]);
  });

  it("저번에 한 운동을 맨 아래로 정렬한다 (최근 안 한 운동 우선)", () => {
    const input: RecommendInput = {
      bodyPartIds: [1],
      exercises: [makeEx("a", 1), makeEx("b", 1), makeEx("c", 1)],
      recentSets: [
        set("b", 1), // 가장 최근에 함 → 맨 아래
        set("b", 5),
        set("b", 10),
        set("c", 2),
      ],
      perBodyPart: 3,
    };
    const result = recommendExercises(input);
    // a(최근 30일 안 함) → c(2일 전) → b(1일 전, 가장 최근)
    expect(result.map((r) => r.exerciseId)).toEqual(["a", "c", "b"]);
  });

  it("빈도가 같으면 마지막 사용일이 더 오래된 운동을 우선한다", () => {
    const input: RecommendInput = {
      bodyPartIds: [1],
      exercises: [makeEx("a", 1), makeEx("b", 1)],
      recentSets: [
        set("a", 2),
        set("b", 20),
      ],
      perBodyPart: 2,
    };
    const result = recommendExercises(input);
    expect(result.map((r) => r.exerciseId)).toEqual(["b", "a"]);
  });

  it("30일 이전 기록은 빈도 카운트에서 제외한다", () => {
    const input: RecommendInput = {
      bodyPartIds: [1],
      exercises: [makeEx("a", 1), makeEx("b", 1)],
      recentSets: [
        set("a", 5),
        set("b", 40),
        set("b", 45),
      ],
      perBodyPart: 2,
    };
    const result = recommendExercises(input);
    const aRec = result.find((r) => r.exerciseId === "a");
    const bRec = result.find((r) => r.exerciseId === "b");
    expect(aRec?.recentUsageCount).toBe(1);
    expect(bRec?.recentUsageCount).toBe(0);
  });

  it("perBodyPart 개수만큼만 부위별로 선택한다", () => {
    const input: RecommendInput = {
      bodyPartIds: [1, 2],
      exercises: [
        makeEx("c1", 1),
        makeEx("c2", 1),
        makeEx("c3", 1),
        makeEx("c4", 1),
        makeEx("b1", 2),
        makeEx("b2", 2),
      ],
      recentSets: [],
      perBodyPart: 2,
    };
    const result = recommendExercises(input);
    const chest = result.filter((r) => r.primaryBodyPartId === 1);
    const back = result.filter((r) => r.primaryBodyPartId === 2);
    expect(chest).toHaveLength(2);
    expect(back).toHaveLength(2);
  });

  it("is_primary=false인 매핑은 후보에서 제외한다", () => {
    const ex: ExerciseWithBodyParts = {
      ...makeEx("dl", 2),
      exercise_body_parts: [
        { exercise_id: "dl", body_part_id: 2, is_primary: true },
        { exercise_id: "dl", body_part_id: 6, is_primary: false },
      ],
    };
    const input: RecommendInput = {
      bodyPartIds: [6],
      exercises: [ex],
      recentSets: [],
      perBodyPart: 3,
    };
    const result = recommendExercises(input);
    expect(result).toHaveLength(0);
  });
});

describe("candidatesForBodyParts", () => {
  it("선택 부위에 primary로 매칭되는 모든 운동을 상위 N 제한 없이 반환한다", () => {
    const exs = [
      makeEx("a", 1),
      makeEx("b", 1),
      makeEx("c", 1),
      makeEx("d", 1), // 추천 top-3 밖이라도 포함돼야 함 (로잉머신 케이스)
      makeEx("x", 2),
    ];
    const result = candidatesForBodyParts(exs, [1]);
    expect(result.map((e) => e.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("기본값은 단측 변형(parent_exercise_id 있는 운동)을 제외한다", () => {
    const variant: ExerciseWithBodyParts = {
      ...makeEx("a-uni", 1),
      parent_exercise_id: "a",
      is_unilateral: true,
    };
    const exs = [makeEx("a", 1), variant];
    expect(candidatesForBodyParts(exs, [1]).map((e) => e.id)).toEqual(["a"]);
    expect(
      candidatesForBodyParts(exs, [1], true).map((e) => e.id).sort(),
    ).toEqual(["a", "a-uni"]);
  });

  it("is_primary=false 매핑만 있는 부위는 후보에서 제외한다", () => {
    const ex: ExerciseWithBodyParts = {
      ...makeEx("dl", 2),
      exercise_body_parts: [
        { exercise_id: "dl", body_part_id: 2, is_primary: true },
        { exercise_id: "dl", body_part_id: 6, is_primary: false },
      ],
    };
    expect(candidatesForBodyParts([ex], [6])).toHaveLength(0);
    expect(candidatesForBodyParts([ex], [2]).map((e) => e.id)).toEqual(["dl"]);
  });
});
