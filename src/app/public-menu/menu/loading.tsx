export default function PublicMenuLoading() {
  return (
    <div className="min-h-screen bg-[var(--pm-surface,#fcf9f8)]">
      <div className="fixed top-0 z-40 h-14 w-full border-b border-black/[0.06] bg-[#fcf9f8]/80 backdrop-blur-md md:h-16" />
      <div className="mx-auto max-w-[1024px] px-4 pt-24 md:px-8">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-neutral-200/80" />
        <div className="mb-8 h-8 w-56 animate-pulse rounded-md bg-neutral-200/80 md:w-72" />
        <div className="mb-6 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-neutral-200/80" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-black/[0.06] bg-white"
            >
              <div className="aspect-[4/3] animate-pulse bg-neutral-200/80" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200/70" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
