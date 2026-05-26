import { readFileSync, writeFileSync } from "node:fs";

type Set = {
  set_number: number;
  drop_order: number;
  weight_kg: number | null;
  reps: number | null;
  side: "both" | "left" | "right";
  confidence: "high" | "medium" | "low";
  source_line?: string;
  memo?: string;
};

type SessionExercise = {
  exercise_name: string;
  sets: Set[];
};

type Session = {
  date: string;
  started_at: string;
  routine_label: string | null;
  overall_notes: string | null;
  exercises: SessionExercise[];
};

const data = JSON.parse(
  readFileSync("seeds/workout_sessions.json", "utf8"),
) as { sessions: Session[] };

function renderSession(s: Session): string {
  const rows = s.exercises.flatMap((ex) =>
    ex.sets.map((set) => {
      const dropMark = set.drop_order > 0 ? `→drop${set.drop_order}` : "";
      const sideMark = set.side !== "both" ? ` (${set.side})` : "";
      const memoMark = set.memo ? ` *${set.memo}*` : "";
      return `| \`${set.source_line ?? ""}\` | ${ex.exercise_name}${sideMark} | ${set.set_number}${dropMark} | ${set.weight_kg ?? "-"} | ${set.reps ?? "-"} | ${set.confidence} |${memoMark}`;
    }),
  );
  const labelLine = s.routine_label ? ` — ${s.routine_label}` : "";
  const notesBlock = s.overall_notes ? `\n**메모:** ${s.overall_notes}\n` : "";
  return `### ${s.date}${labelLine}\n\n| 원본 | 운동 | set | kg | reps | conf |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n${notesBlock}`;
}

// Full version (gitignored) — every session
writeFileSync(
  "docs/import/validation-raw-full.md",
  `# KakaoTalk Import Validation (Full)\n\n${data.sessions
    .map(renderSession)
    .join("\n\n---\n\n")}\n`,
);

// Representative sample selection: ensure each pattern represented
function pickRepresentativeSample(all: Session[]): Session[] {
  const picked = new Map<string, Session>();
  const hasDrop = (s: Session) =>
    s.exercises.some((ex) => ex.sets.some((set) => set.drop_order > 0));
  const hasUnilateral = (s: Session) =>
    s.exercises.some(
      (ex) =>
        ex.sets.some((set) => set.side !== "both") ||
        /한발|한팔|원레그/.test(ex.exercise_name),
    );
  const hasNotes = (s: Session) => !!s.overall_notes;
  const hasLowConfidence = (s: Session) =>
    s.exercises.some((ex) => ex.sets.some((set) => set.confidence === "low"));

  for (const s of all) {
    if (!picked.has("drop") && hasDrop(s)) picked.set("drop", s);
    if (!picked.has("unilateral") && hasUnilateral(s)) picked.set("unilateral", s);
    if (!picked.has("notes") && hasNotes(s)) picked.set("notes", s);
    if (!picked.has("low") && hasLowConfidence(s)) picked.set("low", s);
  }
  for (const s of all) {
    if (picked.size >= 5) break;
    if (![...picked.values()].includes(s)) picked.set(`extra-${picked.size}`, s);
  }
  return [...picked.values()];
}

const sample = pickRepresentativeSample(data.sessions);
writeFileSync(
  "docs/import/validation-summary.md",
  `# KakaoTalk Import Validation (Sample)\n\n> ${sample.length} representative sessions sampled from ${data.sessions.length} total. Full data is gitignored (personal health data).\n> Demonstrates parsing pipeline accuracy across the patterns found in the source (normal sets, drop sets, unilateral variants, session notes).\n\n${sample.map(renderSession).join("\n\n---\n\n")}\n`,
);

console.log(
  `📄 Full: docs/import/validation-raw-full.md (${data.sessions.length} sessions)`,
);
console.log(
  `📄 Sample: docs/import/validation-summary.md (${sample.length} sessions)`,
);
