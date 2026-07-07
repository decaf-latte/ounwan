import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto space-y-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-60 w-full mt-2" />
    </main>
  );
}
