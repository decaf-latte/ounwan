"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createChallenge,
  toggleChallengeToday,
  deleteChallenge,
} from "./actions";
import type { ChallengeProgress } from "@/lib/queries/challenges";

type Props = { challenges: ChallengeProgress[] };

export function ChallengesView({ challenges }: Props) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetDays, setTargetDays] = useState("100");
  const [restDays, setRestDays] = useState("5");

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createChallenge({
        name,
        targetDays: Number.parseInt(targetDays, 10),
        restDaysAllowed: Number.parseInt(restDays, 10),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("챌린지 시작!");
      setCreateOpen(false);
      setName("");
      setTargetDays("100");
      setRestDays("5");
    });
  };

  const handleToggle = (id: string) => {
    startTransition(async () => {
      const result = await toggleChallengeToday(id);
      if (!result.ok) toast.error(result.error);
    });
  };

  const handleDelete = (id: string, n: string) => {
    if (!window.confirm(`'${n}' 챌린지를 삭제할까요? (기록 모두 사라짐)`)) return;
    startTransition(async () => {
      const result = await deleteChallenge(id);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <div className="space-y-4 mt-4">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger
          render={
            <Button type="button" className="w-full" size="lg">
              <Trophy className="w-4 h-4 mr-1" />새 챌린지 시작
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 챌린지</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ch-name">이름</Label>
              <Input
                id="ch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="플랭크 100일 챌린지"
                maxLength={60}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="ch-days">목표 일수</Label>
                <Input
                  id="ch-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={targetDays}
                  onChange={(e) => setTargetDays(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="ch-rest">허용 휴식일</Label>
                <Input
                  id="ch-rest"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={restDays}
                  onChange={(e) => setRestDays(e.target.value)}
                />
              </div>
            </div>
            <p className="text-caption text-text-muted">
              허용 휴식일을 넘기면 챌린지 실패 상태로 표시돼요. (기록 자체는 유지)
            </p>
          </div>
          <DialogFooter>
            <DialogClose
              disabled={isPending}
              render={<Button variant="ghost">취소</Button>}
            />
            <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
              {isPending ? "생성 중..." : "시작"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {challenges.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <div className="text-body text-text-muted">
            아직 챌린지가 없어요
          </div>
          <div className="text-caption text-text-muted mt-1">
            위 버튼으로 첫 챌린지를 시작해보세요
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {challenges.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/challenges/${c.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="text-h3 font-extrabold text-text">
                      {c.name}
                    </div>
                    <div className="text-caption text-text-muted mt-0.5">
                      {c.completedDays} / {c.target_days}일 · 연속 {c.currentStreak}일
                      {!c.onTrack && (
                        <span className="ml-2 text-danger font-semibold">
                          ⚠ 허용 휴식일 초과
                        </span>
                      )}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.name)}
                    aria-label="삭제"
                    className="p-1 text-text-muted hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 h-2 bg-surface border border-accent-soft rounded-full overflow-hidden">
                  <div
                    className="h-full transition-[width]"
                    style={{
                      width: `${Math.min(100, (c.completedDays / c.target_days) * 100)}%`,
                      background: c.onTrack ? "var(--accent)" : "var(--danger)",
                    }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-caption text-text-muted">
                  <span>
                    빠진 {c.missedDays}일 / 허용 {c.rest_days_allowed}일
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={c.doneToday ? "default" : "outline"}
                    onClick={() => handleToggle(c.id)}
                    disabled={isPending}
                    className={cn(c.doneToday && "bg-accent")}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {c.doneToday ? "오늘 완료됨" : "오늘 완료"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
