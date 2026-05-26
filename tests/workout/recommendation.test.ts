import { describe, it, expect } from "vitest";
import {
  recommendExercises,
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

  it("최근 30일 빈도가 높은 운동을 우선한다", () => {
    const input: RecommendInput = {
      bodyPartIds: [1],
      exercises: [makeEx("a", 1), makeEx("b", 1), makeEx("c", 1)],
      recentSets: [
        set("b", 1),
        set("b", 5),
        set("b", 10),
        set("c", 2),
      ],
      perBodyPart: 3,
    };
    const result = recommendExercises(input);
    expect(result.map((r) => r.exerciseId)).toEqual(["b", "c", "a"]);
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
    expect(result[0].exerciseId).toBe("a");
    expect(result[0].recentUsageCount).toBe(1);
    expect(result[1].recentUsageCount).toBe(0);
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
