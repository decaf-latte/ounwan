import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchRecentSessions } from "@/lib/queries/sessions";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sessions = await fetchRecentSessions(user.id, 4);

  return (
    <main className="p-5 max-w-md lg:max-w-3xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">기록</h1>
      <p className="text-body text-text-muted mt-1">최근 4주 운동 기록</p>

      <div className="mt-5 space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {sessions.length === 0 ? (
          <p className="text-body text-text-muted">
            아직 기록이 없어요. 첫 운동을 시작해보세요.
          </p>
        ) : (
          sessions.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-border p-4 bg-surface"
            >
              <div className="text-caption text-text-muted">
                {new Date(s.started_at).toLocaleString("ko-KR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <div className="text-h3 font-bold text-text mt-1">
                {s.bodyParts.length > 0 ? s.bodyParts.join(", ") : "운동"}
              </div>
              <div className="text-body text-text-muted mt-1">
                운동 {s.exerciseCount}개 · 세트 {s.setCount}개
                {s.durationMin ? ` · ${s.durationMin}분` : ""}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
