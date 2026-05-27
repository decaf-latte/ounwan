import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSignedInUser, deleteUser } from "./helpers";

describe("RLS isolation: 본인 외 exercises 접근 차단", () => {
  let userA: Awaited<ReturnType<typeof createSignedInUser>>;
  let userB: Awaited<ReturnType<typeof createSignedInUser>>;

  beforeAll(async () => {
    userA = await createSignedInUser("a");
    userB = await createSignedInUser("b");

    // User A가 자기 운동 1개 INSERT (트리거가 user_id 자동 주입)
    // 트리거 동작 자체를 검증하므로 user_id 생략은 의도적 — TS만 우회.
    const { error } = await userA.client
      .from("exercises")
      // @ts-expect-error 트리거가 user_id를 채우는 것이 이 테스트의 목적 (ADR-008)
      .insert({ name: "Test Exercise A", equipment: "machine" });
    if (error) throw error;
  });

  afterAll(async () => {
    if (userA) await deleteUser(userA.userId);
    if (userB) await deleteUser(userB.userId);
  });

  it("User A는 자기 exercises를 볼 수 있다 (positive control)", async () => {
    const { data, error } = await userA.client.from("exercises").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].name).toBe("Test Exercise A");
    expect(data?.[0].user_id).toBe(userA.userId); // 트리거 자동 주입 검증
  });

  it("User B는 User A의 exercises를 볼 수 없다 (RLS isolation)", async () => {
    const { data, error } = await userB.client.from("exercises").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("User B는 user_id를 위조해서도 A의 row를 못 본다", async () => {
    const { data } = await userB.client
      .from("exercises")
      .select("*")
      .eq("user_id", userA.userId);
    expect(data).toEqual([]);
  });
});
