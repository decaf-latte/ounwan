import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchSession } from "@/lib/queries/sessions";
import { fetchUserExercises } from "@/lib/queries/exercises";
import {
  fetchSessionSets,
  fetchLastMainSetsByExercise,
} from "@/lib/queries/sets";
import { fetchSessionCardio } from "@/lib/queries/cardio";
import { SessionRunner } from "./SessionRunner";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ exercises?: string }>;
};

export default async function SessionPage({
  params,
  searchParams,
}: PageProps) {
  const [{ sessionId }, { exercises: exParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await fetchSession(sessionId);
  if (!session) notFound();
  if (session.user_id !== user.id) notFound();

  const [allExercises, existingSets, initialCardio] = await Promise.all([
    fetchUserExercises(user.id),
    fetchSessionSets(sessionId),
    fetchSessionCardio(sessionId),
  ]);

  // 운동 목록 복원 우선순위:
  // 1) DB의 planned_exercise_ids (세트 0개 운동도 복원 — 새로고침/탭 이동에 강함)
  // 2) URL ?exercises= (하위호환)
  // 3) 저장된 세트의 운동들 (구 세션 fallback)
  const planned = session.planned_exercise_ids ?? [];
  const setExIds = [...new Set(existingSets.map((s) => s.exercise_id))];
  const exerciseIds =
    planned.length > 0
      ? [...planned, ...setExIds.filter((id) => !planned.includes(id))]
      : exParam
        ? exParam.split(",").filter(Boolean)
        : setExIds;

  const selectedExercises = exerciseIds
    .map((id) => allExercises.find((e) => e.id === id))
    .filter(<T,>(x: T | undefined): x is T => !!x);

  if (selectedExercises.length === 0) {
    notFound();
  }

  const prefillDefaults = await fetchLastMainSetsByExercise(
    user.id,
    exerciseIds,
  );

  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5">
      <SessionRunner
        session={session}
        exercises={selectedExercises}
        initialSets={existingSets}
        prefillDefaults={prefillDefaults}
        initialCardio={initialCardio}
      />
    </main>
  );
}
