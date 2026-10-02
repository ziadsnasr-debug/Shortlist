import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminSkeleton() {
  return (
    <div aria-busy="true" className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
      <span role="status" className="sr-only">
        Loading administration
      </span>
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    </div>
  );
}

/** Shown when the API refuses, for example in the local synthetic demo. */
export function AdminUnavailable({
  reason,
  onRetry,
}: {
  reason: string;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="admin-unavailable"
      className="mt-6 grid grid-cols-[minmax(0,1fr)] max-w-2xl gap-3 rounded-lg border border-border bg-surface-2 p-6"
    >
      <Server aria-hidden="true" className="size-5 text-muted-foreground" />
      <h2 id="admin-unavailable">Administration is not available here</h2>
      <p>
        Administration needs the hosted Supabase workspace. The local synthetic
        demo has no members or documents, so there is nothing to manage in it.
        If you expected the hosted workspace, check your connection and try
        again.
      </p>
      {reason && (
        <p className="text-sm">
          <span className="text-foreground">Server message:</span> {reason}
        </p>
      )}
      <div>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </section>
  );
}
