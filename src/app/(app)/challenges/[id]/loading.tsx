import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-40 mt-3" />
      <Skeleton className="h-10 w-full mt-2" />
      <Skeleton className="h-48 w-full mt-4" />
    </main>
  );
}
