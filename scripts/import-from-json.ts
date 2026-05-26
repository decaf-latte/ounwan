import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import type { Database } from "../src/types/database.types";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_EMAIL =
  process.env.IMPORT_TARGET_EMAIL ?? "hyejin.jeon940120@gmail.com";

if (!URL || !SR) {
  console.error("❌ Missing env vars. Check .env.local");
  process.exit(1);
}

const admin = createClient<Database>(URL, SR, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────

async function getTargetUserId(): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === TARGET_EMAIL);
  if (!user) {
    throw new Error(
      `Target user ${TARGET_EMAIL} not found. Sign in to the app once before importing.`,
    );
  }
  return user.id;
}

async function loadBodyPartIdMap(): Promise<Map<string, number>> {
  const { data, error } = await admin.from("body_parts").select("id, code");
  if (error) throw error;
  return new Map(data.map((bp) => [bp.code, bp.id]));
}

async function existingExercisesForUser(userId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("exercises")
    .select("name")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((e) => e.name));
}

async function existingSessionStartedAts(userId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((r) => new Date(r.started_at!).toISOString()));
}

function composeOverallNotes(
  label: string | null,
  memo: string | null,
): string | null {
  if (!label && !memo) return null;
  if (!label) return memo;
  if (!memo) return `[${label}]`;
  return `[${label}] ${memo}`;
}

async function insertBodyPartMappings(
  exerciseId: string,
  bodyParts: { code: string; is_primary: boolean }[],
  bodyPartIds: Map<string, number>,
) {
  for (const bp of bodyParts) {
    const id = bodyPartIds.get(bp.code);
    if (!id) throw new Error(`body_part code ${bp.code} unknown`);
    const { error } = await admin
      .from("exercise_body_parts")
      .insert({ exercise_id: exerciseId, body_part_id: id, is_primary: bp.is_primary });
    if (error && !error.message.includes("duplicate")) {
      throw new Error(`exercise_body_parts: ${error.message}`);
    }
  }
}

// ─── Exercises ─────────────────────────────────────────────────────────────

type ExerciseJson = {
  name: string;
  equipment: "free_weight" | "machine" | "cable" | "bodyweight" | "other";
  is_unilateral: boolean;
  parent_exercise_name: string | null;
  body_parts: { code: string; is_primary: boolean }[];
  default_sets: number | null;
  default_reps_min: number | null;
  default_reps_max: number | null;
  notes: string | null;
};

async function importExercises(
  userId: string,
  bodyPartIds: Map<string, number>,
): Promise<Map<string, string>> {
  const json = JSON.parse(
    readFileSync("seeds/exercises.json", "utf8"),
  ) as { exercises: ExerciseJson[] };
  const existing = await existingExercisesForUser(userId);
  const exercisesByName = new Map<string, string>();

  const bases = json.exercises.filter((e) => !e.parent_exercise_name);
  const variants = json.exercises.filter((e) => !!e.parent_exercise_name);

  // Pass 1: bases
  for (const e of bases) {
    let exerciseId: string;
    if (existing.has(e.name)) {
      console.log(`  ↻ ${e.name} already exists, reusing id`);
      const { data } = await admin
        .from("exercises")
        .select("id")
        .eq("user_id", userId)
        .eq("name", e.name)
        .single();
      if (!data) throw new Error(`exercises.lookup(${e.name}): row missing`);
      exerciseId = data.id;
    } else {
      const { data, error } = await admin
        .from("exercises")
        .insert({
          user_id: userId,
          name: e.name,
          equipment: e.equipment,
          is_unilateral: e.is_unilateral,
          default_sets: e.default_sets,
          default_reps_min: e.default_reps_min,
          default_reps_max: e.default_reps_max,
          notes: e.notes,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(`exercises.insert(${e.name}): ${error.message}`);
      exerciseId = data.id;
    }
    exercisesByName.set(e.name, exerciseId);
    await insertBodyPartMappings(exerciseId, e.body_parts, bodyPartIds);
  }

  // Pass 2: variants
  for (const e of variants) {
    let exerciseId: string;
    if (existing.has(e.name)) {
      console.log(`  ↻ ${e.name} already exists, reusing id`);
      const { data } = await admin
        .from("exercises")
        .select("id")
        .eq("user_id", userId)
        .eq("name", e.name)
        .single();
      if (!data) throw new Error(`exercises.lookup(${e.name}): row missing`);
      exerciseId = data.id;
    } else {
      const parentId = exercisesByName.get(e.parent_exercise_name!);
      if (!parentId)
        throw new Error(
          `${e.name}: parent_exercise_name "${e.parent_exercise_name}" not found in catalog`,
        );

      const { data, error } = await admin
        .from("exercises")
        .insert({
          user_id: userId,
          name: e.name,
          equipment: e.equipment,
          is_unilateral: e.is_unilateral,
          parent_exercise_id: parentId,
          default_sets: e.default_sets,
          default_reps_min: e.default_reps_min,
          default_reps_max: e.default_reps_max,
          notes: e.notes,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(`exercises.insert(${e.name}): ${error.message}`);
      exerciseId = data.id;
    }
    exercisesByName.set(e.name, exerciseId);
    await insertBodyPartMappings(exerciseId, e.body_parts, bodyPartIds);
  }

  return exercisesByName;
}

// ─── Sessions + sets ─────────────────────────────────────────────────────

type SetJson = {
  set_number: number;
  drop_order: number;
  weight_kg: number | null;
  reps: number | null;
  side: "both" | "left" | "right";
  confidence: "high" | "medium" | "low";
  memo?: string;
};

type SessionExerciseJson = {
  exercise_name: string;
  sets: SetJson[];
};

type SessionJson = {
  date: string;
  started_at: string;
  routine_label: string | null;
  overall_notes: string | null;
  exercises: SessionExerciseJson[];
};

async function importSessions(
  userId: string,
  exercisesByName: Map<string, string>,
) {
  const json = JSON.parse(
    readFileSync("seeds/workout_sessions.json", "utf8"),
  ) as { sessions: SessionJson[] };
  const existing = await existingSessionStartedAts(userId);
  let sessionCount = 0;
  let skippedSessions = 0;
  let setCount = 0;

  for (const s of json.sessions) {
    const isoKey = new Date(s.started_at).toISOString();
    if (existing.has(isoKey)) {
      console.log(`  ↻ session ${s.date} already imported, skipping`);
      skippedSessions++;
      continue;
    }

    const { data: session, error: sErr } = await admin
      .from("workout_sessions")
      .insert({
        user_id: userId,
        started_at: s.started_at,
        ended_at: null,
        overall_notes: composeOverallNotes(s.routine_label, s.overall_notes),
      })
      .select("id")
      .single();
    if (sErr)
      throw new Error(`workout_sessions[${s.date}]: ${sErr.message}`);
    sessionCount++;

    for (const ex of s.exercises) {
      const exerciseId = exercisesByName.get(ex.exercise_name);
      if (!exerciseId)
        throw new Error(
          `session ${s.date}: exercise "${ex.exercise_name}" not in catalog`,
        );

      // Main sets first (parent_set_id NULL), then drops with parent resolution
      const mainSets = ex.sets.filter((set) => set.drop_order === 0);
      const dropSets = ex.sets.filter((set) => set.drop_order > 0);
      const mainSetIds = new Map<number, string>();

      for (const set of mainSets) {
        const { data, error } = await admin
          .from("workout_sets")
          .insert({
            session_id: session.id,
            exercise_id: exerciseId,
            set_number: set.set_number,
            weight_kg: set.weight_kg,
            reps: set.reps,
            side: set.side,
            drop_order: 0,
            parent_set_id: null,
            memo: set.memo ?? null,
          })
          .select("id")
          .single();
        if (error)
          throw new Error(
            `workout_sets main ${s.date}/${ex.exercise_name}/${set.set_number}: ${error.message}`,
          );
        mainSetIds.set(set.set_number, data.id);
        setCount++;
      }

      for (const set of dropSets) {
        const parentId = mainSetIds.get(set.set_number);
        if (!parentId)
          throw new Error(
            `drop set ${s.date}/${ex.exercise_name}/${set.set_number}: no main set`,
          );
        const { error } = await admin.from("workout_sets").insert({
          session_id: session.id,
          exercise_id: exerciseId,
          set_number: set.set_number,
          weight_kg: set.weight_kg,
          reps: set.reps,
          side: set.side,
          drop_order: set.drop_order,
          parent_set_id: parentId,
          memo: set.memo ?? null,
        });
        if (error)
          throw new Error(
            `workout_sets drop ${s.date}/${ex.exercise_name}/${set.set_number}@${set.drop_order}: ${error.message}`,
          );
        setCount++;
      }
    }
  }

  return { sessionCount, skippedSessions, setCount };
}

// ─── Wipe (recovery from partial failure) ─────────────────────────────

async function wipeUserData(userId: string) {
  console.log("🧹 Wiping all imported data for user...");
  // Order matters: sessions first (CASCADE removes sets), then exercises
  const { error: e1 } = await admin
    .from("workout_sessions")
    .delete()
    .eq("user_id", userId);
  if (e1) throw new Error(`wipe sessions: ${e1.message}`);
  const { error: e2 } = await admin
    .from("exercises")
    .delete()
    .eq("user_id", userId);
  if (e2) throw new Error(`wipe exercises: ${e2.message}`);
  console.log("✅ Wipe complete");
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");
  const WIPE = process.argv.includes("--wipe");
  console.log(`🚀 Import starting (DRY_RUN=${DRY_RUN}, WIPE=${WIPE})`);

  if (DRY_RUN) {
    console.log("ℹ️  Dry run: validating env + counts only, no INSERT.");
    if (WIPE) {
      console.log("ℹ️  --wipe ignored in dry-run mode (no DELETE either).");
    }
  }

  const userId = await getTargetUserId();
  console.log(`👤 Target user: ${TARGET_EMAIL} (${userId})`);

  const bodyPartIds = await loadBodyPartIdMap();
  console.log(`📚 body_parts loaded: ${bodyPartIds.size}`);

  if (DRY_RUN) {
    const exJson = JSON.parse(
      readFileSync("seeds/exercises.json", "utf8"),
    ) as { exercises: unknown[] };
    const sJson = JSON.parse(
      readFileSync("seeds/workout_sessions.json", "utf8"),
    ) as { sessions: SessionJson[] };
    const totalSets = sJson.sessions
      .flatMap((s) => s.exercises.flatMap((e) => e.sets))
      .length;
    console.log(
      `📊 Would import: ${exJson.exercises.length} exercises, ${sJson.sessions.length} sessions, ${totalSets} sets`,
    );
    return;
  }

  if (WIPE) {
    await wipeUserData(userId);
  }

  const exercisesByName = await importExercises(userId, bodyPartIds);
  console.log(`✅ Exercises imported: ${exercisesByName.size}`);

  const { sessionCount, skippedSessions, setCount } = await importSessions(
    userId,
    exercisesByName,
  );
  console.log(
    `✅ Sessions: ${sessionCount} new (${skippedSessions} skipped as existing), Sets: ${setCount}`,
  );
  console.log("🎉 Import complete");
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
