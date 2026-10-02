"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> {
  /** Extra props for the scrolling viewport, e.g. `aria-label` or `tabIndex={0}` when it holds no focusable content. */
  viewportProps?: React.ComponentPropsWithoutRef<
    typeof ScrollAreaPrimitive.Viewport
  >;
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, viewportProps, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      {...viewportProps}
      className={cn(
        "size-full rounded-[inherit]",
        focusRing,
        viewportProps?.className,
      )}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none p-px transition-colors duration-(--dur-fast)",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
