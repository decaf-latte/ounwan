"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  CARDIO_MACHINES,
  type CardioLog,
  type CardioMachine,
} from "@/lib/queries/cardio-types";

type Props = {
  sessionId: string;
  initialCardio: CardioLog[];
  /** 운동 종료 버튼 활성 판단용 — 유산소만 한 세션도 종료 가능하게 */
  onCountChange?: (count: number) => void;
};

const inputCls =
  "min-w-0 w-full p-2 bg-surface border border-accent-soft rounded-md text-body font-bold text-center focus:border-accent focus:outline-none";

export function CardioCard({ sessionId, initialCardio, onCountChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [logs, setLogs] = useState<CardioLog[]>(initialCardio);
  const [machine, setMachine] = useState<CardioMachine | null>(null);
  const [speed, setSpeed] = useState("");
  const [incline, setIncline] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onCountChange?.(logs.length);
  }, [logs.length, onCountChange]);

  const reset = () => {
    setMachine(null);
    setSpeed("");
    setIncline("");
    setDuration("");
  };

  const handleAdd = async () => {
    if (!machine) {
      toast.error("머신을 선택하세요");
      return;
    }
    const dur = parseInt(duration, 10);
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error("시간(분)을 1 이상 입력하세요");
      return;
    }
    const sp = speed ? parseFloat(speed) : null;
    const inc = incline ? parseFloat(incline) : null;
    setSaving(true);
    const { data, error } = await supabase
      .from("cardio_logs")
      .insert({
        session_id: sessionId,
        machine,
        speed: sp,
        incline: inc,
        duration_min: dur,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("유산소 저장 실패");
      return;
    }
    setLogs((c) => [...c, data as CardioLog]);
    reset();
  };

  const handleDelete = async (id: string) => {
    const prev = logs;
    setLogs((c) => c.filter((l) => l.id !== id));
    const { error } = await supabase.from("cardio_logs").delete().eq("id", id);
    if (error) {
      setLogs(prev);
      toast.error("삭제 실패");
    }
  };

  return (
    <Card className="p-4 mt-3">
      <div className="text-h3 font-extrabold text-text">유산소</div>

      {/* 머신 태그 (3택1) */}
      <div className="flex flex-wrap gap-2 mt-2">
        {CARDIO_MACHINES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMachine(m)}
            className={cn(
              "px-3 py-1.5 rounded-full text-caption font-semibold border transition-colors",
              machine === m
                ? "bg-accent text-text border-accent"
                : "bg-surface text-text-muted border-border hover:bg-accent-soft",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* 입력: 속도 / 경사 / 시간 */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <label className="text-caption text-text-muted">
          속도
          <input
            inputMode="decimal"
            type="number"
            step="0.1"
            placeholder="속도"
            className={inputCls}
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </label>
        <label className="text-caption text-text-muted">
          경사/레벨
          <input
            inputMode="decimal"
            type="number"
            step="0.5"
            placeholder="경사"
            className={inputCls}
            value={incline}
            onChange={(e) => setIncline(e.target.value)}
          />
        </label>
        <label className="text-caption text-text-muted">
          시간(분)
          <input
            inputMode="numeric"
            type="number"
            placeholder="분"
            className={inputCls}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>

      <Button
        size="sm"
        className="w-full mt-2"
        disabled={saving || !machine || !duration}
        onClick={handleAdd}
      >
        {saving ? "추가 중..." : "유산소 추가"}
      </Button>

      {/* 추가된 기록 */}
      {logs.length > 0 && (
        <ul className="mt-3 space-y-1">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 p-2 bg-accent-soft rounded-md text-caption text-text"
            >
              <span>
                <strong>{l.machine}</strong>
                {l.speed != null ? ` · 속도 ${l.speed}` : ""}
                {l.incline != null ? ` · 경사 ${l.incline}` : ""}
                {` · ${l.duration_min}분`}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(l.id)}
                aria-label="유산소 기록 삭제"
                className="shrink-0 p-1 rounded text-text-ghost hover:text-danger hover:bg-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
