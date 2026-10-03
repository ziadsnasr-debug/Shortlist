import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A real <select> (native keyboard, screen-reader and form behaviour) dressed
// to match Input and the Radix Select trigger.
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <span className="relative inline-flex w-full">
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-border-strong bg-card pr-9 pl-3 text-sm text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        "transition-[border-color,box-shadow] duration-(--dur-fast) ease-(--ease-out) hover:border-input",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
    />
  </span>
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
