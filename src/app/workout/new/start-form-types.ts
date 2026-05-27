import type { BodyPart } from "@/lib/queries/body-parts";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type { TemplateWithBodyParts } from "@/lib/queries/templates";
import type { RecentSetSummary } from "@/lib/queries/sets";

export type StartFormProps = {
  userId: string;
  bodyParts: BodyPart[];
  exercises: ExerciseWithBodyParts[];
  templates: TemplateWithBodyParts[];
  recentSets: RecentSetSummary[];
};
