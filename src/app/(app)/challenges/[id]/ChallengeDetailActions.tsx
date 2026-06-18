"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  toggleChallengeToday,
  endChallenge,
  deleteChallenge,
} from "../actions";

type Props = {
  challengeId: string;
  doneToday: boolean;
  name: string;
};

export function ChallengeDetailActions({
  challengeId,
  doneToday,
  name,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const r = await toggleChallengeToday(challengeId);
      if (!r.ok) toast.error(r.error);
    });
  };

  const end = () => {
    if (!window.confirm(`'${name}' 챌린지를 종료할까요? (기록 유지)`)) return;
    startTransition(async () => {
      const r = await endChallenge(challengeId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("챌린지 종료됨");
      router.push("/challenges");
    });
  };

  const del = () => {
    if (!window.confirm(`'${name}' 챌린지를 삭제할까요? (기록 모두 사라짐)`))
      return;
    startTransition(async () => {
      const r = await deleteChallenge(challengeId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("삭제됨");
      router.push("/challenges");
    });
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={toggle}
        disabled={isPending}
        variant={doneToday ? "default" : "outline"}
        className={cn("flex-1 min-w-[140px]", doneToday && "bg-accent")}
      >
        <Check className="w-4 h-4 mr-1" />
        {doneToday ? "오늘 완료됨 (탭하여 취소)" : "오늘 완료"}
      </Button>
      <Button
        type="button"
        onClick={end}
        disabled={isPending}
        variant="ghost"
        size="sm"
      >
        <Flag className="w-3.5 h-3.5 mr-1" />
        종료
      </Button>
      <Button
        type="button"
        onClick={del}
        disabled={isPending}
        variant="ghost"
        size="sm"
        className="text-danger"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1" />
        삭제
      </Button>
    </div>
  );
}
