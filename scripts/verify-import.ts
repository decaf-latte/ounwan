/**
 * Verify imported counts in cloud Supabase against seeds/*.json.
 * Run after `pnpm run import:apply` to confirm parity.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import type { Database } from "../src/types/database.types";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_EMAIL =
  process.env.IMPORT_TARGET_EMAIL ?? "hyejin.jeon940120@gmail.com";

const admin = createClient<Database>(URL, SR, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: usersData } = await admin.auth.admin.listUsers();
  const user = usersData.users.find((u) => u.email === TARGET_EMAIL);
  if (!user) throw new Error(`user ${TARGET_EMAIL} not found`);

  const exJson = JSON.parse(readFileSync("seeds/exercises.json", "utf8"));
  const sJson = JSON.parse(readFileSync("seeds/workout_sessions.json", "utf8"));
  const jsonSets = sJson.sessions.flatMap((s: any) =>
    s.exercises.flatMap((e: any) => e.sets),
  );
  const jsonDropSets = jsonSets.filter((set: any) => set.drop_order > 0);

  const [ex, ebp, sessions, sets, drops] = await Promise.all([
    admin
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    admin
      .from("exercise_body_parts")
      .select("exercise_id, exercises!inner(user_id)", { count: "exact", head: true })
      .eq("exercises.user_id", user.id),
    admin
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    admin
      .from("workout_sets")
      .select("id, workout_sessions!inner(user_id)", { count: "exact", head: true })
      .eq("workout_sessions.user_id", user.id),
    admin
      .from("workout_sets")
      .select("id, workout_sessions!inner(user_id)", { count: "exact", head: true })
      .eq("workout_sessions.user_id", user.id)
      .gt("drop_order", 0),
  ]);

  const ebpJsonCount = exJson.exercises.reduce(
    (n: number, e: any) => n + e.body_parts.length,
    0,
  );

  const rows = [
    ["exercises", ex.count ?? 0, exJson.exercises.length],
    ["exercise_body_parts", ebp.count ?? 0, ebpJsonCount],
    ["workout_sessions", sessions.count ?? 0, sJson.sessions.length],
    ["workout_sets (total)", sets.count ?? 0, jsonSets.length],
    ["workout_sets (drops)", drops.count ?? 0, jsonDropSets.length],
  ];

  let allOk = true;
  console.log("\nTable                    DB    JSON   match");
  console.log("─".repeat(50));
  for (const [name, db, json] of rows) {
    const ok = db === json;
    if (!ok) allOk = false;
    console.log(
      `${String(name).padEnd(24)} ${String(db).padStart(4)}   ${String(json).padStart(4)}   ${ok ? "✅" : "❌"}`,
    );
  }
  console.log("─".repeat(50));
  console.log(allOk ? "\n✅ All counts match." : "\n❌ Mismatch detected.");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
