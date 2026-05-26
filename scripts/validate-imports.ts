/**
 * Validates seeds/exercises.json against the ADR-001/003 schema.
 *
 * Sanity checks:
 *   - No duplicate exercise names
 *   - Every parent_exercise_name (when non-null) references an existing exercise name
 *   - Each exercise has exactly 1 body_part with is_primary=true
 *
 * Session validation (seeds/workout_sessions.json) is added in Chunk 3.
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

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  exercises: z.array(ExerciseSchema).min(1),
});

// ---- Load and validate exercises.json ----

const exercisesPath = "seeds/exercises.json";
if (!existsSync(exercisesPath)) {
  console.error(`exercises.json not found at ${exercisesPath}`);
  process.exit(1);
}

const exercisesJson = JSON.parse(readFileSync(exercisesPath, "utf8"));
const result = FileSchema.safeParse(exercisesJson);

if (!result.success) {
  console.error("exercises.json schema invalid:");
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

const exercises = result.data.exercises;

// ---- Sanity checks ----

// 1. No duplicate names
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

// 2. parent_exercise_name FK integrity
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

// 3. Exactly 1 primary body_part per exercise
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

// TODO (Chunk 3): also validate seeds/workout_sessions.json with SessionFileSchema,
// and check every session exercise_name exists in exercises.json.

console.log(`✅ exercises.json valid (${exercises.length} exercises)`);
