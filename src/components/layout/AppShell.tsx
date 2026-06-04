import { Sidebar } from "./Sidebar";
import { BottomTab } from "./BottomTab";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 lg:max-w-[calc(100vw-13rem)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
      <BottomTab className="lg:hidden" />
    </div>
  );
}
