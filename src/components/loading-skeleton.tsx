import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <LoadingSkeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        <LoadingSkeleton className="h-32" />
        <LoadingSkeleton className="h-32" />
        <LoadingSkeleton className="h-32" />
      </div>
      <LoadingSkeleton className="h-64" />
    </div>
  );
}
