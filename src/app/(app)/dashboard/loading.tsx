import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full lg:col-span-2" />
      </div>
      <Skeleton className="h-12 w-full lg:max-w-xs mt-6" />
    </main>
  );
}
