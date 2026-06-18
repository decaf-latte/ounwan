"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  ListChecks,
  Trophy,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/app/(app)/dashboard/actions";

const NAV = [
  {
    href: "/dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    matchPrefix: "/dashboard",
  },
  {
    href: "/workout/new",
    label: "운동 시작",
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

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "w-52 flex-col p-4 bg-surface border-r border-border",
        className,
      )}
    >
      <Link href="/dashboard" className="text-h2 font-extrabold mb-6 block">
        오운완
      </Link>
      <ul className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon, matchPrefix }) => {
          const active = pathname.startsWith(matchPrefix);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-body transition-colors",
                  "rounded-[var(--radius-md)]",
                  active
                    ? "text-accent font-semibold bg-accent-soft"
                    : "text-text-muted hover:bg-accent-soft hover:text-text",
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-1 mt-6">
        <ThemeToggle />
        <form action={signOut}>
          <Button type="submit" size="icon" variant="ghost" aria-label="로그아웃">
            <LogOut className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </nav>
  );
}
