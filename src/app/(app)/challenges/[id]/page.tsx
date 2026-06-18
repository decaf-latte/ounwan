import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchChallengeById } from "@/lib/queries/challenges";
import { seoulTodayIso } from "@/lib/seoul-date";
import { ChallengeDetailActions } from "./ChallengeDetailActions";

type PageProps = { params: Promise<{ id: string }> };

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function ChallengeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const c = await fetchChallengeById(user.id, id);
  if (!c) notFound();

  const today = seoulTodayIso();
  const logSet = new Set(c.logDates);
  // 시작일~ (start + target_days - 1) 까지 grid
  const totalCells = c.target_days;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = addDays(c.start_date, i);
    return {
      date,
      done: logSet.has(date),
      isToday: date === today,
      isFuture: date > today,
    };
  });

  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto pb-32 lg:pb-5">
      <Link
        href="/challenges"
        className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text"
      >
        <ChevronLeft className="w-4 h-4" />
        챌린지 목록
      </Link>
      <h1 className="text-h2 font-extrabold text-text mt-2">{c.name}</h1>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-display font-extrabold text-accent">
          {c.completedDays}
        </span>
        <span className="text-body text-text-muted">/ {c.target_days}일</span>
        <span className="ml-auto text-caption text-text-muted">
          연속 {c.currentStreak}일
        </span>
      </div>

      <div className="mt-2 text-caption text-text-muted">
        시작 {c.start_date} · 빠진 {c.missedDays}일 / 허용 {c.rest_days_allowed}일
        {!c.onTrack && (
          <span className="ml-2 text-danger font-semibold">⚠ 허용 초과</span>
        )}
      </div>

      <ChallengeDetailActions
        challengeId={c.id}
        doneToday={c.doneToday}
        name={c.name}
      />

      <section className="mt-6">
        <h2 className="text-caption font-semibold text-text-muted mb-2">
          진행 캘린더
        </h2>
        <div className="grid grid-cols-10 gap-1.5">
          {cells.map((cell) => (
            <div
              key={cell.date}
              title={cell.date}
              className="aspect-square rounded-sm relative"
              style={{
                background: cell.done
                  ? "var(--accent)"
                  : cell.isFuture
                    ? "transparent"
                    : "color-mix(in srgb, var(--danger) 18%, transparent)",
                border: cell.isToday
                  ? "1.5px solid var(--accent)"
                  : cell.isFuture
                    ? "1px dashed var(--accent-soft)"
                    : "1px solid var(--line)",
              }}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-3 text-caption text-text-muted">
          <span>
            <span
              className="inline-block w-3 h-3 rounded-sm align-middle mr-1"
              style={{ background: "var(--accent)" }}
            />
            완료
          </span>
          <span>
            <span
              className="inline-block w-3 h-3 rounded-sm align-middle mr-1"
              style={{
                background:
                  "color-mix(in srgb, var(--danger) 18%, transparent)",
              }}
            />
            빠짐
          </span>
          <span>
            <span className="inline-block w-3 h-3 rounded-sm align-middle mr-1 border border-accent-soft border-dashed" />
            예정
          </span>
        </div>
      </section>
    </main>
  );
}
