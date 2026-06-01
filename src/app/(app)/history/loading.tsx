import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-3xl mx-auto space-y-3">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-40" />
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </main>
  );
}
