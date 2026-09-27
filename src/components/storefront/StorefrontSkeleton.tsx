import { Skeleton } from "@/components/ui/skeleton";

export function StorefrontSkeleton() {
  return (
return (
    <main className="min-h-[100dvh] w-full overflow-x-hidden bg-background">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Skeleton className="h-[min(390px,55vw)] min-h-64 rounded-[2rem]" />
          <div className="grid gap-3"><Skeleton className="h-28 rounded-3xl" /><Skeleton className="h-28 rounded-3xl" /></div>
        </div>
        <Skeleton className="mt-10 h-10 w-56 rounded-xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-80 rounded-3xl" />)}
        </div>
      </div>
    </main>
  );
}
}
