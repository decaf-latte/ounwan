import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto">
      <div className="lg:flex lg:gap-6">
        {/* lg+ 좌측 운동 리스트 skeleton */}
        <aside className="hidden lg:block w-56 shrink-0 space-y-2">
          <Skeleton className="h-3 w-20 mb-2" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </aside>

        {/* 메인 영역 skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-40" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
          <Skeleton className="h-12 w-full lg:max-w-xs" />
        </div>
      </div>
    </main>
  );
}
