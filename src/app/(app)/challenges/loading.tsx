import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto space-y-3">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-12 w-full mt-4" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </main>
  );
}
