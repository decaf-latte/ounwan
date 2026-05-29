import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md mx-auto space-y-4">
      <Skeleton className="h-6 w-40" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
      <Skeleton className="h-12 w-full" />
    </main>
  );
}
