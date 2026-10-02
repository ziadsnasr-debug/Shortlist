"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

/** The indicator is always full width and scaled with transform, so progress never triggers layout. */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  const ratio =
    typeof value === "number" && max > 0
      ? Math.min(1, Math.max(0, value / max))
      : 0;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={value}
      max={max}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface-2",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="size-full origin-left rounded-full bg-primary transition-transform duration-(--dur-slow) ease-(--ease-out) motion-reduce:transition-none"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
