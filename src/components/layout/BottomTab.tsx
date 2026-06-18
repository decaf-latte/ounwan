"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  ListChecks,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/dashboard",
    label: "홈",
    icon: LayoutDashboard,
    matchPrefix: "/dashboard",
  },
  {
    href: "/workout/new",
    label: "운동",
    icon: Dumbbell,
    matchPrefix: "/workout",
  },
  {
    href: "/history",
    label: "기록",
    icon: BarChart3,
    matchPrefix: "/history",
  },
  {
    href: "/routines",
    label: "루틴",
    icon: ListChecks,
    matchPrefix: "/routines",
  },
  {
    href: "/challenges",
    label: "챌린지",
    icon: Trophy,
    matchPrefix: "/challenges",
  },
];

export function BottomTab({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-border",
        "backdrop-blur-xl",
        "flex justify-around items-stretch h-14 pb-safe",
        className,
      )}
      style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}
    >
      {TABS.map(({ href, label, icon: Icon, matchPrefix }) => {
        const active = pathname.startsWith(matchPrefix);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-caption transition-colors",
              active ? "text-accent" : "text-text-muted",
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
