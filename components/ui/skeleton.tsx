import * as React from "react";

import { cn } from "@/lib/utils";

/** Static tint placeholder. Deliberately no shimmer: motion is reserved for state changes. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("rounded-md bg-surface-2", className)}
      {...props}
    />
  );
}

export { Skeleton };
