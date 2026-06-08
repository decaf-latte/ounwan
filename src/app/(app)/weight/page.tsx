import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  fetchRecentWeights,
  pickRepresentativeWeight,
  type BodyWeightRow,
} from "@/lib/queries/body-weights";
import { WeightTrendChart, type WeightPoint } from "./WeightTrendChart";

const TREND_DAYS = 30;

export default async function WeightTrendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = await fetchRecentWeights(user.id, TREND_DAYS);

  // 날짜별 그룹핑 → 대표값(아침 우선)
  const byDate = new Map<string, BodyWeightRow[]>();
  for (const r of rows) {
    const list = byDate.get(r.log_date) ?? [];
    list.push(r);
    byDate.set(r.log_date, list);
  }

  const data: WeightPoint[] = [...byDate.entries()]
    .map(([date, list]) => {
      const rep = pickRepresentativeWeight(list);
      if (rep === null) return null;
      const [, m, d] = date.split("-");
      return {
        date,
        label: `${Number(m)}/${Number(d)}`,
        weight: rep,
      };
    })
    .filter((p): p is WeightPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = data.at(-1);
  const earliest = data[0];
  const delta =
    latest && earliest
      ? Math.round((latest.weight - earliest.weight) * 10) / 10
      : 0;
  const deltaSign = delta >= 0 ? "+" : "";

  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/dashboard"
          aria-label="대시보드로"
          className="p-1 -ml-1 text-text-muted hover:text-text"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-h2 font-extrabold text-text">몸무게 추이</h1>
      </div>

      <div className="text-caption text-text-muted mb-2">
        최근 {TREND_DAYS}일 · 아침 우선
      </div>

      {latest && (
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-display font-extrabold text-text">
            {latest.weight}kg
          </span>
          <span className="text-body text-text-muted">
            {deltaSign}
            {delta}kg
          </span>
        </div>
      )}

      <WeightTrendChart data={data} />
    </main>
  );
}
