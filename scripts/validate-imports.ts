/**
 * Validates seeds/exercises.json AND seeds/workout_sessions.json against
 * the ADR-001/003 schema.
 *
 * Sanity checks for exercises.json:
 *   - No duplicate exercise names
 *   - Every parent_exercise_name (when non-null) references an existing exercise name
 *   - Each exercise has exactly 1 body_part with is_primary=true
 *
 * Sanity checks for workout_sessions.json:
 *   - Schema validates
 *   - Every session.exercises[].exercise_name MUST exist in exercises.json
 *   - Set numbers are positive integers; drop_order >= 0
 *
 * Usage:
 *   pnpm run import:validate
 */
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";

const BodyPartCodeEnum = z.enum([
  "chest",
  "back",
  "shoulder",
  "trap",
  "arm",
  "leg",
  "glute",
  "core",
]);

const EquipmentEnum = z.enum([
  "free_weight",
  "machine",
  "cable",
  "bodyweight",
  "other",
]);

const ConfidenceEnum = z.enum(["high", "medium", "low"]);
const SideEnum = z.enum(["left", "right", "both"]);

const ExerciseSchema = z.object({
  name: z.string().min(1),
  equipment: EquipmentEnum,
  is_unilateral: z.boolean(),
  parent_exercise_name: z.string().nullable(),
  body_parts: z
    .array(
      z.object({
        code: BodyPartCodeEnum,
        is_primary: z.boolean(),
      }),
    )
    .min(1),
  default_sets: z.number().int().min(1).max(10).nullable().optional(),
  default_reps_min: z.number().int().nullable().optional(),
  default_reps_max: z.number().int().nullable().optional(),
  notes: z.string().nullable(),
  confidence: ConfidenceEnum,
});

const ExercisesFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  exercises: z.array(ExerciseSchema).min(1),
});

// ---- Session schemas (Chunk 3) ----

const SetSchema = z.object({
  set_number: z.number().int().min(1),
  drop_order: z.number().int().min(0),
  weight_kg: z.number().nullable(),
  reps: z.number().int().nullable(),
  side: SideEnum,
  confidence: ConfidenceEnum,
  source_line: z.string(),
  memo: z.string().optional(),
});

const SessionExerciseSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.array(SetSchema).min(1),
});

const SessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/),
  routine_label: z.string(),
  overall_notes: z.string().nullable(),
  exercises: z.array(SessionExerciseSchema).min(1),
});

const UnresolvedSchema = z.object({
  session_date: z.string(),
  line: z.string(),
  reason: z.string(),
  suggested_handling: z.string(),
});

const SessionsFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  sessions: z.array(SessionSchema),
  unresolved: z.array(UnresolvedSchema),
});

// ---- Load and validate exercises.json ----

const exercisesPath = "seeds/exercises.json";
if (!existsSync(exercisesPath)) {
  console.error(`exercises.json not found at ${exercisesPath}`);
  process.exit(1);
}

const exercisesJson = JSON.parse(readFileSync(exercisesPath, "utf8"));
const result = ExercisesFileSchema.safeParse(exercisesJson);

if (!result.success) {
  console.error("exercises.json schema invalid:");
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

const exercises = result.data.exercises;

// ---- Sanity checks (exercises) ----

const names = new Set<string>();
const duplicates: string[] = [];
for (const e of exercises) {
  if (names.has(e.name)) duplicates.push(e.name);
  names.add(e.name);
}
if (duplicates.length > 0) {
  console.error("duplicate exercise names detected:");
  console.error(duplicates);
  process.exit(1);
}

const orphanedVariants = exercises.filter(
  (e) => e.parent_exercise_name && !names.has(e.parent_exercise_name),
);
if (orphanedVariants.length > 0) {
  console.error("parent_exercise_name references missing exercises:");
  console.error(
    orphanedVariants.map((e) => ({
      name: e.name,
      parent_exercise_name: e.parent_exercise_name,
    })),
  );
  process.exit(1);
}

const primaryViolations = exercises.filter(
  (e) => e.body_parts.filter((bp) => bp.is_primary).length !== 1,
);
if (primaryViolations.length > 0) {
  console.error("each exercise must have exactly 1 primary body_part:");
  console.error(
    primaryViolations.map((e) => ({
      name: e.name,
      primary_count: e.body_parts.filter((bp) => bp.is_primary).length,
      body_parts: e.body_parts,
    })),
  );
  process.exit(1);
}

console.log(`✅ exercises.json valid (${exercises.length} exercises)`);

// ---- Load and validate workout_sessions.json ----

const sessionsPath = "seeds/workout_sessions.json";
if (!existsSync(sessionsPath)) {
  console.log("ℹ️ workout_sessions.json not found — skipping session validation");
  process.exit(0);
}

const sessionsJson = JSON.parse(readFileSync(sessionsPath, "utf8"));
const sessionsResult = SessionsFileSchema.safeParse(sessionsJson);

if (!sessionsResult.success) {
  console.error("workout_sessions.json schema invalid:");
  console.error(JSON.stringify(sessionsResult.error.format(), null, 2));
  process.exit(1);
}

const sessions = sessionsResult.data.sessions;
const unresolved = sessionsResult.data.unresolved;

// Cross-reference: every exercise_name must exist in catalog
const missingNames: { date: string; name: string }[] = [];
for (const s of sessions) {
  for (const ex of s.exercises) {
    if (!names.has(ex.exercise_name)) {
      missingNames.push({ date: s.date, name: ex.exercise_name });
    }
  }
}
if (missingNames.length > 0) {
  console.error(
    "workout_sessions.json references exercise names not in catalog:",
  );
  console.error(missingNames);
  process.exit(1);
}

// Compute stats
let totalSets = 0;
let dropSets = 0;
const exerciseCount: Record<string, number> = {};
const confidenceBreakdown: Record<string, number> = { high: 0, medium: 0, low: 0 };

for (const s of sessions) {
  for (const ex of s.exercises) {
    exerciseCount[ex.exercise_name] =
      (exerciseCount[ex.exercise_name] || 0) + 1;
    for (const st of ex.sets) {
      totalSets++;
      if (st.drop_order > 0) dropSets++;
      confidenceBreakdown[st.confidence] =
        (confidenceBreakdown[st.confidence] || 0) + 1;
    }
  }
}

console.log(
  `✅ workout_sessions.json valid (${sessions.length} sessions, ${totalSets} sets)`,
);
console.log(
  `📊 ${sessions.length} sessions, ${totalSets} total sets (${dropSets} drop sets), ${unresolved.length} unresolved`,
);

const dates = sessions.map((s) => s.date).sort();
if (dates.length > 0) {
  console.log(`   date range: ${dates[0]} → ${dates[dates.length - 1]}`);
}

const topExercises = Object.entries(exerciseCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
console.log(
  `   top 5 exercises: ${topExercises.map(([n, c]) => `${n}(${c})`).join(", ")}`,
);
console.log(
  `   confidence: high=${confidenceBreakdown.high}, medium=${confidenceBreakdown.medium}, low=${confidenceBreakdown.low}`,
);
