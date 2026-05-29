import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
    </main>
  );
}
